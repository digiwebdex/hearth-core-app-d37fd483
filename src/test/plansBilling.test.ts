import { describe, it, expect } from "vitest";
import { PLANS, getDisplayMonthlyPrice, getPlanPrice, getYearlySavings, YEARLY_FREE_MONTHS } from "@/lib/plans";

describe("plan yearly billing", () => {
  it("charges 10 months for yearly (2 months free)", () => {
    expect(YEARLY_FREE_MONTHS).toBe(2);
    const basic = PLANS.find((p) => p.id === "basic")!;
    expect(basic.yearlyPrice).toBe(500 * 10);
    expect(getYearlySavings("basic")).toBe(500 * 2);
  });

  it("shows effective monthly rate when yearly is selected", () => {
    const pro = PLANS.find((p) => p.id === "pro")!;
    expect(getDisplayMonthlyPrice(pro, "yearly")).toBe(Math.round((800 * 10) / 12));
    expect(getPlanPrice("pro", "yearly")).toBe(8000);
  });
});
