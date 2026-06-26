const router = require("express").Router();
const { authenticate, requirePermission, prisma } = require("../middleware/auth");

router.use(authenticate);

router.get("/", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const where = { tenantId: req.tenantId };
    if (req.query.status) where.status = req.query.status;
    const voids = await prisma.ticketVoid.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { booking: { select: { id: true, title: true } } },
    });
    res.json(voids);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const record = await prisma.ticketVoid.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: { booking: { select: { id: true, title: true } } },
    });
    if (!record) return res.status(404).json({ message: "Not found" });
    res.json(record);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", requirePermission("bookings", "create"), async (req, res) => {
  try {
    const b = req.body;
    const data = {
      tenantId: req.tenantId,
      bookingId: b.bookingId || null,
      voidRef: b.voidRef || null,
      pnr: b.pnr || null,
      ticketNumber: b.ticketNumber || null,
      clientName: b.clientName || null,
      airline: b.airline || null,
      ticketDate: b.ticketDate || null,
      voidDeadline: b.voidDeadline || null,
      originalFare: parseFloat(b.originalFare) || 0,
      voidReason: b.voidReason || null,
      status: b.status || "pending",
      notes: b.notes || null,
    };
    const record = await prisma.ticketVoid.create({ data });
    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/:id", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const existing = await prisma.ticketVoid.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ message: "Not found" });
    const b = req.body;
    const data = {};
    const fields = ["bookingId","voidRef","pnr","ticketNumber","clientName","airline","ticketDate","voidDeadline","voidReason","status","notes"];
    for (const f of fields) if (b[f] !== undefined) data[f] = b[f] || null;
    if (b.originalFare !== undefined) data.originalFare = parseFloat(b.originalFare) || 0;
    if (b.status === "voided") data.voidedAt = new Date();
    const record = await prisma.ticketVoid.update({ where: { id: existing.id }, data });
    res.json(record);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", requirePermission("bookings", "delete"), async (req, res) => {
  try {
    const result = await prisma.ticketVoid.deleteMany({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
