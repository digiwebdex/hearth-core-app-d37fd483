import { describe, it, expect } from "vitest";
import { getNavigationGroups } from "@/config/navigation";

describe("getNavigationGroups — 15-section master hierarchy", () => {
  it("returns the 15 Tenant-ERP sections in blueprint order", () => {
    const ids = getNavigationGroups().map((g) => g.id);
    expect(ids).toEqual([
      "dashboard",
      "crm",
      "sales",
      "booking",
      "travelServices",
      "financeAccounts",
      "hrPayroll",
      "documents",
      "marketing",
      "websiteCms",
      "reports",
      "automation",
      "integrations",
      "settings",
      "subscription",
    ]);
  });

  it("keeps the service catalog inside Sales and pointing at /packages/all", () => {
    const sales = getNavigationGroups().find((g) => g.id === "sales");
    const catalog = sales?.items.find((i) => i.id === "service-catalog");
    expect(catalog?.url).toBe("/packages/all");
  });

  it("surfaces the 13 travel services as their own section", () => {
    const svc = getNavigationGroups().find((g) => g.id === "travelServices");
    expect(svc?.items).toHaveLength(13);
    const titles = svc?.items.map((i) => i.title);
    expect(titles).toContain("Air Ticket");
    expect(titles).toContain("Visa");
    expect(titles).toContain("Hajj & Umrah");
    expect(titles).toContain("Student Consultancy");
    expect(titles).toContain("Overseas Manpower");
  });

  it("every travel service declares a service-type gate (so it can lock, not hide)", () => {
    const svc = getNavigationGroups().find((g) => g.id === "travelServices");
    for (const item of svc?.items ?? []) {
      expect(item.requiredServiceTypes?.length).toBeGreaterThan(0);
      expect(item.url).toBeTruthy();
    }
  });

  it("routes travel services to existing views only (no invented pages)", () => {
    const svc = getNavigationGroups().find((g) => g.id === "travelServices");
    const air = svc?.items.find((i) => i.id === "svc-air-ticket");
    const hajj = svc?.items.find((i) => i.id === "svc-hajj-umrah");
    expect(air?.url).toBe("/bookings/flight");
    expect(hajj?.url).toBe("/hajj-umrah");
  });

  it("gates Website CMS on the hasWebsiteTemplates feature + pro plan", () => {
    const cms = getNavigationGroups().find((g) => g.id === "websiteCms");
    const home = cms?.items.find((i) => i.id === "website-home");
    expect(home?.requiredFeature).toBe("hasWebsiteTemplates");
    expect(home?.minPlan).toBe("pro");
  });
});
