// Subscription & Billing Engine — pure billing/subscription logic.
// (docs/v2-master/11-Architecture-Freeze.md, docs/v2-master/12-Implementation-Sequence.md).
//
// Pure — no database access, no side effects. The route
// (routes/billingEngine.js) fetches tenant-scoped rows and passes them in.
//
// "No duplicate business logic": every plan number (price / limit / feature)
// comes from the Plan Engine (backend/src/lib/planEngine.js, which itself wraps
// the canonical planFeatures.js / planPricing.js). This file adds ONLY the
// billing-specific composition that does not exist anywhere yet: the subscriber
// plan catalog with the marketing display names, the add-on registry, the
// effective-limit / usage math, the subscription invoice builder, and the
// MRR / ARR revenue aggregation.
//
// On Finance Core: subscription revenue (a tenant paying the PLATFORM) is a
// distinct money flow from Finance Core's booking ledgers (a tenant's customers/
// suppliers). Coupling the two would be artificial, so this engine does not
// reach into the customer/supplier ledgers; it shares only the money-rounding
// convention (a local round2, exactly as reportingCenter.js keeps its own).
//
// Plan-name reconciliation: the product spec names the paid tiers "Starter" and
// "Professional", but the canonical plan KEYS in planFeatures.js are basic/pro/
// business/enterprise (single source of truth — the backend wins). Renaming the
// keys would be a breaking change to every gate, price, and stored
// tenant.subscriptionPlan. So this file keeps the canonical keys and adds a
// display-name layer only: Starter = basic, Professional = pro. Callers get both
// `plan` (canonical, safe to persist/gate on) and `displayName` (for the UI).

const { getPlanRegistry, resolvePlan, PLAN_TIERS } = require("./planEngine");
const { getPlanPrice, normalizeBillingCycle } = require("./planPricing");
const { normalizePlan } = require("./planFeatures");
const { getTrialDays } = require("./trialConfig");

const { round2 } = require("./numeric");

// ── Plan display names (the only genuinely new plan metadata) ──
// Canonical key -> marketing name from the product spec.
const PLAN_DISPLAY_NAMES = {
  trial: "Free Trial",
  basic: "Starter",
  pro: "Professional",
  business: "Business",
  enterprise: "Enterprise",
};

function planDisplayName(plan) {
  const key = normalizePlan(plan);
  return PLAN_DISPLAY_NAMES[key] || key.charAt(0).toUpperCase() + key.slice(1);
}

// ── Add-on registry ──
// Add-ons "extend limits without changing plan". Each add-on maps to a limit
// key. additional_users -> users, additional_branch -> branches, and
// additional_whatsapp -> whatsapp overlay the existing Plan Engine limits
// (planFeatures PLAN_LIMITS). The rest name add-on-only dimensions (storageGb /
// sms / apiCalls) that have no base plan-limit row today — so the add-on itself
// establishes the allowance.
const ADDON_TYPES = [
  { code: "additional_users", label: "Additional Users", unit: "user", limitKey: "users" },
  { code: "additional_branch", label: "Additional Branch", unit: "branch", limitKey: "branches" },
  { code: "additional_storage", label: "Additional Storage", unit: "GB", limitKey: "storageGb" },
  { code: "additional_sms", label: "Additional SMS", unit: "SMS", limitKey: "sms" },
  { code: "additional_whatsapp", label: "Additional WhatsApp", unit: "message", limitKey: "whatsapp" },
  { code: "additional_api", label: "Additional API", unit: "1k calls", limitKey: "apiCalls" },
];
const ADDON_BY_CODE = Object.fromEntries(ADDON_TYPES.map((a) => [a.code, a]));

function getAddonCatalog() {
  return ADDON_TYPES;
}
function getAddonType(code) {
  return ADDON_BY_CODE[String(code || "").trim().toLowerCase()];
}
function isAddonType(code) {
  return Boolean(getAddonType(code));
}

