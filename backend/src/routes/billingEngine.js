// Subscription & Billing Engine — routes.
// (docs/v2-master/11-Architecture-Freeze.md, docs/v2-master/12-Implementation-Sequence.md).
//
// Mounted at /api/billing. This is a COMPOSITION layer — it reuses, never
// duplicates, the subscription machinery that already exists:
//   - Plan Engine (lib/planEngine.js)              — catalog, limits, pricing, tenant context
//   - Finance Core (lib/billingEngine.js → round2) — consistent money rounding
//   - Permission Engine (middleware/auth.js)       — requirePermission / requireSuperAdmin
//   - Audit Log (prisma.auditLog)                  — every write is audited
//   - Notification Engine (subscriptionNotificationService) — owner WhatsApp on add-on changes
//   - subscriptionExpiryService                    — lazy trial/subscription expiry
//   - subscriptionCouponService                    — invoice discounts
//   - paymentGatewayConfig                         — SSLCommerz / bKash / Nagad / Bank Transfer
//
// What it ADDS (did not exist): the tenant-facing self-service billing views
// (current subscription / usage / history / transactions / invoice), the add-on
// lifecycle (Additional Users/Branch/Storage/SMS/WhatsApp/API), and the admin
// revenue analytics (subscribers, MRR, ARR, revenue-by-plan).
//
// It deliberately does NOT re-implement plan activation / renewal / upgrade
// approval — those stay in routes/adminSubscriptionWorkflow.js and
// routes/paymentRequests.js. Actual money collection (including for add-ons and
// renewals) rides the existing payment-request flow; this engine computes the
// invoice and governs the add-on lifecycle, but self-service actions that cost
// money create a PENDING record for admin approval — nothing that costs money
// self-activates, mirroring the plan-change governance already in place.

const router = require("express").Router();
const { authenticate, requirePermission, requireSuperAdmin, prisma } = require("../middleware/auth");
const { resolveTenantPlanContext, resolvePlan } = require("../lib/planEngine");
const { RESOURCE_MODEL_MAP } = require("../lib/planFeatures");
const { expireTenantIfNeeded, isPastExpiry } = require("../services/subscriptionExpiryService");
const { validateSubscriptionCoupon } = require("../services/subscriptionCouponService");
const { getGatewayStatusDetailed, getDefaultManualPaymentMethods } = require("../lib/paymentGatewayConfig");
const { notifySubscriptionChangeWhatsApp } = require("../services/subscriptionNotificationService");
const {
  getSubscriptionPlanCatalog,
  getAddonCatalog,
  getAddonType,
  validateAddonInput,
  computeEffectiveLimits,
  computeAddonExtensions,
  buildUsageContext,
  buildSubscriptionInvoice,
  computeMrr,
  computeArr,
  summarizeSubscribers,
  revenueByPlan,
} = require("../lib/billingEngine");

router.use(authenticate);

const canView = requirePermission("subscription", "view");
const canManage = requirePermission("subscription", "create");
const canRemove = requirePermission("subscription", "delete");

// ── Shared helpers ──
async function writeAudit(req, data) {
  const [user, tenant] = await Promise.all([
    prisma.user.findUnique({ where: { id: req.userId }, select: { name: true, email: true, role: true } }).catch(() => null),
    req.tenantId ? prisma.tenant.findUnique({ where: { id: req.tenantId }, select: { name: true } }).catch(() => null) : null,
  ]);
  return prisma.auditLog.create({
    data: {
      actorId: req.userId,
      actorName: user?.name || "",
      actorEmail: user?.email || "",
      actorRole: user?.role || req.userRole || "",
      tenantId: req.tenantId || data.tenantId || null,
      tenantName: tenant?.name || null,
      module: "subscription",
      ...data,
    },
  }).catch(() => null);
}

/** Current billing cycle for a tenant = the cycle on its most recent Subscription record. */
async function latestBillingCycle(tenantId) {
  if (!prisma.subscription) return "monthly";
  const last = await prisma.subscription.findFirst({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    select: { billingCycle: true },
  }).catch(() => null);
  return last?.billingCycle || "monthly";
}

