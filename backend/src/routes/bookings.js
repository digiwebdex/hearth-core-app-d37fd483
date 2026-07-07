const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const { authenticate, requirePermission, prisma } = require("../middleware/auth");
const { dispatchTenantAutomation } = require("../services/tenantAutomationService");
const { enrichBookingFromPackage } = require("../services/packageLinkage");
const {
  flattenServiceDetails,
  buildListWhere,
  pickServiceDetailsPayload,
} = require("../lib/bookingServiceDetails");
const { validateTransition } = require("../lib/statusEngine");

// Central Status Engine guard for the Booking lifecycle (docs/v2-master/11 §10.3).
// Returns a 400-shaped payload when the requested status is unknown or the
// transition is not permitted from the booking's current status; null when OK.
function checkBookingStatus(currentStatus, nextStatus) {
  const result = validateTransition("bookingStatus", currentStatus, nextStatus);
  if (result.ok) return null;
  const msg = result.reason === "unknown_status"
    ? `Unknown booking status "${nextStatus}"`
    : `Cannot change booking status from "${currentStatus}" to "${nextStatus}"`;
  return { message: msg, code: "INVALID_STATUS_TRANSITION", allowedNextStatuses: result.allowed };
}

const ALLOWED_DOC_MIMES = new Set([
  "application/pdf",
  "image/jpeg", "image/jpg", "image/png", "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const upload = multer({
  dest: process.env.UPLOAD_DIR || path.join(__dirname, "../../uploads"),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_DOC_MIMES.has(file.mimetype)) return cb(null, true);
    cb(new Error(`File type not allowed: ${file.mimetype}`));
  },
});
const BOOKING_LIST_INCLUDE = {
  client: { select: { id: true, name: true } },
  agent: { select: { id: true, name: true } },
  travelPackage: { select: { id: true, title: true, code: true, serviceType: true } },
  agentCommission: true,
};
const BOOKING_DETAIL_INCLUDE = {
  ...BOOKING_LIST_INCLUDE,
  segments: true,
  travelers: true,
  checklist: true,
};

router.use(authenticate);

function formatBooking(record) {
  if (!record) return null;
  const { client, agent, travelPackage, agentCommission, ...booking } = record;
  const flattened = flattenServiceDetails(booking);
  return {
    ...flattened,
    clientName: client?.name || flattened.clientName || "",
    agentName: agent?.name || flattened.agentName || "",
    packageTitleSnapshot: flattened.packageTitleSnapshot || travelPackage?.title || null,
    packageCodeSnapshot: flattened.packageCodeSnapshot || travelPackage?.code || null,
    serviceType: flattened.serviceType || travelPackage?.serviceType || null,
    agentCommissionAmount: agentCommission?.agentCommissionAmount ?? null,
    agentCommissionStatus: agentCommission?.agentCommissionStatus ?? null,
  };
}

async function getTenantBooking(bookingId, tenantId, include = BOOKING_LIST_INCLUDE) {
  return prisma.booking.findFirst({
    where: { id: bookingId, tenantId },
    include,
  });
}

async function ensureBookingExists(req, res, include = BOOKING_LIST_INCLUDE) {
  const booking = await getTenantBooking(req.params.id, req.tenantId, include);
  if (!booking) {
    res.status(404).json({ message: "Booking not found" });
    return null;
  }
  return booking;
}

async function resolveClientForBooking(data, tenantId, existingBooking = null) {
  const next = { ...data };
  if (!("clientId" in next) && !("clientName" in next)) {
    return next;
  }

  const clientIdValue = String(next.clientId || "").trim();
  const clientNameValue = String(next.clientName || "").trim();

  if (clientIdValue) {
    const client = await prisma.client.findFirst({
      where: { id: clientIdValue, tenantId },
      select: { id: true },
    });
    if (client) {
      next.clientId = client.id;
      delete next.clientName;
      return next;
    }
  }

  if (clientNameValue) {
    let client = await prisma.client.findFirst({
      where: {
        tenantId,
        name: { equals: clientNameValue, mode: "insensitive" },
      },
      select: { id: true },
    });

    if (!client) {
      client = await prisma.client.create({
        data: {
          name: clientNameValue,
          phone: String(next.clientPhone || "").trim(),
          email: String(next.clientEmail || "").trim(),
          tenantId,
        },
        select: { id: true },
      });
    } else if (next.clientPhone || next.clientEmail) {
      await prisma.client.update({
        where: { id: client.id },
        data: {
          ...(next.clientPhone ? { phone: String(next.clientPhone).trim() } : {}),
          ...(next.clientEmail ? { email: String(next.clientEmail).trim() } : {}),
        },
      }).catch(() => {});
    }

    next.clientId = client.id;
    delete next.clientName;
    return next;
  }

  if (!existingBooking?.clientId) {
    throw new Error("Client is required");
  }

  delete next.clientName;
  delete next.clientId;
  return next;
}

