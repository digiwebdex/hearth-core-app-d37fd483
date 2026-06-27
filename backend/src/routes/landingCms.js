const fs = require("fs");
const path = require("path");
const router = require("express").Router();
const { authenticate, requireSuperAdmin } = require("../middleware/auth");

const CMS_FILE = path.join(__dirname, "../../data/landing-cms.json");

function ensureDataDir() {
  const dir = path.dirname(CMS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readCms() {
  try {
    if (fs.existsSync(CMS_FILE)) return JSON.parse(fs.readFileSync(CMS_FILE, "utf8"));
  } catch {}
  return {};
}

function writeCms(data) {
  ensureDataDir();
  fs.writeFileSync(CMS_FILE, JSON.stringify(data, null, 2));
}

// PUBLIC — anyone can fetch
router.get("/", (req, res) => {
  res.json(readCms());
});

// ADMIN — super_admin only
router.post("/", authenticate, requireSuperAdmin, (req, res) => {
  try {
    const data = req.body;
    if (!data || typeof data !== "object") return res.status(400).json({ message: "Invalid body" });
    writeCms(data);
    res.json({ ok: true });
  } catch (e) {
    console.error("landingCms POST error", e);
    res.status(500).json({ message: "Failed to save" });
  }
});

// Upload hero/about image (base64)
router.post("/upload", authenticate, requireSuperAdmin, (req, res) => {
  try {
    const { dataUrl, fileName } = req.body || {};
    if (!dataUrl || !fileName) return res.status(400).json({ message: "dataUrl and fileName required" });
    ensureDataDir();
    const uploadsDir = path.join(__dirname, "../../uploads/landing");
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const base64 = dataUrl.replace(/^data:[^;]+;base64,/, "");
    const safeName = `${Date.now()}-${path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, "")}`;
    fs.writeFileSync(path.join(uploadsDir, safeName), Buffer.from(base64, "base64"));
    const url = `/uploads/landing/${safeName}`;
    res.json({ url });
  } catch (e) {
    console.error("landingCms upload error", e);
    res.status(500).json({ message: "Upload failed" });
  }
});

module.exports = router;
