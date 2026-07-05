// Server-side mirror of src/lib/moduleAccess.ts — keep the two in sync.
// Advanced (opt-in) modules are reserved for Business and Ultimate (enterprise),
// except bundles with a lower `minPlan` floor (e.g. Website is a Pro feature).
// Menu-hiding on the frontend is not enough — this enforces the plan floor.

const MODULE_MIN_PLAN = {
  // default floor is "business"; per-bundle overrides:
  website: "pro", // website builder is available from Pro upward
  catalog: "pro", // package/tour catalog builder — Pro upward (hidden on lean Basic)
};

const ADVANCED_MODULE_IDS = [
  "crm",
  "subAgents",
  "corporate",
  "ticketing",
  "tourGroups",
  "visa",
  "hajj",
  "studentManpower",
  "documentsDesk",
  "hrPayroll",
  "marketing",
  "website",
  "catalog",
];

const PLAN_RANK = { free: 0, basic: 1, pro: 2, business: 3, enterprise: 4 };
const DEFAULT_MODULE_MIN_PLAN = "business";

function planRank(plan) {
  const p = String(plan || "").toLowerCase().trim();
  const normalized = p === "unlimited" ? "enterprise" : p;
  return PLAN_RANK[normalized] ?? 0;
}

function moduleMinPlan(bundleId) {
  return MODULE_MIN_PLAN[bundleId] || DEFAULT_MODULE_MIN_PLAN;
}

function planCanUseModule(bundleId, plan) {
  return planRank(plan) >= planRank(moduleMinPlan(bundleId));
}

function planCanUseAdvancedModules(plan) {
  return ADVANCED_MODULE_IDS.some((id) => planCanUseModule(id, plan));
}

// Keep only known bundle ids the plan is allowed to activate.
function sanitizeEnabledModules(values, plan) {
  const known = new Set(ADVANCED_MODULE_IDS);
  const raw = Array.isArray(values) ? values : [];
  return [...new Set(raw.map((v) => String(v).trim()).filter((v) => known.has(v) && planCanUseModule(v, plan)))];
}

module.exports = {
  ADVANCED_MODULE_IDS,
  moduleMinPlan,
  planCanUseModule,
  planCanUseAdvancedModules,
  sanitizeEnabledModules,
};