async function resolveAgentForBooking(data, tenantId) {
  const next = { ...data };
  if (!("agentId" in next)) {
    return next;
  }

  const agentValue = String(next.agentId || "").trim();
  if (!agentValue) {
    next.agentId = null;
    return next;
  }

  const agent = await prisma.agent.findFirst({
    where: {
      tenantId,
      commissionProfile: { status: "active" },
      OR: [
        { id: agentValue },
        { name: { equals: agentValue, mode: "insensitive" } },
        { email: { equals: agentValue, mode: "insensitive" } },
        { phone: agentValue },
      ],
    },
    select: { id: true },
  });

  next.agentId = agent?.id || null;
  return next;
}

function stripCommissionFields(data) {
  const next = { ...data };
  delete next.agentCommissionAmount;
  delete next.agentCommissionStatus;
  delete next.agentCommission;
  return next;
}

async function syncAgentCommission(bookingId, data, tenantId, existingBooking = null) {
  try {
    const agentId = data.agentId !== undefined ? data.agentId : existingBooking?.agentId ?? null;
    const amount = data.amount !== undefined ? Number(data.amount) : Number(existingBooking?.amount ?? 0);
    const existingCommission = existingBooking?.agentCommission;

    if (existingCommission?.agentCommissionStatus === "paid") {
      return;
    }

    if (!agentId) {
      await prisma.bookingAgentCommission.deleteMany({ where: { bookingId } }).catch(() => {});
      return;
    }

    const profile = await prisma.agentCommissionProfile.findFirst({
      where: {
        agentId,
        status: "active",
        agent: { tenantId },
      },
      select: { commissionRate: true },
    });

    if (!profile) {
      await prisma.bookingAgentCommission.deleteMany({ where: { bookingId } }).catch(() => {});
      return;
    }

    const rate = Number(profile.commissionRate) || 0;
    const commissionAmount = Math.round(amount * (rate / 100) * 100) / 100;

    await prisma.bookingAgentCommission.upsert({
      where: { bookingId },
      create: {
        bookingId,
        agentCommissionAmount: commissionAmount,
        agentCommissionStatus: "pending",
      },
      update: {
        agentCommissionAmount: commissionAmount,
      },
    });
  } catch (err) {
    console.error("[commission] sync failed:", err.message);
  }
}

async function normalizeBookingInput(data, tenantId, existingBooking = null) {
  // Resolve the client/agent from the RAW top-level fields FIRST. pickServiceDetailsPayload
  // buries any non-scalar key (clientName/clientPhone/clientEmail) inside serviceDetails,
  // which would leave resolveClientForBooking unable to create/link the client — the
  // inline "new client" booking path then 500s with "Argument `client` is missing".
  let next = stripCommissionFields({ ...data });
  next = await resolveClientForBooking(next, tenantId, existingBooking);
  next = await resolveAgentForBooking(next, tenantId);
  next = pickServiceDetailsPayload(next);
  if (next.packageId && !existingBooking?.packageId) {
    next = await enrichBookingFromPackage(next, tenantId);
  }
  // Derive profit from the effective amount/cost when the caller omits it, mirroring the
  // package and quotation-conversion paths. Uses existing values for the field not being
  // changed so a partial update (e.g. amount only) never zeroes profit.
  if (next.profit === undefined && (next.amount !== undefined || next.cost !== undefined)) {
    const amt = next.amount !== undefined ? Number(next.amount) || 0 : Number(existingBooking?.amount) || 0;
    const cst = next.cost !== undefined ? Number(next.cost) || 0 : Number(existingBooking?.cost) || 0;
    next.profit = amt - cst;
  }
  if (!next.opsStatus && !existingBooking?.opsStatus) {
    next.opsStatus = "pending";
  }
  if (next.followUpDate !== undefined) {
    next.followUpDate = next.followUpDate ? new Date(next.followUpDate) : null;
  }
  return next;
}

