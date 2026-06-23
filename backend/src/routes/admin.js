const router = require("express").Router();
const bcrypt = require("bcryptjs");
const { authenticate, requireSuperAdmin, prisma } = require("../middleware/auth");
const { validatePassword } = require("../utils/passwordPolicy");
const { normalizeEnabledSubcategories } = require("../constants/serviceSubcategories");

router.use(authenticate);
router.use(requireSuperAdmin);

// Create tenant manually (super admin)
router.post("/tenants", async (req, res) => {
  try {
    const {
      tenantName, ownerName, ownerEmail, ownerPassword,
      ownerPhone, ownerWhatsapp,
      companyPhone, companyWhatsapp, companyAddress, companyCity, companyCountry, companyWebsite, companyNotes,
      subscriptionPlan = "basic",
      subscriptionStatus = "active",
      subscriptionMonths = 1,
      enabledSubcategories,
      enabledServiceTypes,
    } = req.body;

    if (!tenantName || !ownerName || !ownerEmail || !ownerPassword) {
      return res.status(400).json({ message: "tenantName, ownerName, ownerEmail and ownerPassword are required" });
    }

    const passwordCheck = validatePassword(ownerPassword);
    if (!passwordCheck.ok) return res.status(400).json({ message: passwordCheck.message });

    const exists = await prisma.user.findUnique({ where: { email: ownerEmail } });
    if (exists) return res.status(400).json({ message: "Email already registered" });

    const rawSlug = tenantName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
    let slug = rawSlug || "tenant";
    let suffix = 1;
    while (await prisma.tenant.findUnique({ where: { slug } })) {
      slug = `${rawSlug}-${suffix++}`;
    }

    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + Number(subscriptionMonths || 1));

    const tenant = await prisma.tenant.create({
      data: {
        name: tenantName, slug,
        phone: companyPhone || null,
        whatsapp: companyWhatsapp || null,
        address: companyAddress || null,
        city: companyCity || null,
        country: companyCountry || null,
        website: companyWebsite || null,
        notes: companyNotes || null,
        subscriptionPlan, subscriptionStatus,
        subscriptionExpiry: expiry,
        enabledSubcategories: normalizeEnabledSubcategories(enabledSubcategories),
        enabledServiceTypes: Array.isArray(enabledServiceTypes)
          ? [...new Set(enabledServiceTypes.map((v) => String(v).trim().toLowerCase()).filter(Boolean))]
          : [],
      },
    });

    const hashed = await bcrypt.hash(ownerPassword, 10);
    const user = await prisma.user.create({
      data: {
        name: ownerName, email: ownerEmail, password: hashed, role: "tenant_owner",
        status: "active",
        approvedAt: new Date(),
        approvedBy: req.userId,
        phone: ownerPhone || null, whatsapp: ownerWhatsapp || null,
        tenantId: tenant.id,
      },
    });
    await prisma.tenant.update({ where: { id: tenant.id }, data: { ownerId: user.id } });

    const actor = await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true, email: true, role: true } });
    await prisma.auditLog.create({
      data: {
        actorId: req.userId, actorName: actor?.name || "", actorEmail: actor?.email || "", actorRole: actor?.role || "",
        tenantId: tenant.id, tenantName: tenant.name,
        module: "admin", action: "tenant_created",
        targetType: "tenant", targetId: tenant.id, targetLabel: tenant.name,
        newValue: JSON.stringify({ plan: subscriptionPlan, status: subscriptionStatus, months: subscriptionMonths }),
      },
    }).catch(() => {});

    res.json({ tenant, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// All tenants
router.get("/tenants", async (req, res) => {
  try {
    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { users: true, bookings: true } },
        users: { select: { id: true, name: true, email: true, role: true, phone: true, whatsapp: true, createdAt: true } },
      },
    });
    res.json(tenants);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/tenants/:id", async (req, res) => {
  try {
    const t = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      include: {
        users: { select: { id: true, name: true, email: true, role: true, phone: true, whatsapp: true, createdAt: true } },
        _count: { select: { users: true, bookings: true, clients: true, invoices: true } },
      },
    });
    if (!t) return res.status(404).json({ message: "Tenant not found" });
    res.json(t);
  } catch (err) { res.status(500).json({ message: err.message || "Failed to load tenant" }); }
});

