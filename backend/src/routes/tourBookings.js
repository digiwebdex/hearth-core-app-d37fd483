// Tour Booking — the fifth complete booking module, reusing the Air Ticket /
// Visa / Hotel / Hajj architecture.
// (docs/v2-master/11-Architecture-Freeze.md §5, docs/v2-master/12-Implementation-Sequence.md Phase 4).
//
// One unified module for Domestic + International tours (Booking.type "tour",
// serviceType derived from tourType). Reuses bookings.js helpers (CRUD),
// BookingTraveler (travellers), Booking Pricing Library, Booking Identity
// Engine, Status Engine, and the Shared Document Engine (entityType "tour").
// The day-wise itinerary, destinations, hotel/transport allocation, and guide
// assignment are structured serviceDetails sub-collections (the generic
// booking-engine mechanism), each with its own validator/normalizer defined
// once in tourBookingValidation.TOUR_COLLECTIONS. Additive: /api/bookings and
// /api/group-tours are both unchanged.

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
const { BOOKING_TYPE_ID, BOOKING_TYPE_VALUE, serviceTypeForTourType, resolveTourDomain } = require("../lib/tourDomain");
const {
  validateTourBooking,
  validateTraveller,
  TOUR_COLLECTIONS,
  TOUR_COLLECTION_KEYS,
  addCollectionItem,
  updateCollectionItem,
  removeCollectionItem,
} = require("../lib/tourBookingValidation");
const {
  generateBookingReference,
  generatePublicReference,
  generateQrReference,
} = require("../lib/bookingIdentityEngine");
const { resolveStatus } = require("../lib/statusEngine");
const { pricingSummary } = require("../lib/bookingPricing");

router.use(authenticate);

function enrichTourBooking(record) {
  const booking = formatBooking(record);
  return {
    ...booking,
    statusContext: resolveStatus("bookingStatus", booking.status),
    pricing: pricingSummary({ buyingPrice: booking.cost, sellingPrice: booking.amount, paidAmount: booking.paidAmount }),
  };
}

async function getTourBooking(bookingId, tenantId, include = BOOKING_LIST_INCLUDE) {
  return prisma.booking.findFirst({ where: { id: bookingId, tenantId, type: BOOKING_TYPE_VALUE }, include });
}

async function ensureTourBookingExists(req, res, include = BOOKING_LIST_INCLUDE) {
  const booking = await getTourBooking(req.params.id, req.tenantId, include);
  if (!booking) {
    res.status(404).json({ message: "Tour booking not found" });
    return null;
  }
  return booking;
}

function mergeForValidation(existing, incoming) {
  const flattenedExisting = existing ? { ...existing, ...parseServiceDetails(existing.serviceDetails) } : {};
  return { ...flattenedExisting, ...incoming };
}

// ── Domain ──
router.get("/domain", (_req, res) => {
  res.json(resolveTourDomain());
});

