const router = require("express").Router();
const { authenticate, requireSuperAdmin, requireFeature, prisma } = require("../middleware/auth");
const { extractVariables } = require("../services/whatsappTemplateService");
const { sendWhatsApp, getWhatsAppConfig } = require("../services/whatsappService");

router.use(authenticate);
router.use(requireFeature("hasWhatsApp"));

// GET /api/whatsapp/config — return current provider config (no secrets)
router.get("/config", async (req, res) => {
  res.json(getWhatsAppConfig());
});

// POST /api/whatsapp/test — send a test message
router.post("/test", async (req, res) => {
  const { to, message } = req.body;
  if (!to) return res.status(400).json({ message: "Recipient phone number required" });
  const result = await sendWhatsApp({ to, message: message || "Test message from your Travel Agency ERP system." });
  res.json(result);
});

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

// ── WhatsApp Logs (super admin only) ─────────────────────────────────────────

// GET /api/whatsapp/logs — paginated log list with filters
router.get("/logs", requireSuperAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const where = {};
    if (req.query.status && req.query.status !== "all") where.status = req.query.status;
    if (req.query.phone) where.phone = { contains: req.query.phone };
    if (req.query.tenantId) where.tenantId = req.query.tenantId;

    const [logs, total, sent, failed, pending] = await Promise.all([
      prisma.whatsAppLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
      prisma.whatsAppLog.count({ where }),
      prisma.whatsAppLog.count({ where: { status: "sent" } }),
      prisma.whatsAppLog.count({ where: { status: "failed" } }),
      prisma.whatsAppLog.count({ where: { status: "pending" } }),
    ]);

    res.json({ logs, total, page, limit, stats: { total: sent + failed + pending, sent, failed, pending } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/whatsapp/send — send a WhatsApp message and log it
router.post("/send", requireSuperAdmin, async (req, res) => {
  try {
    const { to, message } = req.body;
    if (!to || !message) return res.status(400).json({ message: "to and message required" });
    const result = await sendWhatsApp({ to, message, createdByUserId: req.user?.id });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
