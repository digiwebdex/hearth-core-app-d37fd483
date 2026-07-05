// Permission Engine — Phase 1, Milestone 4
// (docs/v2-master/11-Architecture-Freeze.md §8, docs/v2-master/12-Implementation-Sequence.md Phase 1).
//
// Wraps, and does not duplicate, the existing enforced RBAC matrix:
//   - backend/src/middleware/auth.js — ROLE_PERMISSIONS (now exported; that
//     was the ONLY change made to that file — one identifier added to its
//     existing module.exports object. No function body, no enforcement
//     logic, no behavior of authenticate/requireRole/requirePermission/
//     requireSuperAdmin was touched.)
// This engine becomes the new single entry point for READING permission
// data. It does not replace requirePermission()/requireRole() as the actual
// enforcement mechanism — those keep running exactly as before, on every
// existing route, completely unchanged.
//
// Two-layer role model (see resolveRole() below for why):
//   Layer 1 — Canonical roles: the roles ROLE_PERMISSIONS actually enforces
//     today (tenant_owner, manager, sales_agent, accountant, operations),
//     plus super_admin (enforced via an explicit bypass in auth.js rather
//     than a ROLE_PERMISSIONS entry — represented here as an explicit
//     "grants everything" entry, matching that bypass exactly).
//   Layer 2 — Named roles: the business-facing role labels this milestone
//     was asked to support (Super Admin, Owner, Manager, Accountant, Sales
//     Executive, Visa Officer, Ticket Officer, Hajj Officer, Support,
//     Customer, Agent). Each maps to a Layer-1 canonical role via
//     `backedBy`. Five of them (Super Admin/Owner/Manager/Accountant/Sales
//     Executive) are just a friendlier label for an already 1:1-enforced
//     role (implemented: true). Four (Visa/Ticket/Hajj Officer, Support) do
//     NOT have distinct grants anywhere in ROLE_PERMISSIONS yet — they are
//     registered as named placeholders that currently inherit the
//     `operations` role's grants (implemented: false), so the engine is
//     honest about what is and isn't really enforced. Giving them their own
//     distinct permission sets is a real product decision (which actions on
//     which modules) that this wrap-only milestone does not invent.
//     Customer and Agent are a third category entirely — the Portal system
//     (backend/src/routes/portal.js), a separate JWT audience with no
//     ROLE_PERMISSIONS entry at all; they are registered here for
//     completeness (category: "portal", backedBy: null) but resolve no
//     module/action grants from this engine.
//
// Adding a role later — canonical or named — is one registry entry; nothing
// else in this file needs to change ("future roles must be easily added").

const { ROLE_PERMISSIONS } = require("../middleware/auth");
const { resolveTenantPlanContext } = require("./planEngine");

// ── Permission Registry: modules & actions ──
// Derived from ROLE_PERMISSIONS itself (never hand-maintained), so this list
// can never drift from what auth.js actually enforces.
const MODULES = [...new Set(Object.values(ROLE_PERMISSIONS).flatMap((perms) => Object.keys(perms)))].sort();

// Not exported anywhere in auth.js as a named constant (it's implicit in the
// literal arrays) — declaring it explicitly here fills a real gap without
// duplicating any existing list.
const ACTIONS = ["view", "create", "edit", "delete", "approve", "export"];

// super_admin has no ROLE_PERMISSIONS entry — auth.js grants it everything
// via an explicit bypass in requirePermission/requireRole/requireFeature.
// This constant makes that bypass's effect explicit, queryable data instead
// of an implicit "if (role === 'super_admin') return next()".
const SUPER_ADMIN_GRANTS = Object.fromEntries(MODULES.map((m) => [m, [...ACTIONS]]));

const CANONICAL_ROLES = {
  super_admin: SUPER_ADMIN_GRANTS,
  ...ROLE_PERMISSIONS,
};
const CANONICAL_ROLE_KEYS = Object.keys(CANONICAL_ROLES);

// Mirrors src/lib/permissions.ts's mapLegacyRole() exactly. NOTE: auth.js's
// own enforcement (requirePermission/requireRole) does NOT apply this
// mapping — it reads req.userRole verbatim. A user whose DB User.role is
// still a legacy value ("owner"/"admin"/"member") resolves correctly
// through THIS engine, but the live requirePermission/requireRole
// middleware would deny them (ROLE_PERMISSIONS has no "owner" key). This is
// a pre-existing gap in auth.js, not something introduced or fixed here —
// fixing live enforcement is out of scope for a wrap-only milestone.
const LEGACY_ROLE_ALIASES = { owner: "tenant_owner", admin: "tenant_owner", member: "sales_agent" };

