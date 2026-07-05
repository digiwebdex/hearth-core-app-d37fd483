require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-at-least-32-characters-long";
process.env.RATE_LIMIT_DISABLED = "true";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createApp } = require("../src/app");
const {
  getModuleRegistry,
  getModuleRegistryGroups,
  getModuleRegistryEntry,
} = require("../src/lib/moduleRegistry");

// Expected group order/ids — must match src/config/navigation.ts exactly.
const EXPECTED_GROUP_IDS = [
  "overview",
  "crm",
  "salesBookings",
  "tourGroupTravel",
  "operations",
  "financeAccounts",
  "hrPayroll",
  "marketingLoyalty",
  "websiteCms",
  "administration",
];

describe("moduleRegistry — shape", () => {
  it("has exactly the 10 groups from navigation.ts, in the same order", () => {
    const groups = getModuleRegistryGroups();
    assert.deepEqual(groups.map((g) => g.id), EXPECTED_GROUP_IDS);
  });

  it("has 44 total entries, matching the current navigation.ts item count", () => {
    assert.equal(getModuleRegistry().length, 44);
  });

  it("every entry has the full frozen ModuleRegistryEntry shape", () => {
    for (const entry of getModuleRegistry()) {
      assert.equal(typeof entry.id, "string");
      assert.equal(typeof entry.group, "string");
      assert.equal(typeof entry.route, "string");
      assert.equal(typeof entry.titleKey, "string");
      assert.equal(typeof entry.rbacModule, "string");
      assert.equal(typeof entry.website, "boolean");
      assert.equal(typeof entry.reports, "boolean");
      assert.ok(entry.api === null || typeof entry.api === "string");
    }
  });

  it("entry ids are unique", () => {
    const ids = getModuleRegistry().map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});

describe("moduleRegistry — gating parity with navigation.ts", () => {
  it("hajj-operations requires the hajj_umrah service type", () => {
    const entry = getModuleRegistryEntry("hajj-operations");
    assert.equal(entry.rbacModule, "hajj_umrah");
    assert.deepEqual(entry.requiredServiceTypes, ["hajj_umrah"]);
  });

  it("bd-operations requires study_abroad or b2b_agent", () => {
    const entry = getModuleRegistryEntry("bd-operations");
    assert.deepEqual(entry.requiredServiceTypes, ["study_abroad", "b2b_agent"]);
  });

  it("website-cms items sit on the Pro floor and require hasWebsiteTemplates", () => {
    for (const id of ["website-home", "website-builder", "website-blog", "website-publish", "website-seo"]) {
      const entry = getModuleRegistryEntry(id);
      assert.equal(entry.minPlan, "pro", `${id} should be minPlan pro`);
      assert.equal(entry.requiredFeature, "hasWebsiteTemplates", `${id} should require hasWebsiteTemplates`);
      assert.equal(entry.website, true, `${id} should be flagged website:true`);
    }
  });

  it("loyalty and referrals sit on the Enterprise floor", () => {
    assert.equal(getModuleRegistryEntry("loyalty").minPlan, "enterprise");
    assert.equal(getModuleRegistryEntry("referrals").minPlan, "enterprise");
  });

  it("basic-floor items match navigation.ts (group-tours, mice, travel-approvals, visa-tracker, expenses, accounts, reports, payroll)", () => {
    const basicFloorIds = [
      "group-tours", "mice", "travel-approvals", "visa-tracker",
      "expenses", "accounts", "reports", "payroll",
    ];
    for (const id of basicFloorIds) {
      assert.equal(getModuleRegistryEntry(id).minPlan, "basic", `${id} should be minPlan basic`);
    }
  });

  it("reports flag is set only on the Financial Reports entry", () => {
    const reportsFlagged = getModuleRegistry().filter((e) => e.reports).map((e) => e.id);
    assert.deepEqual(reportsFlagged, ["reports"]);
  });

  it("service-catalog resolves to the travel-packages API", () => {
    assert.equal(getModuleRegistryEntry("service-catalog").api, "/api/travel-packages");
  });
});

describe("GET /api/registry", () => {
  const app = createApp();

  it("requires authentication (401 without a token)", async () => {
    const res = await request(app).get("/api/registry");
    assert.equal(res.status, 401);
    assert.match(res.body.message, /token/i);
  });
});
