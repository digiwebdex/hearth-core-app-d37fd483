// Hajj & Umrah Booking — the fourth complete booking module (Bangladesh
// market differentiator), reusing the Air Ticket / Visa / Hotel architecture.
// (docs/v2-master/11-Architecture-Freeze.md §4/§5, docs/v2-master/12-Implementation-Sequence.md Phase 4).
//
// SALE layer (generic Booking, type "hajj", serviceType "hajj_umrah"), one
// module for both Hajj and Umrah (via serviceDetails.packageType). The
// existing /api/hajj Operations desk (HajjPackage/HajjGroup/HajjPilgrim/
// HajjPilgrimPayment CRUD + enrolled/payment roll-up) is UNTOUCHED and NOT
// re-implemented — this module COMPOSES those models (read) for itinerary /
// hotel / flight / group, and lets a booking LINK to a real HajjPackage /
// HajjGroup. The booking's own pilgrim manifest (who this customer bought
// for, with mahram/room) lives in serviceDetails, exactly like Hotel's rooms
// — the sale side of the frozen two-layer design, distinct from the ops-desk
// roster. Additive: /api/bookings and /api/hajj are both unchanged.

const crypto = require("crypto");
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
} = require("./bookings");
const { BOOKING_TYPE_VALUE, SERVICE_TYPE_VALUE, resolveHajjDomain } = require("../lib/hajjDomain");
const {
  validateHajjBooking,
  validatePilgrim,
  addPilgrim,
  updatePilgrim,
  removePilgrim,
  buildMahramMap,
} = require("../lib/hajjBookingValidation");
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

function enrichHajjBooking(record) {
  const booking = formatBooking(record);
  return {
    ...booking,
    packageType: booking.packageType || "hajj",
    statusContext: resolveStatus("bookingStatus", booking.status),
    pricing: pricingSummary({ buyingPrice: booking.cost, sellingPrice: booking.amount, paidAmount: booking.paidAmount }),
  };
}

async function getHajjBooking(bookingId, tenantId, include = BOOKING_LIST_INCLUDE) {
  return prisma.booking.findFirst({ where: { id: bookingId, tenantId, type: BOOKING_TYPE_VALUE }, include });
}