/** Validate an add-on purchase payload. Pure. Returns { valid, message?, normalized? }. */
function validateAddonInput({ type, quantity, billingCycle } = {}) {
  const addon = getAddonType(type);
  if (!addon) {
    return { valid: false, message: `Unknown add-on type. Allowed: ${ADDON_TYPES.map((a) => a.code).join(", ")}` };
  }
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty <= 0) {
    return { valid: false, message: "quantity must be a positive whole number" };
  }
  return {
    valid: true,
    normalized: {
      type: addon.code,
      quantity: qty,
      billingCycle: normalizeBillingCycle(billingCycle),
      limitKey: addon.limitKey,
    },
  };
}

// ── Subscriber plan catalog ──
// The paid tiers come straight from the Plan Engine registry; the Free Trial is
// a lifecycle STATE, not a Plan Engine tier, so it is surfaced here as a
// catalog entry (price 0, the configured trial length) without inventing a new
// plan key.
function getSubscriptionPlanCatalog() {
  const trial = {
    plan: "trial",
    name: "Free Trial",
    displayName: "Free Trial",
    isTrial: true,
    trialDays: getTrialDays(),
    pricing: { monthly: 0, yearly: 0 },
    // Free Trial = FULL evaluation: mirrors the enterprise tier's capabilities
    // until it expires (docs/v2-master/111-SaaS-Plan-System.md).
    limits: resolvePlan("enterprise").limits,
    features: resolvePlan("enterprise").features,
  };
  const paid = getPlanRegistry().map((p) => ({
    ...p,
    displayName: planDisplayName(p.plan),
    isTrial: false,
  }));
  return [trial, ...paid];
}

// ── Effective limits (plan + active add-ons) ──
/**
 * Merge active add-ons onto the plan's limits. Pure.
 *   -1 (unlimited) stays -1 — an add-on cannot "extend" the unlimited.
 *   Otherwise effective = baseLimit + summed add-on quantity for that limit key.
 *   Add-on-only keys (no base limit) start from 0.
 */
function computeEffectiveLimits(planLimits = {}, activeAddons = []) {
  const effective = { ...planLimits };
  for (const addon of activeAddons) {
    const meta = getAddonType(addon.type);
    if (!meta) continue;
    const key = meta.limitKey;
    const qty = Number(addon.quantity) || 0;
    if (qty <= 0) continue;
    const base = effective[key];
    if (base === -1) continue; // already unlimited
    effective[key] = (Number.isFinite(base) ? base : 0) + qty;
  }
  return effective;
}

/** Summed add-on quantity per limit key (for "base + add-on" display). Pure. */
function computeAddonExtensions(activeAddons = []) {
  const out = {};
  for (const addon of activeAddons) {
    const meta = getAddonType(addon.type);
    if (!meta) continue;
    const qty = Number(addon.quantity) || 0;
    if (qty <= 0) continue;
    out[meta.limitKey] = (out[meta.limitKey] || 0) + qty;
  }
  return out;
}

/**
 * Build the Current Usage / Plan Limits / Remaining Limits view. Pure.
 *   limits:      effective limits map (already includes add-ons)
 *   usageCounts: { resource -> number } for resources that are countable
 *                (usage for un-metered add-on dimensions is reported as null).
 * remaining: -1 when unlimited, else max(0, limit - used).
 */
function buildUsageContext(limits = {}, usageCounts = {}) {
  const resources = Object.keys(limits);
  return resources.map((resource) => {
    const limit = limits[resource];
    const unlimited = limit === -1;
    const tracked = Object.prototype.hasOwnProperty.call(usageCounts, resource);
    const used = tracked ? Number(usageCounts[resource]) || 0 : null;
    let remaining = null;
    if (unlimited) remaining = -1;
    else if (tracked) remaining = Math.max(0, limit - used);
    return { resource, limit, used, remaining, unlimited, tracked };
  });
}

// ── Subscription invoice (Generate Invoice / Renewal Invoice) ──
/**
 * Build a subscription invoice document. Pure — coupon validation is async and
 * done in the route, its result passed in as `coupon` ({ discountAmount }).
 * Returns line items (plan + each add-on), subtotal, discount, total.
 * The invoice is a computed quote; collection rides the existing payment-request
 * flow (routes/paymentRequests.js) — this does not create a second payment path.
 */
