// Air Ticket Booking — the reference implementation of the Generic Booking
// Engine (docs/v2-master/11-Architecture-Freeze.md §5,
// docs/v2-master/12-Implementation-Sequence.md Phase 4).
//
// Every future booking module (Visa, Hotel, Tour, Hajj) reuses this exact
// shape: a thin, type-scoped route that (a) runs real validation, (b)
// delegates all shared persistence to the existing generic bookings.js
// helpers (never re-implemented here), and (c) reuses the same
// BookingTraveler/BookingTimelineEvent/BookingDocument sub-collection
// models the generic route already uses — no new models, no schema change.
//
// This route is purely ADDITIVE: /api/bookings (all types, including
// ticket) is completely unchanged and keeps working exactly as before.
// This route is a type-scoped, more-validated alternative entry point for
// air ticket bookings specifically, mounted at /api/air-ticket-bookings.

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
const { BOOKING_TYPE_ID, BOOKING_TYPE_VALUE, SERVICE_TYPE_VALUE, resolveAirTicketDomain } = require("../lib/airTicketDomain");
const { validateAirTicketBooking } = require("../lib/airTicketBookingValidation");
const {
  generateBookingReference,
  generatePublicReference,
  generateQrReference,
} = require("../lib/bookingIdentityEngine");
const { resolveStatus } = require("../lib/statusEngine");

router.use(authenticate);

function enrichAirTicketBooking(record) {
  const booking = formatBooking(record);
  return { ...booking, statusContext: resolveStatus("bookingStatus", booking.status) };
}

async function getTicketBooking(bookingId, tenantId, include = BOOKING_LIST_INCLUDE) {
  return prisma.booking.findFirst({ where: { id: bookingId, tenantId, type: BOOKING_TYPE_VALUE }, include });
}

async function ensureTicketBookingExists(req, res, include = BOOKING_LIST_INCLUDE) {
  const booking = await getTicketBooking(req.params.id, req.tenantId, include);
  if (!booking) {
    res.status(404).json({ message: "Air ticket booking not found" });
    return null;
  }
  return booking;
}

/** Merges an existing (flattened) booking with an incoming patch, for validating the resulting whole record. */
function mergeForValidation(existing, incoming) {
  const flattenedExisting = existing ? { ...existing, ...parseServiceDetails(existing.serviceDetails) } : {};
  return { ...flattenedExisting, ...incoming };
}

// ── Air Ticket Booking Domain ──
router.get("/domain", (_req, res) => {
  res.json(resolveAirTicketDomain());
});

