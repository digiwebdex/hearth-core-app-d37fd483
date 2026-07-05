// Module Registry — canonical, backend-owned definition of every app module.
//
// Frozen design: docs/v2-master/11-Architecture-Freeze.md §6 "Final Module Registry".
// This is Phase 1, Milestone 1 of docs/v2-master/12-Implementation-Sequence.md:
// it WRAPS the existing frontend sidebar (src/config/navigation.ts) and advanced
// module bundles (src/lib/moduleAccess.ts / backend/src/lib/moduleAccess.js) as a
// single, additive source — it does not replace or remove either. Every field
// below is ported 1:1 from src/config/navigation.ts (verified by hand + by the
// parity assertions in backend/test/moduleRegistry.test.js).
//
// Nothing in the app consumes this registry yet (no route depends on it, no
// frontend component reads it). It is exposed read-only via GET /api/registry
// so later Phase 1 milestones (Feature Flags, Plan Engine, Permission Engine,
// Dynamic Sidebar) can build on top of it without another data-modeling pass.
//
// Field meanings (frozen shape):
//   id                    — stable identifier, matches the nav item id today
//   group / groupLabelKey — sidebar group this module belongs to
//   route                 — the app URL this module renders at
//   titleKey              — i18n key (EN/BN) for the nav label
//   rbacModule            — Permission module key (see src/lib/permissions.ts, Module type)
//   minPlan               — lowest plan tier that unlocks this module (undefined = no floor)
//   requiredFeature       — plan feature flag gating this module (undefined = none)
//   requiredServiceTypes  — tenant must have enabled >=1 of these service types (undefined = always)
//   website               — true if this module's content is exposed on the tenant's public website
//   reports               — true if this module is the tenant Reports/BI surface
//   api                   — the internal REST prefix this module primarily owns (null = composite/UI-only)
//
// `website`/`reports` are intentionally populated conservatively (literal, unambiguous
// cases only) for this milestone — they are forward-compatible metadata for the
// Website CMS (Phase 6) and Finance (Phase 5) phases to refine, not evaluated by
// anything yet.