// Only allow safe fields for admin tenant update
const ADMIN_ALLOWED_TENANT_FIELDS = [
  "name", "subscriptionPlan", "subscriptionStatus", "subscriptionExpiry",
  "phone", "whatsapp", "address", "city", "country", "website", "notes",
  "enabledServiceTypes", "enabledSubcategories",
  "enableHajjUmrahModule", "enableBdOperationsModule",
];

router.patch("/tenants/:id", async (req, res) => {
  try {
    const data = {};
    for (const key of ADMIN_ALLOWED_TENANT_FIELDS) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }
    if (data.subscriptionExpiry) data.subscriptionExpiry = new Date(data.subscriptionExpiry);
    if (data.enableHajjUmrahModule !== undefined) data.enableHajjUmrahModule = Boolean(data.enableHajjUmrahModule);
    if (data.enableBdOperationsModule !== undefined) data.enableBdOperationsModule = Boolean(data.enableBdOperationsModule);
    if (data.enabledServiceTypes !== undefined) {
      const raw = Array.isArray(data.enabledServiceTypes) ? data.enabledServiceTypes : [];
      data.enabledServiceTypes = [...new Set(raw.map((v) => String(v).trim().toLowerCase()).filter(Boolean))];
    }
    if (data.enabledSubcategories !== undefined) {
      data.enabledSubcategories = normalizeEnabledSubcategories(data.enabledSubcategories);
    }
    const updated = await prisma.tenant.update({ where: { id: req.params.id }, data });
    const actor = await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true, email: true, role: true } });
    await prisma.auditLog.create({
      data: {
        actorId: req.userId, actorName: actor?.name || "", actorEmail: actor?.email || "", actorRole: actor?.role || "",
        tenantId: updated.id, tenantName: updated.name,
        module: "admin", action: "tenant_updated",
        targetType: "tenant", targetId: updated.id, targetLabel: updated.name,
        newValue: JSON.stringify(data),
      },
    }).catch(() => {});
    res.json(updated);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Update tenant owner (name/email/password) — super admin
router.patch("/tenants/:id/owner", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    const tenant = await prisma.tenant.findUnique({ where: { id: req.params.id } });
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });

    let owner = null;
    if (tenant.ownerId) {
      owner = await prisma.user.findUnique({ where: { id: tenant.ownerId } });
    }
    if (!owner) {
      owner = await prisma.user.findFirst({
        where: { tenantId: tenant.id, role: { in: ["tenant_owner", "owner"] } },
      });
    }
    if (!owner) return res.status(404).json({ message: "Owner account not found" });

    const data = {};
    if (name !== undefined && name !== null && String(name).trim() !== "") data.name = String(name).trim();
    if (email !== undefined && email !== null && String(email).trim() !== "") {
      const newEmail = String(email).trim();
      if (newEmail !== owner.email) {
        const dup = await prisma.user.findFirst({ where: { email: { equals: newEmail, mode: "insensitive" } } });
        if (dup && dup.id !== owner.id) return res.status(400).json({ message: "Email already in use" });
        data.email = newEmail;
      }
    }
    if (password !== undefined && password !== null && String(password).length > 0) {
      if (String(password).length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
      data.password = await bcrypt.hash(String(password), 10);
    }

    if (Object.keys(data).length === 0) return res.status(400).json({ message: "No changes provided" });

    const updated = await prisma.user.update({ where: { id: owner.id }, data });

    const actor = await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true, email: true, role: true } });
    await prisma.auditLog.create({
      data: {
        actorId: req.userId, actorName: actor?.name || "", actorEmail: actor?.email || "", actorRole: actor?.role || "",
        tenantId: tenant.id, tenantName: tenant.name,
        module: "admin", action: data.password ? "owner_password_reset" : "owner_updated",
        targetType: "user", targetId: owner.id, targetLabel: updated.email,
        newValue: JSON.stringify({ ...data, password: data.password ? "[hashed]" : undefined }),
      },
    }).catch(() => {});

    res.json({ id: updated.id, name: updated.name, email: updated.email, role: updated.role });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Delete tenant (super admin) — cascades via Prisma relations where configured
