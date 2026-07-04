const router = require("express").Router();
const { authenticate, requirePermission, prisma } = require("../middleware/auth");

router.use(authenticate);

const ALLOWED = [
  "visaType", "country", "duration", "sponsorId", "visaId", "occupation",
  "buyingPrice", "sellingPrice", "status", "buyerName", "agentId", "notes",
];
function pick(body) {
  const out = {};
  for (const k of ALLOWED) if (body[k] !== undefined) out[k] = body[k];
  if (out.buyingPrice !== undefined) out.buyingPrice = Number(out.buyingPrice) || 0;
  if (out.sellingPrice !== undefined) out.sellingPrice = Number(out.sellingPrice) || 0;
  return out;
}

async function getOne(id, tenantId) {
  return prisma.visaStock.findFirst({ where: { id, tenantId } });
}

router.get("/", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const where = { tenantId: req.tenantId };
    if (req.query.status) where.status = String(req.query.status);
    res.json(await prisma.visaStock.findMany({ where, orderBy: { createdAt: "desc" } }));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/stats", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const rows = await prisma.visaStock.findMany({ where: { tenantId: req.tenantId }, select: { status: true, profit: true, sellingPrice: true, buyingPrice: true } });
    const stats = { total: rows.length, available: 0, processing: 0, sold: 0, completed: 0, stockValue: 0, soldProfit: 0 };
    for (const r of rows) {
      if (stats[r.status] !== undefined) stats[r.status]++;
      if (r.status === "available" || r.status === "processing") stats.stockValue += r.buyingPrice || 0;
      if (r.status === "sold" || r.status === "completed") stats.soldProfit += r.profit || 0;
    }
    res.json(stats);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/:id", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const item = await getOne(req.params.id, req.tenantId);
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json(item);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/", requirePermission("bookings", "create"), async (req, res) => {
  try {
    const data = pick(req.body);
    if (!data.visaType) return res.status(400).json({ message: "Visa type is required" });
    data.profit = (data.sellingPrice || 0) - (data.buyingPrice || 0);
    res.status(201).json(await prisma.visaStock.create({ data: { ...data, tenantId: req.tenantId, createdBy: req.userId } }));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.patch("/:id", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const existing = await getOne(req.params.id, req.tenantId);
    if (!existing) return res.status(404).json({ message: "Not found" });
    const data = pick(req.body);
    // Recompute profit from the resulting buying/selling prices.
    const buying = data.buyingPrice ?? existing.buyingPrice;
    const selling = data.sellingPrice ?? existing.sellingPrice;
    data.profit = (selling || 0) - (buying || 0);
    await prisma.visaStock.updateMany({ where: { id: req.params.id, tenantId: req.tenantId }, data });
    res.json(await getOne(req.params.id, req.tenantId));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Mark a visa sold: set status, buyer, selling price → profit recomputed.
router.post("/:id/sell", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const existing = await getOne(req.params.id, req.tenantId);
    if (!existing) return res.status(404).json({ message: "Not found" });
    const sellingPrice = req.body.sellingPrice !== undefined ? Number(req.body.sellingPrice) || 0 : existing.sellingPrice;
    await prisma.visaStock.updateMany({
      where: { id: req.params.id, tenantId: req.tenantId },
      data: { status: "sold", buyerName: req.body.buyerName || existing.buyerName, agentId: req.body.agentId || existing.agentId, sellingPrice, profit: sellingPrice - (existing.buyingPrice || 0) },
    });
    res.json(await getOne(req.params.id, req.tenantId));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete("/:id", requirePermission("bookings", "delete"), async (req, res) => {
  try {
    const result = await prisma.visaStock.deleteMany({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
