const router = require("express").Router();
const { authenticate, requireSuperAdmin, prisma } = require("../middleware/auth");
const { sendSms } = require("../services/smsService");
const { messagePreview } = require("../middleware/upload");

router.use(authenticate);

function mapEnvProvider() {
  const raw = (process.env.SMS_PROVIDER || "console").toLowerCase();
  if (raw === "bulksmsbd") return "bulksms";
  if (raw === "twilio") return "sslwireless";
  return raw === "console" ? "bulksms" : raw;
}

function providerBaseUrl() {
  const provider = (process.env.SMS_PROVIDER || "console").toLowerCase();
  if (provider === "bulksmsbd") return "https://bulksmsbd.net/api";
  if (provider === "twilio") return "https://api.twilio.com";
  return process.env.SMS_BASE_URL || "";
}

function isSmsEnabled() {
  return process.env.SMS_ENABLED !== "false";
}

function isApiKeyConfigured() {
  const provider = (process.env.SMS_PROVIDER || "console").toLowerCase();
  if (provider === "twilio") {
    return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
  }
  if (provider === "bulksmsbd") return Boolean(process.env.SMS_API_KEY);
  return process.env.SMS_PROVIDER === "console" || Boolean(process.env.SMS_API_KEY);
}

function getPublicConfig() {
  return {
    provider: mapEnvProvider(),
    senderId: process.env.SMS_SENDER_ID || process.env.TWILIO_FROM_NUMBER || "",
    baseUrl: providerBaseUrl(),
    enabled: isSmsEnabled(),
    apiKeyConfigured: isApiKeyConfigured(),
  };
}

function extractVariables(template) {
  const matches = template.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, "")))];
}

function formatLogListItem(log) {
  const { message, ...rest } = log;
  return { ...rest, messagePreview: messagePreview(message) };
}

async function createSmsLog(data) {
  return prisma.smsLog.create({ data });
}

async function dispatchSms({ phone, message, tenantId, userId, templateId, templateType }) {
  const log = await createSmsLog({
    tenantId: tenantId || null,
    phone,
    message,
    status: "pending",
    provider: process.env.SMS_PROVIDER || "console",
    templateId: templateId || null,
    templateType: templateType || null,
    createdByUserId: userId || null,
  });

  if (!isSmsEnabled()) {
    const updated = await prisma.smsLog.update({
      where: { id: log.id },
      data: { status: "failed", errorMessage: "SMS is disabled" },
    });
    return { success: false, status: "failed", error: "SMS is disabled", log: updated };
  }

  const result = await sendSms({ to: phone, message });
  const updated = await prisma.smsLog.update({
    where: { id: log.id },
    data: {
      status: result.success ? "sent" : "failed",
      provider: result.provider,
      providerMessageId: result.messageId || null,
      errorMessage: result.error || null,
      sentAt: result.success ? new Date() : null,
    },
  });

  return {
    success: result.success,
    status: updated.status,
    messageId: result.messageId,
    error: result.error,
    log: updated,
  };
}

// ── Config (super_admin, env-derived) ──
router.get("/config", requireSuperAdmin, (_req, res) => {
  res.json(getPublicConfig());
});

router.put("/config", requireSuperAdmin, (req, res) => {
  const body = req.body || {};
  if (body.apiKey !== undefined || body.apiSecret !== undefined) {
    return res.status(400).json({
      message: "SMS API credentials are environment-managed in production. Update SMS_API_KEY / TWILIO_* in server environment variables.",
      config: getPublicConfig(),
    });
  }

  res.json({
    ...getPublicConfig(),
    message: "SMS configuration is environment-managed. Only non-secret settings can be changed via deployment configuration (SMS_PROVIDER, SMS_SENDER_ID, SMS_ENABLED).",
  });
});

