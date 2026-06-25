const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { authenticate, prisma, SECRET } = require("../middleware/auth");
const { validatePassword } = require("../utils/passwordPolicy");
const { getTrialDays, addTrialExpiry } = require("../lib/trialConfig");
const { validatePhone, validateEmail } = require("../utils/contactValidation");
const { normalizeEnabledSubcategories } = require("../constants/serviceSubcategories");

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    let user = null;
    try {
      user = await prisma.user.findUnique({ where: { email } });
    } catch (_e) {
      // Avoid leaking DB/connectivity errors on auth endpoints.
      return res.status(401).json({ message: "Invalid credentials" });
    }
    if (!user) return res.status(401).json({ message: "Invalid credentials" });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: "Invalid credentials" });

    // Approval gate
    if (user.status === "pending") {
      return res.status(403).json({
        message: "Your account is pending admin approval. You will be notified once approved.",
        code: "PENDING_APPROVAL",
      });
    }
    if (user.status === "rejected") {
      return res.status(403).json({
        message: user.rejectionReason
          ? `Account rejected: ${user.rejectionReason}`
          : "Your account has been rejected. Please contact support.",
        code: "REJECTED",
      });
    }

    const token = jwt.sign({ userId: user.id, tenantId: user.tenantId, role: user.role }, SECRET, { expiresIn: "7d" });
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }).catch(() => {});
    const { password: _, resetToken: _r, resetTokenExpiry: _e, ...safeUser } = user;

    // Audit log — login
    const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { name: true } });
    await prisma.auditLog.create({
      data: {
        actorId: user.id, actorName: user.name, actorEmail: user.email, actorRole: user.role,
        tenantId: user.tenantId, tenantName: tenant?.name || null,
        module: "auth", action: "login",
        targetType: "user", targetId: user.id, targetLabel: user.email,
        ipAddress: req.headers["x-forwarded-for"]?.toString()?.split(",")[0] || req.ip || null,
      },
    }).catch(() => {});

    res.json({ token, user: safeUser });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Register — auto-approved with Pro trial, returns JWT immediately (Pattern B)
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, tenantName, plan, phone, enabledSubcategories, enabledServiceTypes } = req.body;

    if (!String(name || "").trim()) return res.status(400).json({ message: "Full name is required" });
    if (!String(tenantName || "").trim()) return res.status(400).json({ message: "Agency name is required" });

    const emailCheck = validateEmail(email);
    if (!emailCheck.ok) return res.status(400).json({ message: emailCheck.message });

    const phoneCheck = validatePhone(phone);
    if (!phoneCheck.ok) return res.status(400).json({ message: phoneCheck.message });

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.ok) return res.status(400).json({ message: passwordCheck.message });

    const exists = await prisma.user.findUnique({ where: { email: emailCheck.email } });
    if (exists) return res.status(400).json({ message: "Email already registered" });
    const hashed = await bcrypt.hash(password, 10);

    // Pro trial — length from TRIAL_DAYS env (default 7)
    const trialEnd = addTrialExpiry();
    const trialDays = getTrialDays();

    const allowedPlans = ["free", "basic", "pro", "business", "enterprise"];
    const requestedPlan = allowedPlans.includes(plan) ? plan : "pro";
    // Free → no trial, instant active; everyone else → Pro trial regardless of intended plan
    const subscriptionPlan = requestedPlan === "free" ? "free" : "pro";
    const subscriptionStatus = requestedPlan === "free" ? "active" : "trial";
    const subscriptionExpiry = requestedPlan === "free" ? null : trialEnd;

    const rawSlug = (tenantName || name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
    let slug = rawSlug;
    let suffix = 1;
    while (await prisma.tenant.findUnique({ where: { slug } })) {
      slug = `${rawSlug}-${suffix++}`;
    }

    const tenant = await prisma.tenant.create({
      data: {
        name: tenantName || name + "'s Agency",
        slug,
        phone: phoneCheck.phone,
        subscriptionPlan,
        subscriptionStatus,
        subscriptionExpiry,
        enabledSubcategories: normalizeEnabledSubcategories(enabledSubcategories),
        enabledServiceTypes: Array.isArray(enabledServiceTypes)
          ? [...new Set(enabledServiceTypes.map((v) => String(v).trim().toLowerCase()).filter(Boolean))]
          : [],
      },
    });

    // Email verification token (24h)
    const emailVerifyToken = crypto.randomBytes(32).toString("hex");
    const emailVerifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await prisma.user.create({
      data: {
        name: String(name).trim(),
        email: emailCheck.email,
        phone: phoneCheck.phone,
        password: hashed,
        role: "tenant_owner",
        status: "active", // auto-approved
        tenantId: tenant.id,
        emailVerified: false,
        emailVerifyToken,
        emailVerifyExpiry,
      },
    });
    await prisma.tenant.update({ where: { id: tenant.id }, data: { ownerId: user.id } });

    try {
      const { createPlatformNotification } = require("../services/platformNotificationService");
      await createPlatformNotification({
        type: "new_tenant",
        title: "New Tenant Registered",
        message: `${tenant.name} (${emailCheck.email}, ${phoneCheck.phone}) signed up for ${subscriptionPlan} (${subscriptionStatus}).`,
        link: "/admin/tenants",
        metadata: { tenantId: tenant.id, email: emailCheck.email, phone: phoneCheck.phone, plan: subscriptionPlan },
      });
    } catch (_e) { /* non-blocking */ }

    await prisma.auditLog.create({
      data: {
        actorId: user.id, actorName: name, actorEmail: emailCheck.email, actorRole: "tenant_owner",
        tenantId: tenant.id, tenantName: tenant.name,
        module: "auth", action: "signup",
        targetType: "user", targetId: user.id, targetLabel: emailCheck.email,
        newValue: `auto-approved · ${subscriptionStatus} · plan:${subscriptionPlan} · intended:${requestedPlan} · phone:${phoneCheck.phone}`,
      },
    }).catch(() => {});

    try {
      const { sendEmailVerification } = require("../services/emailService");
      sendEmailVerification(emailCheck.email, name, emailVerifyToken).catch(() => {});
    } catch (e) { /* ignore */ }

    try {
      const { notifyNewSignup } = require("../services/telegramService");
      notifyNewSignup({ name, email: emailCheck.email, phone: phoneCheck.phone, tenantName: tenant.name, userId: user.id, plan: requestedPlan }).catch(() => {});
    } catch (e) { /* ignore */ }

    // Issue JWT — instant access
    const token = jwt.sign({ userId: user.id, tenantId: tenant.id, role: user.role }, SECRET, { expiresIn: "7d" });
    const { password: _, resetToken: _r, resetTokenExpiry: _e, emailVerifyToken: _vt, ...safeUser } = user;

    res.json({
      token,
      user: safeUser,
      tenant,
      intendedPlan: requestedPlan,
      trialDays: requestedPlan === "free" ? 0 : trialDays,
      emailVerificationSent: true,
      message: requestedPlan === "free"
        ? "Welcome! Your free account is ready. Please verify your email."
        : `Welcome! Your ${trialDays}-day Pro trial has started. Please verify your email.`,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Verify email — public, by token
router.post("/verify-email", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: "Token is required" });
    const user = await prisma.user.findFirst({
      where: { emailVerifyToken: token, emailVerifyExpiry: { gt: new Date() } },
    });
    if (!user) return res.status(400).json({ message: "Invalid or expired verification link" });
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailVerifyToken: null, emailVerifyExpiry: null },
    });
    res.json({ message: "Email verified successfully", email: user.email });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Resend verification email — authenticated
