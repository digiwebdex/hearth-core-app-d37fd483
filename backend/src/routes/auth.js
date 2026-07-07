const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
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

    // TOTP check — super_admin with 2FA enabled must provide totpCode
    if (user.role === "super_admin" && user.totpEnabled && user.totpSecret) {
      const { totpCode } = req.body;
      if (!totpCode) {
        return res.status(200).json({ requires2FA: true });
      }
      const verified = speakeasy.totp.verify({
        secret: user.totpSecret,
        encoding: "base32",
        token: String(totpCode).replace(/\s/g, ""),
        window: 1,
      });
      if (!verified) {
        return res.status(401).json({ message: "Invalid authenticator code", requires2FA: true });
      }
    }

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
// Check if an email is available (pre-signup, public)
router.get("/check-email", async (req, res) => {
  try {
    const ec = validateEmail(req.query.email);
    if (!ec.ok) return res.status(400).json({ available: false, message: ec.message });
    const exists = await prisma.user.findUnique({ where: { email: ec.email }, select: { id: true } });
    return res.json({ available: !exists, email: ec.email });
  } catch (err) {
    return res.status(500).json({ available: true }); // fail-open; register re-checks
  }
});

// ─── WhatsApp OTP verification (pre-signup) ──────────────────────────────────

const OTP_TTL_MS = 5 * 60 * 1000;        // 5 minutes
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds between sends
const OTP_MAX_SENDS = 5;                   // per number per hour
const OTP_MAX_ATTEMPTS = 5;

