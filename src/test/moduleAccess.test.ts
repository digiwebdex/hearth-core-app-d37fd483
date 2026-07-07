import { describe, it, expect } from "vitest";
import {
  isNavItemModuleEnabled,
  planCanUseAdvancedModules,
  sanitizeEnabledModules,
} from "@/lib/moduleAccess";

describe("moduleAccess", () => {
  it("core items are always visible regardless of plan or enabled modules", () => {
    for (const plan of ["free", "basic", "pro", "business", "enterprise"]) {
      expect(isNavItemModuleEnabled("dashboard", plan, [])).toBe(true);
      expect(isNavItemModuleEnabled("invoices", plan, [])).toBe(true);
      expect(isNavItemModuleEnabled("clients", plan, [])).toBe(true);
    }
  });

  it("travel-ops bundles are ungated by plan (Starter can opt in)", () => {
    // Business service categories are NOT plan-gated (docs/v2-master/111).
    expect(isNavItemModuleEnabled("hajj-operations", "basic", ["hajj"])).toBe(true);
    expect(isNavItemModuleEnabled("group-tours", "basic", ["tourGroups"])).toBe(true);
  });

  it("platform bundles stay hidden below their plan floor even if opted in", () => {
    // marketing + hrPayroll are Business-floor platform capabilities.
    expect(isNavItemModuleEnabled("loyalty", "pro", ["marketing"])).toBe(false);
    expect(isNavItemModuleEnabled("payroll", "pro", ["hrPayroll"])).toBe(false);
    expect(isNavItemModuleEnabled("loyalty", "business", ["marketing"])).toBe(true);
  });

  it("website is a Pro-floor plan feature: auto-on for Pro+, hidden for Basic", () => {
    // auto-on — shows for Pro without opting in
    expect(isNavItemModuleEnabled("website-builder", "pro", [])).toBe(true);
    expect(isNavItemModuleEnabled("website-seo", "pro", [])).toBe(true);
    expect(isNavItemModuleEnabled("website-builder", "business", [])).toBe(true);
    // below the Pro floor
    expect(isNavItemModuleEnabled("website-builder", "basic", ["website"])).toBe(false);
    expect(isNavItemModuleEnabled("website-builder", "free", [])).toBe(false);
  });

  it("business and ultimate can activate advanced items via enabled modules", () => {
    expect(isNavItemModuleEnabled("hajj-operations", "business", ["hajj"])).toBe(true);
    expect(isNavItemModuleEnabled("website-builder", "business", ["website"])).toBe(true);
    expect(isNavItemModuleEnabled("website-builder", "enterprise", ["website"])).toBe(true);
    expect(isNavItemModuleEnabled("hajj-operations", "unlimited", ["hajj"])).toBe(true);
  });

  it("advanced items are off by default when not opted in, even on business", () => {
    expect(isNavItemModuleEnabled("hajj-operations", "business", [])).toBe(false);
    expect(isNavItemModuleEnabled("payroll", "enterprise", [])).toBe(false);
  });

  it("planCanUseAdvancedModules: basic qualifies (travel-ops/crm floor), free does not", () => {
    expect(planCanUseAdvancedModules("business")).toBe(true);
    expect(planCanUseAdvancedModules("enterprise")).toBe(true);
    expect(planCanUseAdvancedModules("unlimited")).toBe(true);
    expect(planCanUseAdvancedModules("pro")).toBe(true);
    expect(planCanUseAdvancedModules("basic")).toBe(true);
    expect(planCanUseAdvancedModules("free")).toBe(false);
  });

  it("sanitizeEnabledModules drops unknown ids and ids above the plan floor", () => {
    expect(sanitizeEnabledModules(["hajj", "bogus"], "business")).toEqual(["hajj"]);
    // travel-ops (hajj) is ungated; website is a Pro floor; marketing is Business floor
    expect(sanitizeEnabledModules(["hajj", "website"], "pro")).toEqual(["hajj", "website"]);
    expect(sanitizeEnabledModules(["hajj", "website"], "basic")).toEqual(["hajj"]);
    expect(sanitizeEnabledModules(["marketing"], "pro")).toEqual([]);
  });
});
