require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-at-least-32-characters-long";
process.env.RATE_LIMIT_DISABLED = "true";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createApp } = require("../src/app");
const {
  PLAN_DISPLAY_NAMES,
  planDisplayName,
  ADDON_TYPES,
  getAddonType,
  validateAddonInput,
  getSubscriptionPlanCatalog,
  computeEffectiveLimits,
  computeAddonExtensions,
  buildUsageContext,
  buildSubscriptionInvoice,
  monthlyEquivalentPrice,
  computeMrr,
  computeArr,
  summarizeSubscribers,
  revenueByPlan,
} = require("../src/lib/billingEngine");

// ── Plan catalog (name reconciliation: canonical keys, marketing display names) ──
describe("billingEngine — getSubscriptionPlanCatalog (pure)", () => {
  const catalog = getSubscriptionPlanCatalog();

  it("surfaces Free Trial + the four paid tiers, in order", () => {
    assert.deepEqual(catalog.map((p) => p.plan), ["trial", "basic", "pro", "business", "enterprise"]);
  });

  it("keeps canonical plan keys but adds the spec's marketing display names", () => {
    assert.deepEqual(
      catalog.map((p) => p.displayName),
      ["Free Trial", "Starter", "Professional", "Business", "Enterprise"],
    );
    // Starter/Professional are display-only — the persisted/gated key stays basic/pro.
    assert.equal(catalog.find((p) => p.displayName === "Starter").plan, "basic");
    assert.equal(catalog.find((p) => p.displayName === "Professional").plan, "pro");
  });

  it("marks only the trial entry as isTrial and prices it at 0", () => {
    const trial = catalog.find((p) => p.plan === "trial");
    assert.equal(trial.isTrial, true);
    assert.deepEqual(trial.pricing, { monthly: 0, yearly: 0 });
    assert.equal(typeof trial.trialDays, "number");
    assert.equal(catalog.filter((p) => p.isTrial).length, 1);
  });

  it("carries real Plan Engine pricing/limits/features on the paid tiers", () => {
    const pro = catalog.find((p) => p.plan === "pro");
    assert.equal(pro.pricing.monthly, 800);
    assert.equal(pro.limits.users, 10);
    assert.equal(typeof pro.features.hasWhatsApp, "boolean");
  });
});

describe("billingEngine — planDisplayName (pure)", () => {
  it("maps canonical keys to marketing names and capitalizes unknowns", () => {
    assert.equal(planDisplayName("basic"), "Starter");
    assert.equal(planDisplayName("pro"), "Professional");
    assert.equal(planDisplayName("enterprise"), "Enterprise");
    assert.equal(planDisplayName("free"), "Starter"); // free -> basic alias -> Starter
    assert.equal(PLAN_DISPLAY_NAMES.business, "Business");
  });
});

// ── Add-on registry + validation ──
describe("billingEngine — add-on registry (pure)", () => {
  it("registers exactly the six requested add-on types", () => {
    assert.deepEqual(
      ADDON_TYPES.map((a) => a.code).sort(),
      ["additional_api", "additional_branch", "additional_sms", "additional_storage", "additional_users", "additional_whatsapp"].sort(),
    );
  });

  it("maps user/whatsapp add-ons onto existing plan-limit keys", () => {
    assert.equal(getAddonType("additional_users").limitKey, "users");
    assert.equal(getAddonType("additional_whatsapp").limitKey, "whatsapp");
  });
});

describe("billingEngine — validateAddonInput (pure)", () => {
  it("accepts a known type with a positive whole quantity", () => {
    const r = validateAddonInput({ type: "additional_api", quantity: 3, billingCycle: "yearly" });
    assert.equal(r.valid, true);
    assert.equal(r.normalized.limitKey, "apiCalls");
    assert.equal(r.normalized.billingCycle, "yearly");
  });

  it("rejects unknown types and non-positive / non-integer quantities", () => {
    assert.equal(validateAddonInput({ type: "nope", quantity: 1 }).valid, false);
    assert.equal(validateAddonInput({ type: "additional_users", quantity: 0 }).valid, false);
    assert.equal(validateAddonInput({ type: "additional_users", quantity: -2 }).valid, false);
    assert.equal(validateAddonInput({ type: "additional_users", quantity: 1.5 }).valid, false);
  });
});

