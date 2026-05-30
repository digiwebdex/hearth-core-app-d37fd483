const router = require("express").Router();
const { authenticate, requirePermission, prisma } = require("../middleware/auth");

function parseNotes(notes) {
  if (!notes || typeof notes !== "string") return {};
  const trimmed = notes.trim();
  if (!trimmed) return {};
  if (!trimmed.startsWith("{")) return { legacyNotes: notes };
  try { return JSON.parse(trimmed); }
  catch { return { legacyNotes: notes }; }
}

function validateWebsiteConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return "Website config must be an object";
  }
  if (!config.template || typeof config.template !== "string") {
    return "Website template is required";
  }
  if (!config.colors || typeof config.colors !== "object") {
    return "Website colors are required";
  }
  if (!config.content || typeof config.content !== "object") {
    return "Website content is required";
  }
  return null;
}

router.use(authenticate);

router.get("/config", requirePermission("website", "view"), async (req, res) => {
  try {
    if (!req.tenantId) return res.status(400).json({ message: "Tenant context required" });
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: { notes: true },
    });
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });

    const config = parseNotes(tenant.notes).websiteConfig;
    if (!config) return res.status(404).json({ message: "Website config not found" });
    res.json(config);
  } catch (err) {
    console.error("website/config GET error", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/config", requirePermission("website", "edit"), async (req, res) => {
  try {
    if (!req.tenantId) return res.status(400).json({ message: "Tenant context required" });
    const validationError = validateWebsiteConfig(req.body);
    if (validationError) return res.status(400).json({ message: validationError });

    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: { notes: true },
    });
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });

    const notes = parseNotes(tenant.notes);
    notes.websiteConfig = req.body;
    if (req.body.socialLinks) notes.socialLinks = req.body.socialLinks;

    await prisma.tenant.update({
      where: { id: req.tenantId },
      data: { notes: JSON.stringify(notes) },
    });

    res.json(req.body);
  } catch (err) {
    console.error("website/config POST error", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