async function activeAddons(tenantId) {
  if (!prisma.subscriptionAddon) return [];
  return prisma.subscriptionAddon.findMany({
    where: { tenantId, status: "active" },
    orderBy: { createdAt: "desc" },
  }).catch(() => []);
}

// ── Plans (the subscriber catalog: Free Trial / Starter / Professional / Business / Enterprise) ──
router.get("/plans", canView, (_req, res) => {
  res.json({ plans: getSubscriptionPlanCatalog() });
});

// ── Current Plan / Subscription (with lazy trial-expiry) ──
router.get("/subscription", canView, async (req, res) => {
  try {
    await expireTenantIfNeeded(prisma, req.tenantId).catch(() => {});
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: {
        id: true, name: true, subscriptionPlan: true, subscriptionStatus: true,
        subscriptionExpiry: true, enabledModules: true, enabledServiceTypes: true, enabledSubcategories: true,
      },
    });
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });

    const context = await resolveTenantPlanContext({
      plan: tenant.subscriptionPlan,
      enabledModules: tenant.enabledModules,
      enabledServiceTypes: tenant.enabledServiceTypes,
      enabledSubcategories: tenant.enabledSubcategories,
      tenantId: req.tenantId,
    });

    const status = String(tenant.subscriptionStatus || "").toLowerCase();
    const expired = isPastExpiry(tenant.subscriptionExpiry);
    const daysRemaining = tenant.subscriptionExpiry
      ? Math.ceil((new Date(tenant.subscriptionExpiry).getTime() - Date.now()) / 86400000)
      : null;

    res.json({
      tenantId: tenant.id,
      plan: context.plan,
      planName: context.name,
      billingCycle: await latestBillingCycle(req.tenantId),
      subscriptionStatus: tenant.subscriptionStatus,
      subscriptionExpiry: tenant.subscriptionExpiry,
      isTrial: status === "trial",
      isExpired: status === "expired" || (status !== "active" && expired),
      daysRemaining,
      pricing: context.pricing,
      features: context.features,
      limits: context.limits,
      availableModules: context.availableModules,
      enabledModules: context.enabledModules,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to resolve subscription" });
  }
});

// ── Usage (Current Usage / Plan Limits / Remaining Limits) ──
router.get("/usage", canView, async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: { subscriptionPlan: true },
    });
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });

    const planLimits = resolvePlan(tenant.subscriptionPlan).limits;
    const addons = await activeAddons(req.tenantId);
    const effectiveLimits = computeEffectiveLimits(planLimits, addons);

    // Count only the resources that map to a real tenant-scoped model
    // (same source of truth as middleware/auth.js checkPlanLimit).
    const countable = Object.keys(effectiveLimits).filter((r) => RESOURCE_MODEL_MAP[r]);
    const counts = await Promise.all(
      countable.map((r) => prisma[RESOURCE_MODEL_MAP[r]].count({ where: { tenantId: req.tenantId } }).catch(() => 0)),
    );
    const usageCounts = Object.fromEntries(countable.map((r, i) => [r, counts[i]]));

    res.json({
      plan: resolvePlan(tenant.subscriptionPlan).plan,
      planLimits,
      addonExtensions: computeAddonExtensions(addons),
      effectiveLimits,
      usage: buildUsageContext(effectiveLimits, usageCounts),
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to resolve usage" });
  }
});

