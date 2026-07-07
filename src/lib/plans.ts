// ── Subscription Plans Configuration (capability-based) ──
//
// v2 Master Blueprint (docs/v2-master/111-SaaS-Plan-System.md): plans are NO
// LONGER differentiated by record counts (bookings / clients / leads /
// quotations). Plans differ by PLATFORM capabilities (feature flags + advanced
// modules) plus Staff / Branch / Domain limits and real-cost usage quotas
// (SMS / WhatsApp / Storage). Which travel services a tenant sells is an
// onboarding / Settings choice, NOT a plan restriction.
//
// Mirrors backend/src/lib/planFeatures.js. Internal ids stay basic/pro/business/
// enterprise (backend contract); the UI shows Starter / Professional / Business /
// Enterprise via getPlanDisplayName.

export type PlanType = "free" | "basic" | "pro" | "business" | "enterprise";
export type BillingCycle = "monthly" | "yearly";
export type SubscriptionStatus = "trial" | "active" | "overdue" | "expired" | "suspended" | "cancelled";

export interface PlanConfig {
  id: PlanType;
  /** @deprecated Use monthlyPrice instead. Kept for backward compatibility. */
  price: number;
  name: string;
  monthlyPrice: number; // BDT/month, 0 = free, -1 = custom (Contact Sales)
  yearlyPrice: number;  // BDT/year, 0 = free, -1 = custom
  description: string;
  badge?: string;
  trialDays: number; // 0 = no trial

  // ── Capability limits (−1 = unlimited, 0 = not allowed) ──
  maxUsers: number;    // staff seats (add-ons can extend)
  maxBranches: number; // branches/offices (add-ons can extend)
  maxDomains: number;
  maxSmsPerMonth: number;
  maxWhatsappPerMonth: number;
  maxStorageMB: number;

  // ── Feature flags (platform capabilities) ──
  features: string[];
  restrictions: string[];
  paymentGateways: ("manual" | "sslcommerz" | "bkash" | "custom")[];
  hasCustomDomain: boolean;
  hasWebsiteTemplates: boolean;
  hasSmsIntegration: boolean;
  hasWhatsApp: boolean;
  hasEmailNotifications: boolean;
  hasAgentCommission: boolean;
  hasAutomation: boolean;         // Automation Level 1 (Pro)
  hasAdvancedAutomation: boolean; // Advanced Automation (Business)
  hasMarketingTools: boolean;
  hasHrPayroll: boolean;
  hasAdvancedAnalytics: boolean;
  hasRefundSystem: boolean;
  hasApiAccess: boolean;
  hasWhiteLabel: boolean;
  hasMarketplace: boolean;
  hasPrioritySupport: boolean;
  /** Travel category — ungated on every plan (kept for backward-compat). */
  hasHajjUmrah: boolean;
}

// ── Helper: yearly price — pay for 10 months, get 12 (2 months free) ──
const yearly = (monthly: number) =>
  monthly <= 0 ? monthly : monthly * 10;

/** True when a plan has no fixed price (Enterprise = Contact Sales). */
export function isCustomPricing(plan: PlanConfig): boolean {
  return plan.monthlyPrice < 0;
}

export function getDisplayMonthlyPrice(plan: PlanConfig, cycle: BillingCycle): number {
  if (plan.monthlyPrice <= 0) return plan.monthlyPrice;
  return cycle === "yearly" ? Math.round(plan.yearlyPrice / 12) : plan.monthlyPrice;
}

