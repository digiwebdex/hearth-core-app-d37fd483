// Plan Engine — Phase 1, Milestone 3
// (docs/v2-master/11-Architecture-Freeze.md §9, docs/v2-master/12-Implementation-Sequence.md Phase 1).
//
// This module is the ONE place future code should import plan-related data
// from. It does not re-declare any numbers — every limit, feature flag, and
// price is required directly from the existing canonical sources and simply
// composed/re-exported:
//   - backend/src/lib/planFeatures.js  — PLAN_LIMITS + PLAN_FEATURES (canonical,
//     per business decision: "the backend is the single source of truth").
//   - backend/src/lib/planPricing.js   — pricing.
//   - backend/src/lib/moduleAccess.js  — advanced module bundle plan floors.
//   - backend/src/lib/featureFlags.js  — Milestone 2's engineering rollout flags.
// None of those files are modified. "Plan definitions must exist only once" —
// this file adds ONLY the metadata that genuinely doesn't exist anywhere yet
// (display names), it does not duplicate limits/features/pricing.
//
// Alias handling: planFeatures.js's normalizePlan() is the most complete
// normalizer in the codebase (it collapses both "free"->"basic" and
// "unlimited"->"enterprise"). planPricing.js's own normalizePlan() and
// moduleAccess.js's internal planRank() do NOT handle these aliases the same
// way (see docs/v2-master/08-Plan-Feature-Matrix.md "known drift"). To avoid
// inheriting that drift, every resolver in this file normalizes the incoming
// plan value ONCE via planFeatures.normalizePlan(), and only ever calls the
// downstream helpers with that already-canonical value — so "unlimited" is
// guaranteed to price and gate exactly like "enterprise", not fall through to
// planPricing.js's unrelated "free" default. The underlying files are left
// untouched, per "wrap existing systems, replace nothing".

const {
  PLAN_LIMITS,
  PLAN_FEATURES,
  normalizePlan,
  planHasFeature,
  getPlanLimit,
} = require("./planFeatures");
const { getPlanPrice } = require("./planPricing");
const {
  ADVANCED_MODULE_IDS,
  planCanUseModule,
  sanitizeEnabledModules,
} = require("./moduleAccess");
const { getAllFlags } = require("./featureFlags");

// ── Plan Registry ──
// The only genuinely new data point: human-readable plan names. Nothing else
// here is a second copy of a number that already lives in planFeatures.js /
// planPricing.js.
const PLAN_TIERS = ["basic", "pro", "business", "enterprise"];
const PLAN_NAMES = {
  basic: "Basic",
  pro: "Pro",
  business: "Business",
  enterprise: "Enterprise",
};
const BILLING_CYCLES = ["monthly", "yearly"];

// ── Plan Feature Resolver ──
/** The plan's Default Feature Flags (hasX map) — a direct view of PLAN_FEATURES. */
function resolvePlanFeatures(plan) {
  const key = normalizePlan(plan);
  return { ...PLAN_FEATURES[key] };
}

/** The plan's Feature List — the subset of Default Feature Flags that are enabled. */
function resolvePlanFeatureList(plan) {
  const features = resolvePlanFeatures(plan);
  return Object.keys(features).filter((flag) => features[flag] === true);
}

// ── Plan Limit Resolver ──
/** The plan's Feature Limits — a direct view of PLAN_LIMITS (-1 = unlimited, 0 = not allowed). */
function resolvePlanLimits(plan) {
  const key = normalizePlan(plan);
  return { ...PLAN_LIMITS[key] };
}

/** Which advanced module bundles this plan tier unlocks (Module Access — what's possible, not what a tenant has toggled on). */
function resolvePlanModuleAccess(plan) {
  const key = normalizePlan(plan);
  return ADVANCED_MODULE_IDS.filter((id) => planCanUseModule(id, key));
}

// ── Plan Resolver ──
/** The full static definition of one plan tier: name, price, billing cycle, feature list, limits, module access. */
function resolvePlan(plan) {
  const key = normalizePlan(plan);
  return {
    plan: key,
    name: PLAN_NAMES[key],
    pricing: {
      monthly: getPlanPrice(key, "monthly"),
      yearly: getPlanPrice(key, "yearly"),
    },
    billingCycles: BILLING_CYCLES,
    features: resolvePlanFeatures(key),
    featureList: resolvePlanFeatureList(key),
    limits: resolvePlanLimits(key),
    moduleAccess: resolvePlanModuleAccess(key),
  };
}

/** The full Plan Registry — every plan tier's static definition, in tier order. */
function getPlanRegistry() {
  return PLAN_TIERS.map((key) => resolvePlan(key));
}

// ── Tenant Plan Resolver (the full chain) ──
// Tenant Plan -> Enabled Modules -> Enabled Features -> Limits -> Service Types -> Feature Flags.
// Service types are NOT plan-gated today — which of the 14 service types a
// tenant enables is an onboarding-time choice (see docs/v2-master/04-Service-Modules.md),
// not a plan restriction. This resolver passes the tenant's raw configuration
// through unchanged; it does not duplicate the frontend's "effective service
// types" derivation (src/lib/enabledServiceTypes.ts), which stays the single
// place that logic lives.
async function resolveTenantPlanContext({
  plan,
  enabledModules,
  enabledServiceTypes,
  enabledSubcategories,
  tenantId,
} = {}) {
  const key = normalizePlan(plan);
  const definition = resolvePlan(key);

  return {
    plan: key,
    name: definition.name,
    pricing: definition.pricing,
    availableModules: definition.moduleAccess, // bundles this PLAN unlocks
    enabledModules: sanitizeEnabledModules(enabledModules, key), // bundles this TENANT has actually turned on
    features: definition.features, // Default Feature Flags
    limits: definition.limits, // Feature Limits
    serviceTypes: {
      enabled: Array.isArray(enabledServiceTypes) ? enabledServiceTypes : [],
      enabledSubcategories: Array.isArray(enabledSubcategories) ? enabledSubcategories : [],
    },
    flags: await getAllFlags(tenantId), // Milestone 2 engineering rollout flags
  };
}

module.exports = {
  PLAN_TIERS,
  BILLING_CYCLES,
  resolvePlan,
  getPlanRegistry,
  resolvePlanFeatures,
  resolvePlanFeatureList,
  resolvePlanLimits,
  resolvePlanModuleAccess,
  resolveTenantPlanContext,
  // Re-exported so future code can treat planEngine.js as the one plan import surface.
  normalizePlan,
  planHasFeature,
  getPlanLimit,
};
