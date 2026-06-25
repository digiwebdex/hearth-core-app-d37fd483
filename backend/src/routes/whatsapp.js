const router = require("express").Router();
const { authenticate, requireSuperAdmin, prisma } = require("../middleware/auth");
const { extractVariables } = require("../services/whatsappTemplateService");

router.use(authenticate);

router.get("/templates", async (_req, res) => {
  try {
    const items = await prisma.whatsAppTemplate.findMany({
      where: { tenantId: null },
      orderBy: { createdAt: "desc" },
    });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/templates/:id", async (req, res) => {
  try {
    const item = await prisma.whatsAppTemplate.findFirst({
      where: { id: req.params.id, tenantId: null },
    });
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/templates", requireSuperAdmin, async (req, res) => {
  try {
    const { name, type, message, metaTemplateName, variables, isActive } = req.body || {};
    if (!name || !type || !message) {
      return res.status(400).json({ message: "name, type, and message are required" });
    }
    const item = await prisma.whatsAppTemplate.create({
      data: {
        tenantId: null,
        name,
        type,
        message,
        metaTemplateName: metaTemplateName ? String(metaTemplateName).trim() : null,
        variables: Array.isArray(variables) ? variables : extractVariables(message),
        isActive: isActive !== false,
      },
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/templates/:id", requireSuperAdmin, async (req, res) => {
  try {
    const existing = await prisma.whatsAppTemplate.findFirst({
      where: { id: req.params.id, tenantId: null },
    });
    if (!existing) return res.status(404).json({ message: "Not found" });

    const data = {};
    for (const key of ["name", "type", "message", "metaTemplateName", "isActive"]) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }
    if (req.body.variables !== undefined) data.variables = req.body.variables;
    else if (req.body.message !== undefined) data.variables = extractVariables(req.body.message);

    const item = await prisma.whatsAppTemplate.update({ where: { id: existing.id }, data });
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/templates/:id", requireSuperAdmin, async (req, res) => {
  try {
    const result = await prisma.whatsAppTemplate.deleteMany({
      where: { id: req.params.id, tenantId: null },
    });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