// ── Permission Registry: named roles (Layer 2) ──
const ROLE_REGISTRY = [
  { key: "super_admin", label: "Super Admin", category: "platform", backedBy: "super_admin", implemented: true },
  { key: "owner", label: "Owner", category: "tenant", backedBy: "tenant_owner", implemented: true },
  { key: "manager", label: "Manager", category: "tenant", backedBy: "manager", implemented: true },
  { key: "accountant", label: "Accountant", category: "tenant", backedBy: "accountant", implemented: true },
  { key: "sales_executive", label: "Sales Executive", category: "tenant", backedBy: "sales_agent", implemented: true },
  {
    key: "visa_officer", label: "Visa Officer", category: "tenant", backedBy: "operations", implemented: false,
    note: "No distinct grants exist yet — inherits the operations role. A dedicated Visa Officer permission set is a product decision outside this milestone's scope.",
  },
  {
    key: "ticket_officer", label: "Ticket Officer", category: "tenant", backedBy: "operations", implemented: false,
    note: "No distinct grants exist yet — inherits the operations role. A dedicated Ticket Officer permission set is a product decision outside this milestone's scope.",
  },
  {
    key: "hajj_officer", label: "Hajj Officer", category: "tenant", backedBy: "operations", implemented: false,
    note: "No distinct grants exist yet — inherits the operations role. A dedicated Hajj Officer permission set is a product decision outside this milestone's scope.",
  },
  {
    key: "support", label: "Support", category: "tenant", backedBy: "operations", implemented: false,
    note: "Best-effort placeholder mapping — no dedicated support module/role exists in ROLE_PERMISSIONS today. Pending a product decision on what Support should access.",
  },
  { key: "customer", label: "Customer", category: "portal", backedBy: null, portalRole: "customer", implemented: true },
  { key: "agent", label: "Agent", category: "portal", backedBy: null, portalRole: "agent", implemented: true },
];
const ROLE_REGISTRY_BY_KEY = Object.fromEntries(ROLE_REGISTRY.map((r) => [r.key, r]));

function normalizeRoleInput(rawRole) {
  return String(rawRole || "").trim();
}

// ── Role Resolver ──
/**
 * Resolve any role identifier — a legacy DB alias, a canonical AppRole, or
 * one of the named Layer-2 roles — to a single descriptor with its
 * effective (canonical) permission source. Never throws; unrecognized input
 * falls back to "sales_agent", matching src/hooks/usePermissions.ts's
 * documented "safest default".
 */
function resolveRole(rawRole) {
  const raw = normalizeRoleInput(rawRole);

  const named = ROLE_REGISTRY_BY_KEY[raw];
  if (named) {
    return {
      key: named.key,
      label: named.label,
      category: named.category,
      canonicalRole: named.backedBy,
      implemented: named.implemented,
      portalRole: named.portalRole ?? null,
      note: named.note ?? null,
    };
  }

  const canonical = LEGACY_ROLE_ALIASES[raw] || (CANONICAL_ROLE_KEYS.includes(raw) ? raw : null);
  if (canonical) {
    const registryEntry = ROLE_REGISTRY.find((r) => r.backedBy === canonical && r.implemented);
    return {
      key: canonical,
      label: registryEntry?.label || canonical,
      category: canonical === "super_admin" ? "platform" : "tenant",
      canonicalRole: canonical,
      implemented: true,
      portalRole: null,
      note: raw !== canonical ? `Resolved from legacy alias "${raw}".` : null,
    };
  }

  // Unknown role string — safest default.
  return {
    key: "sales_agent",
    label: "Sales Executive",
    category: "tenant",
    canonicalRole: "sales_agent",
    implemented: true,
    portalRole: null,
    note: `Unrecognized role "${raw}" — defaulted to the safest role (sales_agent).`,
  };
}

// ── Permission Resolver ──
/** The full module -> allowed-actions map for a canonical role. super_admin gets every action on every module. */
function getPermissionSet(canonicalRole) {
  return { ...(CANONICAL_ROLES[canonicalRole] || {}) };
}

/** Modules this canonical role has at least one action on. */
function getAccessibleModules(canonicalRole) {
  const set = getPermissionSet(canonicalRole);
  return Object.keys(set).filter((module) => set[module].length > 0);
}

/** True if this canonical role is granted `action` on `module` — mirrors requirePermission()'s own check exactly. */
function hasPermission(canonicalRole, module, action) {
  if (canonicalRole === "super_admin") return true;
  const actions = ROLE_PERMISSIONS[canonicalRole]?.[module];
  return Boolean(actions && actions.includes(action));
}

// ── Final Permission Context ──
// User -> Role -> Permission Set -> Module Access -> Action Access -> Feature
// Flags -> Final Permission Context. The Feature Flags step composes
// Milestone 3's Plan Engine (resolveTenantPlanContext) instead of
// re-deriving plan features/flags a second time.
async function resolveUserPermissionContext({
  role,
  tenantId,
  plan,
  enabledModules,
  enabledServiceTypes,
  enabledSubcategories,
} = {}) {
  const resolvedRole = resolveRole(role);
  const permissions = resolvedRole.canonicalRole ? getPermissionSet(resolvedRole.canonicalRole) : {};
  const moduleAccess = resolvedRole.canonicalRole ? getAccessibleModules(resolvedRole.canonicalRole) : [];

  const planContext = await resolveTenantPlanContext({
    plan,
    enabledModules,
    enabledServiceTypes,
    enabledSubcategories,
    tenantId,
  });

  return {
    role: resolvedRole,
    permissions,
    moduleAccess,
    plan: {
      plan: planContext.plan,
      features: planContext.features,
      availableModules: planContext.availableModules,
      enabledModules: planContext.enabledModules,
      limits: planContext.limits,
    },
    flags: planContext.flags,
  };
}

module.exports = {
  MODULES,
  ACTIONS,
  CANONICAL_ROLE_KEYS,
  ROLE_REGISTRY,
  resolveRole,
  getPermissionSet,
  getAccessibleModules,
  hasPermission,
  resolveUserPermissionContext,
};