// ── Tour Package Booking CRUD (one module, domestic + international) ──
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
    const enriched = bookings.map(enrichTourBooking);
    const tourType = req.query.tourType;
    res.json(tourType ? enriched.filter((b) => b.tourType === tourType) : enriched);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const booking = await getTourBooking(req.params.id, req.tenantId, BOOKING_DETAIL_INCLUDE);
    if (!booking) return res.status(404).json({ message: "Tour booking not found" });
    res.json({ ...enrichTourBooking(booking), bookingTypeContext: resolveTourDomain().bookingContext });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", requirePermission("bookings", "create"), async (req, res) => {
  try {
    const validation = validateTourBooking(req.body);
    if (!validation.valid) return res.status(400).json({ message: "Validation failed", errors: validation.errors });

    const incoming = { ...req.body, type: BOOKING_TYPE_VALUE, serviceType: serviceTypeForTourType(req.body.tourType) };
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

    res.status(201).json(enrichTourBooking(hydrated));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/:id", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const existing = await ensureTourBookingExists(req, res, BOOKING_LIST_INCLUDE);
    if (!existing) return;

    const merged = mergeForValidation(existing, req.body);
    const validation = validateTourBooking(merged);
    if (!validation.valid) return res.status(400).json({ message: "Validation failed", errors: validation.errors });

    const incoming = { ...req.body, type: BOOKING_TYPE_VALUE };
    if (req.body.tourType) incoming.serviceType = serviceTypeForTourType(req.body.tourType);
    const data = await normalizeBookingInput(incoming, req.tenantId, existing);
    const result = await prisma.booking.updateMany({ where: { id: req.params.id, tenantId: req.tenantId, type: BOOKING_TYPE_VALUE }, data });
    if (!result.count) return res.status(404).json({ message: "Tour booking not found" });

    await syncAgentCommission(req.params.id, data, req.tenantId, existing).catch(() => {});
    const updated = await getTenantBooking(req.params.id, req.tenantId, BOOKING_LIST_INCLUDE);
    res.json(enrichTourBooking(updated));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", requirePermission("bookings", "delete"), async (req, res) => {
  try {
    const result = await prisma.booking.deleteMany({ where: { id: req.params.id, tenantId: req.tenantId, type: BOOKING_TYPE_VALUE } });
    if (!result.count) return res.status(404).json({ message: "Tour booking not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Traveller Management (reuses the shared BookingTraveler model) ──
router.get("/:id/travellers", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const booking = await ensureTourBookingExists(req, res);
    if (!booking) return;
    res.json(await prisma.bookingTraveler.findMany({ where: { bookingId: req.params.id } }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post("/:id/travellers", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const booking = await ensureTourBookingExists(req, res);
    if (!booking) return;
    const validation = validateTraveller(req.body);
    if (!validation.valid) return res.status(400).json({ message: "Validation failed", errors: validation.errors });
    res.status(201).json(await prisma.bookingTraveler.create({ data: { ...req.body, bookingId: req.params.id } }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.delete("/:id/travellers/:travellerId", requirePermission("bookings", "delete"), async (req, res) => {
  try {
    const booking = await ensureTourBookingExists(req, res);
    if (!booking) return;
    const result = await prisma.bookingTraveler.deleteMany({ where: { id: req.params.travellerId, bookingId: req.params.id } });
    if (!result.count) return res.status(404).json({ message: "Traveller not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Sub-collections: itinerary, destinations, hotels, transport, guides ──
// One factory, five collections — real GET/POST/PATCH/DELETE CRUD each, each
// validated + normalized by its own TOUR_COLLECTIONS entry.
function registerCollection(key) {
  const cfg = TOUR_COLLECTIONS[key];

  router.get(`/:id/${key}`, requirePermission("bookings", "view"), async (req, res) => {
    try {
      const booking = await ensureTourBookingExists(req, res);
      if (!booking) return;
      const d = parseServiceDetails(booking.serviceDetails);
      res.json(Array.isArray(d[key]) ? d[key] : []);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  router.post(`/:id/${key}`, requirePermission("bookings", "edit"), async (req, res) => {
    try {
      const booking = await ensureTourBookingExists(req, res);
      if (!booking) return;
      const validation = cfg.validate(req.body);
      if (!validation.valid) return res.status(400).json({ message: "Validation failed", errors: validation.errors });
      const details = parseServiceDetails(booking.serviceDetails);
      details[key] = addCollectionItem(details[key], cfg.build(req.body, crypto.randomUUID()));
      await prisma.booking.update({ where: { id: booking.id }, data: { serviceDetails: details } });
      res.status(201).json(details[key]);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  router.patch(`/:id/${key}/:itemId`, requirePermission("bookings", "edit"), async (req, res) => {
    try {
      const booking = await ensureTourBookingExists(req, res);
      if (!booking) return;
      const details = parseServiceDetails(booking.serviceDetails);
      const list = Array.isArray(details[key]) ? details[key] : [];
      const target = list.find((x) => x.id === req.params.itemId);
      if (!target) return res.status(404).json({ message: `${key} item not found` });
      const validation = cfg.validate({ ...target, ...req.body });
      if (!validation.valid) return res.status(400).json({ message: "Validation failed", errors: validation.errors });
      details[key] = updateCollectionItem(list, req.params.itemId, req.body);
      await prisma.booking.update({ where: { id: booking.id }, data: { serviceDetails: details } });
      res.json(details[key].find((x) => x.id === req.params.itemId));
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  router.delete(`/:id/${key}/:itemId`, requirePermission("bookings", "delete"), async (req, res) => {
    try {
      const booking = await ensureTourBookingExists(req, res);
      if (!booking) return;
      const details = parseServiceDetails(booking.serviceDetails);
      const before = Array.isArray(details[key]) ? details[key].length : 0;
      details[key] = removeCollectionItem(details[key], req.params.itemId);
      if (details[key].length === before) return res.status(404).json({ message: `${key} item not found` });
      await prisma.booking.update({ where: { id: booking.id }, data: { serviceDetails: details } });
      res.json({ success: true, [key]: details[key] });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });
}
TOUR_COLLECTION_KEYS.forEach(registerCollection);

// ── Tour Schedule (composed overview of the day-wise itinerary + dates) ──
router.get("/:id/schedule", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const booking = await ensureTourBookingExists(req, res);
    if (!booking) return;
    const d = parseServiceDetails(booking.serviceDetails);
    const days = (Array.isArray(d.itinerary) ? d.itinerary : []).slice().sort((a, b) => (a.dayNumber || 0) - (b.dayNumber || 0));
    res.json({
      tourType: d.tourType || null,
      travelDateFrom: d.travelDateFrom || booking.travelDateFrom || null,
      travelDateTo: d.travelDateTo || booking.travelDateTo || null,
      totalDays: days.length,
      destinationCount: Array.isArray(d.destinations) ? d.destinations.length : 0,
      hotelCount: Array.isArray(d.hotels) ? d.hotels.length : 0,
      days,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Tour Documents (reuses the Shared Document Engine's storage, entityType "tour") ──
router.get("/:id/documents", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const booking = await ensureTourBookingExists(req, res);
    if (!booking) return;
    res.json(await prisma.document.findMany({
      where: { tenantId: req.tenantId, entityType: "tour", entityId: req.params.id },
      orderBy: { createdAt: "desc" },
    }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Timeline / Notes (reuse BookingTimelineEvent) ──
router.get("/:id/timeline", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const booking = await ensureTourBookingExists(req, res);
    if (!booking) return;
    res.json(await prisma.bookingTimelineEvent.findMany({ where: { bookingId: req.params.id }, orderBy: { createdAt: "desc" } }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post("/:id/timeline", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const booking = await ensureTourBookingExists(req, res);
    if (!booking) return;
    if (!String(req.body.content ?? "").trim()) return res.status(400).json({ message: "content is required" });
    res.status(201).json(await prisma.bookingTimelineEvent.create({
      data: { type: req.body.type || "system", content: req.body.content, bookingId: req.params.id, createdBy: req.userId },
    }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get("/:id/notes", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const booking = await ensureTourBookingExists(req, res);
    if (!booking) return;
    res.json(await prisma.bookingTimelineEvent.findMany({ where: { bookingId: req.params.id, type: "note" }, orderBy: { createdAt: "desc" } }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post("/:id/notes", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const booking = await ensureTourBookingExists(req, res);
    if (!booking) return;
    if (!String(req.body.content ?? "").trim()) return res.status(400).json({ message: "content is required" });
    res.status(201).json(await prisma.bookingTimelineEvent.create({
      data: { type: "note", content: req.body.content, bookingId: req.params.id, createdBy: req.userId },
    }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