// ── Air Ticket Booking CRUD ──
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
    res.json(bookings.map(enrichAirTicketBooking));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const booking = await getTicketBooking(req.params.id, req.tenantId, BOOKING_DETAIL_INCLUDE);
    if (!booking) return res.status(404).json({ message: "Air ticket booking not found" });
    res.json({ ...enrichAirTicketBooking(booking), bookingTypeContext: resolveAirTicketDomain().bookingContext });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", requirePermission("bookings", "create"), checkPlanLimit("bookings"), async (req, res) => {
  try {
    const incoming = { ...req.body, type: BOOKING_TYPE_VALUE, serviceType: SERVICE_TYPE_VALUE };
    const validation = validateAirTicketBooking(incoming);
    if (!validation.valid) return res.status(400).json({ message: "Validation failed", errors: validation.errors });

    const data = await normalizeBookingInput({ ...incoming, tenantId: req.tenantId }, req.tenantId);
    const booking = await prisma.booking.create({ data });

    // Real (persisted) identity via Booking Identity Engine — stored inside
    // serviceDetails since Booking has no dedicated number/reference column
    // (no schema change). Same theoretical race-window as Invoice's own
    // scan-max-then-increment numbering elsewhere in this codebase — not a
    // new class of risk.
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

    res.status(201).json(enrichAirTicketBooking(hydrated));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/:id", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const existing = await ensureTicketBookingExists(req, res, BOOKING_LIST_INCLUDE);
    if (!existing) return;

    const merged = mergeForValidation(existing, req.body);
    const validation = validateAirTicketBooking(merged);
    if (!validation.valid) return res.status(400).json({ message: "Validation failed", errors: validation.errors });

    const data = await normalizeBookingInput({ ...req.body, type: BOOKING_TYPE_VALUE }, req.tenantId, existing);
    const result = await prisma.booking.updateMany({ where: { id: req.params.id, tenantId: req.tenantId, type: BOOKING_TYPE_VALUE }, data });
    if (!result.count) return res.status(404).json({ message: "Air ticket booking not found" });

    await syncAgentCommission(req.params.id, data, req.tenantId, existing).catch(() => {});

    const updated = await getTenantBooking(req.params.id, req.tenantId, BOOKING_LIST_INCLUDE);
    res.json(enrichAirTicketBooking(updated));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", requirePermission("bookings", "delete"), async (req, res) => {
  try {
    const result = await prisma.booking.deleteMany({ where: { id: req.params.id, tenantId: req.tenantId, type: BOOKING_TYPE_VALUE } });
    if (!result.count) return res.status(404).json({ message: "Air ticket booking not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Passenger Assignment (reuses the existing BookingTraveler model) ──
router.get("/:id/passengers", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const booking = await ensureTicketBookingExists(req, res);
    if (!booking) return;
    res.json(await prisma.bookingTraveler.findMany({ where: { bookingId: req.params.id } }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post("/:id/passengers", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const booking = await ensureTicketBookingExists(req, res);
    if (!booking) return;
    if (!String(req.body.name ?? "").trim()) return res.status(400).json({ message: "Passenger name is required" });
    res.status(201).json(await prisma.bookingTraveler.create({ data: { ...req.body, bookingId: req.params.id } }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.delete("/:id/passengers/:passengerId", requirePermission("bookings", "delete"), async (req, res) => {
  try {
    const booking = await ensureTicketBookingExists(req, res);
    if (!booking) return;
    const result = await prisma.bookingTraveler.deleteMany({ where: { id: req.params.passengerId, bookingId: req.params.id } });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Booking Timeline (reuses the existing BookingTimelineEvent model) ──
router.get("/:id/timeline", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const booking = await ensureTicketBookingExists(req, res);
    if (!booking) return;
    res.json(await prisma.bookingTimelineEvent.findMany({ where: { bookingId: req.params.id }, orderBy: { createdAt: "desc" } }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post("/:id/timeline", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const booking = await ensureTicketBookingExists(req, res);
    if (!booking) return;
    if (!String(req.body.content ?? "").trim()) return res.status(400).json({ message: "content is required" });
    res.status(201).json(await prisma.bookingTimelineEvent.create({
      data: { type: req.body.type || "system", content: req.body.content, bookingId: req.params.id, createdBy: req.userId },
    }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Booking Notes (a typed view over BookingTimelineEvent, not a new model) ──
router.get("/:id/notes", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const booking = await ensureTicketBookingExists(req, res);
    if (!booking) return;
    res.json(await prisma.bookingTimelineEvent.findMany({ where: { bookingId: req.params.id, type: "note" }, orderBy: { createdAt: "desc" } }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post("/:id/notes", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const booking = await ensureTicketBookingExists(req, res);
    if (!booking) return;
    if (!String(req.body.content ?? "").trim()) return res.status(400).json({ message: "content is required" });
    res.status(201).json(await prisma.bookingTimelineEvent.create({
      data: { type: "note", content: req.body.content, bookingId: req.params.id, createdBy: req.userId },
    }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Booking Attachments (reuses the existing BookingDocument model + bookings.js's multer config) ──
router.get("/:id/attachments", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const booking = await ensureTicketBookingExists(req, res);
    if (!booking) return;
    res.json(await prisma.bookingDocument.findMany({ where: { bookingId: req.params.id }, orderBy: { uploadedAt: "desc" } }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post("/:id/attachments", requirePermission("bookings", "edit"), upload.single("file"), async (req, res) => {
  try {
    const booking = await ensureTicketBookingExists(req, res);
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
    const booking = await ensureTicketBookingExists(req, res);
    if (!booking) return;
    const result = await prisma.bookingDocument.deleteMany({ where: { id: req.params.attachmentId, bookingId: req.params.id } });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
