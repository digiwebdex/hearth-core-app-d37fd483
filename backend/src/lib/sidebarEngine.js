// Sidebar Engine — Phase 1, Milestone 6 (the Phase 1 capstone)
// (docs/v2-master/11-Architecture-Freeze.md §6, docs/v2-master/12-Implementation-Sequence.md Phase 1).
//
// This engine does not introduce any new navigation data — it is a read-only
// composition layer over the five engines already built in this phase:
//   - Module Registry   (moduleRegistry.js)   — the 44 entries / 10 groups
//   - Plan Engine        (planEngine.js)       — plan, limits, features, enabledModules, flags
//   - Permission Engine  (permissionEngine.js) — role -> permission set (composes Plan Engine + Feature Flags itself)
//   - Feature Flag Engine (featureFlags.js)    — consumed transitively via Permission/Plan Engine
//   - moduleAccess.js                          — purchased-module (bundle) gating
// Status Engine is NOT consumed here: nothing about "what statuses exist"
// affects which sidebar items are visible in this codebase, so wiring it in
// would be a contrived dependency, not a real one.
//
// "Business Type" (the resolver chain's first step) is this codebase's
// enabledServiceTypes/enabledSubcategories — the 14-service-type onboarding
// configuration that determines which kind of travel business a tenant runs
// (see docs/v2-master/04-Service-Modules.md). There is no field literally
// named "businessType" anywhere; this is the closest real concept.
//
// Simplification, stated plainly: docs/v2-master/04-Service-Modules.md
// documents that when enabledSubcategories is set, "effective" service types
// are re-derived from it via src/lib/enabledServiceTypes.ts. That derivation
// happens once, at SAVE time (buildTenantServicePayload), and its result is
// what's persisted into Tenant.enabledServiceTypes — so a tenant's stored
// enabledServiceTypes is already the effective set by the time this engine
// reads it. This engine therefore does not re-derive from subcategories; it
// applies only the one read-time rule that isn't already baked into the
// stored data: an EMPTY enabledServiceTypes list means "show every
// service-typed item" (the documented default-onboarding behavior).
//
// Wraps, does not replace: src/config/navigation.ts / src/lib/moduleAccess.ts
// / src/components/AppSidebarNav.tsx keep rendering the sidebar exactly as
// today. Nothing here is consumed by the frontend yet — that wiring, behind
// the `dynamicSidebar` feature flag, is a separate step from building this
// engine.

const { getModuleRegistry, getModuleRegistryGroups } = require("./moduleRegistry");
const { resolveUserPermissionContext, hasPermission } = require("./permissionEngine");
const { planHasFeature } = require("./planEngine");
const { planRank, isNavItemModuleEnabled } = require("./moduleAccess");

// ── Sidebar Registry ──
// Explicitly not a new data structure — a named, discoverable pass-through to
// the Module Registry, per "use the existing Module Registry, do not
// duplicate navigation definitions".
function getSidebarRegistry() {
  return getModuleRegistryGroups();
}

function planMeetsFloor(plan, minPlan) {
  if (!minPlan) return true;
  return planRank(plan) >= planRank(minPlan);
}

function isServiceTypeGateOpen(requiredServiceTypes, effectiveServiceTypes) {
  if (!requiredServiceTypes || requiredServiceTypes.length === 0) return true;
  if (effectiveServiceTypes.length === 0) return true; // empty = "show everything"
  return requiredServiceTypes.some((t) => effectiveServiceTypes.includes(t));
}

/**
 * Whether one Module Registry entry is visible, given a resolved role +
 * plan + purchased modules + effective service types. Applies every gate
 * independently (all must pass) — mirrors how src/components/AppSidebarNav.tsx
 * layers RBAC + plan-lock + moduleAccess today.
 *
 * super_admin bypasses every axis here (RBAC, plan floor, feature flag,
 * service type, purchased module) — matching the frozen rule that
 * super_admin bypasses RBAC + plan + subscription checks everywhere else in
 * the app (docs/v2-master/11-Architecture-Freeze.md §8/§9).
 */
function isEntryVisible(entry, { canonicalRole, plan, enabledModules, effectiveServiceTypes }) {
  if (canonicalRole === "super_admin") return true;
  if (!hasPermission(canonicalRole, entry.rbacModule, "view")) return false;
  if (!planMeetsFloor(plan, entry.minPlan)) return false;
  if (entry.requiredFeature && !planHasFeature(plan, entry.requiredFeature)) return false;
  if (!isServiceTypeGateOpen(entry.requiredServiceTypes, effectiveServiceTypes)) return false;
  if (!isNavItemModuleEnabled(entry.id, plan, enabledModules)) return false;
  return true;
}

// ── Navigation Resolver ──
// Business Type -> Subscription Plan -> Purchased Modules -> Permissions ->
// Feature Flags -> Visible Navigation -> Final Sidebar Context.
async function resolveNavigationContext({
  role,
  tenantId,
  plan,
  enabledModules,
  enabledServiceTypes,
  enabledSubcategories,
} = {}) {
  // Permissions + Feature Flags (composes Plan Engine + Feature Flag Engine internally).
  const permissionContext = await resolveUserPermissionContext({
    role, tenantId, plan, enabledModules, enabledServiceTypes, enabledSubcategories,
  });

  const effectiveServiceTypes = Array.isArray(enabledServiceTypes) ? enabledServiceTypes : [];
  const visibilityInputs = {
    canonicalRole: permissionContext.role.canonicalRole,
    plan: permissionContext.plan.plan,
    enabledModules: permissionContext.plan.enabledModules,
    effectiveServiceTypes,
  };

  const groups = getSidebarRegistry()
    .map((group) => ({
      id: group.id,
      labelKey: group.labelKey,
      items: group.items.filter((entry) => isEntryVisible(entry, visibilityInputs)),
    }))
    .filter((group) => group.items.length > 0);

  return {
    role: permissionContext.role,
    plan: permissionContext.plan,
    flags: permissionContext.flags,
    businessType: {
      enabledServiceTypes: effectiveServiceTypes,
      enabledSubcategories: Array.isArray(enabledSubcategories) ? enabledSubcategories : [],
    },
    groups,
    totalVisibleItems: groups.reduce((sum, g) => sum + g.items.length, 0),
    totalModules: getModuleRegistry().length,
  };
}

module.exports = {
  getSidebarRegistry,
  isEntryVisible,
  resolveNavigationContext,
};
