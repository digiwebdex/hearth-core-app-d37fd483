const router = require("express").Router();
const { authenticate, requireFeature, requirePermission, prisma } = require("../middleware/auth");
const { sendSms } = require("../services/smsService");
const { sendWhatsApp } = require("../services/whatsappService");
const { sendEmail } = require("../services/emailService");

router.use(authenticate);
// Marketing campaigns are a Business/Ultimate feature (hasMarketingTools).
router.use(requireFeature("hasMarketingTools"));

const MAX_RECIPIENTS = 1000;
const ALLOWED = ["name", "channel", "subject", "body", "audienceType", "audienceValue", "status"];
function pick(body) {
  const out = {};
  for (const k of ALLOWED) if (body[k] !== undefined) out[k] = body[k];
  return out;
}

// Resolve the recipient client list for an audience segment + channel.
async function resolveAudience(tenantId, type, value, channel) {
  const where = { tenantId };
  if (type === "tag" && value) where.tags = { has: value };
  else if (type === "clientType" && value) where.clientType = value;
  const clients = await prisma.client.findMany({
    where, select: { id: true, name: true, phone: true, email: true },
  });
  // Keep only contactable recipients for the chosen channel.
  return clients.filter((c) => (channel === "email" ? !!c.email : !!c.phone));
}

function render(body, client) {
  return String(body || "").replace(/\{\{\s*name\s*\}\}/gi, client.name || "");
}

router.get("/", requirePermission("clients", "view"), async (req, res) => {
  try {
    res.json(await prisma.campaign.findMany({ where: { tenantId: req.tenantId }, orderBy: { createdAt: "desc" } }));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Preview how many contactable recipients a segment has.
router.get("/audience-preview", requirePermission("clients", "view"), async (req, res) => {
  try {
    const list = await resolveAudience(req.tenantId, req.query.type, req.query.value, req.query.channel || "sms");
    res.json({ count: list.length });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/:id", requirePermission("clients", "view"), async (req, res) => {
  try {
    const c = await prisma.campaign.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!c) return res.status(404).json({ message: "Not found" });
    res.json(c);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/", requirePermission("clients", "create"), async (req, res) => {
  try {
    const data = pick(req.body);
    if (!data.name) return res.status(400).json({ message: "Campaign name is required" });
    res.status(201).json(await prisma.campaign.create({ data: { ...data, status: "draft", tenantId: req.tenantId, createdBy: req.userId } }));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.patch("/:id", requirePermission("clients", "edit"), async (req, res) => {
  try {
    const existing = await prisma.campaign.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (existing.status === "sent") return res.status(400).json({ message: "A sent campaign cannot be edited" });
    await prisma.campaign.updateMany({ where: { id: req.params.id, tenantId: req.tenantId }, data: pick(req.body) });
    res.json(await prisma.campaign.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } }));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete("/:id", requirePermission("clients", "delete"), async (req, res) => {
  try {
    const result = await prisma.campaign.deleteMany({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Execute the campaign: resolve audience, send through the channel, record counts.
router.post("/:id/send", requirePermission("clients", "edit"), async (req, res) => {
  try {
    const c = await prisma.campaign.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!c) return res.status(404).json({ message: "Not found" });
    if (c.status === "sent") return res.status(400).json({ message: "Campaign already sent" });
    if (!c.body?.trim()) return res.status(400).json({ message: "Campaign message is empty" });

    const recipients = (await resolveAudience(req.tenantId, c.audienceType, c.audienceValue, c.channel)).slice(0, MAX_RECIPIENTS);
    let sent = 0, failed = 0;
    for (const client of recipients) {
      const message = render(c.body, client);
      try {
        if (c.channel === "sms") await sendSms({ to: client.phone, message });
        else if (c.channel === "whatsapp") await sendWhatsApp({ to: client.phone, message, tenantId: req.tenantId });
        else if (c.channel === "email") await sendEmail({ to: client.email, subject: c.subject || c.name, html: `<p>${message.replace(/\n/g, "<br/>")}</p>`, text: message });
        sent++;
      } catch { failed++; }
    }

    const updated = await prisma.campaign.update({
      where: { id: c.id },
      data: { status: "sent", recipientCount: recipients.length, sentCount: sent, failedCount: failed, sentAt: new Date() },
    });
    res.json(updated);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
