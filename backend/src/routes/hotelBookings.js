// Hotel Booking — the third complete booking module, reusing the Air Ticket
// / Visa reference architecture exactly
// (docs/v2-master/11-Architecture-Freeze.md §5, docs/v2-master/12-Implementation-Sequence.md Phase 4).
//
// Additive: /api/bookings (all types, including hotel) is completely
// unchanged. Mounted at /api/hotel-bookings, type-scoped to
// Booking.type = "hotel". Reuses bookings.js helpers (CRUD persistence),
// Booking Pricing Library (pricing), Booking Identity Engine (identity),
// Status Engine (status), and the Shared Document Engine (documents via
// entityType "hotel"). Hotel-specific workflow: reservation confirmation,
// guest voucher, room assignment, and check-in / check-out.

const crypto = require("crypto");
const router = require("express").Router();
const { authenticate, requirePermission, prisma } = require("../middleware/auth");
const { dispatchTenantAutomation } = require("../services/tenantAutomationService");
const { parseServiceDetails } = require("../lib/bookingServiceDetails");
const {
  normalizeBookingInput,
  formatBooking,
  getTenantBooking,
  BOOKING_LIST_INCLUDE,
  BOOKING_DETAIL_INCLUDE,
  syncAgentCommission,
} = require("./bookings");
const { BOOKING_TYPE_ID, BOOKING_TYPE_VALUE, SERVICE_TYPE_VALUE, resolveHotelDomain } = require("../lib/hotelDomain");
const {
  computeNights,
  validateHotelBooking,
  validateRoomAssignment,
  addRoom,
  removeRoom,
} = require("../lib/hotelBookingValidation");
const {
  generateBookingReference,
  generatePublicReference,
  generateQrReference,
} = require("../lib/bookingIdentityEngine");
const { resolveStatus } = require("../lib/statusEngine");
const { pricingSummary } = require("../lib/bookingPricing");

router.use(authenticate);

function nowIso() {
  return new Date().toISOString();
}

function enrichHotelBooking(record) {
  const booking = formatBooking(record);
  return {
    ...booking,
    statusContext: resolveStatus("bookingStatus", booking.status),
    pricing: pricingSummary({ buyingPrice: booking.cost, sellingPrice: booking.amount, paidAmount: booking.paidAmount }),
    nights: computeNights(booking.checkInDate, booking.checkOutDate),
  };
}

async function getHotelBooking(bookingId, tenantId, include = BOOKING_LIST_INCLUDE) {
  return prisma.booking.findFirst({ where: { id: bookingId, tenantId, type: BOOKING_TYPE_VALUE }, include });
}

async function ensureHotelBookingExists(req, res, include = BOOKING_LIST_INCLUDE) {
  const booking = await getHotelBooking(req.params.id, req.tenantId, include);
  if (!booking) {
    res.status(404).json({ message: "Hotel booking not found" });
    return null;
  }
  return booking;
}

function mergeForValidation(existing, incoming) {
  const flattenedExisting = existing ? { ...existing, ...parseServiceDetails(existing.serviceDetails) } : {};
  return { ...flattenedExisting, ...incoming };
}

async function timelineEvent(bookingId, userId, type, content) {
  await prisma.bookingTimelineEvent.create({ data: { type, content, bookingId, createdBy: userId } }).catch(() => {});
}

// ── Hotel Booking Domain ──
router.get("/domain", (_req, res) => {
  res.json(resolveHotelDomain());
});

