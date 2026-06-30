/**
 * Platform Staff — super admin's internal team accounts
 * Stored in PlatformStaff table (separate from tenant Users).
 * Login via POST /api/auth/platform-staff/login
 */
const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { authenticate, requireSuperAdmin, prisma } = require("../middleware/auth");
const { getJwtSecret } = require("../middleware/jwtSecret");

const SECRET = getJwtSecret();

const PERMISSION_OPTIONS = [
  { key: "agencies",      label: "Agencies — view & manage" },
  { key: "payments",      label: "Payments — view & approve" },
  { key: "subscriptions", label: "Subscriptions — activate & extend" },
  { key: "reports",       label: "Reports & Analytics" },
  { key: "audit_log",     label: "Audit Log" },
  { key: "whatsapp",      label: "WhatsApp Logs & Send" },
  { key: "sms",           label: "SMS Logs" },
  { key: "domains",       label: "Domains" },
  { key: "master_data",   label: "Master Data" },
];

// ── Platform staff login (public) ─────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password required" });

    const staff = await prisma.platformStaff.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!staff) return res.status(401).json({ message: "Invalid credentials" });
    if (staff.status !== "active") return res.status(403).json({ message: "Account is inactive" });

    const valid = await bcrypt.compare(password, staff.password);
    if (!valid) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { staffId: staff.id, role: "platform_staff", permissions: staff.permissions },
      SECRET,
      { expiresIn: "12h" }
    );

    const { password: _, ...safeStaff } = staff;
    res.json({ token, staff: safeStaff, role: "platform_staff" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── All routes below require super_admin ──────────────────────────────────────
router.use(authenticate);
router.use(requireSuperAdmin);

// Permission options metadata
router.get("/meta/permissions", (_req, res) => {
  res.json({ permissions: PERMISSION_OPTIONS });
});

// List all platform staff
router.get("/", async (_req, res) => {
  try {
    const staff = await prisma.platformStaff.findMany({
      select: { id: true, name: true, email: true, phone: true, status: true, permissions: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ staff });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create platform staff
router.post("/", async (req, res) => {
  try {
    const { name, email, phone, password, permissions = [] } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: "Name is required" });
    if (!email?.trim()) return res.status(400).json({ message: "Email is required" });
    if (!password || password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });

    const exists = await prisma.platformStaff.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (exists) return res.status(400).json({ message: "Email already in use" });

    const hashed = await bcrypt.hash(password, 10);
    const staff = await prisma.platformStaff.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone?.trim() || null,
        password: hashed,
        permissions,
        status: "active",
      },
      select: { id: true, name: true, email: true, phone: true, status: true, permissions: true, createdAt: true },
    });
    res.json({ staff });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update staff
router.patch("/:id", async (req, res) => {
  try {
    const { name, phone, status, permissions, password } = req.body;
    const data = {};
    if (name) data.name = name.trim();
    if (phone !== undefined) data.phone = phone?.trim() || null;
    if (status) data.status = status;
    if (permissions) data.permissions = permissions;
    if (password) {
      if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });
      data.password = await bcrypt.hash(password, 10);
    }
    const staff = await prisma.platformStaff.update({
      where: { id: req.params.id },
      data,
      select: { id: true, name: true, email: true, phone: true, status: true, permissions: true, updatedAt: true },
    });
    res.json({ staff });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete staff
router.delete("/:id", async (req, res) => {
  try {
    await prisma.platformStaff.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
