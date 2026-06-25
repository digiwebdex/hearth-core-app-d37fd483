const router = require("express").Router();
const { authenticate, requirePermission, prisma } = require("../middleware/auth");

router.use(authenticate);

// ─── Hotel Contracts ─────────────────────────────────────────────────────────

router.get("/hotels", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const { status, search } = req.query;
    const where = { tenantId: req.tenantId };
    if (status) where.status = status;
    if (search) where.hotelName = { contains: search, mode: "insensitive" };

    const hotels = await prisma.hotelContract.findMany({ where, orderBy: { createdAt: "desc" } });
    res.json(hotels);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/hotels", requirePermission("bookings", "create"), async (req, res) => {
  try {
    const { vendorId, hotelName, city, country, starRating, contractStart, contractEnd, totalRooms, allocatedRooms, ratePerNight, mealPlan, status, notes } = req.body;
    if (!hotelName) return res.status(400).json({ message: "hotelName is required" });

    const hotel = await prisma.hotelContract.create({
      data: {
        tenantId: req.tenantId,
        vendorId: vendorId || null,
        hotelName,
        city: city || null,
        country: country || null,
        starRating: starRating ? parseInt(starRating) : null,
        contractStart: contractStart ? new Date(contractStart) : null,
        contractEnd: contractEnd ? new Date(contractEnd) : null,
        totalRooms: parseInt(totalRooms) || 0,
        allocatedRooms: parseInt(allocatedRooms) || 0,
        ratePerNight: ratePerNight ? parseFloat(ratePerNight) : null,
        mealPlan: mealPlan || null,
        status: status || "active",
        notes: notes || null,
      },
    });
    res.status(201).json(hotel);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/hotels/:id", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const existing = await prisma.hotelContract.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ message: "Not found" });

    const { vendorId, hotelName, city, country, starRating, contractStart, contractEnd, totalRooms, allocatedRooms, ratePerNight, mealPlan, status, notes } = req.body;
    const data = {};
    if (hotelName !== undefined) data.hotelName = hotelName;
    if (city !== undefined) data.city = city;
    if (country !== undefined) data.country = country;
    if (vendorId !== undefined) data.vendorId = vendorId || null;
    if (starRating !== undefined) data.starRating = starRating ? parseInt(starRating) : null;
    if (contractStart !== undefined) data.contractStart = contractStart ? new Date(contractStart) : null;
    if (contractEnd !== undefined) data.contractEnd = contractEnd ? new Date(contractEnd) : null;
    if (totalRooms !== undefined) data.totalRooms = parseInt(totalRooms);
    if (allocatedRooms !== undefined) data.allocatedRooms = parseInt(allocatedRooms);
    if (ratePerNight !== undefined) data.ratePerNight = ratePerNight ? parseFloat(ratePerNight) : null;
    if (mealPlan !== undefined) data.mealPlan = mealPlan;
    if (status !== undefined) data.status = status;
    if (notes !== undefined) data.notes = notes;

    const updated = await prisma.hotelContract.update({ where: { id: req.params.id }, data });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/hotels/:id", requirePermission("bookings", "delete"), async (req, res) => {
  try {
    const existing = await prisma.hotelContract.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ message: "Not found" });
    await prisma.hotelContract.delete({ where: { id: req.params.id } });
    res.json({ message: "Deleted" });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// ─── Transport Contracts ──────────────────────────────────────────────────────

router.get("/transport", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const { status, transportType } = req.query;
    const where = { tenantId: req.tenantId };
    if (status) where.status = status;
    if (transportType) where.transportType = transportType;

    const transport = await prisma.transportContract.findMany({ where, orderBy: { createdAt: "desc" } });
    res.json(transport);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/transport", requirePermission("bookings", "create"), async (req, res) => {
  try {
    const { vendorId, transportType, vehicleModel, capacity, registrationNo, driverName, driverPhone, ratePerDay, ratePerTrip, contractStart, contractEnd, status, notes } = req.body;

    const transport = await prisma.transportContract.create({
      data: {
        tenantId: req.tenantId,
        vendorId: vendorId || null,
        transportType: transportType || "bus",
        vehicleModel: vehicleModel || null,
        capacity: parseInt(capacity) || 0,
        registrationNo: registrationNo || null,
        driverName: driverName || null,
        driverPhone: driverPhone || null,
        ratePerDay: ratePerDay ? parseFloat(ratePerDay) : null,
        ratePerTrip: ratePerTrip ? parseFloat(ratePerTrip) : null,
        contractStart: contractStart ? new Date(contractStart) : null,
        contractEnd: contractEnd ? new Date(contractEnd) : null,
        status: status || "available",
        notes: notes || null,
      },
    });
    res.status(201).json(transport);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/transport/:id", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const existing = await prisma.transportContract.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ message: "Not found" });

    const { vendorId, transportType, vehicleModel, capacity, registrationNo, driverName, driverPhone, ratePerDay, ratePerTrip, contractStart, contractEnd, status, notes } = req.body;
    const data = {};
    if (vendorId !== undefined) data.vendorId = vendorId || null;
    if (transportType !== undefined) data.transportType = transportType;
    if (vehicleModel !== undefined) data.vehicleModel = vehicleModel;
    if (capacity !== undefined) data.capacity = parseInt(capacity);
    if (registrationNo !== undefined) data.registrationNo = registrationNo;
    if (driverName !== undefined) data.driverName = driverName;
    if (driverPhone !== undefined) data.driverPhone = driverPhone;
    if (ratePerDay !== undefined) data.ratePerDay = ratePerDay ? parseFloat(ratePerDay) : null;
    if (ratePerTrip !== undefined) data.ratePerTrip = ratePerTrip ? parseFloat(ratePerTrip) : null;
    if (contractStart !== undefined) data.contractStart = contractStart ? new Date(contractStart) : null;
    if (contractEnd !== undefined) data.contractEnd = contractEnd ? new Date(contractEnd) : null;
    if (status !== undefined) data.status = status;
    if (notes !== undefined) data.notes = notes;

    const updated = await prisma.transportContract.update({ where: { id: req.params.id }, data });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/transport/:id", requirePermission("bookings", "delete"), async (req, res) => {
  try {
    const existing = await prisma.transportContract.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ message: "Not found" });
    await prisma.transportContract.delete({ where: { id: req.params.id } });
    res.json({ message: "Deleted" });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
