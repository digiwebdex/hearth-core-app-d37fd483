import type { PlanType } from "@/lib/plans";

// Advanced (opt-in) sidebar modules.
//
// The lean core menu is visible to every plan by default. Everything below is
// OFF by default and can be switched on in Settings. Most bundles are reserved
// for Business and Ultimate (enterprise); a bundle may set its own `minPlan`
// floor when the underlying feature is already sold on a lower plan (e.g.
// Website is a Pro feature, so its floor is Pro).

export interface AdvancedModule {
  id: string;
  labelKey: string;
  descKey: string;
  items: string[];
  /** Lowest plan that may activate this bundle. Defaults to "business". */
  minPlan?: PlanType;
  /** When true the bundle is shown automatically for eligible plans (it's a
   *  plan feature, not a hidden opt-in) and is not listed as a Settings toggle. */
  autoOn?: boolean;
}

export const ADVANCED_MODULES: AdvancedModule[] = [
  { id: "crm", labelKey: "modules.crm", descKey: "modules.crmDesc", items: ["crm-hub"] },
  { id: "subAgents", labelKey: "modules.subAgents", descKey: "modules.subAgentsDesc", items: ["commissions"] },
  { id: "corporate", labelKey: "modules.corporate", descKey: "modules.corporateDesc", items: ["corporate", "travel-approvals"] },
  { id: "ticketing", labelKey: "modules.ticketing", descKey: "modules.ticketingDesc", items: ["ticket-transactions", "flight-reminders"] },
  { id: "tourGroups", labelKey: "modules.tourGroups", descKey: "modules.tourGroupsDesc", items: ["group-tours", "mice"] },
  { id: "visa", labelKey: "modules.visa", descKey: "modules.visaDesc", items: ["visa-tracker"] },
  { id: "hajj", labelKey: "modules.hajj", descKey: "modules.hajjDesc", items: ["hajj-operations"] },
  { id: "studentManpower", labelKey: "modules.studentManpower", descKey: "modules.studentManpowerDesc", items: ["bd-operations"] },
  { id: "documentsDesk", labelKey: "modules.documentsDesk", descKey: "modules.documentsDeskDesc", items: ["documents", "service-operations"] },
  { id: "hrPayroll", labelKey: "modules.hrPayroll", descKey: "modules.hrPayrollDesc", items: ["hrm", "activity-log", "payroll"] },
  { id: "marketing", labelKey: "modules.marketing", descKey: "modules.marketingDesc", items: ["loyalty", "referrals"] },
  { id: "website", labelKey: "modules.website", descKey: "modules.websiteDesc", minPlan: "pro", autoOn: true, items: ["website-home", "website-builder", "website-blog", "website-publish", "website-seo"] },
];

/** Bundles shown automatically for eligible plans (plan features, not opt-in toggles). */
export const AUTO_ON_MODULE_IDS: string[] = ADVANCED_MODULES.filter((m) => m.autoOn).map((m) => m.id);
export function isModuleAutoOn(bundleId: string): boolean {
  return AUTO_ON_MODULE_IDS.includes(bundleId);
}

export const ADVANCED_MODULE_IDS: string[] = ADVANCED_MODULES.map((m) => m.id);

const MODULE_BY_ID: Record<string, AdvancedModule> = ADVANCED_MODULES.reduce(
  (acc, m) => {
    acc[m.id] = m;
    return acc;
  },
  {} as Record<string, AdvancedModule>,
);

// Reverse lookup: nav item id → the advanced bundle that controls it.
const ITEM_TO_MODULE: Record<string, string> = ADVANCED_MODULES.reduce(
  (acc, m) => {
    for (const item of m.items) acc[item] = m.id;
    return acc;
  },
  {} as Record<string, string>,
);

const PLAN_RANK: Record<string, number> = { free: 0, basic: 1, pro: 2, business: 3, enterprise: 4 };
const DEFAULT_MODULE_MIN_PLAN: PlanType = "business";

function planRank(plan?: string | null): number {
  const p = String(plan || "").toLowerCase().trim();
  const normalized = p === "unlimited" ? "enterprise" : p;
  return PLAN_RANK[normalized] ?? 0;
}

/** Lowest plan allowed to activate a given bundle. */
export function moduleMinPlan(bundleId: string): PlanType {
  return MODULE_BY_ID[bundleId]?.minPlan ?? DEFAULT_MODULE_MIN_PLAN;
}

/** True when this plan is allowed to activate the given advanced bundle. */
export function planCanUseModule(bundleId: string, plan?: string | null): boolean {
  return planRank(plan) >= planRank(moduleMinPlan(bundleId));
}

/** True when the plan can activate at least one advanced bundle. */
export function planCanUseAdvancedModules(plan?: string | null): boolean {
  return ADVANCED_MODULE_IDS.some((id) => planCanUseModule(id, plan));
}

/** True when a nav item should be visible for this plan + enabled-module set. */
export function isNavItemModuleEnabled(itemId: string, plan?: string | null, enabledModules?: string[] | null): boolean {
  const bundle = ITEM_TO_MODULE[itemId];
  if (!bundle) return true; // core item — always available
  if (!planCanUseModule(bundle, plan)) return false; // below this bundle's plan floor
  if (isModuleAutoOn(bundle)) return true; // plan feature — shown automatically for eligible plans
  return Array.isArray(enabledModules) && enabledModules.includes(bundle);
}

/** Keep only known bundle ids the plan is allowed to activate. */
export function sanitizeEnabledModules(values?: string[] | null, plan?: string | null): string[] {
  const known = new Set(ADVANCED_MODULE_IDS);
  return [...new Set((values || []).map((v) => String(v).trim()).filter((v) => known.has(v) && planCanUseModule(v, plan)))];
}
