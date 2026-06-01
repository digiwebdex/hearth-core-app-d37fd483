const router = require("express").Router();
const { authenticate, requirePermission, checkPlanLimit, prisma } = require("../middleware/auth");

router.use(authenticate);

async function getTenantClient(clientId, tenantId, include = undefined) {
  return prisma.client.findFirst({ where: { id: clientId, tenantId }, include });
}

router.get("/", requirePermission("clients", "view"), async (req, res) => {
  try {
    const items = await prisma.client.findMany({ where: { tenantId: req.tenantId }, orderBy: { createdAt: "desc" } });
    res.json(items);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/:id", requirePermission("clients", "view"), async (req, res) => {
  try {
    const item = await getTenantClient(req.params.id, req.tenantId, { documents: true });
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json(item);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/", requirePermission("clients", "create"), checkPlanLimit("clients"), async (req, res) => {
  try {
    const item = await prisma.client.create({ data: { ...req.body, tenantId: req.tenantId } });
    res.status(201).json(item);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.patch("/:id", requirePermission("clients", "edit"), async (req, res) => {
  try {
    const result = await prisma.client.updateMany({ where: { id: req.params.id, tenantId: req.tenantId }, data: req.body });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    const updated = await prisma.client.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    res.json(updated);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete("/:id", requirePermission("clients", "delete"), async (req, res) => {
  try {
    const result = await prisma.client.deleteMany({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/:id/bookings", requirePermission("clients", "view"), async (req, res) => {
  try {
    const client = await getTenantClient(req.params.id, req.tenantId);
    if (!client) return res.status(404).json({ message: "Not found" });
    const items = await prisma.booking.findMany({ where: { clientId: req.params.id, tenantId: req.tenantId } });
    res.json(items);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/:id/invoices", requirePermission("clients", "view"), async (req, res) => {
  try {
    const client = await getTenantClient(req.params.id, req.tenantId);
    if (!client) return res.status(404).json({ message: "Not found" });
    const items = await prisma.invoice.findMany({ where: { clientId: req.params.id, tenantId: req.tenantId } });
    res.json(items);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/:id/payments", requirePermission("clients", "view"), async (req, res) => {
  try {
    const client = await getTenantClient(req.params.id, req.tenantId);
    if (!client) return res.status(404).json({ message: "Not found" });
    const invoices = await prisma.invoice.findMany({ where: { clientId: req.params.id, tenantId: req.tenantId }, select: { id: true } });
    const ids = invoices.map((i) => i.id);
    const items = ids.length ? await prisma.payment.findMany({ where: { tenantId: req.tenantId, invoiceId: { in: ids } } }) : [];
    res.json(items);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;