function buildSubscriptionInvoice({ plan, billingCycle, addons = [], coupon = null, type = "new" } = {}) {
  const planKey = normalizePlan(plan);
  const cycle = normalizeBillingCycle(billingCycle);
  const planPrice = getPlanPrice(planKey, cycle);

  const lineItems = [{
    kind: "plan",
    code: planKey,
    label: `${planDisplayName(planKey)} plan (${cycle})`,
    quantity: 1,
    unitPrice: round2(planPrice),
    amount: round2(planPrice),
  }];

  for (const addon of addons) {
    const meta = getAddonType(addon.type);
    if (!meta) continue;
    const qty = Number(addon.quantity) || 0;
    const unitPrice = Number(addon.unitPrice) || 0;
    if (qty <= 0) continue;
    lineItems.push({
      kind: "addon",
      code: meta.code,
      label: `${meta.label} × ${qty}`,
      quantity: qty,
      unitPrice: round2(unitPrice),
      amount: round2(unitPrice * qty),
    });
  }

  const subtotal = round2(lineItems.reduce((sum, li) => sum + li.amount, 0));
  const discount = round2(Math.min(Number(coupon?.discountAmount) || 0, subtotal));
  const total = round2(Math.max(0, subtotal - discount));

  return {
    type: type === "renewal" ? "renewal" : "new",
    plan: planKey,
    planDisplayName: planDisplayName(planKey),
    billingCycle: cycle,
    lineItems,
    subtotal,
    discount,
    couponCode: coupon?.code || null,
    total,
    currency: "BDT",
  };
}

// ── Revenue analytics (MRR / ARR / subscriber breakdown) ──
const ACTIVE_REVENUE_STATUSES = ["active"];

/** Monthly-equivalent recurring price of one subscription. Pure. Yearly is normalized /12. */
function monthlyEquivalentPrice(plan, billingCycle) {
  const cycle = normalizeBillingCycle(billingCycle);
  if (cycle === "yearly") return round2(getPlanPrice(plan, "yearly") / 12);
  return round2(getPlanPrice(plan, "monthly"));
}

/**
 * Monthly Recurring Revenue. Pure.
 *   tenants: [{ subscriptionStatus, subscriptionPlan, billingCycle }]
 * Only active, paid subscriptions contribute (trial/free/expired/suspended and
 * enterprise-custom priced at 0 add nothing).
 */
function computeMrr(tenants = []) {
  let mrr = 0;
  for (const t of tenants) {
    const status = String(t.subscriptionStatus || "").toLowerCase();
    if (!ACTIVE_REVENUE_STATUSES.includes(status)) continue;
    mrr += monthlyEquivalentPrice(t.subscriptionPlan, t.billingCycle);
  }
  return round2(mrr);
}

function computeArr(mrr) {
  return round2((Number(mrr) || 0) * 12);
}

/** Group subscribers by subscription status and by plan. Pure. */
function summarizeSubscribers(tenants = []) {
  const byStatus = {};
  const byPlan = {};
  for (const t of tenants) {
    const status = String(t.subscriptionStatus || "unknown").toLowerCase();
    const plan = normalizePlan(t.subscriptionPlan);
    byStatus[status] = (byStatus[status] || 0) + 1;
    byPlan[plan] = (byPlan[plan] || 0) + 1;
  }
  return { total: tenants.length, byStatus, byPlan };
}

/** Recurring revenue split by plan (active subscriptions only). Pure. */
function revenueByPlan(tenants = []) {
  const out = {};
  for (const key of PLAN_TIERS) out[key] = 0;
  for (const t of tenants) {
    const status = String(t.subscriptionStatus || "").toLowerCase();
    if (!ACTIVE_REVENUE_STATUSES.includes(status)) continue;
    const plan = normalizePlan(t.subscriptionPlan);
    out[plan] = round2((out[plan] || 0) + monthlyEquivalentPrice(plan, t.billingCycle));
  }
  return out;
}

module.exports = {
  PLAN_DISPLAY_NAMES,
  planDisplayName,
  ADDON_TYPES,
  getAddonCatalog,
  getAddonType,
  isAddonType,
  validateAddonInput,
  getSubscriptionPlanCatalog,
  computeEffectiveLimits,
  computeAddonExtensions,
  buildUsageContext,
  buildSubscriptionInvoice,
  monthlyEquivalentPrice,
  computeMrr,
  computeArr,
  summarizeSubscribers,
  revenueByPlan,
};
