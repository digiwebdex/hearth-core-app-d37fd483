// Visa Booking — the second complete booking module, reusing the Air
// Ticket reference implementation's architecture exactly
// (docs/v2-master/11-Architecture-Freeze.md §5, docs/v2-master/12-Implementation-Sequence.md Phase 4).
//
// Additive: /api/bookings (all types, including visa) is completely
// unchanged. This route is a type-scoped, validated, richer alternative
// entry point mounted at /api/visa-bookings.
//
// Beyond what Air Ticket needed, Visa integrates with the existing
// VisaApplication model (a dedicated visa case-tracking table that already
// existed before this module — see "Visa Tracking" below) and composes
// Customer Engine for "Passport Information" instead of querying Client
// directly a second time.

const router = require("express").Router();
const { authenticate, requirePermission, checkPlanLimit, prisma } = require("../middleware/auth");
const { dispatchTenantAutomation } = require("../services/tenantAutomationService");
const { parseServiceDetails } = require("../lib/bookingServiceDetails");
const {
  normalizeBookingInput,
  formatBooking,
  getTenantBooking,
  BOOKING_LIST_INCLUDE,
  BOOKING_DETAIL_INCLUDE,
  syncAgentCommission,
  upload,
} = require("./bookings");
const { BOOKING_TYPE_ID, BOOKING_TYPE_VALUE, SERVICE_TYPE_VALUE, resolveVisaDomain } = require("../lib/visaDomain");
const { validateVisaBooking } = require("../lib/visaBookingValidation");
const {
  generateBookingReference,
  generatePublicReference,
  generateQrReference,
} = require("../lib/bookingIdentityEngine");
const { resolveStatus } = require("../lib/statusEngine");
const { pricingSummary } = require("../lib/bookingPricing");
const { resolveCustomerContext } = require("../lib/customerEngine");

router.use(authenticate);

function enrichVisaBooking(record) {
  const booking = formatBooking(record);
  return {
    ...booking,
    statusContext: resolveStatus("bookingStatus", booking.status),
    pricing: pricingSummary({ buyingPrice: booking.cost, sellingPrice: booking.amount, paidAmount: booking.paidAmount }),
  };
}

async function getVisaBooking(bookingId, tenantId, include = BOOKING_LIST_INCLUDE) {
  return prisma.booking.findFirst({ where: { id: bookingId, tenantId, type: BOOKING_TYPE_VALUE }, include });
}

async function ensureVisaBookingExists(req, res, include = BOOKING_LIST_INCLUDE) {
  const booking = await getVisaBooking(req.params.id, req.tenantId, include);
  if (!booking) {
    res.status(404).json({ message: "Visa booking not found" });
    return null;
  }
  return booking;
}

function mergeForValidation(existing, incoming) {
  const flattenedExisting = existing ? { ...existing, ...parseServiceDetails(existing.serviceDetails) } : {};
  return { ...flattenedExisting, ...incoming };
}

// ── Visa Booking Domain ──
router.get("/domain", (_req, res) => {
  res.json(resolveVisaDomain());
});