// Send a 6-digit code to a WhatsApp number
router.post("/whatsapp-otp/send", async (req, res) => {
  try {
    const phoneCheck = validatePhone(req.body.whatsapp || req.body.phone);
    if (!phoneCheck.ok) return res.status(400).json({ message: phoneCheck.message });
    const phone = phoneCheck.phone;

    // Rate limit: cooldown + hourly cap
    const recent = await prisma.whatsappOtp.findFirst({
      where: { phone, purpose: "signup" },
      orderBy: { createdAt: "desc" },
    });
    const now = Date.now();
    if (recent) {
      const since = now - new Date(recent.createdAt).getTime();
      if (since < OTP_RESEND_COOLDOWN_MS) {
        const wait = Math.ceil((OTP_RESEND_COOLDOWN_MS - since) / 1000);
        return res.status(429).json({ message: `Please wait ${wait}s before requesting a new code.`, retryAfter: wait });
      }
      // hourly cap
      const hourAgo = new Date(now - 60 * 60 * 1000);
      const sendsInHour = await prisma.whatsappOtp.count({ where: { phone, purpose: "signup", createdAt: { gte: hourAgo } } });
      if (sendsInHour >= OTP_MAX_SENDS) {
        return res.status(429).json({ message: "Too many code requests. Please try again later." });
      }
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await prisma.whatsappOtp.create({
      data: { phone, code, purpose: "signup", expiresAt: new Date(now + OTP_TTL_MS) },
    });

    const message =
      `🔐 Your verification code is *${code}*\n\n` +
      `This code expires in 5 minutes.\n` +
      `Do not share it with anyone.`;

    let delivered = false;
    try {
      const { sendWhatsApp } = require("../services/whatsappService");
      const result = await sendWhatsApp({ to: phone, message });
      delivered = !!(result && result.success);
    } catch (_e) { delivered = false; }

    return res.json({
      sent: true,
      delivered,
      whatsapp: phone,
      expiresInSec: OTP_TTL_MS / 1000,
      message: delivered
        ? "Verification code sent to your WhatsApp."
        : "We could not confirm delivery — check the number and try resending.",
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// Verify a code → returns short-lived proof token
router.post("/whatsapp-otp/verify", async (req, res) => {
  try {
    const phoneCheck = validatePhone(req.body.whatsapp || req.body.phone);
    if (!phoneCheck.ok) return res.status(400).json({ message: phoneCheck.message });
    const phone = phoneCheck.phone;
    const code = String(req.body.code || "").trim();
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ message: "Enter the 6-digit code." });

    const otp = await prisma.whatsappOtp.findFirst({
      where: { phone, purpose: "signup", verified: false },
      orderBy: { createdAt: "desc" },
    });
    if (!otp) return res.status(400).json({ message: "No active code. Please request a new one." });
    if (new Date(otp.expiresAt).getTime() < Date.now()) {
      return res.status(400).json({ message: "Code expired. Please request a new one." });
    }
    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      return res.status(429).json({ message: "Too many attempts. Please request a new code." });
    }
    if (otp.code !== code) {
      await prisma.whatsappOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      return res.status(400).json({ message: "Incorrect code. Please try again." });
    }

    await prisma.whatsappOtp.update({ where: { id: otp.id }, data: { verified: true } });

    // Proof token — bound to this number, valid 30 min, consumed at register
    const whatsappVerifyToken = jwt.sign(
      { whatsapp: phone, purpose: "wa_verify" }, SECRET, { expiresIn: "30m" }
    );
    return res.json({ verified: true, whatsapp: phone, whatsappVerifyToken });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, tenantName, plan, phone, whatsapp, whatsappVerifyToken, enabledSubcategories, enabledServiceTypes } = req.body;

    if (!String(name || "").trim()) return res.status(400).json({ message: "Full name is required" });
    if (!String(tenantName || "").trim()) return res.status(400).json({ message: "Agency name is required" });

    const emailCheck = validateEmail(email);
    if (!emailCheck.ok) return res.status(400).json({ message: emailCheck.message });

    const phoneCheck = validatePhone(phone);
    if (!phoneCheck.ok) return res.status(400).json({ message: phoneCheck.message });

    // WhatsApp number (defaults to mobile if not provided)
    const whatsappCheck = validatePhone(whatsapp || phone);
    if (!whatsappCheck.ok) return res.status(400).json({ message: "Valid WhatsApp number is required" });

    // Verify the WhatsApp proof token bound to this number
    let whatsappVerified = false;
    if (whatsappVerifyToken) {
      try {
        const decoded = jwt.verify(whatsappVerifyToken, SECRET);
        whatsappVerified = decoded.purpose === "wa_verify" && decoded.whatsapp === whatsappCheck.phone;
      } catch (_e) { whatsappVerified = false; }
    }
    if (!whatsappVerified) {
      return res.status(400).json({ message: "Please verify your WhatsApp number first.", code: "WHATSAPP_NOT_VERIFIED" });
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.ok) return res.status(400).json({ message: passwordCheck.message });

    const exists = await prisma.user.findUnique({ where: { email: emailCheck.email } });
    if (exists) return res.status(400).json({ message: "Email already registered" });
    const hashed = await bcrypt.hash(password, 10);

    // Pro trial — length from TRIAL_DAYS env (default 7)
    const trialEnd = addTrialExpiry();
    const trialDays = getTrialDays();

    // Enterprise is Contact Sales — it is never self-provisioned. A self-serve
    // signup that asks for enterprise is given a full-featured Business trial and
    // flagged as an enterprise lead for sales follow-up.
    const allowedPlans = ["free", "basic", "pro", "business"];
    const requestedPlan = String(plan || "").trim().toLowerCase();
    const enterpriseLead = requestedPlan === "enterprise";
    const subscriptionPlan = allowedPlans.includes(requestedPlan) ? requestedPlan : (enterpriseLead ? "business" : "basic");
    // Free → no trial, instant active; paid plans → trial of their chosen plan
    const subscriptionStatus = subscriptionPlan === "free" ? "active" : "trial";
    const subscriptionExpiry = subscriptionPlan === "free" ? null : trialEnd;

    const normalizedServiceTypes = Array.isArray(enabledServiceTypes)
      ? [...new Set(enabledServiceTypes.map((v) => String(v).trim().toLowerCase()).filter(Boolean))]
      : [];
    const { ensurePrimaryBranch, deriveModuleFlags } = require("../lib/tenantProvisioning");
    const moduleFlags = deriveModuleFlags(normalizedServiceTypes);

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
        whatsapp: whatsappCheck.phone,
        subscriptionPlan,
        subscriptionStatus,
        subscriptionExpiry,
        enableHajjUmrahModule: moduleFlags.enableHajjUmrahModule,
        enableBdOperationsModule: moduleFlags.enableBdOperationsModule,
        enabledSubcategories: normalizeEnabledSubcategories(enabledSubcategories),
        enabledServiceTypes: normalizedServiceTypes,
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
        whatsapp: whatsappCheck.phone,
        whatsappVerified: true,
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

    // Provision the default primary branch and assign the owner to it — every
    // tenant must have a primary branch (staff are branch-scoped).
    await ensurePrimaryBranch(prisma, tenant.id).catch((e) => console.error("[REGISTER] Branch provisioning error:", e?.message || e));

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
        newValue: `auto-approved · ${subscriptionStatus} · plan:${subscriptionPlan} · phone:${phoneCheck.phone}`,
      },
    }).catch(() => {});

    try {
      const { sendEmailVerification } = require("../services/emailService");
      sendEmailVerification(emailCheck.email, name, emailVerifyToken).catch(() => {});
    } catch (e) { /* ignore */ }

    try {
      const { notifyNewSignup } = require("../services/telegramService");
      notifyNewSignup({ name, email: emailCheck.email, phone: phoneCheck.phone, tenantName: tenant.name, userId: user.id, plan: subscriptionPlan }).catch(() => {});
    } catch (e) { /* ignore */ }

    // Issue JWT — instant access
    const token = jwt.sign({ userId: user.id, tenantId: tenant.id, role: user.role }, SECRET, { expiresIn: "7d" });
    const { password: _, resetToken: _r, resetTokenExpiry: _e, emailVerifyToken: _vt, ...safeUser } = user;

    res.json({
      token,
      user: safeUser,
      tenant,
      trialDays: subscriptionPlan === "free" ? 0 : trialDays,
      emailVerificationSent: true,
      message: subscriptionPlan === "free"
        ? "Welcome! Your free account is ready. Please verify your email."
        : `Welcome! Your ${trialDays}-day ${subscriptionPlan.charAt(0).toUpperCase() + subscriptionPlan.slice(1)} trial has started. Please verify your email.`,
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

// Update current user profile (name + optional password change)
router.patch("/me", authenticate, async (req, res) => {
  try {
    const { name, currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ message: "User not found" });

    const data = {};
    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) return res.status(400).json({ message: "Name cannot be empty" });
      data.name = trimmed;
    }
    if (newPassword !== undefined) {
      if (!currentPassword) return res.status(400).json({ message: "Current password is required" });
      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) return res.status(400).json({ message: "Current password is incorrect" });
      const { validatePassword } = require("../utils/passwordPolicy");
      const check = validatePassword(newPassword);
      if (!check.ok) return res.status(400).json({ message: check.message });
      data.password = await bcrypt.hash(newPassword, 10);
    }
    if (Object.keys(data).length === 0) return res.status(400).json({ message: "No fields to update" });

    const updated = await prisma.user.update({ where: { id: req.userId }, data });
    const { password: _, resetToken: _r, resetTokenExpiry: _e, ...safeUser } = updated;
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

// ── TOTP (Google Authenticator) — super_admin only ───────────────────────────

// GET /api/auth/totp/setup — generate secret + QR code URI
router.get("/totp/setup", authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true, email: true, totpEnabled: true } });
    if (!user || user.role !== "super_admin") return res.status(403).json({ message: "Super admin only" });
    if (user.totpEnabled) return res.status(400).json({ message: "2FA is already enabled" });

    const secret = speakeasy.generateSecret({ name: `TravelERP (${user.email})`, length: 20 });
    // Store temp secret (not yet confirmed)
    await prisma.user.update({ where: { id: req.userId }, data: { totpSecret: secret.base32 } });

    const otpauthUrl = secret.otpauth_url;
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
    res.json({ secret: secret.base32, qrDataUrl });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/totp/enable — verify first code and activate 2FA
router.post("/totp/enable", authenticate, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: "Code required" });

    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true, totpSecret: true, totpEnabled: true } });
    if (!user || user.role !== "super_admin") return res.status(403).json({ message: "Super admin only" });
    if (user.totpEnabled) return res.status(400).json({ message: "2FA already enabled" });
    if (!user.totpSecret) return res.status(400).json({ message: "Run setup first" });

    const verified = speakeasy.totp.verify({
      secret: user.totpSecret,
      encoding: "base32",
      token: String(code).replace(/\s/g, ""),
      window: 1,
    });
    if (!verified) return res.status(400).json({ message: "Invalid code — check your authenticator app" });

    await prisma.user.update({ where: { id: req.userId }, data: { totpEnabled: true } });
    res.json({ message: "2FA enabled successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/totp/disable — disable 2FA (requires current code)
router.post("/totp/disable", authenticate, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: "Code required" });

    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true, totpSecret: true, totpEnabled: true } });
    if (!user || user.role !== "super_admin") return res.status(403).json({ message: "Super admin only" });
    if (!user.totpEnabled) return res.status(400).json({ message: "2FA is not enabled" });

    const verified = speakeasy.totp.verify({
      secret: user.totpSecret,
      encoding: "base32",
      token: String(code).replace(/\s/g, ""),
      window: 1,
    });
    if (!verified) return res.status(400).json({ message: "Invalid code" });

    await prisma.user.update({ where: { id: req.userId }, data: { totpEnabled: false, totpSecret: null } });
    res.json({ message: "2FA disabled" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/auth/totp/status — check if 2FA is enabled
router.get("/totp/status", authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true, totpEnabled: true } });
    if (!user || user.role !== "super_admin") return res.status(403).json({ message: "Super admin only" });
    res.json({ totpEnabled: user.totpEnabled });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/super-admin/reset-password — super admin resets own password (no current password needed)
router.post("/super-admin/reset-password", authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || user.role !== "super_admin") return res.status(403).json({ message: "Super admin only" });
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });
    const { validatePassword } = require("../utils/passwordPolicy");
    const check = validatePassword(newPassword);
    if (!check.ok) return res.status(400).json({ message: check.message });
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.userId }, data: { password: hashed } });
    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/auth/whatsapp-config — get WhatsApp provider config
router.get("/whatsapp-config", authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true } });
    if (!user || user.role !== "super_admin") return res.status(403).json({ message: "Super admin only" });
    const { getWhatsAppConfig } = require("../services/whatsappService");
    res.json(getWhatsAppConfig());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
