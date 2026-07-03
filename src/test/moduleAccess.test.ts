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

  it("advanced items stay hidden for basic and pro even if opted in", () => {
    expect(isNavItemModuleEnabled("hajj-operations", "basic", ["hajj"])).toBe(false);
    expect(isNavItemModuleEnabled("group-tours", "pro", ["tourGroups"])).toBe(false);
    // website builder is Business/Ultimate only — not available on Pro
    expect(isNavItemModuleEnabled("website-builder", "pro", ["website"])).toBe(false);
    expect(isNavItemModuleEnabled("website-builder", "basic", ["website"])).toBe(false);
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

  it("planCanUseAdvancedModules only allows business and enterprise", () => {
    expect(planCanUseAdvancedModules("business")).toBe(true);
    expect(planCanUseAdvancedModules("enterprise")).toBe(true);
    expect(planCanUseAdvancedModules("unlimited")).toBe(true);
    expect(planCanUseAdvancedModules("pro")).toBe(false);
    expect(planCanUseAdvancedModules("basic")).toBe(false);
    expect(planCanUseAdvancedModules("free")).toBe(false);
  });

  it("sanitizeEnabledModules drops unknown ids and clears for sub-business plans", () => {
    expect(sanitizeEnabledModules(["hajj", "bogus"], "business")).toEqual(["hajj"]);
    // pro cannot keep any advanced module, including website
    expect(sanitizeEnabledModules(["hajj", "website"], "pro")).toEqual([]);
    expect(sanitizeEnabledModules(["website"], "basic")).toEqual([]);
  });
});