// ── Effective limits (plan + active add-ons) ──
describe("billingEngine — computeEffectiveLimits (pure)", () => {
  it("adds add-on quantity onto a numeric plan limit", () => {
    const eff = computeEffectiveLimits({ users: 10, whatsapp: 200 }, [
      { type: "additional_users", quantity: 5 },
      { type: "additional_whatsapp", quantity: 300 },
    ]);
    assert.equal(eff.users, 15);
    assert.equal(eff.whatsapp, 500);
  });

  it("leaves an unlimited (-1) limit unlimited", () => {
    const eff = computeEffectiveLimits({ users: -1 }, [{ type: "additional_users", quantity: 5 }]);
    assert.equal(eff.users, -1);
  });

  it("creates add-on-only dimensions (sms/storage/api/branch) from a zero base", () => {
    const eff = computeEffectiveLimits({}, [
      { type: "additional_sms", quantity: 1000 },
      { type: "additional_branch", quantity: 2 },
    ]);
    assert.equal(eff.sms, 1000);
    assert.equal(eff.branches, 2);
  });

  it("computeAddonExtensions sums quantity per limit key", () => {
    assert.deepEqual(
      computeAddonExtensions([
        { type: "additional_users", quantity: 5 },
        { type: "additional_users", quantity: 3 },
        { type: "additional_sms", quantity: 500 },
      ]),
      { users: 8, sms: 500 },
    );
  });
});

// ── Usage context (Current Usage / Plan Limits / Remaining Limits) ──
describe("billingEngine — buildUsageContext (pure)", () => {
  const usage = buildUsageContext({ users: 15, bookings: -1, sms: 1000 }, { users: 12, bookings: 9999 });

  it("computes remaining = max(0, limit - used) for tracked, countable resources", () => {
    assert.deepEqual(usage.find((u) => u.resource === "users"), { resource: "users", limit: 15, used: 12, remaining: 3, unlimited: false, tracked: true });
  });

  it("reports unlimited resources as remaining -1", () => {
    const bookings = usage.find((u) => u.resource === "bookings");
    assert.equal(bookings.unlimited, true);
    assert.equal(bookings.remaining, -1);
  });

  it("reports un-metered dimensions as used null / not tracked", () => {
    const sms = usage.find((u) => u.resource === "sms");
    assert.equal(sms.used, null);
    assert.equal(sms.remaining, null);
    assert.equal(sms.tracked, false);
  });

  it("never returns negative remaining", () => {
    const over = buildUsageContext({ users: 3 }, { users: 10 });
    assert.equal(over[0].remaining, 0);
  });
});

// ── Subscription invoice ──
describe("billingEngine — buildSubscriptionInvoice (pure)", () => {
  it("builds a single plan line item with no add-ons / no coupon", () => {
    const inv = buildSubscriptionInvoice({ plan: "pro", billingCycle: "monthly" });
    assert.equal(inv.type, "new");
    assert.equal(inv.lineItems.length, 1);
    assert.equal(inv.subtotal, 800);
    assert.equal(inv.discount, 0);
    assert.equal(inv.total, 800);
  });

  it("adds per-add-on line items and applies a coupon discount", () => {
    const inv = buildSubscriptionInvoice({
      plan: "pro",
      billingCycle: "monthly",
      addons: [{ type: "additional_users", quantity: 2, unitPrice: 100 }],
      coupon: { code: "SAVE", discountAmount: 150 },
      type: "renewal",
    });
    assert.equal(inv.type, "renewal");
    assert.equal(inv.lineItems.length, 2);
    assert.equal(inv.subtotal, 1000); // 800 plan + 2*100 add-on
    assert.equal(inv.discount, 150);
    assert.equal(inv.total, 850);
    assert.equal(inv.couponCode, "SAVE");
  });

  it("caps the discount at the subtotal (total never goes negative)", () => {
    const inv = buildSubscriptionInvoice({ plan: "basic", billingCycle: "monthly", coupon: { discountAmount: 99999 } });
    assert.equal(inv.discount, inv.subtotal);
    assert.equal(inv.total, 0);
  });
});

