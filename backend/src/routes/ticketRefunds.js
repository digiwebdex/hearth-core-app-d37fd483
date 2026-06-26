const router = require("express").Router();
const { authenticate, requirePermission, prisma } = require("../middleware/auth");

router.use(authenticate);

function calcNet(body) {
  const airlineRefund = parseFloat(body.airlineRefund) || 0;
  const taxRefund = parseFloat(body.taxRefund) || 0;
  const agencyFee = parseFloat(body.agencyFee) || 0;
  return airlineRefund + taxRefund - agencyFee;
}

router.get("/", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const where = { tenantId: req.tenantId };
    if (req.query.status) where.status = req.query.status;
    const refunds = await prisma.ticketRefund.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { booking: { select: { id: true, title: true } } },
    });
    res.json(refunds);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const record = await prisma.ticketRefund.findFirst({
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
      refundRef: b.refundRef || null,
      pnr: b.pnr || null,
      ticketNumber: b.ticketNumber || null,
      clientName: b.clientName || null,
      airline: b.airline || null,
      originalFare: parseFloat(b.originalFare) || 0,
      airlineRefund: parseFloat(b.airlineRefund) || 0,
      taxRefund: parseFloat(b.taxRefund) || 0,
      agencyFee: parseFloat(b.agencyFee) || 0,
      netRefundAmount: calcNet(b),
      reason: b.reason || null,
      status: b.status || "requested",
      refundMethod: b.refundMethod || null,
      notes: b.notes || null,
    };
    const record = await prisma.ticketRefund.create({ data });
    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/:id", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const existing = await prisma.ticketRefund.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ message: "Not found" });
    const b = req.body;
    const merged = { ...existing, ...b };
    const data = {};
    const fields = ["bookingId","refundRef","pnr","ticketNumber","clientName","airline","reason","status","refundMethod","notes"];
    for (const f of fields) if (b[f] !== undefined) data[f] = b[f] || null;
    const numFields = ["originalFare","airlineRefund","taxRefund","agencyFee"];
    for (const f of numFields) if (b[f] !== undefined) data[f] = parseFloat(b[f]) || 0;
    if (Object.keys(data).some(k => numFields.includes(k))) {
      data.netRefundAmount = calcNet(merged);
    }
    if (b.status === "completed" || b.status === "approved") {
      data.processedAt = data.processedAt || new Date();
    }
    const record = await prisma.ticketRefund.update({ where: { id: existing.id }, data });
    res.json(record);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", requirePermission("bookings", "delete"), async (req, res) => {
  try {
    const result = await prisma.ticketRefund.deleteMany({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