// ── Send ──
router.post("/send", async (req, res) => {
  try {
    const { phone, message, templateId } = req.body || {};
    if (!phone || !message) return res.status(400).json({ message: "phone and message are required" });

    let templateType;
    if (templateId) {
      const template = await prisma.smsTemplate.findFirst({
        where: { id: templateId, OR: [{ tenantId: null }, { tenantId: req.tenantId }], isActive: true },
      });
      if (!template) return res.status(404).json({ message: "Template not found" });
      templateType = template.type;
    }

    const result = await dispatchSms({
      phone,
      message,
      tenantId: req.tenantId,
      userId: req.userId,
      templateId,
      templateType,
    });

    res.status(result.success ? 200 : 502).json({
      success: result.success,
      messageId: result.messageId,
      status: result.status,
      error: result.error,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/send-bulk", requireSuperAdmin, async (req, res) => {
  try {
    const { phones, message, templateId } = req.body || {};
    if (!Array.isArray(phones) || !phones.length || !message) {
      return res.status(400).json({ message: "phones array and message are required" });
    }

    let templateType;
    if (templateId) {
      const template = await prisma.smsTemplate.findFirst({ where: { id: templateId, tenantId: null, isActive: true } });
      if (!template) return res.status(404).json({ message: "Template not found" });
      templateType = template.type;
    }

    const results = [];
    let sent = 0;
    let failed = 0;

    for (const phone of phones) {
      const result = await dispatchSms({
        phone,
        message,
        tenantId: req.tenantId,
        userId: req.userId,
        templateId,
        templateType,
      });
      if (result.success) sent += 1;
      else failed += 1;
      results.push({ phone, success: result.success, error: result.error });
    }

    res.json({ total: phones.length, sent, failed, results });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/test", requireSuperAdmin, async (req, res) => {
  try {
    const { phone } = req.body || {};
    if (!phone) return res.status(400).json({ message: "phone is required" });

    const result = await dispatchSms({
      phone,
      message: "Test SMS from Travel Agency Web — configuration check.",
      tenantId: req.tenantId,
      userId: req.userId,
    });

    res.status(result.success ? 200 : 502).json({
      success: result.success,
      messageId: result.messageId,
      status: result.status,
      error: result.error,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Logs ──
router.get("/logs/stats", requireSuperAdmin, async (_req, res) => {
  try {
    const [total, sent, failed, pending] = await Promise.all([
      prisma.smsLog.count(),
      prisma.smsLog.count({ where: { status: "sent" } }),
      prisma.smsLog.count({ where: { status: "failed" } }),
      prisma.smsLog.count({ where: { status: "pending" } }),
    ]);
    res.json({ total, sent, failed, pending });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/logs", requireSuperAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "20", 10)));
    const skip = (page - 1) * limit;

    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.phone) where.phone = { contains: req.query.phone, mode: "insensitive" };
    if (req.query.from || req.query.to) {
      where.createdAt = {};
      if (req.query.from) where.createdAt.gte = new Date(req.query.from);
      if (req.query.to) where.createdAt.lte = new Date(req.query.to);
    }

    const [logs, total] = await Promise.all([
      prisma.smsLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
      prisma.smsLog.count({ where }),
    ]);

    res.json({ logs: logs.map(formatLogListItem), total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/logs/:id", requireSuperAdmin, async (req, res) => {
  try {
    const log = await prisma.smsLog.findUnique({ where: { id: req.params.id } });
    if (!log) return res.status(404).json({ message: "Not found" });
    res.json(log);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Templates ──
router.get("/templates", async (_req, res) => {
  try {
    const items = await prisma.smsTemplate.findMany({
      where: { tenantId: null, isActive: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/templates/:id", async (req, res) => {
  try {
    const item = await prisma.smsTemplate.findFirst({
      where: { id: req.params.id, OR: [{ tenantId: null }, { tenantId: req.tenantId }] },
    });
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/templates", requireSuperAdmin, async (req, res) => {
  try {
    const { name, type, message, variables, isActive } = req.body || {};
    if (!name || !type || !message) return res.status(400).json({ message: "name, type, and message are required" });

    const item = await prisma.smsTemplate.create({
      data: {
        tenantId: null,
        name,
        type,
        message,
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
    const existing = await prisma.smsTemplate.findFirst({ where: { id: req.params.id, tenantId: null } });
    if (!existing) return res.status(404).json({ message: "Not found" });

    const data = {};
    for (const key of ["name", "type", "message", "isActive"]) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }
    if (req.body.variables !== undefined) data.variables = req.body.variables;
    else if (req.body.message !== undefined) data.variables = extractVariables(req.body.message);

    const item = await prisma.smsTemplate.update({ where: { id: req.params.id }, data });
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/templates/:id", requireSuperAdmin, async (req, res) => {
  try {
    const result = await prisma.smsTemplate.deleteMany({ where: { id: req.params.id, tenantId: null } });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
