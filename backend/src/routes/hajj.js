const router = require("express").Router();
const { authenticate, requirePermission, prisma } = require("../middleware/auth");

router.use(authenticate);

// Every route enforces the shared "hajj_umrah" permission matrix (auth.js
// ROLE_PERMISSIONS), like every other resource. Without these gates any
// authenticated tenant user — including roles with only view/export rights —
// could create/edit/delete Hajj packages, groups, pilgrims, and payments
// (audit M2). super_admin bypasses inside requirePermission.
const canView = requirePermission("hajj_umrah", "view");
const canCreate = requirePermission("hajj_umrah", "create");
const canEdit = requirePermission("hajj_umrah", "edit");
const canDelete = requirePermission("hajj_umrah", "delete");

// Packages
router.get("/packages", canView, async (req, res) => {
  try { res.json(await prisma.hajjPackage.findMany({ where: { tenantId: req.tenantId }, orderBy: { createdAt: "desc" } })); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
router.get("/packages/:id", canView, async (req, res) => {
  try {
    const p = await prisma.hajjPackage.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!p) return res.status(404).json({ message: "Not found" });
    res.json(p);
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.post("/packages", canCreate, async (req, res) => {
  try { res.status(201).json(await prisma.hajjPackage.create({ data: { ...req.body, tenantId: req.tenantId } })); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
router.patch("/packages/:id", canEdit, async (req, res) => {
  try {
    const existing = await prisma.hajjPackage.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ message: "Not found" });
    res.json(await prisma.hajjPackage.update({ where: { id: req.params.id }, data: req.body }));
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.delete("/packages/:id", canDelete, async (req, res) => {
  try { await prisma.hajjPackage.deleteMany({ where: { id: req.params.id, tenantId: req.tenantId } }); res.json({ success: true }); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

// Groups
router.get("/groups", canView, async (req, res) => {
  try {
    const where = { tenantId: req.tenantId };
    if (req.query.packageId) where.packageId = req.query.packageId;
    res.json(await prisma.hajjGroup.findMany({ where, orderBy: { createdAt: "desc" } }));
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.post("/groups", canCreate, async (req, res) => {
  try { res.status(201).json(await prisma.hajjGroup.create({ data: { ...req.body, tenantId: req.tenantId } })); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
router.patch("/groups/:id", canEdit, async (req, res) => {
  try {
    const existing = await prisma.hajjGroup.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ message: "Not found" });
    res.json(await prisma.hajjGroup.update({ where: { id: req.params.id }, data: req.body }));
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.delete("/groups/:id", canDelete, async (req, res) => {
  try { await prisma.hajjGroup.deleteMany({ where: { id: req.params.id, tenantId: req.tenantId } }); res.json({ success: true }); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

// Pilgrims
router.get("/pilgrims", canView, async (req, res) => {
  try {
    const where = { tenantId: req.tenantId };
    if (req.query.packageId) where.packageId = req.query.packageId;
    res.json(await prisma.hajjPilgrim.findMany({ where, orderBy: { createdAt: "desc" } }));
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.post("/pilgrims", canCreate, async (req, res) => {
  try {
    const pilgrim = await prisma.hajjPilgrim.create({ data: { ...req.body, tenantId: req.tenantId } });
    // Update enrolled count
    const count = await prisma.hajjPilgrim.count({ where: { packageId: pilgrim.packageId } });
    await prisma.hajjPackage.update({ where: { id: pilgrim.packageId }, data: { enrolled: count } });
    res.status(201).json(pilgrim);
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.patch("/pilgrims/:id", canEdit, async (req, res) => {
  try {
    const existing = await prisma.hajjPilgrim.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ message: "Not found" });
    res.json(await prisma.hajjPilgrim.update({ where: { id: req.params.id }, data: req.body }));
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.delete("/pilgrims/:id", canDelete, async (req, res) => {
  try {
    const p = await prisma.hajjPilgrim.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!p) return res.status(404).json({ message: "Not found" });
    await prisma.hajjPilgrim.delete({ where: { id: req.params.id } });
    const count = await prisma.hajjPilgrim.count({ where: { packageId: p.packageId } });
    await prisma.hajjPackage.update({ where: { id: p.packageId }, data: { enrolled: count } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Pilgrim Payments
router.get("/pilgrims/:id/payments", canView, async (req, res) => {
  try {
    const pilgrim = await prisma.hajjPilgrim.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!pilgrim) return res.status(404).json({ message: "Not found" });
    res.json(await prisma.hajjPilgrimPayment.findMany({ where: { pilgrimId: req.params.id }, orderBy: { createdAt: "desc" } }));
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.post("/pilgrims/:id/payments", canCreate, async (req, res) => {
  try {
    const pilgrim = await prisma.hajjPilgrim.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!pilgrim) return res.status(404).json({ message: "Not found" });

    const payment = await prisma.hajjPilgrimPayment.create({ data: { ...req.body, pilgrimId: req.params.id, receivedBy: req.userId } });
    const payments = await prisma.hajjPilgrimPayment.findMany({ where: { pilgrimId: req.params.id } });
    const paid = payments.reduce((s, p) => s + p.amount, 0);
    await prisma.hajjPilgrim.update({
      where: { id: req.params.id },
      data: {
        paidAmount: paid,
        dueAmount: pilgrim.totalAmount - paid,
        paymentStatus: paid >= pilgrim.totalAmount ? "paid" : paid > 0 ? "partial" : "unpaid",
      },
    });
    res.status(201).json(payment);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