const MODULE_REGISTRY_GROUPS = [
  {
    id: "overview",
    labelKey: "sidebar.overview",
    items: [
      {
        id: "dashboard", route: "/dashboard", titleKey: "sidebar.dashboard",
        rbacModule: "dashboard", api: "/api/dashboard",
      },
    ],
  },
  {
    id: "crm",
    labelKey: "sidebar.crm",
    items: [
      { id: "crm-hub", route: "/crm", titleKey: "sidebar.crmWorkspace", rbacModule: "clients", api: null },
      { id: "clients", route: "/clients", titleKey: "sidebar.clients", rbacModule: "clients", api: "/api/clients" },
      {
        id: "corporate", route: "/corporate", titleKey: "sidebar.corporateTravel", rbacModule: "clients",
        requiredServiceTypes: ["corporate_travel", "mice_event"], api: "/api/clients",
      },
      { id: "agents", route: "/agents", titleKey: "sidebar.agents", rbacModule: "agents", api: "/api/agents" },
      { id: "vendors", route: "/vendors", titleKey: "sidebar.vendors", rbacModule: "vendors", api: "/api/vendors" },
    ],
  },
  {
    id: "salesBookings",
    labelKey: "sidebar.salesBookings",
    items: [
      { id: "quotations", route: "/quotations", titleKey: "sidebar.quotations", rbacModule: "quotations", api: "/api/quotations" },
      { id: "bookings", route: "/bookings", titleKey: "sidebar.bookings", rbacModule: "bookings", api: "/api/bookings" },
      { id: "visa-stock", route: "/visa-stock", titleKey: "sidebar.visaStock", rbacModule: "bookings", api: "/api/visa-stock" },
      { id: "service-catalog", route: "/packages/all", titleKey: "sidebar.serviceCatalogItem", rbacModule: "packages", api: "/api/travel-packages" },
      {
        id: "ticket-transactions", route: "/ticket-transactions", titleKey: "sidebar.ticketTransactions", rbacModule: "bookings",
        requiredServiceTypes: ["air_ticket"], api: "/api/ticket-refunds",
      },
      {
        id: "flight-reminders", route: "/flight-reminders", titleKey: "sidebar.flightReminders", rbacModule: "bookings",
        requiredServiceTypes: ["air_ticket"], api: "/api/flight-reminders",
      },
    ],
  },
  {
    id: "tourGroupTravel",
    labelKey: "sidebar.tourGroupTravel",
    items: [
      {
        id: "group-tours", route: "/group-tours", titleKey: "sidebar.groupTours", rbacModule: "bookings", minPlan: "basic",
        requiredServiceTypes: ["tour_domestic", "tour_international", "mice_event"], api: "/api/group-tours",
      },
      {
        id: "mice", route: "/mice", titleKey: "sidebar.mice", rbacModule: "bookings", minPlan: "basic",
        requiredServiceTypes: ["mice_event"], api: "/api/mice",
      },
      {
        id: "travel-approvals", route: "/travel-approvals", titleKey: "sidebar.travelApprovals", rbacModule: "bookings", minPlan: "basic",
        requiredServiceTypes: ["corporate_travel", "mice_event"], api: "/api/travel-policy",
      },
      {
        id: "visa-tracker", route: "/visa-tracker", titleKey: "sidebar.visaTracker", rbacModule: "bookings", minPlan: "basic",
        requiredServiceTypes: ["visa", "study_abroad"], api: "/api/visa",
      },
    ],
  },
  {
    id: "operations",
    labelKey: "sidebar.operations",
    items: [
      { id: "documents", route: "/documents", titleKey: "sidebar.documents", rbacModule: "clients", api: "/api/documents" },
      { id: "tasks", route: "/tasks", titleKey: "sidebar.tasks", rbacModule: "tasks", api: "/api/tasks" },
      { id: "service-operations", route: "/operations/services", titleKey: "sidebar.serviceOperations", rbacModule: "bookings", api: null },
      {
        id: "hajj-operations", route: "/hajj-umrah", titleKey: "sidebar.hajjUmrahOperations", rbacModule: "hajj_umrah",
        requiredServiceTypes: ["hajj_umrah"], api: "/api/hajj",
      },
      {
        id: "bd-operations", route: "/operations/bd", titleKey: "sidebar.bdOperations", rbacModule: "bookings",
        requiredServiceTypes: ["study_abroad", "b2b_agent"], api: null,
      },
    ],
  },
  {
    id: "financeAccounts",
    labelKey: "sidebar.financeAccounts",
    items: [
      { id: "invoices", route: "/invoices", titleKey: "sidebar.invoices", rbacModule: "invoices", api: "/api/invoices" },
      { id: "payments", route: "/payments", titleKey: "sidebar.payments", rbacModule: "invoices", api: "/api/invoices" },
      { id: "expenses", route: "/expenses", titleKey: "sidebar.expenses", rbacModule: "accounts", minPlan: "basic", api: "/api/expenses" },
      {
        id: "commissions", route: "/commissions", titleKey: "sidebar.commissions", rbacModule: "agents",
        requiredServiceTypes: ["air_ticket", "b2b_agent", "tour_domestic", "tour_international", "hajj_umrah"], api: "/api/agents",
      },
      { id: "accounts", route: "/accounts", titleKey: "sidebar.accountsLedger", rbacModule: "accounts", minPlan: "basic", api: "/api/accounts" },
      { id: "reports", route: "/reports", titleKey: "sidebar.financialReports", rbacModule: "reports", minPlan: "basic", reports: true, api: "/api/finance" },
    ],
  },
  {
    id: "hrPayroll",
    labelKey: "sidebar.hrPayroll",
    items: [
      { id: "team", route: "/team", titleKey: "sidebar.team", rbacModule: "team", api: "/api/tenants" },
      { id: "hrm", route: "/hrm", titleKey: "sidebar.hrm", rbacModule: "team", api: "/api/hrm" },
      { id: "roles", route: "/roles", titleKey: "sidebar.roles", rbacModule: "team", api: null },
      { id: "activity-log", route: "/activity-log", titleKey: "sidebar.activityLog", rbacModule: "team", api: "/api/audit-logs" },
      { id: "payroll", route: "/payroll", titleKey: "sidebar.payroll", rbacModule: "team", minPlan: "basic", api: "/api/payroll" },
    ],
  },
  {
    id: "marketingLoyalty",
    labelKey: "sidebar.marketingLoyalty",
    items: [
      { id: "loyalty", route: "/loyalty", titleKey: "sidebar.loyalty", rbacModule: "clients", minPlan: "enterprise", api: "/api/loyalty" },
      { id: "referrals", route: "/referrals", titleKey: "sidebar.referrals", rbacModule: "clients", minPlan: "enterprise", api: "/api/referrals" },
    ],
  },
  {
    id: "websiteCms",
    labelKey: "sidebar.websiteCms",
    items: [
      { id: "website-home", route: "/website", titleKey: "sidebar.websiteHome", rbacModule: "website", minPlan: "pro", requiredFeature: "hasWebsiteTemplates", website: true, api: "/api/website" },
      { id: "website-builder", route: "/website/builder", titleKey: "sidebar.themeBuilder", rbacModule: "website", minPlan: "pro", requiredFeature: "hasWebsiteTemplates", website: true, api: "/api/website" },
      { id: "website-blog", route: "/website/blog", titleKey: "sidebar.websiteBlog", rbacModule: "website", minPlan: "pro", requiredFeature: "hasWebsiteTemplates", website: true, api: "/api/blogs" },
      { id: "website-publish", route: "/website/publish", titleKey: "sidebar.publishDomain", rbacModule: "website", minPlan: "pro", requiredFeature: "hasWebsiteTemplates", website: true, api: "/api/tenant-domains" },
      { id: "website-seo", route: "/website/seo", titleKey: "sidebar.websiteSeo", rbacModule: "website", minPlan: "pro", requiredFeature: "hasWebsiteTemplates", website: true, api: "/api/website" },
    ],
  },
  {
    id: "administration",
    labelKey: "sidebar.administration",
    items: [
      { id: "notifications", route: "/notifications", titleKey: "sidebar.notifications", rbacModule: "reports", api: "/api/notifications" },
      { id: "settings", route: "/settings", titleKey: "sidebar.settings", rbacModule: "settings", api: null },
      { id: "organization", route: "/organization", titleKey: "sidebar.organization", rbacModule: "organization", api: "/api/tenants" },
      { id: "subscription", route: "/subscription", titleKey: "sidebar.subscription", rbacModule: "subscription", api: "/api/subscriptions" },
      { id: "userGuide", route: "/user-guide", titleKey: "sidebar.userGuide", rbacModule: "dashboard", api: null },
    ],
  },
];

