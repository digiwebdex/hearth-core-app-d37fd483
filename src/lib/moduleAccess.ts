// Advanced (opt-in) sidebar modules.
//
// The lean core menu is visible to every plan by default. Everything below is
// OFF by default and can be switched on only by Business and Ultimate
// (enterprise) plan owners in Settings. Each bundle maps to one or more nav
// item ids from src/config/navigation.ts.

export interface AdvancedModule {
  id: string;
  labelKey: string;
  descKey: string;
  items: string[];
}

export const ADVANCED_MODULES: AdvancedModule[] = [
  { id: "subAgents", labelKey: "modules.subAgents", descKey: "modules.subAgentsDesc", items: ["agents", "commissions"] },
  { id: "corporate", labelKey: "modules.corporate", descKey: "modules.corporateDesc", items: ["corporate", "travel-approvals"] },
  { id: "ticketing", labelKey: "modules.ticketing", descKey: "modules.ticketingDesc", items: ["ticket-transactions", "flight-reminders"] },
  { id: "tourGroups", labelKey: "modules.tourGroups", descKey: "modules.tourGroupsDesc", items: ["group-tours", "mice"] },
  { id: "visa", labelKey: "modules.visa", descKey: "modules.visaDesc", items: ["visa-tracker"] },
  { id: "hajj", labelKey: "modules.hajj", descKey: "modules.hajjDesc", items: ["hajj-operations"] },
  { id: "studentManpower", labelKey: "modules.studentManpower", descKey: "modules.studentManpowerDesc", items: ["bd-operations"] },
  { id: "documentsDesk", labelKey: "modules.documentsDesk", descKey: "modules.documentsDeskDesc", items: ["documents", "service-operations"] },
  { id: "hrPayroll", labelKey: "modules.hrPayroll", descKey: "modules.hrPayrollDesc", items: ["hrm", "activity-log", "payroll"] },
  { id: "marketing", labelKey: "modules.marketing", descKey: "modules.marketingDesc", items: ["loyalty", "referrals"] },
  { id: "website", labelKey: "modules.website", descKey: "modules.websiteDesc", items: ["website-home", "website-builder", "website-blog", "website-publish", "website-seo"] },
];

export const ADVANCED_MODULE_IDS: string[] = ADVANCED_MODULES.map((m) => m.id);

// Reverse lookup: nav item id → the advanced bundle that controls it.
const ITEM_TO_MODULE: Record<string, string> = ADVANCED_MODULES.reduce(
  (acc, m) => {
    for (const item of m.items) acc[item] = m.id;
    return acc;
  },
  {} as Record<string, string>,
);

// Plans allowed to activate advanced modules. "Ultimate" is the enterprise tier.
const ADVANCED_PLAN_TIERS = new Set(["business", "enterprise"]);

export function planCanUseAdvancedModules(plan?: string | null): boolean {
  const p = String(plan || "").toLowerCase().trim();
  const normalized = p === "unlimited" ? "enterprise" : p;
  return ADVANCED_PLAN_TIERS.has(normalized);
}

/** True when a nav item should be visible for this plan + enabled-module set. */
export function isNavItemModuleEnabled(itemId: string, plan?: string | null, enabledModules?: string[] | null): boolean {
  const bundle = ITEM_TO_MODULE[itemId];
  if (!bundle) return true; // core item — always available
  if (!planCanUseAdvancedModules(plan)) return false; // gated to Business / Ultimate
  return Array.isArray(enabledModules) && enabledModules.includes(bundle);
}

/** Keep only known bundle ids; empty when the plan cannot use advanced modules. */
export function sanitizeEnabledModules(values?: string[] | null, plan?: string | null): string[] {
  if (!planCanUseAdvancedModules(plan)) return [];
  const known = new Set(ADVANCED_MODULE_IDS);
  return [...new Set((values || []).map((v) => String(v).trim()).filter((v) => known.has(v)))];
}
