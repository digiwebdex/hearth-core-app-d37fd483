// Single source of truth for subscription FEATURE flags on the backend.
// Mirrors src/lib/plans.ts. Count-limits live in middleware/auth.js (PLAN_LIMITS).
//
// Feature gating is enforced here so paid features cannot be used by calling the
// API directly on a cheaper plan (the frontend menu hiding is not enough).

const PLAN_FEATURES = {
  basic: {
    hasCustomDomain: false, hasWebsiteTemplates: false, hasSmsIntegration: false,
    hasWhatsApp: false, hasEmailNotifications: false, hasAgentCommission: false,
    hasAdvancedAnalytics: false, hasMarketingTools: false, hasApiAccess: false,
    hasRefundSystem: false, hasHajjUmrah: true, hasPrioritySupport: false,
  },
  pro: {
    hasCustomDomain: true, hasWebsiteTemplates: true, hasSmsIntegration: true,
    hasWhatsApp: false, hasEmailNotifications: true, hasAgentCommission: true,
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

module.exports = { PLAN_FEATURES, normalizePlan, planHasFeature };
