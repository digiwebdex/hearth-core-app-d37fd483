const router = require("express").Router();
const { authenticate, requireSuperAdmin, prisma } = require("../middleware/auth");
const { notifySubscriptionPaymentApproved, notifySubscriptionChangeWhatsApp } = require("../services/subscriptionNotificationService");
const { incrementCouponUsage } = require("../services/subscriptionCouponService");
const { getDefaultManualPaymentMethods } = require("../lib/paymentGatewayConfig");
const { normalizePlan } = require("../lib/planPricing");

router.use(authenticate);
router.use(requireSuperAdmin);

const DEFAULT_PAYMENT_METHODS = getDefaultManualPaymentMethods();
const PENDING_REVIEW_STATUSES = ["pending", "submitted", "pending_review", "needs_info"];

const normPlan = normalizePlan;
const normCycle = (v) => String(v || "monthly").trim().toLowerCase() === "yearly" ? "yearly" : "monthly";
const monthsFor = (cycle) => normCycle(cycle) === "yearly" ? 12 : 1;
const addMonths = (value, months) => { const d = new Date(value); const n = new Date(d); n.setMonth(n.getMonth() + Number(months || 0)); return n; };
const resolveType = ({ currentPlan, requestedPlan, explicit, subscriptionStatus }) => {
  const e = String(explicit || "").trim().toLowerCase();
  if (["activate", "renew", "upgrade", "downgrade"].includes(e)) return e;
  if (!currentPlan || currentPlan === "free" || subscriptionStatus === "trial" || subscriptionStatus === "expired") return "activate";
  if (currentPlan === requestedPlan) return "renew";
  const RANK = { basic: 1, pro: 2, business: 3, enterprise: 4 };
  return (RANK[requestedPlan] || 0) < (RANK[currentPlan] || 0) ? "downgrade" : "upgrade";
};

async function actor(req) {
  return prisma.user.findUnique({ where: { id: req.userId }, select: { name: true, email: true, role: true } });
}

async function audit(req, data) {
  const a = await actor(req);
  return prisma.auditLog.create({
    data: {
      actorId: req.userId,
      actorName: a?.name || "",
      actorEmail: a?.email || "",
      actorRole: a?.role || req.userRole || "",
      ...data,
    },
  }).catch(() => null);
}

async function history(data) {
  if (!prisma.subscriptionHistory) return null;
  return prisma.subscriptionHistory.create({ data }).catch(() => null);
}

async function subscriptionRecord(data) {
  if (!prisma.subscription) return null;
  return prisma.subscription.create({ data }).catch(() => null);
}

function mergeWithDefaultMethodConfig(rows = []) {
  const byCode = new Map(rows.map((row) => [String(row.methodCode).toLowerCase(), row]));
  return DEFAULT_PAYMENT_METHODS.map((fallback) => {
    const saved = byCode.get(fallback.methodCode);
    if (!saved) return fallback;
    return {
      ...fallback,
      ...saved,
      accountName: saved.accountName || fallback.accountName,
      accountNumber: saved.accountNumber || fallback.accountNumber,
      bankName: saved.bankName || fallback.bankName,
      branchName: saved.branchName || fallback.branchName,
      instructions: saved.instructions || fallback.instructions,
    };
  });
}

async function paymentMethods() {
  if (!prisma.paymentMethodConfig) return DEFAULT_PAYMENT_METHODS;
  let rows = await prisma.paymentMethodConfig.findMany({ orderBy: { sortOrder: "asc" } });
  if (!rows.length) {
    await prisma.paymentMethodConfig.createMany({ data: DEFAULT_PAYMENT_METHODS }).catch(() => {});
    rows = await prisma.paymentMethodConfig.findMany({ orderBy: { sortOrder: "asc" } });
  }
  return mergeWithDefaultMethodConfig(rows);
}

function subscriptionOutcome({ tenant, requestedPlan, billingCycle, activationMode, activationDate, requestType, endTrialNow = true }) {
  const now = activationDate ? new Date(activationDate) : new Date();
  const currentExpiry = tenant.subscriptionExpiry ? new Date(tenant.subscriptionExpiry) : null;
  let start = new Date(now);
  let mode = activationMode || "activate_now";

  if (requestType === "renew" && currentExpiry && currentExpiry > now && tenant.subscriptionStatus === "active" && normPlan(tenant.subscriptionPlan) === requestedPlan) {
    start = new Date(currentExpiry);
    mode = "extend_from_current_expiry";
  }
  if (requestType === "upgrade" && mode === "after_current_expiry" && currentExpiry && currentExpiry > now && tenant.subscriptionStatus === "active") {
    start = new Date(currentExpiry);
  }
  if (tenant.subscriptionStatus === "trial" && endTrialNow === false && currentExpiry && currentExpiry > now) {
    start = new Date(currentExpiry);
    mode = "after_current_expiry";
  }

  const expiryDate = addMonths(start, monthsFor(billingCycle));
  return {
    start,
    expiryDate,
    immediate: start.getTime() <= now.getTime() + 1000,
    activationMode: mode,
  };
}

