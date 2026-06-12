import { describe, expect, it } from "vitest";
import { getSubscriptionBlockState } from "@/lib/subscriptionAccess";
import type { Tenant } from "@/lib/api";

const baseTenant = (overrides: Partial<Tenant>): Tenant => ({
  id: "t1",
  name: "Test Agency",
  ownerId: "u1",
  subscriptionPlan: "pro",
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe("getSubscriptionBlockState", () => {
  it("does not block active trial with future expiry", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const result = getSubscriptionBlockState(
      baseTenant({ subscriptionStatus: "trial", subscriptionExpiry: future }),
      "pro"
    );
    expect(result.isBlocked).toBe(false);
  });

  it("blocks expired trial", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    const result = getSubscriptionBlockState(
      baseTenant({ subscriptionStatus: "trial", subscriptionExpiry: past }),
      "pro"
    );
    expect(result.isBlocked).toBe(true);
    expect(result.reason).toBe("trial_ended");
  });

  it("blocks suspended regardless of expiry", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const result = getSubscriptionBlockState(
      baseTenant({ subscriptionStatus: "suspended", subscriptionExpiry: future }),
      "pro"
    );
    expect(result.isBlocked).toBe(true);
    expect(result.reason).toBe("suspended");
  });

  it("does not block free plan unless suspended", () => {
    const result = getSubscriptionBlockState(
      baseTenant({ subscriptionPlan: "free", subscriptionStatus: "active" }),
      "free"
    );
    expect(result.isBlocked).toBe(false);
  });
});
