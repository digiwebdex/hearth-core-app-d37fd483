const router = require("express").Router();
const { authenticate, requirePermission, requireRole, prisma } = require("../middleware/auth");

router.use(authenticate);

const DEFAULTS = {
  leadSources: ["website", "facebook", "referral", "walk_in", "phone", "whatsapp"],
  followUpTypes: ["call", "whatsapp", "email", "meeting", "site_visit"],
  complaintCategories: ["general", "booking", "payment", "service", "refund", "staff"],
  customFields: [],
  automations: { leadWonCreateTask: false, complaintNotifyOwner: false },
};

async function getOrCreate(tenantId) {
  let cfg = await prisma.crmConfig.findUnique({ where: { tenantId } });
  if (!cfg) cfg = await prisma.crmConfig.create({ data: { tenantId, ...DEFAULTS } });
  return cfg;
}

router.get("/", requirePermission("clients", "view"), async (req, res) => {
  try {
    res.json(await getOrCreate(req.tenantId));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Only the owner/manager configure CRM settings.
router.patch("/", requireRole("tenant_owner", "manager", "owner"), async (req, res) => {
  try {
    await getOrCreate(req.tenantId);
    const data = {};
    const cleanList = (v) => [...new Set((Array.isArray(v) ? v : []).map((x) => String(x).trim()).filter(Boolean))];
    if (req.body.leadSources !== undefined) data.leadSources = cleanList(req.body.leadSources);
    if (req.body.followUpTypes !== undefined) data.followUpTypes = cleanList(req.body.followUpTypes);
    if (req.body.complaintCategories !== undefined) data.complaintCategories = cleanList(req.body.complaintCategories);
    if (req.body.customFields !== undefined) {
      const raw = Array.isArray(req.body.customFields) ? req.body.customFields : [];
      data.customFields = raw
        .filter((f) => f && f.label)
        .map((f) => ({
          key: String(f.key || f.label).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
          label: String(f.label),
          type: ["text", "number", "date", "select"].includes(f.type) ? f.type : "text",
          appliesTo: f.appliesTo === "lead" ? "lead" : "client",
          options: Array.isArray(f.options) ? f.options.map(String) : [],
        }));
    }
    if (req.body.automations !== undefined && typeof req.body.automations === "object") {
      data.automations = {
        leadWonCreateTask: !!req.body.automations.leadWonCreateTask,
        complaintNotifyOwner: !!req.body.automations.complaintNotifyOwner,
      };
    }
    const cfg = await prisma.crmConfig.update({ where: { tenantId: req.tenantId }, data });
    res.json(cfg);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
module.exports.getOrCreate = getOrCreate;
