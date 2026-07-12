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

  it("business-floor items stay hidden for basic and pro even if opted in", () => {
    expect(isNavItemModuleEnabled("hajj-operations", "basic", ["hajj"])).toBe(false);
    expect(isNavItemModuleEnabled("group-tours", "pro", ["tourGroups"])).toBe(false);
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

  it("service catalog (Packages) is core ERP — visible on every plan incl. Basic", () => {
    expect(isNavItemModuleEnabled("service-catalog", "basic", [])).toBe(true);
    expect(isNavItemModuleEnabled("service-catalog", "pro", [])).toBe(true);
    expect(isNavItemModuleEnabled("service-catalog", "free", [])).toBe(true);
  });

  it("lean default: the 7 core items show for a fresh Basic tenant, sellable modules are hidden", () => {
    const core = ["dashboard", "clients", "bookings", "invoices", "service-catalog", "reports", "settings"];
    for (const id of core) expect(isNavItemModuleEnabled(id, "basic", [])).toBe(true);
    // moved into opt-in bundles — hidden by default on Basic
    for (const id of ["agents", "vendors", "visa-stock", "tasks", "expenses", "accounts"]) {
      expect(isNavItemModuleEnabled(id, "basic", [])).toBe(false);
    }
  });

  it("sellable modules surface when their bundle is enabled on an eligible plan", () => {
    expect(isNavItemModuleEnabled("agents", "business", ["subAgents"])).toBe(true);
    expect(isNavItemModuleEnabled("vendors", "business", ["suppliers"])).toBe(true);
    expect(isNavItemModuleEnabled("visa-stock", "business", ["visa"])).toBe(true);
    expect(isNavItemModuleEnabled("expenses", "business", ["advancedFinance"])).toBe(true);
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

  it("planCanUseAdvancedModules: pro qualifies (website), basic and free do not", () => {
    expect(planCanUseAdvancedModules("business")).toBe(true);
    expect(planCanUseAdvancedModules("enterprise")).toBe(true);
    expect(planCanUseAdvancedModules("unlimited")).toBe(true);
    expect(planCanUseAdvancedModules("pro")).toBe(true);
    expect(planCanUseAdvancedModules("basic")).toBe(false);
    expect(planCanUseAdvancedModules("free")).toBe(false);
  });

  it("sanitizeEnabledModules drops unknown ids and ids above the plan floor", () => {
    expect(sanitizeEnabledModules(["hajj", "bogus"], "business")).toEqual(["hajj"]);
    // pro can keep website but not the business-floor hajj bundle
    expect(sanitizeEnabledModules(["hajj", "website"], "pro")).toEqual(["website"]);
    expect(sanitizeEnabledModules(["website"], "basic")).toEqual([]);
  });
});
