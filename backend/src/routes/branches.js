// Branch / Office CRUD — a core tenant-scoped ERP entity.
// Plan-limited (Starter 1 / Professional 3 / Business 10 / Enterprise ∞) via
// checkPlanLimit("branches"). Every query is scoped by req.tenantId; writes/deletes
// use updateMany/deleteMany with { id, tenantId } so a cross-tenant id 404s.
const router = require("express").Router();
const { authenticate, requirePermission, checkPlanLimit, prisma } = require("../middleware/auth");

router.use(authenticate);

const SELECT = {
  id: true, tenantId: true, name: true, code: true, address: true, city: true,
  phone: true, email: true, isPrimary: true, isActive: true, createdAt: true, updatedAt: true,
};

function pickBranchInput(body = {}) {
  const out = {};
  for (const key of ["name", "code", "address", "city", "phone", "email"]) {
    if (body[key] !== undefined) out[key] = body[key] === null ? null : String(body[key]).trim();
  }
  if (body.isActive !== undefined) out.isActive = Boolean(body.isActive);
  return out;
}

// List branches (with staff counts) for the tenant.
router.get("/", requirePermission("branches", "view"), async (req, res) => {
  try {
    const branches = await prisma.branch.findMany({
      where: { tenantId: req.tenantId },
      select: { ...SELECT, _count: { select: { users: true } } },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    });
    res.json(branches);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/:id", requirePermission("branches", "view"), async (req, res) => {
  try {
    const branch = await prisma.branch.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      select: { ...SELECT, _count: { select: { users: true } } },
    });
    if (!branch) return res.status(404).json({ message: "Branch not found" });
    res.json(branch);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Create a branch. Plan-limited; the first branch of a tenant is the primary.
router.post("/", requirePermission("branches", "create"), checkPlanLimit("branches"), async (req, res) => {
  try {
    const data = pickBranchInput(req.body);
    if (!data.name) return res.status(400).json({ message: "Branch name is required" });
    const existing = await prisma.branch.count({ where: { tenantId: req.tenantId } });
    const branch = await prisma.branch.create({
      data: { ...data, tenantId: req.tenantId, isPrimary: existing === 0 },
      select: SELECT,
    });
    res.status(201).json(branch);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.patch("/:id", requirePermission("branches", "edit"), async (req, res) => {
  try {
    const data = pickBranchInput(req.body);
    const result = await prisma.branch.updateMany({
      where: { id: req.params.id, tenantId: req.tenantId },
      data,
    });
    if (result.count === 0) return res.status(404).json({ message: "Branch not found" });
    const branch = await prisma.branch.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      select: SELECT,
    });
    res.json(branch);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Mark a branch as the tenant's primary (single primary per tenant).
router.patch("/:id/primary", requirePermission("branches", "edit"), async (req, res) => {
  try {
    const target = await prisma.branch.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      select: { id: true },
    });
    if (!target) return res.status(404).json({ message: "Branch not found" });
    await prisma.$transaction([
      prisma.branch.updateMany({ where: { tenantId: req.tenantId }, data: { isPrimary: false } }),
      prisma.branch.update({ where: { id: target.id }, data: { isPrimary: true, isActive: true } }),
    ]);
    const branch = await prisma.branch.findFirst({ where: { id: target.id }, select: SELECT });
    res.json(branch);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete("/:id", requirePermission("branches", "delete"), async (req, res) => {
  try {
    const branch = await prisma.branch.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      select: { id: true, isPrimary: true },
    });
    if (!branch) return res.status(404).json({ message: "Branch not found" });
    if (branch.isPrimary) {
      return res.status(400).json({ message: "Cannot delete the primary branch. Set another branch as primary first." });
    }
    // Staff/bookings/accounts keep working — their branchId is set to null (SetNull).
    await prisma.branch.deleteMany({ where: { id: req.params.id, tenantId: req.tenantId } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