router.delete("/tenants/:id", async (req, res) => {
  try {
    const t = await prisma.tenant.findUnique({ where: { id: req.params.id } });
    if (!t) return res.status(404).json({ message: "Not found" });

    // Best-effort cascade — delete dependent rows that may not have ON DELETE CASCADE
    const tx = [];
    const tryDel = (model) => { if (prisma[model]) tx.push(prisma[model].deleteMany({ where: { tenantId: t.id } }).catch(() => {})); };
    [
      "payment", "invoice", "quotation", "booking", "lead", "client", "vendor",
      "expense", "task", "agent", "account", "tenantDomain", "smsLog", "notification",
      "subscription", "paymentRequest", "auditLog",
    ].forEach(tryDel);
    await Promise.all(tx);

    // Detach owner reference, then remove users, then tenant
    await prisma.tenant.update({ where: { id: t.id }, data: { ownerId: null } }).catch(() => {});
    await prisma.user.deleteMany({ where: { tenantId: t.id } }).catch(() => {});
    await prisma.tenant.delete({ where: { id: t.id } });

    const actor = await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true, email: true, role: true } });
    await prisma.auditLog.create({
      data: {
        actorId: req.userId, actorName: actor?.name || "", actorEmail: actor?.email || "", actorRole: actor?.role || "",
        tenantId: null, tenantName: t.name,
        module: "admin", action: "tenant_deleted",
        targetType: "tenant", targetId: t.id, targetLabel: t.name,
      },
    }).catch(() => {});

    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Dashboard stats
