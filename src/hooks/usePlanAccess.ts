import { useMemo } from "react";
import { getPlan, type PlanType, type PlanConfig, type BillingCycle, getPlanPrice, checkUsage, type TenantSubscription, type UsageCheck } from "@/lib/plans";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Hook to check feature access based on the current tenant's plan.
 * During an active Free Trial the backend grants full (enterprise) capabilities
 * (effectiveGatingPlan), so this hook mirrors that: display fields use the real
 * plan, but limits/features resolve against the effective plan (docs/v2-master/112).
 */
export function usePlanAccess(currentPlan: PlanType = "free") {
  const { isTrialActive } = useAuth();
  const plan: PlanConfig = useMemo(() => getPlan(currentPlan), [currentPlan]);
  const gating: PlanConfig = useMemo(() => (isTrialActive ? getPlan("enterprise") : plan), [isTrialActive, plan]);

  return {
    plan,
    planId: plan.id,
    planName: plan.name,

    // Prices
    monthlyPrice: plan.monthlyPrice,
    yearlyPrice: plan.yearlyPrice,
    trialDays: plan.trialDays,

    // Capability limits (staff / branches / domains — no record-count limits)
    maxUsers: gating.maxUsers,
    maxStaff: gating.maxUsers,
    maxBranches: gating.maxBranches,
    maxDomains: gating.maxDomains,
    maxSmsPerMonth: gating.maxSmsPerMonth,
    maxWhatsappPerMonth: gating.maxWhatsappPerMonth,
    maxStorageMB: gating.maxStorageMB,
    isUnlimitedStaff: gating.maxUsers === -1,
    isUnlimitedBranches: gating.maxBranches === -1,

    // Feature flags
    canUsePaymentGateway: gating.paymentGateways.length > 1,
    canUseSslCommerz: gating.paymentGateways.includes("sslcommerz"),
    canUseBkash: gating.paymentGateways.includes("bkash"),
    canUseCustomGateway: gating.paymentGateways.includes("custom"),
    canUseCustomDomain: gating.hasCustomDomain,
    canUseWebsiteTemplates: gating.hasWebsiteTemplates,
    canUseSms: gating.hasSmsIntegration,
    canUseWhatsApp: gating.hasWhatsApp,
    canUseEmail: gating.hasEmailNotifications,
    canUseAgentCommission: gating.hasAgentCommission,
    canUseAutomation: gating.hasAutomation,
    canUseAdvancedAutomation: gating.hasAdvancedAutomation,
    canUseAdvancedAnalytics: gating.hasAdvancedAnalytics,
    canUseMarketingTools: gating.hasMarketingTools,
    canUseHrPayroll: gating.hasHrPayroll,
    canUseApi: gating.hasApiAccess,
    canUseWhiteLabel: gating.hasWhiteLabel,
    canUseMarketplace: gating.hasMarketplace,
    canUseRefund: gating.hasRefundSystem,
    canUseHajjUmrah: gating.hasHajjUmrah,
    hasPrioritySupport: gating.hasPrioritySupport,

    // Helpers
    hasFeature: (feature: keyof PlanConfig) => !!gating[feature],
    requiresUpgrade: (feature: keyof PlanConfig) => !gating[feature],
    getUpgradePlan: (feature: keyof PlanConfig): PlanType | null => {
      const order: PlanType[] = ["free", "basic", "pro", "business", "enterprise"];
      const currentIdx = order.indexOf(currentPlan);
      for (let i = currentIdx + 1; i < order.length; i++) {
        const p = getPlan(order[i]);
        if (p[feature]) return order[i];
      }
      return null;
    },
  };
}