// ── Subscription History (this tenant's own plan-change history) ──
router.get("/history", canView, async (req, res) => {
  try {
    if (!prisma.subscriptionHistory) return res.json([]);
    const rows = await prisma.subscriptionHistory.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Transaction History (this tenant's own subscription payments) ──
router.get("/transactions", canView, async (req, res) => {
  try {
    const rows = await prisma.paymentRequest.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true, plan: true, requestedPlan: true, billingCycle: true, requestType: true,
        amount: true, amountSent: true, expectedAmount: true, discountAmount: true, couponCode: true,
        paymentMethod: true, method: true, transactionId: true, trxId: true,
        status: true, paymentDate: true, processedAt: true, createdAt: true,
      },
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Generate Invoice / Renewal Invoice (computed quote; pay via /api/payment-requests) ──
router.get("/invoice", canView, async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: { subscriptionPlan: true },
    });
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });

    const type = String(req.query.type || "new").toLowerCase() === "renewal" ? "renewal" : "new";
    const plan = req.query.plan ? String(req.query.plan) : (tenant.subscriptionPlan || "basic");
    const billingCycle = req.query.billingCycle ? String(req.query.billingCycle) : await latestBillingCycle(req.tenantId);
    const addons = await activeAddons(req.tenantId);

    let coupon = null;
    let couponError = null;
    if (req.query.coupon) {
      const result = await validateSubscriptionCoupon({ code: String(req.query.coupon), plan, billingCycle });
      if (result.valid) coupon = result;
      else couponError = result.message;
    }

    const invoice = buildSubscriptionInvoice({ plan, billingCycle, addons, coupon, type });
    res.json({ ...invoice, couponError });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── Payment Gateways (SSLCommerz / bKash / Nagad / Bank Transfer) ──
router.get("/gateways", canView, (_req, res) => {
  res.json({
    gateways: getGatewayStatusDetailed(),
    manualMethods: getDefaultManualPaymentMethods().filter((m) => m.enabled),
  });
});

// ── Add-ons ──
router.get("/addons/catalog", canView, (_req, res) => {
  res.json({ addons: getAddonCatalog() });
});

router.get("/addons", canView, async (req, res) => {
  try {
    if (!prisma.subscriptionAddon) return res.json([]);
    const rows = await prisma.subscriptionAddon.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { createdAt: "desc" },
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Request an add-on. Created PENDING — it does not extend limits until an admin
// activates it (nothing that costs money self-activates). Payment rides the
// existing payment-request flow.
router.post("/addons", canManage, async (req, res) => {
  try {
    if (!prisma.subscriptionAddon) {
      return res.status(503).json({ message: "Run prisma db push to create the SubscriptionAddon table" });
    }
    const validation = validateAddonInput(req.body || {});
    if (!validation.valid) return res.status(400).json({ message: validation.message });

    const { type, quantity, billingCycle } = validation.normalized;
    const unitPrice = Number(req.body?.unitPrice) > 0 ? Number(req.body.unitPrice) : 0;

    const addon = await prisma.subscriptionAddon.create({
      data: {
        tenantId: req.tenantId,
        type,
        quantity,
        unitPrice,
        billingCycle,
        status: "pending",
        note: req.body?.note || null,
      },
    });

    await writeAudit(req, {
      action: "addon_requested",
      targetType: "subscriptionAddon",
      targetId: addon.id,
      targetLabel: `${getAddonType(type).label} × ${quantity}`,
      newValue: JSON.stringify({ type, quantity, billingCycle, unitPrice, status: "pending" }),
    });
    notifySubscriptionChangeWhatsApp(
      req.tenantId,
      `🧩 Add-on requested — *${getAddonType(type).label} × ${quantity}*\nStatus: *Pending approval*`,
    ).catch(() => {});

    res.status(201).json(addon);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Cancel one of this tenant's own add-ons (pending or active).
router.delete("/addons/:id", canRemove, async (req, res) => {
  try {
    if (!prisma.subscriptionAddon) return res.status(404).json({ message: "Add-on not found" });
    const existing = await prisma.subscriptionAddon.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!existing) return res.status(404).json({ message: "Add-on not found" });
    if (existing.status === "cancelled") return res.status(400).json({ message: "Add-on is already cancelled" });

    const updated = await prisma.subscriptionAddon.update({
      where: { id: existing.id },
      data: { status: "cancelled", endDate: new Date() },
    });
    await writeAudit(req, {
      action: "addon_cancelled",
      targetType: "subscriptionAddon",
      targetId: existing.id,
      targetLabel: `${getAddonType(existing.type)?.label || existing.type} × ${existing.quantity}`,
      oldValue: JSON.stringify({ status: existing.status }),
      newValue: JSON.stringify({ status: "cancelled" }),
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── Admin: subscribers / revenue / add-on governance (super admin) ──
router.get("/admin/subscribers", requireSuperAdmin, async (req, res) => {
  try {
    const where = {};
    if (req.query.status && String(req.query.status).toLowerCase() !== "all") {
      where.subscriptionStatus = String(req.query.status).toLowerCase();
    }
    if (req.query.plan) where.subscriptionPlan = String(req.query.plan).toLowerCase();

    const tenants = await prisma.tenant.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, slug: true,
        subscriptionPlan: true, subscriptionStatus: true, subscriptionExpiry: true, createdAt: true,
      },
    });
    res.json({ count: tenants.length, summary: summarizeSubscribers(tenants), subscribers: tenants });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/admin/revenue", requireSuperAdmin, async (req, res) => {
  try {
    const tenants = await prisma.tenant.findMany({
      select: { id: true, subscriptionPlan: true, subscriptionStatus: true },
    });
    // Resolve each tenant's current billing cycle from its latest Subscription record.
    const cycleByTenant = {};
    if (prisma.subscription) {
      const subs = await prisma.subscription.findMany({
        orderBy: { createdAt: "desc" },
        select: { tenantId: true, billingCycle: true },
      });
      for (const s of subs) if (!(s.tenantId in cycleByTenant)) cycleByTenant[s.tenantId] = s.billingCycle;
    }
    const withCycle = tenants.map((t) => ({
      subscriptionStatus: t.subscriptionStatus,
      subscriptionPlan: t.subscriptionPlan,
      billingCycle: cycleByTenant[t.id] || "monthly",
    }));

    const mrr = computeMrr(withCycle);
    res.json({
      mrr,
      arr: computeArr(mrr),
      currency: "BDT",
      revenueByPlan: revenueByPlan(withCycle),
      subscribers: summarizeSubscribers(tenants),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/admin/addons", requireSuperAdmin, async (req, res) => {
  try {
    if (!prisma.subscriptionAddon) return res.json([]);
    const where = {};
    if (req.query.status) where.status = String(req.query.status).toLowerCase();
    if (req.query.tenantId) where.tenantId = String(req.query.tenantId);
    const rows = await prisma.subscriptionAddon.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Activate / cancel an add-on (super admin) — activation is what actually
// extends the tenant's limits.
router.patch("/admin/addons/:id", requireSuperAdmin, async (req, res) => {
  try {
    if (!prisma.subscriptionAddon) return res.status(404).json({ message: "Add-on not found" });
    const status = String(req.body?.status || "").toLowerCase();
    if (!["active", "cancelled"].includes(status)) {
      return res.status(400).json({ message: "status must be 'active' or 'cancelled'" });
    }
    const existing = await prisma.subscriptionAddon.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: "Add-on not found" });

    const updated = await prisma.subscriptionAddon.update({
      where: { id: existing.id },
      data: { status, endDate: status === "cancelled" ? new Date() : null },
    });
    await writeAudit(req, {
      tenantId: existing.tenantId,
      action: status === "active" ? "addon_activated" : "addon_cancelled",
      targetType: "subscriptionAddon",
      targetId: existing.id,
      targetLabel: `${getAddonType(existing.type)?.label || existing.type} × ${existing.quantity}`,
      oldValue: JSON.stringify({ status: existing.status }),
      newValue: JSON.stringify({ status }),
    });
    notifySubscriptionChangeWhatsApp(
      existing.tenantId,
      status === "active"
        ? `✅ Add-on activated — *${getAddonType(existing.type)?.label || existing.type} × ${existing.quantity}*\nYour plan limits have been extended.`
        : `❌ Add-on cancelled — *${getAddonType(existing.type)?.label || existing.type} × ${existing.quantity}*`,
    ).catch(() => {});
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
