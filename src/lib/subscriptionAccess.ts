import type { Tenant } from "@/lib/api";
import type { PlanType } from "@/lib/plans";

export type SubscriptionBlockReason = "trial_ended" | "expired" | "suspended" | "cancelled";

export function getSubscriptionBlockState(
  tenant: Tenant | null,
  currentPlan: PlanType
): { isBlocked: boolean; reason: SubscriptionBlockReason | null } {
  if (!tenant) return { isBlocked: false, reason: null };

  if (tenant.subscriptionStatus === "suspended") {
    return { isBlocked: true, reason: "suspended" };
  }
  if (tenant.subscriptionStatus === "cancelled") {
    return { isBlocked: true, reason: "cancelled" };
  }

  const pastExpiry = Boolean(
    tenant.subscriptionExpiry && new Date(tenant.subscriptionExpiry) < new Date()
  );

  if (tenant.subscriptionStatus === "trial" && pastExpiry) {
    return { isBlocked: true, reason: "trial_ended" };
  }
  if (tenant.subscriptionStatus === "expired") {
    return { isBlocked: true, reason: "expired" };
  }
  if (currentPlan !== "free" && pastExpiry) {
    return { isBlocked: true, reason: "expired" };
  }

  return { isBlocked: false, reason: null };
}
