// Server-side mirror of src/lib/moduleAccess.ts — keep the two in sync.
// Enforces that advanced (opt-in) modules can only be activated by Business and
// Ultimate (enterprise) plan owners; menu-hiding on the frontend is not enough.

const ADVANCED_MODULE_IDS = [
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
];

const ADVANCED_PLAN_TIERS = new Set(["business", "enterprise"]);

function planCanUseAdvancedModules(plan) {
  const p = String(plan || "").toLowerCase().trim();
  const normalized = p === "unlimited" ? "enterprise" : p;
  return ADVANCED_PLAN_TIERS.has(normalized);
}

// Keep only known bundle ids; empty when the plan cannot use advanced modules.
function sanitizeEnabledModules(values, plan) {
  if (!planCanUseAdvancedModules(plan)) return [];
  const known = new Set(ADVANCED_MODULE_IDS);
  const raw = Array.isArray(values) ? values : [];
  return [...new Set(raw.map((v) => String(v).trim()).filter((v) => known.has(v)))];
}

module.exports = {
  ADVANCED_MODULE_IDS,
  planCanUseAdvancedModules,
  sanitizeEnabledModules,
};