router.post("/resend-verification", authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.emailVerified) return res.json({ message: "Email already verified" });

    const emailVerifyToken = crypto.randomBytes(32).toString("hex");
    const emailVerifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifyToken, emailVerifyExpiry },
    });
    const { sendEmailVerification } = require("../services/emailService");
    await sendEmailVerification(user.email, user.name, emailVerifyToken);
    res.json({ message: "Verification email sent" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Me
router.get("/me", authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ message: "User not found" });
    const { password: _, resetToken: _r, resetTokenExpiry: _e, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Forgot Password — generates reset token
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal if email exists
      return res.json({ message: "If an account exists with that email, a reset link has been sent." });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry },
    });

    // Send password reset email (SMTP or console fallback)
    const { sendPasswordReset } = require("../services/emailService");
    await sendPasswordReset(email, resetToken);

    res.json({ message: "If an account exists with that email, a reset link has been sent." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Reset Password — validates token and updates password
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ message: "Token and password are required" });
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.ok) return res.status(400).json({ message: passwordCheck.message });

    const user = await prisma.user.findFirst({
      where: { resetToken: token, resetTokenExpiry: { gt: new Date() } },
    });
    if (!user) return res.status(400).json({ message: "Invalid or expired reset token" });

    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, resetToken: null, resetTokenExpiry: null },
    });

    // Audit log
    const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { name: true } });
    await prisma.auditLog.create({
      data: {
        actorId: user.id, actorName: user.name, actorEmail: user.email, actorRole: user.role,
        tenantId: user.tenantId, tenantName: tenant?.name || null,
        module: "auth", action: "password_reset",
        targetType: "user", targetId: user.id, targetLabel: user.email,
      },
    }).catch(() => {});

    res.json({ message: "Password has been reset successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Logout audit (optional — called by frontend)
router.post("/logout", authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true, email: true, role: true, tenantId: true } });
    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId }, select: { name: true } });
    await prisma.auditLog.create({
      data: {
        actorId: req.userId, actorName: user?.name || "", actorEmail: user?.email || "", actorRole: user?.role || "",
        tenantId: req.tenantId, tenantName: tenant?.name || null,
        module: "auth", action: "logout",
        targetType: "user", targetId: req.userId, targetLabel: user?.email || "",
        ipAddress: req.headers["x-forwarded-for"]?.toString()?.split(",")[0] || req.ip || null,
      },
    }).catch(() => {});
    res.json({ message: "Logged out" });
  } catch (err) {
    res.json({ message: "Logged out" });
  }
});

module.exports = router;