// ── Revenue analytics (MRR / ARR / subscribers / revenue-by-plan) ──
describe("billingEngine — MRR / ARR (pure)", () => {
  const tenants = [
    { subscriptionStatus: "active", subscriptionPlan: "pro", billingCycle: "monthly" },      // 800
    { subscriptionStatus: "active", subscriptionPlan: "business", billingCycle: "yearly" },   // 15000/12 = 1250
    { subscriptionStatus: "trial", subscriptionPlan: "basic", billingCycle: "monthly" },      // 0 (not active)
    { subscriptionStatus: "suspended", subscriptionPlan: "pro", billingCycle: "monthly" },    // 0 (not active)
  ];

  it("counts only active, paid subscriptions and normalizes yearly to a monthly figure", () => {
    assert.equal(monthlyEquivalentPrice("business", "yearly"), 1250);
    assert.equal(computeMrr(tenants), 2050);
  });

  it("ARR is MRR times twelve", () => {
    assert.equal(computeArr(2050), 24600);
  });

  it("enterprise (custom / non-listed price) contributes 0 to MRR", () => {
    assert.equal(computeMrr([{ subscriptionStatus: "active", subscriptionPlan: "enterprise", billingCycle: "monthly" }]), 0);
  });
});

describe("billingEngine — summarizeSubscribers / revenueByPlan (pure)", () => {
  const tenants = [
    { subscriptionStatus: "active", subscriptionPlan: "pro", billingCycle: "monthly" },
    { subscriptionStatus: "active", subscriptionPlan: "pro", billingCycle: "monthly" },
    { subscriptionStatus: "trial", subscriptionPlan: "basic", billingCycle: "monthly" },
    { subscriptionStatus: "expired", subscriptionPlan: "business", billingCycle: "monthly" },
  ];

  it("summarizeSubscribers groups by status and plan", () => {
    const s = summarizeSubscribers(tenants);
    assert.equal(s.total, 4);
    assert.deepEqual(s.byStatus, { active: 2, trial: 1, expired: 1 });
    assert.deepEqual(s.byPlan, { pro: 2, basic: 1, business: 1 });
  });

  it("revenueByPlan sums monthly-equivalent revenue for active subscriptions only", () => {
    const rev = revenueByPlan(tenants);
    assert.equal(rev.pro, 1600); // 2 * 800
    assert.equal(rev.business, 0); // expired -> excluded
    assert.equal(rev.basic, 0); // trial -> excluded
  });
});

// ── Authentication is required on every endpoint ──
describe("/api/billing — authentication required on every endpoint", () => {
  const app = createApp();
  const endpoints = [
    ["get", "/api/billing/plans"],
    ["get", "/api/billing/subscription"],
    ["get", "/api/billing/usage"],
    ["get", "/api/billing/history"],
    ["get", "/api/billing/transactions"],
    ["get", "/api/billing/invoice"],
    ["get", "/api/billing/gateways"],
    ["get", "/api/billing/addons/catalog"],
    ["get", "/api/billing/addons"],
    ["post", "/api/billing/addons"],
    ["delete", "/api/billing/addons/some-id"],
    ["get", "/api/billing/admin/subscribers"],
    ["get", "/api/billing/admin/revenue"],
    ["get", "/api/billing/admin/addons"],
    ["patch", "/api/billing/admin/addons/some-id"],
  ];
  for (const [method, path] of endpoints) {
    it(`401 without a token: ${method.toUpperCase()} ${path}`, async () => {
      const res = await request(app)[method](path);
      assert.equal(res.status, 401);
      assert.match(res.body.message, /token/i);
    });
  }
});
