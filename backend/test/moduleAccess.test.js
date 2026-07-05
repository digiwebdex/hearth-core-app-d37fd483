require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  isNavItemModuleEnabled,
  planCanUseAdvancedModules,
  sanitizeEnabledModules,
} = require("../src/lib/moduleAccess");

// Mirrors src/test/moduleAccess.test.ts assertion-for-assertion — this file's
// header comment says "keep the two in sync"; these tests are the proof.
describe("moduleAccess (backend) — parity with src/test/moduleAccess.test.ts", () => {
  it("core items are always visible regardless of plan or enabled modules", () => {
    for (const plan of ["free", "basic", "pro", "business", "enterprise"]) {
      assert.equal(isNavItemModuleEnabled("dashboard", plan, []), true);
      assert.equal(isNavItemModuleEnabled("invoices", plan, []), true);
      assert.equal(isNavItemModuleEnabled("clients", plan, []), true);
    }
  });

  it("business-floor items stay hidden for basic and pro even if opted in", () => {
    assert.equal(isNavItemModuleEnabled("hajj-operations", "basic", ["hajj"]), false);
    assert.equal(isNavItemModuleEnabled("group-tours", "pro", ["tourGroups"]), false);
  });

  it("website is a Pro-floor plan feature: auto-on for Pro+, hidden for Basic", () => {
    assert.equal(isNavItemModuleEnabled("website-builder", "pro", []), true);
    assert.equal(isNavItemModuleEnabled("website-seo", "pro", []), true);
    assert.equal(isNavItemModuleEnabled("website-builder", "business", []), true);
    assert.equal(isNavItemModuleEnabled("website-builder", "basic", ["website"]), false);
    assert.equal(isNavItemModuleEnabled("website-builder", "free", []), false);
  });

  it("business and ultimate can activate advanced items via enabled modules", () => {
    assert.equal(isNavItemModuleEnabled("hajj-operations", "business", ["hajj"]), true);
    assert.equal(isNavItemModuleEnabled("website-builder", "business", ["website"]), true);
    assert.equal(isNavItemModuleEnabled("website-builder", "enterprise", ["website"]), true);
    assert.equal(isNavItemModuleEnabled("hajj-operations", "unlimited", ["hajj"]), true);
  });

  it("advanced items are off by default when not opted in, even on business", () => {
    assert.equal(isNavItemModuleEnabled("hajj-operations", "business", []), false);
    assert.equal(isNavItemModuleEnabled("payroll", "enterprise", []), false);
  });

  it("planCanUseAdvancedModules: pro qualifies (website), basic and free do not", () => {
    assert.equal(planCanUseAdvancedModules("business"), true);
    assert.equal(planCanUseAdvancedModules("enterprise"), true);
    assert.equal(planCanUseAdvancedModules("unlimited"), true);
    assert.equal(planCanUseAdvancedModules("pro"), true);
    assert.equal(planCanUseAdvancedModules("basic"), false);
    assert.equal(planCanUseAdvancedModules("free"), false);
  });

  it("sanitizeEnabledModules drops unknown ids and ids above the plan floor", () => {
    assert.deepEqual(sanitizeEnabledModules(["hajj", "bogus"], "business"), ["hajj"]);
    assert.deepEqual(sanitizeEnabledModules(["hajj", "website"], "pro"), ["website"]);
    assert.deepEqual(sanitizeEnabledModules(["website"], "basic"), []);
  });
});
