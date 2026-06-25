const router = require("express").Router();
const { authenticate, requirePermission, prisma } = require("../middleware/auth");

router.use(authenticate);

// GET /api/group-tours
router.get("/", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const tours = await prisma.groupTour.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { departureDate: "asc" },
      include: { _count: { select: { bookings: true } } },
    });
    res.json(tours);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/group-tours
router.post("/", requirePermission("bookings", "create"), async (req, res) => {
  try {
    const { name, destination, departureDate, returnDate, capacity, status, notes } = req.body;
    if (!name) return res.status(400).json({ message: "name is required" });

    const tour = await prisma.groupTour.create({
      data: {
        tenantId: req.tenantId,
        name,
        destination: destination || null,
        departureDate: departureDate || null,
        returnDate: returnDate || null,
        capacity: parseInt(capacity) || 0,
        status: status || "upcoming",
        notes: notes || null,
        createdBy: req.userId,
      },
    });
    res.status(201).json(tour);
  } catch (e) {
    console.error("POST /group-tours error", e);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/group-tours/:id — full manifest
router.get("/:id", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const tour = await prisma.groupTour.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        bookings: {
          include: {
            booking: {
              include: {
                client: { select: { id: true, name: true, phone: true, email: true } },
                travelers: true,
              },
            },
          },
          orderBy: { seatNumber: "asc" },
        },
      },
    });
    if (!tour) return res.status(404).json({ message: "Group tour not found" });
    res.json(tour);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH /api/group-tours/:id
router.patch("/:id", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const existing = await prisma.groupTour.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ message: "Not found" });

    const { name, destination, departureDate, returnDate, capacity, status, notes } = req.body;
    const updated = await prisma.groupTour.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(destination !== undefined && { destination }),
        ...(departureDate !== undefined && { departureDate }),
        ...(returnDate !== undefined && { returnDate }),
        ...(capacity !== undefined && { capacity: parseInt(capacity) }),
        ...(status !== undefined && { status }),
        ...(notes !== undefined && { notes }),
      },
    });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/group-tours/:id
router.delete("/:id", requirePermission("bookings", "delete"), async (req, res) => {
  try {
    const existing = await prisma.groupTour.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ message: "Not found" });
    await prisma.groupTour.delete({ where: { id: req.params.id } });
    res.json({ message: "Deleted" });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/group-tours/:id/bookings — add a booking to group
router.post("/:id/bookings", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const { bookingId, seatNumber, roomNumber, roomType, notes } = req.body;
    if (!bookingId) return res.status(400).json({ message: "bookingId is required" });

    const tour = await prisma.groupTour.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!tour) return res.status(404).json({ message: "Tour not found" });

    const booking = await prisma.booking.findFirst({ where: { id: bookingId, tenantId: req.tenantId } });
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const entry = await prisma.groupTourBooking.upsert({
      where: { groupTourId_bookingId: { groupTourId: req.params.id, bookingId } },
      update: {
        seatNumber: seatNumber || null,
        roomNumber: roomNumber || null,
        roomType: roomType || null,
        notes: notes || null,
      },
      create: {
        groupTourId: req.params.id,
        bookingId,
        seatNumber: seatNumber || null,
        roomNumber: roomNumber || null,
        roomType: roomType || null,
        notes: notes || null,
      },
    });
    res.status(201).json(entry);
  } catch (e) {
    console.error("POST /group-tours/:id/bookings error", e);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/group-tours/:id/bookings/:bookingId — remove booking from group
router.delete("/:id/bookings/:bookingId", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    await prisma.groupTourBooking.deleteMany({
      where: { groupTourId: req.params.id, bookingId: req.params.bookingId },
    });
    res.json({ message: "Removed" });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