export const PLANS: PlanConfig[] = [
  {
    id: "basic", name: "Starter", price: 500, monthlyPrice: 500, yearlyPrice: yearly(500),
    description: "Core agency management to get started", trialDays: 0,
    maxUsers: 3, maxBranches: 1, maxDomains: 0,
    maxSmsPerMonth: 0, maxWhatsappPerMonth: 0, maxStorageMB: 500,
    features: [
      "CRM (clients, leads, follow-ups)",
      "Bookings for every travel service",
      "Finance & accounting",
      "Invoices + payments",
      "Reports",
      "3 staff · 1 branch",
    ],
    restrictions: ["No Website CMS", "No email/SMS/WhatsApp", "No automation"],
    paymentGateways: ["manual"],
    hasCustomDomain: false, hasWebsiteTemplates: false, hasSmsIntegration: false,
    hasWhatsApp: false, hasEmailNotifications: false, hasAgentCommission: false,
    hasAutomation: false, hasAdvancedAutomation: false, hasMarketingTools: false,
    hasHrPayroll: false, hasAdvancedAnalytics: false, hasRefundSystem: false,
    hasApiAccess: false, hasWhiteLabel: false, hasMarketplace: false,
    hasPrioritySupport: false, hasHajjUmrah: true,
  },
  {
    id: "pro", name: "Professional", price: 800, monthlyPrice: 800, yearlyPrice: yearly(800),
    description: "Grow online — website, messaging & automation", badge: "Most Popular", trialDays: 0,
    maxUsers: 10, maxBranches: 3, maxDomains: 1,
    maxSmsPerMonth: 500, maxWhatsappPerMonth: 200, maxStorageMB: 2048,
    features: [
      "Everything in Starter",
      "Website CMS & builder",
      "Email notifications",
      "SMS & WhatsApp integration",
      "Company domain (charges excluded)",
      "Agent commissions",
      "Automation (Level 1)",
      "10 staff · 3 branches",
    ],
    restrictions: ["No marketing campaigns", "No HR & Payroll", "No advanced analytics"],
    paymentGateways: ["manual", "sslcommerz"],
    hasCustomDomain: true, hasWebsiteTemplates: true, hasSmsIntegration: true,
    hasWhatsApp: true, hasEmailNotifications: true, hasAgentCommission: true,
    hasAutomation: true, hasAdvancedAutomation: false, hasMarketingTools: false,
    hasHrPayroll: false, hasAdvancedAnalytics: false, hasRefundSystem: false,
    hasApiAccess: false, hasWhiteLabel: false, hasMarketplace: false,
    hasPrioritySupport: false, hasHajjUmrah: true,
  },
  {
    id: "business", name: "Business", price: 1500, monthlyPrice: 1500, yearlyPrice: yearly(1500),
    description: "Scale operations — marketing, HR & advanced automation", badge: "Best Value", trialDays: 0,
    maxUsers: 30, maxBranches: 10, maxDomains: 2,
    maxSmsPerMonth: 2000, maxWhatsappPerMonth: -1, maxStorageMB: 10240,
    features: [
      "Everything in Professional",
      "Marketing campaigns (SMS/Email/WhatsApp)",
      "HR & Payroll",
      "Advanced automation",
      "Advanced analytics",
      "Refund system",
      "30 staff · 10 branches",
    ],
    restrictions: [],
    paymentGateways: ["manual", "sslcommerz", "bkash"],
    hasCustomDomain: true, hasWebsiteTemplates: true, hasSmsIntegration: true,
    hasWhatsApp: true, hasEmailNotifications: true, hasAgentCommission: true,
    hasAutomation: true, hasAdvancedAutomation: true, hasMarketingTools: true,
    hasHrPayroll: true, hasAdvancedAnalytics: true, hasRefundSystem: true,
    hasApiAccess: false, hasWhiteLabel: false, hasMarketplace: false,
    hasPrioritySupport: false, hasHajjUmrah: true,
  },
  {
    id: "enterprise", name: "Enterprise", price: -1, monthlyPrice: -1, yearlyPrice: -1,
    description: "Custom capability package — configured by our team", badge: "Contact Sales", trialDays: 0,
    maxUsers: -1, maxBranches: -1, maxDomains: -1,
    maxSmsPerMonth: -1, maxWhatsappPerMonth: -1, maxStorageMB: -1,
    features: [
      "Everything in Business",
      "Custom capability package",
      "White Label",
      "API access",
      "Marketplace",
      "Dedicated support",
      "Unlimited staff & branches",
    ],
    restrictions: [],
    paymentGateways: ["manual", "sslcommerz", "bkash", "custom"],
    hasCustomDomain: true, hasWebsiteTemplates: true, hasSmsIntegration: true,
    hasWhatsApp: true, hasEmailNotifications: true, hasAgentCommission: true,
    hasAutomation: true, hasAdvancedAutomation: true, hasMarketingTools: true,
    hasHrPayroll: true, hasAdvancedAnalytics: true, hasRefundSystem: true,
    hasApiAccess: true, hasWhiteLabel: true, hasMarketplace: true,
    hasPrioritySupport: true, hasHajjUmrah: true,
  },
];