// ── Hotel Booking CRUD ──
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
    res.json(bookings.map(enrichHotelBooking));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const booking = await getHotelBooking(req.params.id, req.tenantId, BOOKING_DETAIL_INCLUDE);
    if (!booking) return res.status(404).json({ message: "Hotel booking not found" });
    res.json({ ...enrichHotelBooking(booking), bookingTypeContext: resolveHotelDomain().bookingContext });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", requirePermission("bookings", "create"), async (req, res) => {
  try {
    const incoming = { ...req.body, type: BOOKING_TYPE_VALUE, serviceType: SERVICE_TYPE_VALUE };
    const validation = validateHotelBooking(incoming);
    if (!validation.valid) return res.status(400).json({ message: "Validation failed", errors: validation.errors });

    const data = await normalizeBookingInput({ ...incoming, tenantId: req.tenantId }, req.tenantId);
    const booking = await prisma.booking.create({ data });

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
        actorId: req.userId, actorName: user?.name || "", actorEmail: user?.email || "", actorRole: user?.role || "",
        tenantId: req.tenantId, tenantName: tenant?.name || null,
        module: "booking", action: "created", targetType: "booking", targetId: booking.id,
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
        relatedType: "booking", relatedId: booking.id, bookingId: booking.id,
        bookingTitle: hydrated?.title || booking.title, bookingType: BOOKING_TYPE_VALUE,
        bookingStatus: hydrated?.status || booking.status, amount: hydrated?.amount ?? booking.amount,
        clientName: client?.name || hydrated?.clientName || "", clientPhone: client?.phone || "", tenantName: tenant?.name || "",
      },
    }).catch((err) => console.error("[automation] booking_created:", err.message));

    res.status(201).json(enrichHotelBooking(hydrated));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/:id", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const existing = await ensureHotelBookingExists(req, res, BOOKING_LIST_INCLUDE);
    if (!existing) return;

    const merged = mergeForValidation(existing, req.body);
    const validation = validateHotelBooking(merged);
    if (!validation.valid) return res.status(400).json({ message: "Validation failed", errors: validation.errors });

    const data = await normalizeBookingInput({ ...req.body, type: BOOKING_TYPE_VALUE }, req.tenantId, existing);
    const result = await prisma.booking.updateMany({ where: { id: req.params.id, tenantId: req.tenantId, type: BOOKING_TYPE_VALUE }, data });
    if (!result.count) return res.status(404).json({ message: "Hotel booking not found" });

    await syncAgentCommission(req.params.id, data, req.tenantId, existing).catch(() => {});
    const updated = await getTenantBooking(req.params.id, req.tenantId, BOOKING_LIST_INCLUDE);
    res.json(enrichHotelBooking(updated));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", requirePermission("bookings", "delete"), async (req, res) => {
  try {
    const result = await prisma.booking.deleteMany({ where: { id: req.params.id, tenantId: req.tenantId, type: BOOKING_TYPE_VALUE } });
    if (!result.count) return res.status(404).json({ message: "Hotel booking not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Hotel Reservation (confirm with the hotel: confirmation number + supplier) ──
router.get("/:id/reservation", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const booking = await ensureHotelBookingExists(req, res);
    if (!booking) return;
    const d = parseServiceDetails(booking.serviceDetails);
    res.json({
      hotelName: d.hotelName || null, hotelCity: d.hotelCity || null, hotelCountry: d.hotelCountry || null,
      checkInDate: d.checkInDate || null, checkOutDate: d.checkOutDate || null,
      nights: computeNights(d.checkInDate, d.checkOutDate),
      roomType: d.roomType || null, roomCount: d.roomCount ?? null, guestCount: d.guestCount ?? null,
      confirmationNumber: d.confirmationNumber || null, rooms: Array.isArray(d.rooms) ? d.rooms : [],
      supplierName: booking.supplierName || null, supplierRef: booking.supplierRef || null,
      status: booking.status, paymentStatus: booking.paymentStatus,
      checkedInAt: d.checkedInAt || null, checkedOutAt: d.checkedOutAt || null,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post("/:id/reservation", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const booking = await ensureHotelBookingExists(req, res);
    if (!booking) return;
    if (!String(req.body.confirmationNumber ?? "").trim()) return res.status(400).json({ message: "confirmationNumber is required" });

    const details = parseServiceDetails(booking.serviceDetails);
    details.confirmationNumber = String(req.body.confirmationNumber).trim();
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        serviceDetails: details,
        ...(req.body.supplierName !== undefined ? { supplierName: req.body.supplierName } : {}),
        ...(req.body.supplierRef !== undefined ? { supplierRef: req.body.supplierRef } : {}),
      },
    });
    await timelineEvent(booking.id, req.userId, "system", `Reservation confirmed: ${details.confirmationNumber}`);
    const updated = await getHotelBooking(booking.id, req.tenantId, BOOKING_LIST_INCLUDE);
    res.json(enrichHotelBooking(updated));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Hotel Voucher (guest-facing voucher — composes Booking Identity + stay + rooms) ──
router.get("/:id/voucher", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const booking = await ensureHotelBookingExists(req, res);
    if (!booking) return;
    const d = parseServiceDetails(booking.serviceDetails);
    const enriched = enrichHotelBooking(booking);
    res.json({
      voucherType: "hotel",
      bookingId: booking.id,
      bookingReference: d.bookingReference || null,
      publicReference: d.publicReference || null,
      qrReference: d.qrReference || null,
      guestName: enriched.clientName || null,
      hotel: { name: d.hotelName || null, city: d.hotelCity || null, country: d.hotelCountry || null },
      stay: { checkInDate: d.checkInDate || null, checkOutDate: d.checkOutDate || null, nights: enriched.nights },
      roomType: d.roomType || null, roomCount: d.roomCount ?? null, guestCount: d.guestCount ?? null,
      rooms: Array.isArray(d.rooms) ? d.rooms : [],
      confirmationNumber: d.confirmationNumber || null,
      status: booking.status, paymentStatus: booking.paymentStatus,
      amount: booking.amount, paidAmount: booking.paidAmount, dueAmount: booking.dueAmount,
      issuedAt: nowIso(),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Room Assignment (stored in serviceDetails.rooms, config-driven) ──
router.get("/:id/rooms", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const booking = await ensureHotelBookingExists(req, res);
    if (!booking) return;
    const d = parseServiceDetails(booking.serviceDetails);
    res.json(Array.isArray(d.rooms) ? d.rooms : []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post("/:id/rooms", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const booking = await ensureHotelBookingExists(req, res);
    if (!booking) return;
    const validation = validateRoomAssignment(req.body);
    if (!validation.valid) return res.status(400).json({ message: "Validation failed", errors: validation.errors });

    const details = parseServiceDetails(booking.serviceDetails);
    details.rooms = addRoom(details.rooms, { id: crypto.randomUUID(), ...req.body });
    await prisma.booking.update({ where: { id: booking.id }, data: { serviceDetails: details } });
    res.status(201).json(details.rooms);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.delete("/:id/rooms/:roomId", requirePermission("bookings", "delete"), async (req, res) => {
  try {
    const booking = await ensureHotelBookingExists(req, res);
    if (!booking) return;
    const details = parseServiceDetails(booking.serviceDetails);
    const before = Array.isArray(details.rooms) ? details.rooms.length : 0;
    details.rooms = removeRoom(details.rooms, req.params.roomId);
    if (details.rooms.length === before) return res.status(404).json({ message: "Room not found" });
    await prisma.booking.update({ where: { id: booking.id }, data: { serviceDetails: details } });
    res.json({ success: true, rooms: details.rooms });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Check-in / Check-out ──
router.post("/:id/check-in", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const booking = await ensureHotelBookingExists(req, res);
    if (!booking) return;
    const details = parseServiceDetails(booking.serviceDetails);
    details.checkedInAt = nowIso();
    await prisma.booking.update({ where: { id: booking.id }, data: { serviceDetails: details, opsStatus: "checked_in" } });
    await timelineEvent(booking.id, req.userId, "system", "Guest checked in");
    const updated = await getHotelBooking(booking.id, req.tenantId, BOOKING_LIST_INCLUDE);
    res.json(enrichHotelBooking(updated));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post("/:id/check-out", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const booking = await ensureHotelBookingExists(req, res);
    if (!booking) return;
    const details = parseServiceDetails(booking.serviceDetails);
    if (!details.checkedInAt) return res.status(400).json({ message: "Cannot check out before checking in" });
    details.checkedOutAt = nowIso();
    await prisma.booking.update({ where: { id: booking.id }, data: { serviceDetails: details, opsStatus: "checked_out" } });
    await timelineEvent(booking.id, req.userId, "system", "Guest checked out");
    const updated = await getHotelBooking(booking.id, req.tenantId, BOOKING_LIST_INCLUDE);
    res.json(enrichHotelBooking(updated));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Hotel Timeline (reuses BookingTimelineEvent) ──
router.get("/:id/timeline", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const booking = await ensureHotelBookingExists(req, res);
    if (!booking) return;
    res.json(await prisma.bookingTimelineEvent.findMany({ where: { bookingId: req.params.id }, orderBy: { createdAt: "desc" } }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post("/:id/timeline", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const booking = await ensureHotelBookingExists(req, res);
    if (!booking) return;
    if (!String(req.body.content ?? "").trim()) return res.status(400).json({ message: "content is required" });
    res.status(201).json(await prisma.bookingTimelineEvent.create({
      data: { type: req.body.type || "system", content: req.body.content, bookingId: req.params.id, createdBy: req.userId },
    }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Hotel Notes (a typed view over BookingTimelineEvent) ──
router.get("/:id/notes", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const booking = await ensureHotelBookingExists(req, res);
    if (!booking) return;
    res.json(await prisma.bookingTimelineEvent.findMany({ where: { bookingId: req.params.id, type: "note" }, orderBy: { createdAt: "desc" } }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post("/:id/notes", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const booking = await ensureHotelBookingExists(req, res);
    if (!booking) return;
    if (!String(req.body.content ?? "").trim()) return res.status(400).json({ message: "content is required" });
    res.status(201).json(await prisma.bookingTimelineEvent.create({
      data: { type: "note", content: req.body.content, bookingId: req.params.id, createdBy: req.userId },
    }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Hotel Documents (reuses the Shared Document Engine's storage) ──
// This is a hotel-scoped READ over the shared Document model (entityType
// "hotel"). Upload / versioning / verification go through the Shared
// Document Engine at /api/document-engine/hotel/:bookingId — no duplicate
// upload logic here.
router.get("/:id/documents", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const booking = await ensureHotelBookingExists(req, res);
    if (!booking) return;
    res.json(await prisma.document.findMany({
      where: { tenantId: req.tenantId, entityType: "hotel", entityId: req.params.id },
      orderBy: { createdAt: "desc" },
    }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