router.get("/stats", async (req, res) => {
  try {
    const [tenants, users, bookings, revenue] = await Promise.all([
      prisma.tenant.count(),
      prisma.user.count(),
      prisma.booking.count(),
      prisma.payment.aggregate({ _sum: { amount: true } }),
    ]);
    res.json({
      totalTenants: tenants,
      totalUsers: users,
      totalBookings: bookings,
      totalRevenue: revenue._sum.amount || 0,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Payment requests
router.get("/payment-requests", async (req, res) => {
  try {
    res.json(await prisma.paymentRequest.findMany({
      orderBy: { createdAt: "desc" },
      include: { tenant: { select: { name: true } } },
    }));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.patch("/payment-requests/:id", async (req, res) => {
  try {
    const { status, reviewerComment } = req.body;
    const updateData = { status };
    if (reviewerComment !== undefined) updateData.reviewerComment = reviewerComment;
    if (status === "approved" || status === "rejected") {
      updateData.processedAt = new Date();
    }

    const pr = await prisma.paymentRequest.update({ where: { id: req.params.id }, data: updateData });

    // If approved, activate the tenant's subscription
    if (status === "approved") {
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + (pr.plan === "enterprise" ? 12 : pr.plan === "business" ? 12 : pr.plan === "pro" ? 6 : 1));
      await prisma.tenant.update({
        where: { id: pr.tenantId },
        data: {
          subscriptionPlan: pr.plan,
          subscriptionStatus: "active",
          subscriptionExpiry: endDate,
        },
      });
    }

    // Audit log — subscription approval/rejection
    const actor = await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true, email: true, role: true } });
    const tenant = await prisma.tenant.findUnique({ where: { id: pr.tenantId }, select: { name: true } });
    await prisma.auditLog.create({
      data: {
        actorId: req.userId, actorName: actor?.name || "", actorEmail: actor?.email || "", actorRole: actor?.role || "",
        tenantId: pr.tenantId, tenantName: tenant?.name || null,
        module: "subscription", action: status === "approved" ? "payment_approved" : "payment_rejected",
        targetType: "paymentRequest", targetId: pr.id, targetLabel: `${pr.plan} - ${pr.amount}`,
        newValue: JSON.stringify({ status, plan: pr.plan, amount: pr.amount, reviewerComment }),
      },
    }).catch(() => {});

    res.json(pr);
  } catch (err) { res.status(500).json({ message: err.message }); }
});


// ── Pending Users (signup approval queue) ──
router.get("/pending-users", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "desc" },
      include: { tenant: { select: { id: true, name: true, slug: true } } },
    });
    res.json(users.map(({ password, resetToken, resetTokenExpiry, ...u }) => u));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/users/status/:status", async (req, res) => {
  try {
    const { status } = req.params;
    const users = await prisma.user.findMany({
      where: { status },
      orderBy: { createdAt: "desc" },
      include: { tenant: { select: { id: true, name: true, slug: true } } },
    });
    res.json(users.map(({ password, resetToken, resetTokenExpiry, ...u }) => u));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/users/:id/approve", async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.status === "active") return res.status(400).json({ message: "User is already active" });

    // 3-day Pro trial (matches self-registration flow)
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 3);

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        status: "active",
        approvedAt: new Date(),
        approvedBy: req.userId,
        rejectionReason: null,
      },
    });
    await prisma.tenant.update({
      where: { id: user.tenantId },
      data: { subscriptionStatus: "trial", subscriptionExpiry: trialEnd },
    }).catch(() => {});

    const actor = await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true, email: true, role: true } });
    const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { name: true } });
    await prisma.auditLog.create({
      data: {
        actorId: req.userId, actorName: actor?.name || "", actorEmail: actor?.email || "", actorRole: actor?.role || "",
        tenantId: user.tenantId, tenantName: tenant?.name || null,
        module: "admin", action: "user_approved",
        targetType: "user", targetId: user.id, targetLabel: user.email,
      },
    }).catch(() => {});

    try {
      const { notifyUserApproved } = require("../services/telegramService");
      notifyUserApproved({ name: user.name, email: user.email }).catch(() => {});
    } catch (e) { /* ignore */ }

    res.json({ id: updated.id, status: updated.status, approvedAt: updated.approvedAt });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/users/:id/reject", async (req, res) => {
  try {
    const { reason } = req.body || {};
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ message: "User not found" });

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        status: "rejected",
        rejectionReason: reason || null,
      },
    });

    const actor = await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true, email: true, role: true } });
    const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { name: true } });
    await prisma.auditLog.create({
      data: {
        actorId: req.userId, actorName: actor?.name || "", actorEmail: actor?.email || "", actorRole: actor?.role || "",
        tenantId: user.tenantId, tenantName: tenant?.name || null,
        module: "admin", action: "user_rejected",
        targetType: "user", targetId: user.id, targetLabel: user.email,
        newValue: reason || null,
      },
    }).catch(() => {});

    res.json({ id: updated.id, status: updated.status, rejectionReason: updated.rejectionReason });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/** Expired trials / subscriptions needing follow-up (super admin). */
