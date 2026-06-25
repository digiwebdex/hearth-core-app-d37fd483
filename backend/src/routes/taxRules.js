const router = require("express").Router();
const { authenticate, requirePermission, prisma } = require("../middleware/auth");

router.use(authenticate);

// GET /api/tax-rules — list all tax rules for the tenant
router.get("/", requirePermission("settings", "view"), async (req, res) => {
  try {
    const rules = await prisma.taxRule.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { createdAt: "asc" },
    });
    res.json(rules);
  } catch (e) {
    console.error("GET /tax-rules error", e);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/tax-rules — create a new tax rule
router.post("/", requirePermission("settings", "edit"), async (req, res) => {
  try {
    const { name, rate, type, appliesTo, isDefault, isActive } = req.body;
    if (!name || rate === undefined) {
      return res.status(400).json({ message: "name and rate are required" });
    }

    // If setting as default, clear existing default
    if (isDefault) {
      await prisma.taxRule.updateMany({
        where: { tenantId: req.tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const rule = await prisma.taxRule.create({
      data: {
        tenantId: req.tenantId,
        name,
        rate: parseFloat(rate),
        type: type || "percentage",
        appliesTo: appliesTo || "all",
        isDefault: isDefault || false,
        isActive: isActive !== false,
      },
    });
    res.status(201).json(rule);
  } catch (e) {
    console.error("POST /tax-rules error", e);
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH /api/tax-rules/:id — update a tax rule
router.patch("/:id", requirePermission("settings", "edit"), async (req, res) => {
  try {
    const { name, rate, type, appliesTo, isDefault, isActive } = req.body;

    const existing = await prisma.taxRule.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!existing) return res.status(404).json({ message: "Tax rule not found" });

    if (isDefault) {
      await prisma.taxRule.updateMany({
        where: { tenantId: req.tenantId, isDefault: true, id: { not: req.params.id } },
        data: { isDefault: false },
      });
    }

    const rule = await prisma.taxRule.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(rate !== undefined && { rate: parseFloat(rate) }),
        ...(type !== undefined && { type }),
        ...(appliesTo !== undefined && { appliesTo }),
        ...(isDefault !== undefined && { isDefault }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    res.json(rule);
  } catch (e) {
    console.error("PATCH /tax-rules/:id error", e);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/tax-rules/:id
router.delete("/:id", requirePermission("settings", "edit"), async (req, res) => {
  try {
    const existing = await prisma.taxRule.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!existing) return res.status(404).json({ message: "Tax rule not found" });

    await prisma.taxRule.delete({ where: { id: req.params.id } });
    res.json({ message: "Deleted" });
  } catch (e) {
    console.error("DELETE /tax-rules/:id error", e);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/tax-rules/default — get the default active tax rule
router.get("/default", requirePermission("settings", "view"), async (req, res) => {
  try {
    const rule = await prisma.taxRule.findFirst({
      where: { tenantId: req.tenantId, isDefault: true, isActive: true },
    });
    res.json(rule || null);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
