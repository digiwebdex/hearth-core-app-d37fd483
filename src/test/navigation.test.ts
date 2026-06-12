import { describe, it, expect } from "vitest";
import { getNavigationGroups } from "@/config/navigation";

describe("getNavigationGroups", () => {
  it("orders groups CRM → catalog → sales → operations", () => {
    const ids = getNavigationGroups().map((g) => g.id);
    const crm = ids.indexOf("crm");
    const catalog = ids.indexOf("serviceCatalog");
    const sales = ids.indexOf("sales");
    const operations = ids.indexOf("operations");
    expect(crm).toBeGreaterThanOrEqual(0);
    expect(catalog).toBeGreaterThan(crm);
    expect(sales).toBeGreaterThan(catalog);
    expect(operations).toBeGreaterThan(sales);
  });

  it("uses hajj ops desk label key when module enabled", () => {
    const ops = getNavigationGroups({ enableHajjUmrahModule: true }).find((g) => g.id === "operations");
    const hajj = ops?.items.find((i) => i.id === "hajj-operations");
    expect(hajj?.titleKey).toBe("sidebar.hajjUmrahOperations");
    expect(hajj?.url).toBe("/hajj-umrah");
  });

  it("includes service operations desk in operations group", () => {
    const ops = getNavigationGroups().find((g) => g.id === "operations");
    const serviceOps = ops?.items.find((i) => i.id === "service-operations");
    expect(serviceOps?.titleKey).toBe("sidebar.serviceOperations");
    expect(serviceOps?.url).toBe("/operations/services");
  });
});
