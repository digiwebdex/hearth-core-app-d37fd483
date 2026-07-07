// Server-side mirror of src/lib/moduleAccess.ts — keep the two in sync.
// Advanced (opt-in) modules are reserved for Business and Ultimate (enterprise),
// except bundles with a lower `minPlan` floor (e.g. Website is a Pro feature).
// Menu-hiding on the frontend is not enough — this enforces the plan floor.

// Plans gate PLATFORM capabilities only — NOT travel business categories
// (docs/v2-master/111-SaaS-Plan-System.md). So the travel-operations bundles
// (ticketing, visa, hajj, tourGroups, corporate, studentManpower, documentsDesk,
// subAgents) are ungated by plan ("basic" floor) and instead surface by the
// tenant's enabled service types. Only the true PLATFORM bundles carry a plan
// floor: website (Pro), marketing + hrPayroll (Business). crm is a Starter core.
const MODULE_MIN_PLAN = {
  crm: "basic",
  ticketing: "basic",
  visa: "basic",
  hajj: "basic",
  tourGroups: "basic",
  corporate: "basic",
  studentManpower: "basic",
  documentsDesk: "basic",
  subAgents: "basic",
  website: "pro", // Website CMS is a Professional platform capability
  marketing: "business", // Marketing is a Business platform capability
  hrPayroll: "business", // HR & Payroll is a Business platform capability
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

// ── Added for Phase 1 Milestone 6 (Sidebar Engine) ──
// This file's header already said "keep the two in sync"; these were the
// pieces the frontend (src/lib/moduleAccess.ts) had that this file didn't
// yet — ported verbatim from there, additively, so the Sidebar Engine can
// resolve "is this nav item purchased/enabled" without a second copy of the
// bundle->item mapping living anywhere else.
const MODULE_ITEMS = {
  crm: ["crm-hub"],
  subAgents: ["commissions"],
  corporate: ["corporate", "travel-approvals"],
  ticketing: ["ticket-transactions", "flight-reminders"],
  tourGroups: ["group-tours", "mice"],
  visa: ["visa-tracker"],
  hajj: ["hajj-operations"],
  studentManpower: ["bd-operations"],
  documentsDesk: ["documents", "service-operations"],
  hrPayroll: ["hrm", "activity-log", "payroll"],
  marketing: ["loyalty", "referrals"],
  website: ["website-home", "website-builder", "website-blog", "website-publish", "website-seo"],
};

// Bundles shown automatically for eligible plans (plan features, not opt-in toggles).
const AUTO_ON_MODULE_IDS = ["website"];

function isModuleAutoOn(bundleId) {
  return AUTO_ON_MODULE_IDS.includes(bundleId);
}

// Reverse lookup: nav item id -> the advanced bundle that controls it.
const ITEM_TO_MODULE = Object.entries(MODULE_ITEMS).reduce((acc, [bundleId, items]) => {
  for (const item of items) acc[item] = bundleId;
  return acc;
}, {});

// True when a nav item should be visible for this plan + enabled-module set.
function isNavItemModuleEnabled(itemId, plan, enabledModules) {
  const bundle = ITEM_TO_MODULE[itemId];
  if (!bundle) return true; // core item — always available
  if (!planCanUseModule(bundle, plan)) return false; // below this bundle's plan floor
  if (isModuleAutoOn(bundle)) return true; // plan feature — shown automatically for eligible plans
  return Array.isArray(enabledModules) && enabledModules.includes(bundle);
}

module.exports = {
  ADVANCED_MODULE_IDS,
  moduleMinPlan,
  planCanUseModule,
  planCanUseAdvancedModules,
  sanitizeEnabledModules,
  planRank,
  ITEM_TO_MODULE,
  AUTO_ON_MODULE_IDS,
  isModuleAutoOn,
  isNavItemModuleEnabled,
};