async function manualTenantUpdate(req, tenant, nextState) {
  const updated = await prisma.tenant.update({ where: { id: tenant.id }, data: nextState.data });
  await subscriptionRecord({
    tenantId: tenant.id,
    plan: nextState.plan,
    startDate: nextState.start.toISOString(),
    endDate: nextState.expiryDate.toISOString(),
    status: nextState.status,
    billingCycle: nextState.billingCycle,
    source: nextState.source,
    note: nextState.note || null,
  });
  await history({
    tenantId: tenant.id,
    oldPlan: tenant.subscriptionPlan,
    newPlan: nextState.plan,
    oldStatus: tenant.subscriptionStatus,
    newStatus: nextState.status,
    billingCycle: nextState.billingCycle,
    activationDate: nextState.start,
    expiryDate: nextState.expiryDate,
    actionType: nextState.actionType,
    source: nextState.source,
    note: nextState.note || null,
    actorUserId: req.userId,
  });
  await audit(req, {
    tenantId: tenant.id,
    tenantName: tenant.name,
    module: "subscription",
    action: nextState.actionType,
    targetType: "tenant",
    targetId: tenant.id,
    targetLabel: tenant.name,
    oldValue: JSON.stringify({ plan: tenant.subscriptionPlan, status: tenant.subscriptionStatus, expiry: tenant.subscriptionExpiry }),
    newValue: JSON.stringify({ plan: updated.subscriptionPlan, status: updated.subscriptionStatus, expiry: updated.subscriptionExpiry }),
  });

  // WhatsApp notification to agency owner for every manual admin action
  const actionLabels = {
    activated: "✅ Activated",
    renewed: "✅ Renewed",
    upgraded: "⬆️ Upgraded",
    upgrade_scheduled: "📅 Upgrade Scheduled",
    extended: "📅 Extended",
    suspended: "⛔ Suspended",
    cancelled: "❌ Cancelled",
    trial_skipped: "⏭️ Trial Ended",
    trial_ended_paid: "✅ Trial Ended — Plan Activated",
  };
  const actionLabel = actionLabels[nextState.actionType] || `🔄 ${nextState.actionType}`;
  const planLabel = (updated.subscriptionPlan || nextState.plan || "").charAt(0).toUpperCase() + (updated.subscriptionPlan || nextState.plan || "").slice(1);
  const expiry = nextState.expiryDate ? new Date(nextState.expiryDate).toISOString().slice(0, 10) : "N/A";
  let waMsg = `${actionLabel} — *${tenant.name}*\nPlan: *${planLabel}*\nStatus: *${updated.subscriptionStatus}*\nValid until: ${expiry}`;
  if (nextState.note) waMsg += `\nNote: ${nextState.note}`;
  notifySubscriptionChangeWhatsApp(tenant.id, waMsg).catch(() => {});

  return updated;
}