// Normalize every entry so optional fields are always present with a
// consistent "unset" value (undefined), never missing entirely — callers can
// rely on every key existing on every entry.
function normalizeEntry(entry, group) {
  return {
    id: entry.id,
    group: group.id,
    groupLabelKey: group.labelKey,
    route: entry.route,
    titleKey: entry.titleKey,
    rbacModule: entry.rbacModule,
    minPlan: entry.minPlan,
    requiredFeature: entry.requiredFeature,
    requiredServiceTypes: entry.requiredServiceTypes,
    website: entry.website === true,
    reports: entry.reports === true,
    api: entry.api ?? null,
  };
}

const FLAT_REGISTRY = MODULE_REGISTRY_GROUPS.flatMap((group) =>
  group.items.map((item) => normalizeEntry(item, group)),
);

const REGISTRY_BY_ID = FLAT_REGISTRY.reduce((acc, entry) => {
  acc[entry.id] = entry;
  return acc;
}, {});

/** Full registry as a flat array of ModuleRegistryEntry objects. */
function getModuleRegistry() {
  return FLAT_REGISTRY;
}

/** Registry grouped exactly like the sidebar (id, labelKey, items[]). */
function getModuleRegistryGroups() {
  return MODULE_REGISTRY_GROUPS.map((group) => ({
    id: group.id,
    labelKey: group.labelKey,
    items: group.items.map((item) => normalizeEntry(item, group)),
  }));
}

/** Look up a single registry entry by its stable id. Returns undefined if unknown. */
function getModuleRegistryEntry(id) {
  return REGISTRY_BY_ID[id];
}

module.exports = {
  getModuleRegistry,
  getModuleRegistryGroups,
  getModuleRegistryEntry,
};
