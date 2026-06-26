const router = require("express").Router();
const { authenticate, requirePermission, prisma } = require("../middleware/auth");

router.use(authenticate);

function calcTotal(b) {
  const fareDiff = parseFloat(b.fareDifference) || 0;
  const reissueFee = parseFloat(b.reissueFee) || 0;
  const agencyFee = parseFloat(b.agencyFee) || 0;
  return fareDiff + reissueFee + agencyFee;
}

function calcFareDiff(b) {
  const newFare = parseFloat(b.newFare) || 0;
  const originalFare = parseFloat(b.originalFare) || 0;
  return newFare - originalFare;
}

router.get("/", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const where = { tenantId: req.tenantId };
    if (req.query.status) where.status = req.query.status;
    const reissues = await prisma.ticketReissue.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { booking: { select: { id: true, title: true } } },
    });
    res.json(reissues);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const record = await prisma.ticketReissue.findFirst({
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
    const originalFare = parseFloat(b.originalFare) || 0;
    const newFare = parseFloat(b.newFare) || 0;
    const fareDifference = b.fareDifference !== undefined ? parseFloat(b.fareDifference) : newFare - originalFare;
    const reissueFee = parseFloat(b.reissueFee) || 0;
    const agencyFee = parseFloat(b.agencyFee) || 0;
    const data = {
      tenantId: req.tenantId,
      bookingId: b.bookingId || null,
      reissueRef: b.reissueRef || null,
      pnr: b.pnr || null,
      ticketNumber: b.ticketNumber || null,
      clientName: b.clientName || null,
      airline: b.airline || null,
      originalRoute: b.originalRoute || null,
      newRoute: b.newRoute || null,
      originalDate: b.originalDate || null,
      newDate: b.newDate || null,
      originalFare,
      newFare,
      fareDifference,
      reissueFee,
      agencyFee,
      totalCharge: fareDifference + reissueFee + agencyFee,
      reason: b.reason || null,
      status: b.status || "requested",
      notes: b.notes || null,
    };
    const record = await prisma.ticketReissue.create({ data });
    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/:id", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const existing = await prisma.ticketReissue.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ message: "Not found" });
    const b = req.body;
    const data = {};
    const strFields = ["bookingId","reissueRef","pnr","ticketNumber","clientName","airline","originalRoute","newRoute","originalDate","newDate","reason","status","notes"];
    for (const f of strFields) if (b[f] !== undefined) data[f] = b[f] || null;
    const numFields = ["originalFare","newFare","fareDifference","reissueFee","agencyFee"];
    for (const f of numFields) if (b[f] !== undefined) data[f] = parseFloat(b[f]) || 0;
    const merged = { ...existing, ...data };
    if (Object.keys(data).some(k => [...numFields, "fareDifference"].includes(k))) {
      const fd = data.fareDifference !== undefined ? data.fareDifference : (merged.newFare - merged.originalFare);
      data.fareDifference = fd;
      data.totalCharge = fd + (merged.reissueFee || 0) + (merged.agencyFee || 0);
    }
    if (b.status === "completed") data.completedAt = new Date();
    const record = await prisma.ticketReissue.update({ where: { id: existing.id }, data });
    res.json(record);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", requirePermission("bookings", "delete"), async (req, res) => {
  try {
    const result = await prisma.ticketReissue.deleteMany({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
