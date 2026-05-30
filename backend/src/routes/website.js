const fs = require("fs");
const path = require("path");
const router = require("express").Router();
const { authenticate, requirePermission, prisma } = require("../middleware/auth");

const ALLOWED_ASSET_TYPES = new Set(["logo", "hero", "about", "gallery"]);
const ALLOWED_MIME_TYPES = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
};
const MAX_ASSET_SIZE_BYTES = 8 * 1024 * 1024;
const WEBSITE_UPLOAD_DIR = path.join(__dirname, "../../uploads/website-assets");

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

function parseAssetPayload(body = {}) {
  const rawData = String(body.dataUrl || body.base64 || "").trim();
  if (!rawData) throw new Error("Image data is required");

  let mimeType = String(body.contentType || "").trim().toLowerCase();
  let encoded = rawData;
  const match = rawData.match(/^data:(.+?);base64,(.+)$/);
  if (match) {
    mimeType = mimeType || match[1].toLowerCase();
    encoded = match[2];
  }

  const extension = ALLOWED_MIME_TYPES[mimeType];
  if (!extension) throw new Error("Only PNG, JPG, JPEG, WEBP, or SVG images are allowed");

  const buffer = Buffer.from(encoded, "base64");
  if (!buffer.length) throw new Error("Invalid image data");
  if (buffer.length > MAX_ASSET_SIZE_BYTES) throw new Error("Image must be 8 MB or smaller");

  return { extension, buffer };
}

function sanitizeBaseName(value) {
  return String(value || "website-asset")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50) || "website-asset";
}

function ensureUploadDirectory(tenantId) {
  const tenantDir = path.join(WEBSITE_UPLOAD_DIR, tenantId);
  fs.mkdirSync(tenantDir, { recursive: true });
  return tenantDir;
}

function buildAssetResponse(req, tenantId, fileName) {
  const apiBase = (process.env.API_BASE_URL || `${req.protocol}://${req.get("host")}/api`).replace(/\/$/, "");
  const origin = apiBase.endsWith("/api") ? apiBase.slice(0, -4) : apiBase;
  return {
    assetUrl: `${origin}/uploads/website-assets/${tenantId}/${fileName}`,
    fileName,
  };
}

router.use(authenticate);

router.post("/upload-asset", requirePermission("website", "edit"), async (req, res) => {
  try {
    if (!req.tenantId) return res.status(400).json({ message: "Tenant context required" });
    const assetType = String(req.body?.assetType || "").trim().toLowerCase();
    if (!ALLOWED_ASSET_TYPES.has(assetType)) return res.status(400).json({ message: "Invalid asset type" });

    const { extension, buffer } = parseAssetPayload(req.body || {});
    const tenantDir = ensureUploadDirectory(req.tenantId);
    const baseName = sanitizeBaseName(req.body?.fileName || `${assetType}-image`);
    const fileName = `${assetType}-${Date.now()}-${baseName}${extension}`;
    fs.writeFileSync(path.join(tenantDir, fileName), buffer);

    res.status(201).json(buildAssetResponse(req, req.tenantId, fileName));
  } catch (err) {
    console.error("website/upload-asset POST error", err);
    res.status(400).json({ message: err.message || "Upload failed" });
  }
});

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