export function getPlan(planId: PlanType): PlanConfig {
  // "free" is deprecated; fall back to Starter for legacy tenants.
  return PLANS.find((p) => p.id === planId) || PLANS[0];
}

// ── Blueprint plan display names ──
export const FREE_TRIAL_DAYS = 7;

const PLAN_DISPLAY_NAMES: Record<string, string> = {
  free: "Free Trial",
  trial: "Free Trial",
  basic: "Starter",
  pro: "Professional",
  business: "Business",
  enterprise: "Enterprise",
};

/** Blueprint display name for a plan id (or a trial/free subscription status). */
export function getPlanDisplayName(planId: string | null | undefined): string {
  const key = String(planId || "").trim().toLowerCase();
  return PLAN_DISPLAY_NAMES[key] || getPlan((key as PlanType) || "basic").name;
}

export function getPlanPrice(planId: PlanType, cycle: BillingCycle): number {
  const plan = getPlan(planId);
  return cycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
}

export function getYearlySavings(planId: PlanType): number {
  const plan = getPlan(planId);
  if (plan.monthlyPrice <= 0) return 0;
  return (plan.monthlyPrice * 12) - plan.yearlyPrice;
}

export function getLimitLabel(value: number): string {
  if (value === -1) return "Unlimited";
  if (value === 0) return "None";
  return value.toLocaleString();
}

export function getDomainLimitLabel(planId: PlanType): string {
  const plan = getPlan(planId);
  return getLimitLabel(plan.maxDomains);
}

// ── Subscription interface ──
export interface TenantSubscription {
  id: string;
  tenantId: string;
  tenantName: string;
  ownerEmail: string;
  plan: PlanType;
  billingCycle: BillingCycle;
  price: number;
  startDate: string;
  endDate: string;
  trialStartDate?: string;
  trialEndDate?: string;
  status: SubscriptionStatus;
  autoRenew: boolean;
  lastPaymentDate?: string;
  nextPaymentDate?: string;
  paymentMethod?: string;
  cancelReason?: string;
  cancelledAt?: string;
  suspendedAt?: string;
  suspendReason?: string;
  // Capability usage counters (add-ons may extend the effective limit)
  usedUsers?: number;
  usedBranches?: number;
  usedDomains?: number;
  usedSms?: number;
  usedWhatsapp?: number;
  usedStorageMB?: number;
}

// ── Usage helper (capability limits only — no record-count limits) ──
export interface UsageCheck {
  resource: string;
  used: number;
  limit: number;
  isUnlimited: boolean;
  percentage: number;
  isNearLimit: boolean; // >80%
  isAtLimit: boolean;
}

