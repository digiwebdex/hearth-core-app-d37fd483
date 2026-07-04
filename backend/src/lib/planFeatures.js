// Single source of truth for subscription PLANS on the backend (limits + features).
// Mirrors src/lib/plans.ts. Enforced server-side so paid limits/features cannot be
// bypassed by calling the API directly (frontend menu hiding is not enough).

// ── Count limits (−1 = unlimited, 0 = not allowed) ──
const PLAN_LIMITS = {
  basic:      { clients: 500,  bookings: 500,  users: 3,  domains: 0, leads: 500,  quotations: 500,  whatsapp: 0 },
  pro:        { clients: 1000, bookings: 1000, users: 10, domains: 1, leads: 1000, quotations: 1000, whatsapp: 200 },
  business:   { clients: 2000, bookings: 2000, users: 25, domains: 2, leads: 2000, quotations: 2000, whatsapp: -1 },
  enterprise: { clients: -1,   bookings: -1,   users: -1, domains: -1, leads: -1,  quotations: -1,   whatsapp: -1 },
};

const RESOURCE_MODEL_MAP = {
  clients: "client",
  bookings: "booking",
  users: "user",
  domains: "tenantDomain",
  leads: "lead",
  quotations: "quotation",
};

// ── Feature flags ──
const PLAN_FEATURES = {
  basic: {
    hasCustomDomain: false, hasWebsiteTemplates: false, hasSmsIntegration: false,
    hasWhatsApp: false, hasEmailNotifications: false, hasAgentCommission: false,
    hasAdvancedAnalytics: false, hasMarketingTools: false, hasApiAccess: false,
    hasRefundSystem: false, hasHajjUmrah: true, hasPrioritySupport: false,
  },
  pro: {
    hasCustomDomain: true, hasWebsiteTemplates: true, hasSmsIntegration: true,
    hasWhatsApp: true, hasEmailNotifications: true, hasAgentCommission: true,
    hasAdvancedAnalytics: false, hasMarketingTools: false, hasApiAccess: false,
    hasRefundSystem: false, hasHajjUmrah: true, hasPrioritySupport: false,
  },
  business: {
    hasCustomDomain: true, hasWebsiteTemplates: true, hasSmsIntegration: true,
    hasWhatsApp: true, hasEmailNotifications: true, hasAgentCommission: true,
    hasAdvancedAnalytics: true, hasMarketingTools: true, hasApiAccess: false,
    hasRefundSystem: true, hasHajjUmrah: true, hasPrioritySupport: false,
  },
  enterprise: {
    hasCustomDomain: true, hasWebsiteTemplates: true, hasSmsIntegration: true,
    hasWhatsApp: true, hasEmailNotifications: true, hasAgentCommission: true,
    hasAdvancedAnalytics: true, hasMarketingTools: true, hasApiAccess: true,
    hasRefundSystem: true, hasHajjUmrah: true, hasPrioritySupport: true,
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
// undefined if the resource is unknown).
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
