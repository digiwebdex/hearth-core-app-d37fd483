// Single source of truth for subscription PLANS on the backend (limits + features).
// Mirrors src/lib/plans.ts. Enforced server-side so paid limits/features cannot be
// bypassed by calling the API directly (frontend menu hiding is not enough).
//
// ── Capability-based model (v2 Master Blueprint, docs/v2-master/111-SaaS-Plan-System.md) ──
// Plans are NO LONGER differentiated by record counts (bookings / clients / leads /
// quotations). Those volume limits are retired. Plans differ by:
//   - Enabled features (feature flags below)
//   - Enabled business services (onboarding choice — NOT plan-gated in v2)
//   - Staff (users) / Branch / Domain limits
//   - Usage quotas ONLY for real-infrastructure-cost services (whatsapp/sms/…)
// Canonical plan KEYS stay basic/pro/business/enterprise (backward compatible with
// every stored tenant.subscriptionPlan and gate). Display names (Starter/Professional
// /Business/Enterprise) live in planEngine.js / billingEngine.js.

// ── Count limits (−1 = unlimited, 0 = not allowed) ──
// Only capability limits remain: staff (users), branches, domains, and the
// whatsapp usage quota (a real-cost service, not a record count).
const PLAN_LIMITS = {
  basic:      { users: 3,  branches: 1,  domains: 0,  whatsapp: 0 },
  pro:        { users: 10, branches: 3,  domains: 1,  whatsapp: 200 },
  business:   { users: 30, branches: 10, domains: 2,  whatsapp: -1 },
  enterprise: { users: -1, branches: -1, domains: -1, whatsapp: -1 },
};

// Which Prisma model backs each countable limit (used by checkPlanLimit).
// whatsapp is a usage quota, not a row count — it has no model here.
const RESOURCE_MODEL_MAP = {
  users: "user",
  branches: "branch",
  domains: "tenantDomain",
};

// ── Feature flags (PLATFORM-capability gating only) ──
// Plans gate PLATFORM capabilities, NOT travel business categories. Which travel
// services a tenant sells (Air Ticket, Visa, Hotel, Tour, Hajj, Transport,
// Insurance, Student, Manpower, Corporate…) is an onboarding / Settings choice
// (enabledServiceTypes), configurable by Super Admin or the tenant — never a plan
// restriction. `hasHajjUmrah` is therefore true on every plan (kept only for
// backward-compat with existing consumers; it does not gate).
//
// Enterprise = the fully-enabled default ("custom capability package"); it is
// intended to be tuned per-tenant by Super Admin (via the feature-override map /
// SystemFlag mechanism), not a frozen matrix (docs/v2-master/111-SaaS-Plan-System.md).
const PLAN_FEATURES = {
  basic: {
    hasHajjUmrah: true, // travel category — ungated on every plan
    hasEmailNotifications: false, hasWebsiteTemplates: false, hasCustomDomain: false,
    hasSmsIntegration: false, hasWhatsApp: false, hasAgentCommission: false,
    hasAutomation: false, hasAdvancedAutomation: false, hasMarketingTools: false,
    hasHrPayroll: false, hasAdvancedAnalytics: false, hasRefundSystem: false,
    hasApiAccess: false, hasWhiteLabel: false, hasMarketplace: false,
    hasPrioritySupport: false,
  },
  pro: {
    hasHajjUmrah: true,
    hasEmailNotifications: true, hasWebsiteTemplates: true, hasCustomDomain: true,
    hasSmsIntegration: true, hasWhatsApp: true, hasAgentCommission: true,
    hasAutomation: true, hasAdvancedAutomation: false, hasMarketingTools: false,
    hasHrPayroll: false, hasAdvancedAnalytics: false, hasRefundSystem: false,
    hasApiAccess: false, hasWhiteLabel: false, hasMarketplace: false,
    hasPrioritySupport: false,
  },
  business: {
    hasHajjUmrah: true,
    hasEmailNotifications: true, hasWebsiteTemplates: true, hasCustomDomain: true,
    hasSmsIntegration: true, hasWhatsApp: true, hasAgentCommission: true,
    hasAutomation: true, hasAdvancedAutomation: true, hasMarketingTools: true,
    hasHrPayroll: true, hasAdvancedAnalytics: true, hasRefundSystem: true,
    hasApiAccess: false, hasWhiteLabel: false, hasMarketplace: false,
    hasPrioritySupport: false,
  },
  enterprise: {
    hasHajjUmrah: true,
    hasEmailNotifications: true, hasWebsiteTemplates: true, hasCustomDomain: true,
    hasSmsIntegration: true, hasWhatsApp: true, hasAgentCommission: true,
    hasAutomation: true, hasAdvancedAutomation: true, hasMarketingTools: true,
    hasHrPayroll: true, hasAdvancedAnalytics: true, hasRefundSystem: true,
    hasApiAccess: true, hasWhiteLabel: true, hasMarketplace: true,
    hasPrioritySupport: true,
  },
};

// Normalize legacy / alias plan names to a known key.
function normalizePlan(plan) {
  const p = String(plan || "").toLowerCase().trim();
  if (p === "unlimited") return "enterprise"; // UI calls enterprise "Unlimited"
  if (p === "free" || p === "") return "basic"; // legacy free → basic-tier features
  if (PLAN_FEATURES[p]) return p;
  return "basic";
}

function planHasFeature(plan, flag) {
  const key = normalizePlan(plan);
  return Boolean(PLAN_FEATURES[key]?.[flag]);
}

// Returns the numeric limit for a resource on a plan (−1 unlimited, 0 not allowed,
// undefined if the resource is unknown — unknown resources are NOT limited).
function getPlanLimit(plan, resource) {
  const key = normalizePlan(plan);
  return PLAN_LIMITS[key]?.[resource];
}

module.exports = {
  PLAN_LIMITS,
  RESOURCE_MODEL_MAP,
  PLAN_FEATURES,
  normalizePlan,
  planHasFeature,
  getPlanLimit,
};