async function ensureHajjBookingExists(req, res, include = BOOKING_LIST_INCLUDE) {
  const booking = await getHajjBooking(req.params.id, req.tenantId, include);
  if (!booking) {
    res.status(404).json({ message: "Hajj/Umrah booking not found" });
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

// ── Domain ──
router.get("/domain", (_req, res) => {
  res.json(resolveHajjDomain());
});

// ── Hajj/Umrah Package Booking CRUD (one module, both packageTypes) ──
router.get("/", requirePermission("hajj_umrah", "view"), async (req, res) => {
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
    const enriched = bookings.map(enrichHajjBooking);
    const packageType = req.query.packageType;
    res.json(packageType ? enriched.filter((b) => b.packageType === packageType) : enriched);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id", requirePermission("hajj_umrah", "view"), async (req, res) => {
  try {
    const booking = await getHajjBooking(req.params.id, req.tenantId, BOOKING_DETAIL_INCLUDE);
    if (!booking) return res.status(404).json({ message: "Hajj/Umrah booking not found" });
    const d = parseServiceDetails(booking.serviceDetails);
    res.json({
      ...enrichHajjBooking(booking),
      pilgrimCount: Array.isArray(d.pilgrims) ? d.pilgrims.length : (d.pilgrimCount ?? 0),
      bookingTypeContext: resolveHajjDomain().bookingContext[d.packageType === "umrah" ? "umrah" : "hajj"],
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", requirePermission("hajj_umrah", "create"), checkPlanLimit("bookings"), async (req, res) => {
  try {
    const incoming = { ...req.body, type: BOOKING_TYPE_VALUE, serviceType: SERVICE_TYPE_VALUE };
    const validation = validateHajjBooking(incoming);
    if (!validation.valid) return res.status(400).json({ message: "Validation failed", errors: validation.errors });

    const data = await normalizeBookingInput({ ...incoming, tenantId: req.tenantId }, req.tenantId);
    const booking = await prisma.booking.create({ data });

    // Identity persisted under the correct Booking Registry type (hajj/umrah).
    const packageType = incoming.packageType === "umrah" ? "umrah" : "hajj";
    const typeScopedCount = await prisma.booking.count({ where: { tenantId: req.tenantId, type: BOOKING_TYPE_VALUE } });
    const bookingReference = generateBookingReference({ bookingTypeId: packageType, year: new Date().getFullYear(), sequence: typeScopedCount });
    const publicReference = generatePublicReference(booking.id);
    const qrReference = generateQrReference({ bookingTypeId: packageType, publicReference });
    await prisma.booking.update({
      where: { id: booking.id },
      data: { serviceDetails: { ...parseServiceDetails(booking.serviceDetails), packageType, bookingReference, publicReference, qrReference } },
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

    res.status(201).json(enrichHajjBooking(hydrated));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/:id", requirePermission("hajj_umrah", "edit"), async (req, res) => {
  try {
    const existing = await ensureHajjBookingExists(req, res, BOOKING_LIST_INCLUDE);
    if (!existing) return;

    const merged = mergeForValidation(existing, req.body);
    const validation = validateHajjBooking(merged);
    if (!validation.valid) return res.status(400).json({ message: "Validation failed", errors: validation.errors });

    const data = await normalizeBookingInput({ ...req.body, type: BOOKING_TYPE_VALUE }, req.tenantId, existing);
    const result = await prisma.booking.updateMany({ where: { id: req.params.id, tenantId: req.tenantId, type: BOOKING_TYPE_VALUE }, data });
    if (!result.count) return res.status(404).json({ message: "Hajj/Umrah booking not found" });

    await syncAgentCommission(req.params.id, data, req.tenantId, existing).catch(() => {});
    const updated = await getTenantBooking(req.params.id, req.tenantId, BOOKING_LIST_INCLUDE);
    res.json(enrichHajjBooking(updated));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", requirePermission("hajj_umrah", "delete"), async (req, res) => {
  try {
    const result = await prisma.booking.deleteMany({ where: { id: req.params.id, tenantId: req.tenantId, type: BOOKING_TYPE_VALUE } });
    if (!result.count) return res.status(404).json({ message: "Hajj/Umrah booking not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Pilgrim Management (sale manifest — serviceDetails.pilgrims) ──
router.get("/:id/pilgrims", requirePermission("hajj_umrah", "view"), async (req, res) => {
  try {
    const booking = await ensureHajjBookingExists(req, res);
    if (!booking) return;
    const d = parseServiceDetails(booking.serviceDetails);
    res.json(Array.isArray(d.pilgrims) ? d.pilgrims : []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post("/:id/pilgrims", requirePermission("hajj_umrah", "edit"), async (req, res) => {
  try {
    const booking = await ensureHajjBookingExists(req, res);
    if (!booking) return;
    const validation = validatePilgrim(req.body);
    if (!validation.valid) return res.status(400).json({ message: "Validation failed", errors: validation.errors });

    const details = parseServiceDetails(booking.serviceDetails);
    details.pilgrims = addPilgrim(details.pilgrims, { id: crypto.randomUUID(), ...req.body });
    await prisma.booking.update({ where: { id: booking.id }, data: { serviceDetails: details } });
    res.status(201).json(details.pilgrims);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.patch("/:id/pilgrims/:pilgrimId", requirePermission("hajj_umrah", "edit"), async (req, res) => {
  try {
    const booking = await ensureHajjBookingExists(req, res);
    if (!booking) return;
    const details = parseServiceDetails(booking.serviceDetails);
    const list = Array.isArray(details.pilgrims) ? details.pilgrims : [];
    const target = list.find((p) => p.id === req.params.pilgrimId);
    if (!target) return res.status(404).json({ message: "Pilgrim not found" });

    const validation = validatePilgrim({ ...target, ...req.body });
    if (!validation.valid) return res.status(400).json({ message: "Validation failed", errors: validation.errors });

    details.pilgrims = updatePilgrim(list, req.params.pilgrimId, req.body);
    await prisma.booking.update({ where: { id: booking.id }, data: { serviceDetails: details } });
    res.json(details.pilgrims.find((p) => p.id === req.params.pilgrimId));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.delete("/:id/pilgrims/:pilgrimId", requirePermission("hajj_umrah", "delete"), async (req, res) => {
  try {
    const booking = await ensureHajjBookingExists(req, res);
    if (!booking) return;
    const details = parseServiceDetails(booking.serviceDetails);
    const before = Array.isArray(details.pilgrims) ? details.pilgrims.length : 0;
    details.pilgrims = removePilgrim(details.pilgrims, req.params.pilgrimId);
    if (details.pilgrims.length === before) return res.status(404).json({ message: "Pilgrim not found" });
    await prisma.booking.update({ where: { id: booking.id }, data: { serviceDetails: details } });
    res.json({ success: true, pilgrims: details.pilgrims });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Mahram Management (relationship map + compliance — genuine new logic) ──
router.get("/:id/mahram-map", requirePermission("hajj_umrah", "view"), async (req, res) => {
  try {
    const booking = await ensureHajjBookingExists(req, res);
    if (!booking) return;
    const d = parseServiceDetails(booking.serviceDetails);
    res.json(buildMahramMap(Array.isArray(d.pilgrims) ? d.pilgrims : [], nowIso()));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Package Itinerary (composes the linked HajjPackage, or the booking's own fields) ──
router.get("/:id/itinerary", requirePermission("hajj_umrah", "view"), async (req, res) => {
  try {
    const booking = await ensureHajjBookingExists(req, res);
    if (!booking) return;
    const d = parseServiceDetails(booking.serviceDetails);

    const pkg = d.hajjPackageId
      ? await prisma.hajjPackage.findFirst({ where: { id: d.hajjPackageId, tenantId: req.tenantId } })
      : null;

    res.json({
      source: pkg ? "linked_package" : "booking",
      packageName: pkg?.name || d.packageName || null,
      packageType: d.packageType || pkg?.type || null,
      makkahNights: pkg?.makkahNights ?? d.makkahNights ?? null,
      madinahNights: pkg?.madinahNights ?? d.madinahNights ?? null,
      makkahHotel: pkg?.makkahHotel || d.makkahHotel || null,
      madinahHotel: pkg?.madinahHotel || d.madinahHotel || null,
      hotelClass: pkg?.hotelClass || null,
      departureDate: pkg?.departureDate || d.departureDate || null,
      returnDate: pkg?.returnDate || d.returnDate || null,
      highlights: pkg?.highlights || null,
      inclusions: pkg ? { visa: pkg.visaIncluded, transport: pkg.transportIncluded, meals: pkg.mealsIncluded, ziyarat: pkg.ziyaratIncluded } : null,
      packageStatusContext: pkg ? resolveStatus("hajjPackageStatus", pkg.status) : null,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Hotel Allocation (Makkah/Madinah hotels + per-pilgrim room) ──
router.get("/:id/hotel-allocation", requirePermission("hajj_umrah", "view"), async (req, res) => {
  try {
    const booking = await ensureHajjBookingExists(req, res);
    if (!booking) return;
    const d = parseServiceDetails(booking.serviceDetails);
    const pkg = d.hajjPackageId
      ? await prisma.hajjPackage.findFirst({ where: { id: d.hajjPackageId, tenantId: req.tenantId }, select: { makkahHotel: true, madinahHotel: true, makkahNights: true, madinahNights: true, hotelClass: true } })
      : null;

    res.json({
      makkah: { hotel: pkg?.makkahHotel || d.makkahHotel || null, nights: pkg?.makkahNights ?? d.makkahNights ?? null },
      madinah: { hotel: pkg?.madinahHotel || d.madinahHotel || null, nights: pkg?.madinahNights ?? d.madinahNights ?? null },
      hotelClass: pkg?.hotelClass || null,
      rooms: (Array.isArray(d.pilgrims) ? d.pilgrims : []).map((p) => ({ pilgrimId: p.id, name: p.name, roomType: p.roomType || null, roomNumber: p.roomNumber || null })),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Flight Allocation (composes the linked HajjGroup's flight details) ──
router.get("/:id/flight-allocation", requirePermission("hajj_umrah", "view"), async (req, res) => {
  try {
    const booking = await ensureHajjBookingExists(req, res);
    if (!booking) return;
    const d = parseServiceDetails(booking.serviceDetails);
    const group = d.hajjGroupId
      ? await prisma.hajjGroup.findFirst({ where: { id: d.hajjGroupId, tenantId: req.tenantId } })
      : null;

    res.json({
      source: group ? "linked_group" : "booking",
      flightDetails: group?.flightDetails || d.flightDetails || null,
      departureDate: group?.departureDate || d.departureDate || null,
      returnDate: group?.returnDate || d.returnDate || null,
      groupName: group?.name || null,
      pilgrimCount: Array.isArray(d.pilgrims) ? d.pilgrims.length : (d.pilgrimCount ?? 0),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Group Management (composes the linked HajjGroup — no re-CRUD; groups live in /api/hajj) ──
router.get("/:id/group", requirePermission("hajj_umrah", "view"), async (req, res) => {
  try {
    const booking = await ensureHajjBookingExists(req, res);
    if (!booking) return;
    const d = parseServiceDetails(booking.serviceDetails);
    if (!d.hajjGroupId) return res.json(null);
    const group = await prisma.hajjGroup.findFirst({ where: { id: d.hajjGroupId, tenantId: req.tenantId } });
    res.json(group || null);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Linkage bridges to the Operations desk models ──
router.post("/:id/link-package", requirePermission("hajj_umrah", "edit"), async (req, res) => {
  try {
    const booking = await ensureHajjBookingExists(req, res);
    if (!booking) return;
    const hajjPackageId = String(req.body.hajjPackageId || "").trim();
    if (!hajjPackageId) return res.status(400).json({ message: "hajjPackageId is required" });
    const pkg = await prisma.hajjPackage.findFirst({ where: { id: hajjPackageId, tenantId: req.tenantId }, select: { id: true, name: true } });
    if (!pkg) return res.status(404).json({ message: "Hajj package not found" });

    const details = parseServiceDetails(booking.serviceDetails);
    details.hajjPackageId = pkg.id;
    await prisma.booking.update({ where: { id: booking.id }, data: { serviceDetails: details } });
    await timelineEvent(booking.id, req.userId, "system", `Linked to Hajj package: ${pkg.name}`);
    res.json(enrichHajjBooking(await getHajjBooking(booking.id, req.tenantId, BOOKING_LIST_INCLUDE)));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post("/:id/link-group", requirePermission("hajj_umrah", "edit"), async (req, res) => {
  try {
    const booking = await ensureHajjBookingExists(req, res);
    if (!booking) return;
    const hajjGroupId = String(req.body.hajjGroupId || "").trim();
    if (!hajjGroupId) return res.status(400).json({ message: "hajjGroupId is required" });
    const group = await prisma.hajjGroup.findFirst({ where: { id: hajjGroupId, tenantId: req.tenantId }, select: { id: true, name: true } });
    if (!group) return res.status(404).json({ message: "Hajj group not found" });

    const details = parseServiceDetails(booking.serviceDetails);
    details.hajjGroupId = group.id;
    await prisma.booking.update({ where: { id: booking.id }, data: { serviceDetails: details } });
    await timelineEvent(booking.id, req.userId, "system", `Linked to Hajj group: ${group.name}`);
    res.json(enrichHajjBooking(await getHajjBooking(booking.id, req.tenantId, BOOKING_LIST_INCLUDE)));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Package Documents (reuses the Shared Document Engine's storage, entityType "hajj") ──
router.get("/:id/documents", requirePermission("hajj_umrah", "view"), async (req, res) => {
  try {
    const booking = await ensureHajjBookingExists(req, res);
    if (!booking) return;
    res.json(await prisma.document.findMany({
      where: { tenantId: req.tenantId, entityType: "hajj", entityId: req.params.id },
      orderBy: { createdAt: "desc" },
    }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Timeline / Notes (reuse BookingTimelineEvent) ──
router.get("/:id/timeline", requirePermission("hajj_umrah", "view"), async (req, res) => {
  try {
    const booking = await ensureHajjBookingExists(req, res);
    if (!booking) return;
    res.json(await prisma.bookingTimelineEvent.findMany({ where: { bookingId: req.params.id }, orderBy: { createdAt: "desc" } }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post("/:id/timeline", requirePermission("hajj_umrah", "edit"), async (req, res) => {
  try {
    const booking = await ensureHajjBookingExists(req, res);
    if (!booking) return;
    if (!String(req.body.content ?? "").trim()) return res.status(400).json({ message: "content is required" });
    res.status(201).json(await prisma.bookingTimelineEvent.create({
      data: { type: req.body.type || "system", content: req.body.content, bookingId: req.params.id, createdBy: req.userId },
    }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get("/:id/notes", requirePermission("hajj_umrah", "view"), async (req, res) => {
  try {
    const booking = await ensureHajjBookingExists(req, res);
    if (!booking) return;
    res.json(await prisma.bookingTimelineEvent.findMany({ where: { bookingId: req.params.id, type: "note" }, orderBy: { createdAt: "desc" } }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post("/:id/notes", requirePermission("hajj_umrah", "edit"), async (req, res) => {
  try {
    const booking = await ensureHajjBookingExists(req, res);
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
