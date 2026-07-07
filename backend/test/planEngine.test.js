require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-at-least-32-characters-long";
process.env.RATE_LIMIT_DISABLED = "true";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createApp } = require("../src/app");
const { PLAN_LIMITS, PLAN_FEATURES } = require("../src/lib/planFeatures");
const { getPlanPrice } = require("../src/lib/planPricing");
const {
  PLAN_TIERS,
  resolvePlan,
  getPlanRegistry,
  resolvePlanFeatures,
  resolvePlanFeatureList,
  resolvePlanLimits,
  resolvePlanModuleAccess,
  resolveTenantPlanContext,
} = require("../src/lib/planEngine");

describe("planEngine — Plan Registry shape", () => {
  it("has exactly the 4 canonical tiers, in order", () => {
    assert.deepEqual(PLAN_TIERS, ["basic", "pro", "business", "enterprise"]);
  });

  it("getPlanRegistry returns one definition per tier, in tier order, each named", () => {
    const registry = getPlanRegistry();
    assert.deepEqual(registry.map((p) => p.plan), PLAN_TIERS);
    assert.deepEqual(registry.map((p) => p.name), ["Starter", "Professional", "Business", "Enterprise"]);
  });
});

describe("planEngine — wraps planFeatures.js without duplicating it", () => {
  for (const tier of ["basic", "pro", "business", "enterprise"]) {
    it(`resolvePlanFeatures("${tier}") is byte-identical to PLAN_FEATURES.${tier}`, () => {
      assert.deepEqual(resolvePlanFeatures(tier), PLAN_FEATURES[tier]);
    });

    it(`resolvePlanLimits("${tier}") is byte-identical to PLAN_LIMITS.${tier}`, () => {
      assert.deepEqual(resolvePlanLimits(tier), PLAN_LIMITS[tier]);
    });
  }

  it("resolvePlanFeatureList only lists flags that are true", () => {
    // Capability model: Starter (basic) has no premium PLATFORM capabilities;
    // hasHajjUmrah is a travel category kept true on every plan (ungated).
    assert.deepEqual(resolvePlanFeatureList("basic").sort(), ["hasHajjUmrah"]);
  });
});

describe("planEngine — alias normalization is correct end-to-end (no drift inherited)", () => {
  it("'free' resolves identically to 'basic' (features + limits + pricing)", () => {
    const free = resolvePlan("free");
    const basic = resolvePlan("basic");
    assert.deepEqual(free.features, basic.features);
    assert.deepEqual(free.limits, basic.limits);
    assert.deepEqual(free.pricing, basic.pricing);
    assert.equal(free.plan, "basic");
  });

  it("'unlimited' resolves identically to 'enterprise' (features + limits + pricing) — not planPricing.js's unrelated 'free' fallback", () => {
    const unlimited = resolvePlan("unlimited");
    const enterprise = resolvePlan("enterprise");
    assert.deepEqual(unlimited.features, enterprise.features);
    assert.deepEqual(unlimited.limits, enterprise.limits);
    assert.deepEqual(unlimited.pricing, enterprise.pricing);
    assert.equal(unlimited.plan, "enterprise");
    // Enterprise pricing is 0 (custom/-1 clamped) per planPricing.js — confirms
    // "unlimited" did NOT fall through to PLAN_PRICES.free's own zero by
    // accident of a different code path; both are 0 for the right reason.
    assert.equal(unlimited.pricing.monthly, getPlanPrice("enterprise", "monthly"));
  });

  it("an unknown plan string defaults to basic, matching planFeatures.normalizePlan", () => {
    assert.equal(resolvePlan("totally-not-a-plan").plan, "basic");
  });
});

describe("planEngine — Module Access resolver matches moduleAccess.js's plan floors", () => {
  // Travel-ops bundles are ungated (floor basic); only platform bundles carry a
  // plan floor: website (pro), marketing + hrPayroll (business).
  const TRAVEL_OPS = ["crm", "subAgents", "corporate", "ticketing", "tourGroups", "visa", "hajj", "studentManpower", "documentsDesk"];

  it("basic unlocks all travel-ops bundles, no platform-gated bundles", () => {
    assert.deepEqual(resolvePlanModuleAccess("basic").sort(), [...TRAVEL_OPS].sort());
  });

  it("pro adds the website platform bundle", () => {
    assert.deepEqual(resolvePlanModuleAccess("pro").sort(), [...TRAVEL_OPS, "website"].sort());
  });

  it("business and enterprise unlock every advanced bundle", () => {
    const business = resolvePlanModuleAccess("business");
    const enterprise = resolvePlanModuleAccess("enterprise");
    assert.equal(business.length, 12);
    assert.deepEqual(business, enterprise);
  });
});

describe("planEngine — Tenant Plan Resolver chain", () => {
  it("resolves modules, features, limits, service types, and flags together", async () => {
    const context = await resolveTenantPlanContext({
      plan: "business",
      enabledModules: ["hajj", "bogus", "website"],
      enabledServiceTypes: ["hajj_umrah"],
      enabledSubcategories: [],
      tenantId: "test-tenant-id",
    });

    assert.equal(context.plan, "business");
    // sanitizeEnabledModules drops unknown ids and anything above the plan floor.
    assert.deepEqual(context.enabledModules.sort(), ["hajj", "website"].sort());
    assert.deepEqual(context.features, PLAN_FEATURES.business);
    assert.deepEqual(context.limits, PLAN_LIMITS.business);
    assert.deepEqual(context.serviceTypes, { enabled: ["hajj_umrah"], enabledSubcategories: [] });
    // No DATABASE_URL configured in this test environment -> SystemFlag reads
    // fail safe to their coded defaults (all false) rather than throwing.
    assert.deepEqual(context.flags, {
      dynamicSidebar: false,
      planEngineV2: false,
      statusEngineV2: false,
    });
  });

  it("defaults gracefully with no arguments at all", async () => {
    const context = await resolveTenantPlanContext();
    assert.equal(context.plan, "basic");
    assert.deepEqual(context.enabledModules, []);
    assert.deepEqual(context.serviceTypes, { enabled: [], enabledSubcategories: [] });
  });
});

describe("GET /api/plan-engine", () => {
  const app = createApp();

  it("requires authentication (401 without a token)", async () => {
    const res = await request(app).get("/api/plan-engine");
    assert.equal(res.status, 401);
    assert.match(res.body.message, /token/i);
  });

  it("requires authentication on /me (401 without a token)", async () => {
    const res = await request(app).get("/api/plan-engine/me");
    assert.equal(res.status, 401);
    assert.match(res.body.message, /token/i);
  });

  it("requires authentication on /:plan (401 without a token)", async () => {
    const res = await request(app).get("/api/plan-engine/business");
    assert.equal(res.status, 401);
    assert.match(res.body.message, /token/i);
  });
});