// ── Visa Booking CRUD ──
router.get("/", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const limitRaw = parseInt(String(req.query.limit || "500"), 10);
    const offsetRaw = parseInt(String(req.query.offset || "0"), 10);
    const take = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 1000) : 500;
    const skip = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

    const bookings = await prisma.booking.findMany({
      where: { tenantId: req.tenantId, type: BOOKING_TYPE_VALUE },
      include: BOOKING_LIST_INCLUDE,
      orderBy: { createdAt: "desc" },
      take,
      skip,
    });
    res.json(bookings.map(enrichVisaBooking));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const booking = await getVisaBooking(req.params.id, req.tenantId, BOOKING_DETAIL_INCLUDE);
    if (!booking) return res.status(404).json({ message: "Visa booking not found" });
    res.json({ ...enrichVisaBooking(booking), bookingTypeContext: resolveVisaDomain().bookingContext });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", requirePermission("bookings", "create"), checkPlanLimit("bookings"), async (req, res) => {
  try {
    const incoming = { ...req.body, type: BOOKING_TYPE_VALUE, serviceType: SERVICE_TYPE_VALUE };
    const validation = validateVisaBooking(incoming);
    if (!validation.valid) return res.status(400).json({ message: "Validation failed", errors: validation.errors });

    const data = await normalizeBookingInput({ ...incoming, tenantId: req.tenantId }, req.tenantId);
    const booking = await prisma.booking.create({ data });

    // Real (persisted) identity via Booking Identity Engine, stored in
    // serviceDetails — no schema change, same pattern as Air Ticket.
    const typeScopedCount = await prisma.booking.count({ where: { tenantId: req.tenantId, type: BOOKING_TYPE_VALUE } });
    const bookingReference = generateBookingReference({ bookingTypeId: BOOKING_TYPE_ID, year: new Date().getFullYear(), sequence: typeScopedCount });
    const publicReference = generatePublicReference(booking.id);
    const qrReference = generateQrReference({ bookingTypeId: BOOKING_TYPE_ID, publicReference });
    await prisma.booking.update({
      where: { id: booking.id },
      data: { serviceDetails: { ...parseServiceDetails(booking.serviceDetails), bookingReference, publicReference, qrReference } },
    });

    await syncAgentCommission(booking.id, data, req.tenantId).catch(() => {});

    const hydrated = await getTenantBooking(booking.id, req.tenantId, BOOKING_LIST_INCLUDE);

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
        targetLabel: hydrated?.title || hydrated?.client?.name || bookingReference || booking.id,
      },
    }).catch(() => {});

    const client = hydrated?.clientId
      ? await prisma.client.findFirst({ where: { id: hydrated.clientId, tenantId: req.tenantId }, select: { name: true, phone: true } })
      : null;
    dispatchTenantAutomation("booking_created", {
      tenantId: req.tenantId,
      actorUserId: req.userId,
      payload: {
        relatedType: "booking",
        relatedId: booking.id,
        bookingId: booking.id,
        bookingTitle: hydrated?.title || booking.title,
        bookingType: BOOKING_TYPE_VALUE,
        bookingStatus: hydrated?.status || booking.status,
        amount: hydrated?.amount ?? booking.amount,
        clientName: client?.name || hydrated?.clientName || "",
        clientPhone: client?.phone || "",
        tenantName: tenant?.name || "",
      },
    }).catch((err) => console.error("[automation] booking_created:", err.message));

    res.status(201).json(enrichVisaBooking(hydrated));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/:id", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const existing = await ensureVisaBookingExists(req, res, BOOKING_LIST_INCLUDE);
    if (!existing) return;

    const merged = mergeForValidation(existing, req.body);
    const validation = validateVisaBooking(merged);
    if (!validation.valid) return res.status(400).json({ message: "Validation failed", errors: validation.errors });

    const data = await normalizeBookingInput({ ...req.body, type: BOOKING_TYPE_VALUE }, req.tenantId, existing);
    const result = await prisma.booking.updateMany({ where: { id: req.params.id, tenantId: req.tenantId, type: BOOKING_TYPE_VALUE }, data });
    if (!result.count) return res.status(404).json({ message: "Visa booking not found" });

    await syncAgentCommission(req.params.id, data, req.tenantId, existing).catch(() => {});

    const updated = await getTenantBooking(req.params.id, req.tenantId, BOOKING_LIST_INCLUDE);
    res.json(enrichVisaBooking(updated));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", requirePermission("bookings", "delete"), async (req, res) => {
  try {
    const result = await prisma.booking.deleteMany({ where: { id: req.params.id, tenantId: req.tenantId, type: BOOKING_TYPE_VALUE } });
    if (!result.count) return res.status(404).json({ message: "Visa booking not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Visa Tracking (reuses the existing, pre-existing VisaApplication model) ──
router.get("/:id/tracking", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const booking = await ensureVisaBookingExists(req, res);
    if (!booking) return;
    const application = await prisma.visaApplication.findFirst({ where: { bookingId: req.params.id, tenantId: req.tenantId } });
    if (!application) return res.json(null);
    res.json({ ...application, statusContext: resolveStatus("visaApplicationStatus", application.status) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post("/:id/tracking", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const booking = await ensureVisaBookingExists(req, res);
    if (!booking) return;
    const existing = await prisma.visaApplication.findFirst({ where: { bookingId: req.params.id, tenantId: req.tenantId } });
    if (existing) return res.status(409).json({ message: "Visa tracking already exists for this booking — use PATCH to update it" });

    const flattened = { ...booking, ...parseServiceDetails(booking.serviceDetails) };
    const application = await prisma.visaApplication.create({
      data: {
        tenantId: req.tenantId,
        bookingId: req.params.id,
        clientId: booking.clientId || null,
        applicantName: req.body.applicantName || flattened.clientName || "",
        passportNumber: req.body.passportNumber || flattened.passportNumber || null,
        nationality: req.body.nationality || null,
        visaType: req.body.visaType || flattened.visaType || null,
        destination: req.body.destination || flattened.visaCountry || null,
        appliedDate: req.body.appliedDate ? new Date(req.body.appliedDate) : null,
        appointmentDate: req.body.appointmentDate ? new Date(req.body.appointmentDate) : null,
        decisionDate: req.body.decisionDate ? new Date(req.body.decisionDate) : null,
        expiryDate: req.body.expiryDate ? new Date(req.body.expiryDate) : null,
        status: req.body.status || "not_applied",
        referenceNo: req.body.referenceNo || null,
        embassyFee: req.body.embassyFee !== undefined ? Number(req.body.embassyFee) : null,
        serviceFee: req.body.serviceFee !== undefined ? Number(req.body.serviceFee) : null,
        notes: req.body.notes || null,
        createdBy: req.userId,
      },
    });
    res.status(201).json({ ...application, statusContext: resolveStatus("visaApplicationStatus", application.status) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.patch("/:id/tracking", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const booking = await ensureVisaBookingExists(req, res);
    if (!booking) return;
    const existing = await prisma.visaApplication.findFirst({ where: { bookingId: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ message: "No visa tracking record exists for this booking yet — use POST to create one" });

    const data = {};
    for (const key of ["applicantName", "passportNumber", "nationality", "visaType", "destination", "status", "referenceNo", "notes"]) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }
    for (const key of ["appliedDate", "appointmentDate", "decisionDate", "expiryDate"]) {
      if (req.body[key] !== undefined) data[key] = req.body[key] ? new Date(req.body[key]) : null;
    }
    for (const key of ["embassyFee", "serviceFee"]) {
      if (req.body[key] !== undefined) data[key] = Number(req.body[key]);
    }

    await prisma.visaApplication.update({ where: { id: existing.id }, data });
    const updated = await prisma.visaApplication.findFirst({ where: { id: existing.id, tenantId: req.tenantId } });
    res.json({ ...updated, statusContext: resolveStatus("visaApplicationStatus", updated.status) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Passport Information (composes Customer Engine, does not re-query Client) ──
router.get("/:id/passport", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const booking = await ensureVisaBookingExists(req, res);
    if (!booking) return;

    const flattened = { ...booking, ...parseServiceDetails(booking.serviceDetails) };
    const [customer, application] = await Promise.all([
      booking.clientId ? resolveCustomerContext(booking.clientId, req.tenantId) : null,
      prisma.visaApplication.findFirst({ where: { bookingId: req.params.id, tenantId: req.tenantId }, select: { passportNumber: true } }),
    ]);

    res.json({
      fromBooking: { passportNumber: flattened.passportNumber || null, passportExpiry: flattened.passportExpiry || null },
      fromClient: customer ? { passportNumber: customer.passportNumber ?? null, passportExpiry: customer.passportExpiry ?? null, nationality: customer.nationality ?? null } : null,
      fromTracking: application ? { passportNumber: application.passportNumber } : null,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Visa Documents (a required-documents checklist — reuses BookingChecklistItem) ──
router.get("/:id/documents", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const booking = await ensureVisaBookingExists(req, res);
    if (!booking) return;
    res.json(await prisma.bookingChecklistItem.findMany({ where: { bookingId: req.params.id } }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post("/:id/documents", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const booking = await ensureVisaBookingExists(req, res);
    if (!booking) return;
    if (!String(req.body.label ?? "").trim()) return res.status(400).json({ message: "label is required" });
    res.status(201).json(await prisma.bookingChecklistItem.create({ data: { label: req.body.label, bookingId: req.params.id } }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.patch("/:id/documents/:documentId", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const booking = await ensureVisaBookingExists(req, res);
    if (!booking) return;
    const result = await prisma.bookingChecklistItem.updateMany({
      where: { id: req.params.documentId, bookingId: req.params.id },
      data: { done: !!req.body.done, doneAt: req.body.done ? new Date() : null, doneBy: req.body.done ? req.userId : null },
    });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json(await prisma.bookingChecklistItem.findFirst({ where: { id: req.params.documentId, bookingId: req.params.id } }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Visa Timeline (reuses the existing BookingTimelineEvent model) ──
router.get("/:id/timeline", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const booking = await ensureVisaBookingExists(req, res);
    if (!booking) return;
    res.json(await prisma.bookingTimelineEvent.findMany({ where: { bookingId: req.params.id }, orderBy: { createdAt: "desc" } }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post("/:id/timeline", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const booking = await ensureVisaBookingExists(req, res);
    if (!booking) return;
    if (!String(req.body.content ?? "").trim()) return res.status(400).json({ message: "content is required" });
    res.status(201).json(await prisma.bookingTimelineEvent.create({
      data: { type: req.body.type || "system", content: req.body.content, bookingId: req.params.id, createdBy: req.userId },
    }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Visa Notes (a typed view over BookingTimelineEvent, not a new model) ──
router.get("/:id/notes", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const booking = await ensureVisaBookingExists(req, res);
    if (!booking) return;
    res.json(await prisma.bookingTimelineEvent.findMany({ where: { bookingId: req.params.id, type: "note" }, orderBy: { createdAt: "desc" } }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post("/:id/notes", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const booking = await ensureVisaBookingExists(req, res);
    if (!booking) return;
    if (!String(req.body.content ?? "").trim()) return res.status(400).json({ message: "content is required" });
    res.status(201).json(await prisma.bookingTimelineEvent.create({
      data: { type: "note", content: req.body.content, bookingId: req.params.id, createdBy: req.userId },
    }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Visa Attachments (reuses the existing BookingDocument model + bookings.js's multer config) ──
router.get("/:id/attachments", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const booking = await ensureVisaBookingExists(req, res);
    if (!booking) return;
    res.json(await prisma.bookingDocument.findMany({ where: { bookingId: req.params.id }, orderBy: { uploadedAt: "desc" } }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post("/:id/attachments", requirePermission("bookings", "edit"), upload.single("file"), async (req, res) => {
  try {
    const booking = await ensureVisaBookingExists(req, res);
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
router.delete("/:id/attachments/:attachmentId", requirePermission("bookings", "delete"), async (req, res) => {
  try {
    const booking = await ensureVisaBookingExists(req, res);
    if (!booking) return;
    const result = await prisma.bookingDocument.deleteMany({ where: { id: req.params.attachmentId, bookingId: req.params.id } });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
