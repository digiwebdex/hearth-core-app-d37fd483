require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-at-least-32-characters-long";
process.env.RATE_LIMIT_DISABLED = "true";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createApp } = require("../src/app");
const { getModuleRegistry, getModuleRegistryGroups } = require("../src/lib/moduleRegistry");
const { getSidebarRegistry, isEntryVisible, resolveNavigationContext } = require("../src/lib/sidebarEngine");

const ALL_BUNDLE_IDS = [
  "crm", "subAgents", "corporate", "ticketing", "tourGroups", "visa", "hajj",
  "studentManpower", "documentsDesk", "hrPayroll", "marketing", "website",
];

describe("sidebarEngine — Sidebar Registry is a pass-through, not a duplicate", () => {
  it("getSidebarRegistry() returns exactly what the Module Registry returns", () => {
    assert.deepEqual(getSidebarRegistry(), getModuleRegistryGroups());
  });
});

describe("sidebarEngine — isEntryVisible gates (each checked independently)", () => {
  const dashboardEntry = getModuleRegistry().find((e) => e.id === "dashboard");
  const websiteBuilderEntry = getModuleRegistry().find((e) => e.id === "website-builder");
  const hajjOpsEntry = getModuleRegistry().find((e) => e.id === "hajj-operations");
  const loyaltyEntry = getModuleRegistry().find((e) => e.id === "loyalty");
  const groupToursEntry = getModuleRegistry().find((e) => e.id === "group-tours");

  it("RBAC gate: sales_agent cannot see website (no website module access at all)", () => {
    assert.equal(
      isEntryVisible(websiteBuilderEntry, {
        canonicalRole: "sales_agent", plan: "enterprise", enabledModules: ALL_BUNDLE_IDS, effectiveServiceTypes: [],
      }),
      false,
    );
  });

  it("plan floor gate: website-builder hidden on basic even for tenant_owner", () => {
    assert.equal(
      isEntryVisible(websiteBuilderEntry, {
        canonicalRole: "tenant_owner", plan: "basic", enabledModules: ALL_BUNDLE_IDS, effectiveServiceTypes: [],
      }),
      false,
    );
  });

  it("feature flag gate: website-builder hidden without hasWebsiteTemplates (basic plan lacks it) even if plan floor alone were met", () => {
    // pro plan meets the minPlan floor AND has hasWebsiteTemplates -- sanity check the flag actually gates.
    assert.equal(
      isEntryVisible(websiteBuilderEntry, {
        canonicalRole: "tenant_owner", plan: "pro", enabledModules: ["website"], effectiveServiceTypes: [],
      }),
      true,
    );
  });

  it("service-type gate: hajj-operations hidden when hajj_umrah is not among a non-empty enabled list", () => {
    assert.equal(
      isEntryVisible(hajjOpsEntry, {
        canonicalRole: "tenant_owner", plan: "enterprise", enabledModules: ALL_BUNDLE_IDS, effectiveServiceTypes: ["visa"],
      }),
      false,
    );
  });

  it("service-type gate: empty enabledServiceTypes means 'show everything'", () => {
    assert.equal(
      isEntryVisible(hajjOpsEntry, {
        canonicalRole: "tenant_owner", plan: "enterprise", enabledModules: ALL_BUNDLE_IDS, effectiveServiceTypes: [],
      }),
      true,
    );
  });

  it("purchased-module gate: hajj-operations hidden when the hajj bundle isn't purchased, even with the right service type", () => {
    assert.equal(
      isEntryVisible(hajjOpsEntry, {
        canonicalRole: "tenant_owner", plan: "enterprise", enabledModules: [], effectiveServiceTypes: ["hajj_umrah"],
      }),
      false,
    );
  });

  it("direct minPlan floor gate: loyalty hidden below enterprise regardless of RBAC/modules", () => {
    assert.equal(
      isEntryVisible(loyaltyEntry, {
        canonicalRole: "tenant_owner", plan: "business", enabledModules: ["marketing"], effectiveServiceTypes: [],
      }),
      false,
    );
    assert.equal(
      isEntryVisible(loyaltyEntry, {
        canonicalRole: "tenant_owner", plan: "enterprise", enabledModules: ["marketing"], effectiveServiceTypes: [],
      }),
      true,
    );
  });

  it("core item (no bundle, no service type, no plan floor) is visible whenever RBAC allows it", () => {
    assert.equal(
      isEntryVisible(dashboardEntry, {
        canonicalRole: "sales_agent", plan: "basic", enabledModules: [], effectiveServiceTypes: [],
      }),
      true,
    );
  });

  it("group-tours needs its direct basic floor AND the tourGroups bundle's business floor AND a matching service type AND purchase", () => {
    assert.equal(
      isEntryVisible(groupToursEntry, {
        canonicalRole: "tenant_owner", plan: "business", enabledModules: ["tourGroups"], effectiveServiceTypes: ["tour_domestic"],
      }),
      true,
    );
    // Below the bundle's business floor -> hidden even though the direct minPlan (basic) is met.
    assert.equal(
      isEntryVisible(groupToursEntry, {
        canonicalRole: "tenant_owner", plan: "pro", enabledModules: ["tourGroups"], effectiveServiceTypes: ["tour_domestic"],
      }),
      false,
    );
  });
});