router.get("/", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const where = buildListWhere(req.tenantId, req.query);
    const limitRaw = parseInt(String(req.query.limit || "500"), 10);
    const offsetRaw = parseInt(String(req.query.offset || "0"), 10);
    const take = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 1000) : 500;
    const skip = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

    const bookings = await prisma.booking.findMany({
      where,
      include: BOOKING_LIST_INCLUDE,
      orderBy: { createdAt: "desc" },
      take,
      skip,
    });
    res.json(bookings.map(formatBooking));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const booking = await getTenantBooking(req.params.id, req.tenantId, BOOKING_DETAIL_INCLUDE);
    if (!booking) return res.status(404).json({ message: "Not found" });
    res.json(formatBooking(booking));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", requirePermission("bookings", "create"), async (req, res) => {
  try {
    const data = await normalizeBookingInput({ ...req.body, tenantId: req.tenantId }, req.tenantId);
    if (data.status !== undefined) {
      const invalid = checkBookingStatus(null, data.status);
      if (invalid) return res.status(400).json(invalid);
    }
    const booking = await prisma.booking.create({ data });
    await syncAgentCommission(booking.id, data, req.tenantId).catch(() => {});
    const hydratedBooking = await getTenantBooking(booking.id, req.tenantId, BOOKING_LIST_INCLUDE);

    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true, email: true, role: true } });
    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId }, select: { name: true } });
    await prisma.auditLog.create({
      data: {
        actorId: req.userId,
        actorName: user?.name || "",
        actorEmail: user?.email || "",
        actorRole: user?.role || "",
        tenantId: req.tenantId,
        tenantName: tenant?.name || null,
        module: "booking",
        action: "created",
        targetType: "booking",
        targetId: booking.id,
        targetLabel: hydratedBooking?.title || hydratedBooking?.client?.name || hydratedBooking?.destination || booking.id,
      },
    }).catch(() => {});

    const client = hydratedBooking?.clientId
      ? await prisma.client.findFirst({
        where: { id: hydratedBooking.clientId, tenantId: req.tenantId },
        select: { name: true, phone: true },
      })
      : null;

    dispatchTenantAutomation("booking_created", {
      tenantId: req.tenantId,
      actorUserId: req.userId,
      payload: {
        relatedType: "booking",
        relatedId: booking.id,
        bookingId: booking.id,
        bookingTitle: hydratedBooking?.title || booking.title,
        bookingType: hydratedBooking?.type || booking.type,
        bookingStatus: hydratedBooking?.status || booking.status,
        amount: hydratedBooking?.amount ?? booking.amount,
        clientName: client?.name || hydratedBooking?.clientName || "",
        clientPhone: client?.phone || "",
        tenantName: tenant?.name || "",
      },
    }).catch((err) => console.error("[automation] booking_created:", err.message));

    res.status(201).json(formatBooking(hydratedBooking));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/:id", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const existing = await ensureBookingExists(req, res, BOOKING_LIST_INCLUDE);
    if (!existing) return;

    const data = await normalizeBookingInput(req.body, req.tenantId, existing);
    if (data.status !== undefined && data.status !== existing.status) {
      const invalid = checkBookingStatus(existing.status, data.status);
      if (invalid) return res.status(400).json(invalid);
    }
    const result = await prisma.booking.updateMany({ where: { id: req.params.id, tenantId: req.tenantId }, data });
    if (!result.count) return res.status(404).json({ message: "Not found" });

    await syncAgentCommission(req.params.id, data, req.tenantId, existing).catch(() => {});

    const updated = await getTenantBooking(req.params.id, req.tenantId, BOOKING_LIST_INCLUDE);
    res.json(formatBooking(updated));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/:id/commission", requirePermission("agents", "approve"), async (req, res) => {
  try {
    const existing = await ensureBookingExists(req, res, BOOKING_LIST_INCLUDE);
    if (!existing) return;

    const status = String(req.body.status || "").trim().toLowerCase();
    if (!["pending", "paid"].includes(status)) {
      return res.status(400).json({ message: "status must be pending or paid" });
    }

    if (!existing.agentCommission) {
      return res.status(400).json({ message: "No commission record for this booking" });
    }

    await prisma.bookingAgentCommission.update({
      where: { bookingId: req.params.id },
      data: { agentCommissionStatus: status },
    });

    const updated = await getTenantBooking(req.params.id, req.tenantId, BOOKING_LIST_INCLUDE);
    res.json(formatBooking(updated));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", requirePermission("bookings", "delete"), async (req, res) => {
  try {
    const result = await prisma.booking.deleteMany({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /bookings/follow-ups — inquiry bookings that need follow-up (the "Inquiries to follow up" widget)
router.get("/board/follow-ups", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { tenantId: req.tenantId, status: "inquiry" },
      include: BOOKING_LIST_INCLUDE,
      orderBy: [{ followUpDate: "asc" }, { createdAt: "desc" }],
    });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const formatted = bookings.map(formatBooking);
    const due = [];
    const upcoming = [];
    const noDate = [];
    for (const b of formatted) {
      if (!b.followUpDate) { noDate.push(b); continue; }
      const fd = new Date(b.followUpDate);
      if (fd <= endOfToday) due.push(b);
      else upcoming.push(b);
    }
    res.json({
      due,        // overdue + today — call these now
      upcoming,   // snoozed to a future date
      noDate,     // inquiries with no follow-up date set
      counts: { due: due.length, upcoming: upcoming.length, noDate: noDate.length, total: formatted.length },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /bookings/:id/follow-up — set/snooze follow-up date + note, or convert to confirmed
router.patch("/:id/follow-up", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const existing = await getTenantBooking(req.params.id, req.tenantId, BOOKING_LIST_INCLUDE);
    if (!existing) return res.status(404).json({ message: "Not found" });

    if (req.body.status !== undefined && req.body.status !== existing.status) {
      const invalid = checkBookingStatus(existing.status, req.body.status);
      if (invalid) return res.status(400).json(invalid);
    }

    const data = {};
    if (req.body.followUpDate !== undefined) data.followUpDate = req.body.followUpDate ? new Date(req.body.followUpDate) : null;
    if (req.body.followUpNote !== undefined) data.followUpNote = req.body.followUpNote || null;
    if (req.body.status !== undefined) data.status = req.body.status;

    await prisma.booking.updateMany({ where: { id: req.params.id, tenantId: req.tenantId }, data });

    if (req.body.status && req.body.status !== existing.status) {
      await prisma.bookingTimelineEvent.create({
        data: {
          bookingId: req.params.id,
          type: "status_change",
          content: `Status: ${existing.status} → ${req.body.status}`,
          oldStatus: existing.status,
          newStatus: req.body.status,
          createdBy: req.userId,
        },
      }).catch(() => {});
    }

    const updated = await getTenantBooking(req.params.id, req.tenantId, BOOKING_LIST_INCLUDE);
    res.json(formatBooking(updated));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/:id/status", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const old = await getTenantBooking(req.params.id, req.tenantId, BOOKING_LIST_INCLUDE);
    if (!old) return res.status(404).json({ message: "Not found" });

    if (req.body.status !== old.status) {
      const invalid = checkBookingStatus(old.status, req.body.status);
      if (invalid) return res.status(400).json(invalid);
    }

    await prisma.booking.updateMany({ where: { id: req.params.id, tenantId: req.tenantId }, data: { status: req.body.status } });
    await prisma.bookingTimelineEvent.create({
      data: {
        bookingId: req.params.id,
        type: "status_change",
        content: `Status: ${old.status} → ${req.body.status}`,
        oldStatus: old.status,
        newStatus: req.body.status,
        createdBy: req.userId,
      },
    });

    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true, email: true, role: true } });
    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId }, select: { name: true } });
    await prisma.auditLog.create({
      data: {
        actorId: req.userId,
        actorName: user?.name || "",
        actorEmail: user?.email || "",
        actorRole: user?.role || "",
        tenantId: req.tenantId,
        tenantName: tenant?.name || null,
        module: "booking",
        action: "status_changed",
        targetType: "booking",
        targetId: req.params.id,
        targetLabel: old.title || old.client?.name || old.destination || req.params.id,
        oldValue: old.status,
        newValue: req.body.status,
      },
    }).catch(() => {});

    const updated = await getTenantBooking(req.params.id, req.tenantId, BOOKING_LIST_INCLUDE);
    res.json(formatBooking(updated));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id/segments", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const booking = await ensureBookingExists(req, res);
    if (!booking) return;
    res.json(await prisma.bookingSegment.findMany({ where: { bookingId: req.params.id } }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post("/:id/segments", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const booking = await ensureBookingExists(req, res);
    if (!booking) return;
    res.status(201).json(await prisma.bookingSegment.create({ data: { ...req.body, bookingId: req.params.id } }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.delete("/:id/segments/:segId", requirePermission("bookings", "delete"), async (req, res) => {
  try {
    const booking = await ensureBookingExists(req, res);
    if (!booking) return;
    const result = await prisma.bookingSegment.deleteMany({ where: { id: req.params.segId, bookingId: req.params.id } });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id/travelers", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const booking = await ensureBookingExists(req, res);
    if (!booking) return;
    res.json(await prisma.bookingTraveler.findMany({ where: { bookingId: req.params.id } }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post("/:id/travelers", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const booking = await ensureBookingExists(req, res);
    if (!booking) return;
    res.status(201).json(await prisma.bookingTraveler.create({ data: { ...req.body, bookingId: req.params.id } }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.delete("/:id/travelers/:travId", requirePermission("bookings", "delete"), async (req, res) => {
  try {
    const booking = await ensureBookingExists(req, res);
    if (!booking) return;
    const result = await prisma.bookingTraveler.deleteMany({ where: { id: req.params.travId, bookingId: req.params.id } });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id/checklist", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const booking = await ensureBookingExists(req, res);
    if (!booking) return;
    res.json(await prisma.bookingChecklistItem.findMany({ where: { bookingId: req.params.id } }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post("/:id/checklist", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const booking = await ensureBookingExists(req, res);
    if (!booking) return;
    res.status(201).json(await prisma.bookingChecklistItem.create({ data: { label: req.body.label, bookingId: req.params.id } }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.patch("/:id/checklist/:itemId", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const booking = await ensureBookingExists(req, res);
    if (!booking) return;
    const result = await prisma.bookingChecklistItem.updateMany({
      where: { id: req.params.itemId, bookingId: req.params.id },
      data: { done: !!req.body.done, doneAt: req.body.done ? new Date() : null, doneBy: req.body.done ? req.userId : null },
    });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json(await prisma.bookingChecklistItem.findFirst({ where: { id: req.params.itemId, bookingId: req.params.id } }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id/timeline", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const booking = await ensureBookingExists(req, res);
    if (!booking) return;
    res.json(await prisma.bookingTimelineEvent.findMany({ where: { bookingId: req.params.id }, orderBy: { createdAt: "desc" } }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post("/:id/timeline", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const booking = await ensureBookingExists(req, res);
    if (!booking) return;
    res.status(201).json(await prisma.bookingTimelineEvent.create({ data: { ...req.body, bookingId: req.params.id, createdBy: req.userId } }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id/documents", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const booking = await ensureBookingExists(req, res);
    if (!booking) return;
    res.json(await prisma.bookingDocument.findMany({ where: { bookingId: req.params.id }, orderBy: { uploadedAt: "desc" } }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post("/:id/documents", requirePermission("bookings", "edit"), upload.single("file"), async (req, res) => {
  try {
    const booking = await ensureBookingExists(req, res);
    if (!booking) return;
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const url = `/uploads/${req.file.filename}`;
    res.status(201).json(await prisma.bookingDocument.create({
      data: { bookingId: req.params.id, name: req.file.originalname, type: req.file.mimetype, url, uploadedBy: req.userId },
    }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.delete("/:id/documents/:docId", requirePermission("bookings", "delete"), async (req, res) => {
  try {
    const booking = await ensureBookingExists(req, res);
    if (!booking) return;
    const result = await prisma.bookingDocument.deleteMany({ where: { id: req.params.docId, bookingId: req.params.id } });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Additive exports (router itself is unchanged/still the default export Express
// mounts) — lets type-scoped booking routes (e.g. routes/airTicketBookings.js)
// reuse this file's client/agent resolution, commission sync, and response
// shaping instead of re-implementing them. See docs/v2-master/11-Architecture-Freeze.md §5.
module.exports = Object.assign(router, {
  normalizeBookingInput,
  formatBooking,
  getTenantBooking,
  BOOKING_LIST_INCLUDE,
  BOOKING_DETAIL_INCLUDE,
  syncAgentCommission,
  upload,
});