export function checkUsage(sub: TenantSubscription): UsageCheck[] {
  const plan = getPlan(sub.plan);
  const checks: [string, number, number][] = [
    ["Staff", sub.usedUsers || 0, plan.maxUsers],
    ["Branches", sub.usedBranches || 0, plan.maxBranches],
    ["Domains", sub.usedDomains || 0, plan.maxDomains],
    ["SMS", sub.usedSms || 0, plan.maxSmsPerMonth],
    ["WhatsApp", sub.usedWhatsapp || 0, plan.maxWhatsappPerMonth],
    ["Storage (MB)", sub.usedStorageMB || 0, plan.maxStorageMB],
  ];
  return checks.map(([resource, used, limit]) => {
    const isUnlimited = limit === -1;
    const percentage = isUnlimited || limit === 0 ? 0 : Math.round((used / limit) * 100);
    return {
      resource, used, limit, isUnlimited,
      percentage: Math.min(percentage, 100),
      isNearLimit: !isUnlimited && limit > 0 && percentage >= 80,
      isAtLimit: !isUnlimited && limit > 0 && used >= limit,
    };
  });
}

// ── Feature comparison table (capability-based) ──
type CmpValue = boolean | string;
export const FEATURE_COMPARISON: {
  category: string;
  features: { name: string; basic: CmpValue; pro: CmpValue; business: CmpValue; enterprise: CmpValue }[];
}[] = [
  { category: "Core (all plans)", features: [
    { name: "CRM (clients, leads, follow-ups)", basic: true, pro: true, business: true, enterprise: true },
    { name: "Bookings — all travel services", basic: true, pro: true, business: true, enterprise: true },
    { name: "Finance & accounting", basic: true, pro: true, business: true, enterprise: true },
    { name: "Invoices + payments", basic: true, pro: true, business: true, enterprise: true },
    { name: "Reports", basic: true, pro: true, business: true, enterprise: true },
    { name: "Automatic daily backup", basic: true, pro: true, business: true, enterprise: true },
  ]},
  { category: "Team & Branches", features: [
    { name: "Staff seats", basic: "3", pro: "10", business: "30", enterprise: "Unlimited" },
    { name: "Branches / offices", basic: "1", pro: "3", business: "10", enterprise: "Unlimited" },
    { name: "Additional staff / branch add-ons", basic: true, pro: true, business: true, enterprise: true },
  ]},
  { category: "Website & Communication", features: [
    { name: "Website CMS & builder", basic: false, pro: true, business: true, enterprise: true },
    { name: "Company domain", basic: "None", pro: "1", business: "2", enterprise: "Unlimited" },
    { name: "Email notifications", basic: false, pro: true, business: true, enterprise: true },
    { name: "SMS integration", basic: "None", pro: "500/mo", business: "2,000/mo", enterprise: "Unlimited" },
    { name: "WhatsApp", basic: false, pro: "200/mo", business: "Unlimited", enterprise: "Unlimited" },
  ]},
  { category: "Platform Capabilities", features: [
    { name: "Agent commissions", basic: false, pro: true, business: true, enterprise: true },
    { name: "Automation", basic: false, pro: "Level 1", business: "Advanced", enterprise: "Advanced" },
    { name: "Marketing campaigns", basic: false, pro: false, business: true, enterprise: true },
    { name: "HR & Payroll", basic: false, pro: false, business: true, enterprise: true },
    { name: "Advanced analytics", basic: false, pro: false, business: true, enterprise: true },
    { name: "Refund system", basic: false, pro: false, business: true, enterprise: true },
  ]},
  { category: "Payments", features: [
    { name: "Manual payment", basic: true, pro: true, business: true, enterprise: true },
    { name: "SSLCommerz gateway", basic: false, pro: true, business: true, enterprise: true },
    { name: "bKash gateway", basic: false, pro: false, business: true, enterprise: true },
  ]},
  { category: "Enterprise", features: [
    { name: "White Label", basic: false, pro: false, business: false, enterprise: true },
    { name: "API access", basic: false, pro: false, business: false, enterprise: true },
    { name: "Marketplace", basic: false, pro: false, business: false, enterprise: true },
    { name: "Dedicated support", basic: false, pro: false, business: false, enterprise: true },
    { name: "Custom capability package", basic: false, pro: false, business: false, enterprise: true },
  ]},
];