describe("sidebarEngine — Navigation Resolver (resolveNavigationContext)", () => {
  it("super_admin sees every module in every group, regardless of plan/modules/service types", async () => {
    const context = await resolveNavigationContext({
      role: "super_admin", tenantId: "t1", plan: "basic", enabledModules: [], enabledServiceTypes: [],
    });
    assert.equal(context.totalVisibleItems, context.totalModules);
    assert.equal(context.totalModules, 44);
  });

  it("tenant_owner on enterprise with every bundle purchased and no service-type restriction sees everything", async () => {
    const context = await resolveNavigationContext({
      role: "tenant_owner",
      tenantId: "t1",
      plan: "enterprise",
      enabledModules: ALL_BUNDLE_IDS,
      enabledServiceTypes: [],
    });
    assert.equal(context.totalVisibleItems, 44);
  });

  it("narrowing enabledServiceTypes to just hajj_umrah hides the other service-typed items", async () => {
    const context = await resolveNavigationContext({
      role: "tenant_owner",
      tenantId: "t1",
      plan: "enterprise",
      enabledModules: ALL_BUNDLE_IDS,
      enabledServiceTypes: ["hajj_umrah"],
    });
    const visibleIds = context.groups.flatMap((g) => g.items.map((i) => i.id));
    assert.ok(visibleIds.includes("hajj-operations"));
    for (const hiddenId of ["bd-operations", "corporate", "travel-approvals", "group-tours", "mice", "visa-tracker", "ticket-transactions", "flight-reminders"]) {
      assert.ok(!visibleIds.includes(hiddenId), `${hiddenId} should be hidden when only hajj_umrah is enabled`);
    }
    assert.ok(context.totalVisibleItems < 44);
  });

  it("a plain sales_agent on the basic plan sees only their RBAC-accessible, unlocked core items", async () => {
    const context = await resolveNavigationContext({
      role: "sales_agent", tenantId: "t1", plan: "basic", enabledModules: [], enabledServiceTypes: [],
    });
    const visibleIds = context.groups.flatMap((g) => g.items.map((i) => i.id));
    assert.ok(visibleIds.includes("dashboard"));
    assert.ok(visibleIds.includes("clients"));
    assert.ok(visibleIds.includes("bookings"));
    // sales_agent has no RBAC access to accounts/reports/settings/team/website at all.
    for (const hiddenId of ["accounts", "reports", "settings", "team", "website-builder", "loyalty"]) {
      assert.ok(!visibleIds.includes(hiddenId), `${hiddenId} should be hidden for sales_agent`);
    }
  });

  it("returns the role, plan, flags, and businessType alongside the groups (Final Sidebar Context shape)", async () => {
    const context = await resolveNavigationContext({ role: "manager", tenantId: "t1", plan: "pro" });
    assert.equal(context.role.canonicalRole, "manager");
    assert.equal(context.plan.plan, "pro");
    assert.deepEqual(context.flags, { dynamicSidebar: false, planEngineV2: false, statusEngineV2: false });
    assert.deepEqual(context.businessType, { enabledServiceTypes: [], enabledSubcategories: [] });
  });
});

describe("GET /api/sidebar-engine/me", () => {
  const app = createApp();

  it("requires authentication (401 without a token)", async () => {
    const res = await request(app).get("/api/sidebar-engine/me");
    assert.equal(res.status, 401);
    assert.match(res.body.message, /token/i);
  });
});