router.get("/trial-expiry-alerts", async (_req, res) => {
  try {
    const tenants = await prisma.tenant.findMany({
      where: { subscriptionStatus: "expired" },
      orderBy: { subscriptionExpiry: "desc" },
      include: {
        users: {
          where: { role: "tenant_owner" },
          select: { id: true, name: true, email: true, phone: true, whatsapp: true },
        },
      },
      take: 200,
    });

    const alerts = [];
    for (const tenant of tenants) {
      const autoExpired = await prisma.auditLog.findFirst({
        where: { tenantId: tenant.id, module: "subscription", action: "auto_expired" },
        orderBy: { createdAt: "desc" },
      });
      const wasTrial = autoExpired?.oldValue === "trial" || String(tenant.subscriptionPlan || "").toLowerCase() === "free";

      const notifyLogs = await prisma.auditLog.findMany({
        where: {
          tenantId: tenant.id,
          module: "subscription",
          action: { in: ["trial_expiry_auto_notify", "trial_expiry_manual_sms", "trial_expiry_manual_whatsapp"] },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      const owner = tenant.users?.[0];
      const phone = owner?.phone || owner?.whatsapp || tenant.phone || tenant.whatsapp || "";
      const whatsapp = owner?.whatsapp || tenant.whatsapp || owner?.phone || tenant.phone || "";

      alerts.push({
        tenantId: tenant.id,
        tenantName: tenant.name,
        ownerName: owner?.name || null,
        ownerEmail: owner?.email || null,
        ownerPhone: phone || null,
        ownerWhatsapp: whatsapp || null,
        subscriptionPlan: tenant.subscriptionPlan,
        subscriptionExpiry: tenant.subscriptionExpiry,
        wasTrial,
        expiredAt: autoExpired?.createdAt || tenant.subscriptionExpiry,
        autoNotified: notifyLogs.some((l) => l.action === "trial_expiry_auto_notify"),
        smsSent: notifyLogs.some((l) => l.action === "trial_expiry_manual_sms" || (l.action === "trial_expiry_auto_notify" && String(l.newValue || "").includes("sms"))),
        whatsappSent: notifyLogs.some((l) => l.action === "trial_expiry_manual_whatsapp" || (l.action === "trial_expiry_auto_notify" && String(l.newValue || "").includes("whatsapp"))),
        lastNotifyAt: notifyLogs[0]?.createdAt || null,
      });
    }

    res.json({ items: alerts, total: alerts.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Manually send trial-expiry SMS and/or WhatsApp to agency owner. */
router.post("/tenants/:id/trial-expiry-notify", async (req, res) => {
  try {
    const channels = Array.isArray(req.body?.channels) ? req.body.channels : ["sms", "whatsapp"];
    const sendSmsChannel = channels.includes("sms");
    const sendWaChannel = channels.includes("whatsapp");
    if (!sendSmsChannel && !sendWaChannel) {
      return res.status(400).json({ message: "channels must include sms and/or whatsapp" });
    }

    const contact = await resolveTenantOwnerContact(prisma, req.params.id);
    if (!contact?.tenant) return res.status(404).json({ message: "Tenant not found" });

    const { sendTrialExpiryChannels } = require("../services/notificationService");
    const payload = {
      tenantName: contact.tenant.name,
      ownerName: contact.ownerName,
      ownerEmail: contact.ownerEmail,
      ownerPhone: contact.phone,
      ownerWhatsapp: contact.whatsapp,
      phone: contact.phone,
      whatsapp: contact.whatsapp,
      plan: contact.tenant.subscriptionPlan,
      expiryDate: contact.tenant.subscriptionExpiry?.toISOString().slice(0, 10),
    };

    const results = await sendTrialExpiryChannels(payload, { sms: sendSmsChannel, whatsapp: sendWaChannel });

    const actor = await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true, email: true, role: true } });

    if (sendSmsChannel) {
      await prisma.auditLog.create({
        data: {
          actorId: req.userId,
          actorName: actor?.name || "",
          actorEmail: actor?.email || "",
          actorRole: actor?.role || "",
          tenantId: contact.tenant.id,
          tenantName: contact.tenant.name,
          module: "subscription",
          action: "trial_expiry_manual_sms",
          targetType: "tenant",
          targetId: contact.tenant.id,
          targetLabel: contact.tenant.name,
          newValue: JSON.stringify({ phone: contact.phone, success: results.sms?.success }),
        },
      }).catch(() => {});
    }
    if (sendWaChannel) {
      await prisma.auditLog.create({
        data: {
          actorId: req.userId,
          actorName: actor?.name || "",
          actorEmail: actor?.email || "",
          actorRole: actor?.role || "",
          tenantId: contact.tenant.id,
          tenantName: contact.tenant.name,
          module: "subscription",
          action: "trial_expiry_manual_whatsapp",
          targetType: "tenant",
          targetId: contact.tenant.id,
          targetLabel: contact.tenant.name,
          newValue: JSON.stringify({ whatsapp: contact.whatsapp, success: results.whatsapp?.success }),
        },
      }).catch(() => {});
    }

    res.json({
      ok: true,
      phone: contact.phone,
      whatsapp: contact.whatsapp,
      results,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