router.get("/payment-methods", async (_req, res) => {
  try { res.json(await paymentMethods()); } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put("/payment-methods", async (req, res) => {
  try {
    if (!Array.isArray(req.body?.methods)) return res.status(400).json({ message: "methods array is required" });
    if (!prisma.paymentMethodConfig) return res.status(500).json({ message: "Run prisma db push first to create PaymentMethodConfig" });
    for (const method of req.body.methods) {
      if (!method?.methodCode) continue;
      await prisma.paymentMethodConfig.upsert({
        where: { methodCode: String(method.methodCode).toLowerCase() },
        update: {
          label: method.label || method.methodCode,
          enabled: method.enabled !== false,
          accountName: method.accountName || null,
          accountNumber: method.accountNumber || null,
          bankName: method.bankName || null,
          branchName: method.branchName || null,
          instructions: method.instructions || null,
          sortOrder: Number(method.sortOrder || 0),
        },
        create: {
          methodCode: String(method.methodCode).toLowerCase(),
          label: method.label || method.methodCode,
          enabled: method.enabled !== false,
          accountName: method.accountName || null,
          accountNumber: method.accountNumber || null,
          bankName: method.bankName || null,
          branchName: method.branchName || null,
          instructions: method.instructions || null,
          sortOrder: Number(method.sortOrder || 0),
        },
      });
    }
    res.json(await paymentMethods());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/payment-requests", async (req, res) => {
  try {
    const { status, tenantId, plan, method, q } = req.query || {};
    const where = {};
    if (status) where.status = String(status);
    if (tenantId) where.tenantId = String(tenantId);
    if (method) where.OR = [{ paymentMethod: String(method).toLowerCase() }, { method: String(method).toLowerCase() }];
    if (plan) where.AND = [{ OR: [{ requestedPlan: normPlan(plan) }, { plan: normPlan(plan) }] }];
    if (q) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { trxId: { contains: String(q), mode: "insensitive" } },
            { transactionId: { contains: String(q), mode: "insensitive" } },
            { senderAccountOrNumber: { contains: String(q), mode: "insensitive" } },
            { tenant: { name: { contains: String(q), mode: "insensitive" } } },
          ],
        },
      ];
    }
    res.json(await prisma.paymentRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { tenant: { select: { id: true, name: true, slug: true, subscriptionPlan: true, subscriptionStatus: true, subscriptionExpiry: true } } },
    }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/payment-requests/:id", async (req, res) => {
  try {
    const item = await prisma.paymentRequest.findUnique({
      where: { id: req.params.id },
      include: { tenant: { select: { id: true, name: true, slug: true, subscriptionPlan: true, subscriptionStatus: true, subscriptionExpiry: true } } },
    });
    if (!item) return res.status(404).json({ message: "Payment request not found" });
    const subscriptionHistory = prisma.subscriptionHistory
      ? await prisma.subscriptionHistory.findMany({ where: { tenantId: item.tenantId }, orderBy: { createdAt: "desc" }, take: 10 })
      : [];
    res.json({ ...item, subscriptionHistory });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/payment-requests/:id", async (req, res) => {
  try {
    const action = String(req.body.action || req.body.status || "").trim().toLowerCase();
    const paymentRequest = await prisma.paymentRequest.findUnique({ where: { id: req.params.id } });
    if (!paymentRequest) return res.status(404).json({ message: "Payment request not found" });
    const tenant = await prisma.tenant.findUnique({ where: { id: paymentRequest.tenantId } });
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });

    if (["approve", "approved"].includes(action)) {
      if (!PENDING_REVIEW_STATUSES.includes(paymentRequest.status)) return res.status(400).json({ message: `Cannot approve a request in ${paymentRequest.status} state` });
      const requestedPlan = normPlan(req.body.targetPlan || paymentRequest.requestedPlan || paymentRequest.plan);
      const billingCycle = normCycle(req.body.billingCycle || paymentRequest.billingCycle);
      const requestType = resolveType({ currentPlan: paymentRequest.currentPlan || tenant.subscriptionPlan, requestedPlan, subscriptionStatus: tenant.subscriptionStatus, explicit: paymentRequest.requestType });
      const outcome = subscriptionOutcome({ tenant, requestedPlan, billingCycle, activationMode: req.body.activationMode || paymentRequest.activationMode || "activate_now", activationDate: req.body.activationDate, requestType, endTrialNow: req.body.endTrialNow !== false });
      const reviewedAt = new Date();

      const updated = await prisma.paymentRequest.update({
        where: { id: paymentRequest.id },
        data: {
          status: "approved",
          reviewedBy: req.userId,
          reviewedAt,
          processedAt: reviewedAt,
          reviewerComment: req.body.reviewerComment !== undefined ? req.body.reviewerComment : paymentRequest.reviewerComment,
          adminNote: req.body.adminNote || null,
          rejectionReason: null,
          requestedPlan,
          plan: requestedPlan,
          billingCycle,
          requestType,
          activationMode: outcome.activationMode,
          activationDate: outcome.start,
          expiryDateAfterApproval: outcome.expiryDate,
          currentPlan: tenant.subscriptionPlan,
        },
      });

      if (outcome.immediate) {
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: { subscriptionPlan: requestedPlan, subscriptionStatus: "active", subscriptionExpiry: outcome.expiryDate },
        });
      }

      await subscriptionRecord({ tenantId: tenant.id, plan: requestedPlan, startDate: outcome.start.toISOString(), endDate: outcome.expiryDate.toISOString(), status: outcome.immediate ? "active" : "scheduled", billingCycle, source: "payment_request_approved", paymentRequestId: paymentRequest.id, note: req.body.adminNote || null });
      await history({ tenantId: tenant.id, paymentRequestId: paymentRequest.id, oldPlan: tenant.subscriptionPlan, newPlan: requestedPlan, oldStatus: tenant.subscriptionStatus, newStatus: outcome.immediate ? "active" : tenant.subscriptionStatus, billingCycle, activationDate: outcome.start, expiryDate: outcome.expiryDate, actionType: requestType === "renew" ? "renewed" : requestType === "upgrade" ? (outcome.immediate ? "upgraded" : "upgrade_scheduled") : (tenant.subscriptionStatus === "trial" && outcome.immediate ? "trial_ended_paid" : "activated"), source: "payment_request_approved", note: req.body.adminNote || null, actorUserId: req.userId });
      await prisma.paymentRequest.updateMany({ where: { tenantId: tenant.id, id: { not: paymentRequest.id }, status: { in: PENDING_REVIEW_STATUSES } }, data: { status: "cancelled", adminNote: "Cancelled automatically because another subscription request was approved", reviewedBy: req.userId, reviewedAt, processedAt: reviewedAt } }).catch(() => {});
      await audit(req, { tenantId: tenant.id, tenantName: tenant.name, module: "subscription", action: "payment_approved", targetType: "paymentRequest", targetId: paymentRequest.id, targetLabel: `${requestedPlan} - ${paymentRequest.amountSent || paymentRequest.amount}`, oldValue: JSON.stringify({ plan: tenant.subscriptionPlan, status: tenant.subscriptionStatus, expiry: tenant.subscriptionExpiry }), newValue: JSON.stringify({ plan: requestedPlan, status: outcome.immediate ? "active" : tenant.subscriptionStatus, activationDate: outcome.start.toISOString(), expiryDate: outcome.expiryDate.toISOString(), activationMode: outcome.activationMode }) });

      await notifySubscriptionPaymentApproved({
        tenant: outcome.immediate
          ? { ...tenant, subscriptionPlan: requestedPlan, subscriptionStatus: "active", subscriptionExpiry: outcome.expiryDate }
          : tenant,
        paymentRequest: updated,
        plan: requestedPlan,
        expiryDate: outcome.expiryDate,
        immediate: outcome.immediate,
        activationDate: outcome.start,
      }).catch(() => {});

      if (paymentRequest.couponCode) {
        await incrementCouponUsage(paymentRequest.couponCode);
      }

      return res.json({ paymentRequest: updated, outcome: { immediate: outcome.immediate, activationDate: outcome.start, expiryDate: outcome.expiryDate, plan: requestedPlan, billingCycle, requestType } });
    }

    if (["reject", "rejected", "request_more_info", "needs_info", "duplicate", "cancelled", "cancel"].includes(action)) {
      const normalized = action === "reject" ? "rejected" : action === "request_more_info" ? "needs_info" : action === "cancel" ? "cancelled" : action;
      const reviewedAt = new Date();
      const updated = await prisma.paymentRequest.update({
        where: { id: paymentRequest.id },
        data: {
          status: normalized,
          reviewedBy: req.userId,
          reviewedAt,
          processedAt: reviewedAt,
          reviewerComment: req.body.reviewerComment !== undefined ? req.body.reviewerComment : paymentRequest.reviewerComment,
          adminNote: req.body.adminNote || null,
          rejectionReason: req.body.rejectionReason || req.body.reason || null,
        },
      });
      await audit(req, { tenantId: tenant.id, tenantName: tenant.name, module: "subscription", action: normalized, targetType: "paymentRequest", targetId: paymentRequest.id, targetLabel: `${paymentRequest.requestedPlan || paymentRequest.plan} - ${paymentRequest.amountSent || paymentRequest.amount}`, newValue: JSON.stringify({ status: normalized, reason: req.body.rejectionReason || req.body.reason || null }) });

      // WhatsApp to agency owner
      const reason = req.body.rejectionReason || req.body.reason || null;
      const waStatusLabel = normalized === "rejected" ? "❌ Rejected" : normalized === "needs_info" ? "⚠️ More info needed" : "🔄 Status updated";
      const waMsg = `${waStatusLabel} — *${tenant.name}* subscription payment request for *${paymentRequest.requestedPlan || paymentRequest.plan}* plan has been marked as *${normalized}*.${reason ? `\n\nReason: ${reason}` : ""}\n\nContact support if you have questions.`;
      notifySubscriptionChangeWhatsApp(tenant.id, waMsg).catch(() => {});

      return res.json(updated);
    }

    return res.status(400).json({ message: "Unsupported payment request action" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/tenants/:id/subscription-history", async (req, res) => {
  try {
    if (!prisma.subscriptionHistory) return res.json([]);
    res.json(await prisma.subscriptionHistory.findMany({ where: { tenantId: req.params.id }, orderBy: { createdAt: "desc" } }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/tenants/:id/subscription/manual-activate", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.params.id } });
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });
    const requestedPlan = normPlan(req.body.plan || req.body.targetPlan || tenant.subscriptionPlan || "basic");
    const billingCycle = normCycle(req.body.billingCycle);
    const start = req.body.activationDate ? new Date(req.body.activationDate) : new Date();
    const expiryDate = req.body.expiryDate ? new Date(req.body.expiryDate) : addMonths(start, monthsFor(billingCycle));
    const updated = await manualTenantUpdate(req, tenant, {
      data: { subscriptionPlan: requestedPlan, subscriptionStatus: req.body.subscriptionStatus || "active", subscriptionExpiry: expiryDate },
      plan: requestedPlan,
      status: req.body.subscriptionStatus || "active",
      billingCycle,
      start,
      expiryDate,
      source: "manual_admin",
      actionType: req.body.actionType || "activated",
      note: req.body.note || null,
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.patch("/tenants/:id/subscription/skip-trial", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.params.id } });
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });
    if (tenant.subscriptionStatus !== "trial") return res.status(400).json({ message: "Tenant is not currently on trial" });

    if (req.body?.plan || req.body?.targetPlan) {
      const requestedPlan = normPlan(req.body.plan || req.body.targetPlan);
      const billingCycle = normCycle(req.body.billingCycle);
      const start = req.body.activationDate ? new Date(req.body.activationDate) : new Date();
      const expiryDate = req.body.expiryDate ? new Date(req.body.expiryDate) : addMonths(start, monthsFor(billingCycle));
      const updated = await manualTenantUpdate(req, tenant, {
        data: { subscriptionPlan: requestedPlan, subscriptionStatus: "active", subscriptionExpiry: expiryDate },
        plan: requestedPlan,
        status: "active",
        billingCycle,
        start,
        expiryDate,
        source: "manual_admin",
        actionType: "trial_skipped",
        note: req.body.note || "Trial skipped and paid plan activated",
      });
      return res.json(updated);
    }

    const updated = await prisma.tenant.update({ where: { id: tenant.id }, data: { subscriptionStatus: "expired", subscriptionExpiry: new Date() } });
    await history({ tenantId: tenant.id, oldPlan: tenant.subscriptionPlan, newPlan: tenant.subscriptionPlan, oldStatus: tenant.subscriptionStatus, newStatus: "expired", billingCycle: "monthly", activationDate: new Date(), expiryDate: new Date(), actionType: "trial_skipped", source: "manual_admin", note: req.body?.note || "Trial skipped by super admin", actorUserId: req.userId });
    await audit(req, { tenantId: tenant.id, tenantName: tenant.name, module: "subscription", action: "trial_skipped", targetType: "tenant", targetId: tenant.id, targetLabel: tenant.name, oldValue: JSON.stringify({ plan: tenant.subscriptionPlan, status: tenant.subscriptionStatus, expiry: tenant.subscriptionExpiry }), newValue: JSON.stringify({ plan: tenant.subscriptionPlan, status: updated.subscriptionStatus, expiry: updated.subscriptionExpiry }) });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.patch("/tenants/:id/subscription/extend", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.params.id } });
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });
    const months = Number(req.body?.months || 1);
    if (!Number.isFinite(months) || months <= 0) return res.status(400).json({ message: "months must be greater than 0" });
    const base = tenant.subscriptionExpiry && new Date(tenant.subscriptionExpiry) > new Date() ? new Date(tenant.subscriptionExpiry) : new Date();
    const expiryDate = addMonths(base, months);
    const updated = await manualTenantUpdate(req, tenant, {
      data: { subscriptionStatus: "active", subscriptionExpiry: expiryDate },
      plan: tenant.subscriptionPlan,
      status: "active",
      billingCycle: req.body?.billingCycle || "monthly",
      start: base,
      expiryDate,
      source: "manual_admin",
      actionType: "extended",
      note: req.body?.note || `Extended by ${months} month(s)`,
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.patch("/tenants/:id/subscription/suspend", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.params.id } });
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });
    const updated = await manualTenantUpdate(req, tenant, {
      data: { subscriptionStatus: "suspended" },
      plan: tenant.subscriptionPlan,
      status: "suspended",
      billingCycle: req.body?.billingCycle || "monthly",
      start: new Date(),
      expiryDate: tenant.subscriptionExpiry || new Date(),
      source: "manual_admin",
      actionType: "suspended",
      note: req.body?.note || null,
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;