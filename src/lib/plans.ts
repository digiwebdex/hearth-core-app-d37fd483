// ── Subscription Plans Configuration ──

export type PlanType = "free" | "basic" | "pro" | "business" | "enterprise";
export type BillingCycle = "monthly" | "yearly";
export type SubscriptionStatus = "trial" | "active" | "overdue" | "expired" | "suspended" | "cancelled";

export interface PlanConfig {
  id: PlanType;
  /** @deprecated Use monthlyPrice instead. Kept for backward compatibility. */
  price: number;
  name: string;
  monthlyPrice: number; // BDT/month, 0 = free, -1 = custom
  yearlyPrice: number;  // BDT/year, 0 = free, -1 = custom
  description: string;
  badge?: string;
  trialDays: number; // 0 = no trial

  // ── Limits (−1 = unlimited) ──
  maxClients: number;
  maxBookings: number;
  maxUsers: number;
  maxDomains: number;
  maxBranches: number;
  maxSmsPerMonth: number;
  maxStorageMB: number;
  maxReports: number;
  maxLeads: number;
  maxQuotations: number;

  // ── Feature flags ──
  features: string[];
  restrictions: string[];
  paymentGateways: ("manual" | "sslcommerz" | "bkash" | "custom")[];
  hasCustomDomain: boolean;
  hasWebsiteTemplates: boolean;
  hasSmsIntegration: boolean;
  hasWhatsApp: boolean;
  hasEmailNotifications: boolean;
  hasAgentCommission: boolean;
  hasAdvancedAnalytics: boolean;
  hasMarketingTools: boolean;
  hasApiAccess: boolean;
  hasRefundSystem: boolean;
  hasHajjUmrah: boolean;
  hasPrioritySupport: boolean;
}

// ── Helper: yearly price — pay for 10 months, get 12 (2 months free) ──
const yearly = (monthly: number) =>
  monthly <= 0 ? monthly : monthly * 10;

export function getDisplayMonthlyPrice(plan: PlanConfig, cycle: BillingCycle): number {
  if (plan.monthlyPrice <= 0) return plan.monthlyPrice;
  return cycle === "yearly" ? Math.round(plan.yearlyPrice / 12) : plan.monthlyPrice;
}

export const PLANS: PlanConfig[] = [
  {
    id: "basic", name: "Basic", price: 500, monthlyPrice: 500, yearlyPrice: yearly(500),
    description: "For small travel agencies getting started", trialDays: 0,
    maxClients: 500, maxBookings: 500, maxUsers: 3, maxDomains: 0,
    maxBranches: 1, maxSmsPerMonth: 0, maxStorageMB: 500, maxReports: 10,
    maxLeads: 500, maxQuotations: 500,
    features: [
      "500 clients",
      "500 bookings",
      "Hajj, Umrah, Visa, Air Ticket, Hotel + Tour, Transport, Manpower, Student & more",
      "Accounting",
      "Invoice + payments",
      "3 team members",
    ],
    restrictions: ["No custom domain", "No SMS/Email integration", "No website design"],
    paymentGateways: ["manual"],
    hasCustomDomain: false, hasWebsiteTemplates: false, hasSmsIntegration: false,
    hasWhatsApp: false, hasEmailNotifications: false, hasAgentCommission: false,
    hasAdvancedAnalytics: false, hasMarketingTools: false, hasApiAccess: false,
    hasRefundSystem: false, hasHajjUmrah: true, hasPrioritySupport: false,
  },
  {
    id: "pro", name: "Pro", price: 800, monthlyPrice: 800, yearlyPrice: yearly(800),
    description: "For growing agencies that need an online presence", badge: "Most Popular", trialDays: 0,
    maxClients: 1000, maxBookings: 1000, maxUsers: 10, maxDomains: 1,
    maxBranches: 2, maxSmsPerMonth: 500, maxStorageMB: 2048, maxReports: 30,
    maxLeads: 1000, maxQuotations: 1000,
    features: [
      "1,000 clients",
      "1,000 bookings",
      "Hajj, Umrah, Visa, Air Ticket, Hotel + Tour, Transport, Manpower, Student & more",
      "Company domain (domain charge excluded)",
      "SMS & Email integration",
      "Accounting",
      "Invoice + payments",
      "10 team members",
    ],
    restrictions: ["No WhatsApp", "No website builder", "No advanced analytics"],
    paymentGateways: ["manual", "sslcommerz"],
    hasCustomDomain: true, hasWebsiteTemplates: true, hasSmsIntegration: true,
    hasWhatsApp: false, hasEmailNotifications: true, hasAgentCommission: true,
    hasAdvancedAnalytics: false, hasMarketingTools: false, hasApiAccess: false,
    hasRefundSystem: false, hasHajjUmrah: true, hasPrioritySupport: false,
  },
  {
    id: "business", name: "Business", price: 1500, monthlyPrice: 1500, yearlyPrice: yearly(1500),
    description: "For established agencies scaling operations", badge: "Best Value", trialDays: 0,
    maxClients: 2000, maxBookings: 2000, maxUsers: 25, maxDomains: 2,
    maxBranches: 5, maxSmsPerMonth: 2000, maxStorageMB: 10240, maxReports: -1,
    maxLeads: 2000, maxQuotations: 2000,
    features: [
      "2,000 clients",
      "2,000 bookings",
      "Hajj, Umrah, Visa, Air Ticket, Hotel + Tour, Transport, Manpower, Student & more",
      "Full CRM suite + marketing campaigns",
      "Operations desks (Hajj, ticketing, visa, corporate)",
      "Website design",
      "SMS, Email & WhatsApp integration",
      "Daily WhatsApp summary + auto backup",
      "Advanced analytics + accounting",
      "25 team members",
    ],
    restrictions: [],
    paymentGateways: ["manual", "sslcommerz", "bkash"],
    hasCustomDomain: true, hasWebsiteTemplates: true, hasSmsIntegration: true,
    hasWhatsApp: true, hasEmailNotifications: true, hasAgentCommission: true,
    hasAdvancedAnalytics: true, hasMarketingTools: true, hasApiAccess: false,
    hasRefundSystem: true, hasHajjUmrah: true, hasPrioritySupport: false,
  },
  {
    id: "enterprise", name: "Enterprise", price: 5000, monthlyPrice: 5000, yearlyPrice: yearly(5000),
    description: "For large agencies — unlimited scale, full automation & dedicated support", trialDays: 0,
    maxClients: -1, maxBookings: -1, maxUsers: -1, maxDomains: -1,
    maxBranches: -1, maxSmsPerMonth: -1, maxStorageMB: -1, maxReports: -1,
    maxLeads: -1, maxQuotations: -1,
    features: [
      "Unlimited clients",
      "Unlimited bookings",
      "Unlimited team members",
      "Unlimited branches & multi-office management",
      "Full CRM suite, campaigns & operations desks",
      "Daily WhatsApp summary + automatic backup",
      "Unlimited SMS & WhatsApp automation",
      "Unlimited storage",
      "Unlimited custom domains",
      "Full automation & workflow engine",
      "API access & custom integrations",
      "Dedicated account manager",
      "Priority 24/7 WhatsApp support",
      "Accounting + advanced analytics",
      "All payment gateways",
    ],
    restrictions: [],
    paymentGateways: ["manual", "sslcommerz", "bkash", "custom"],
    hasCustomDomain: true, hasWebsiteTemplates: true, hasSmsIntegration: true,
    hasWhatsApp: true, hasEmailNotifications: true, hasAgentCommission: true,
    hasAdvancedAnalytics: true, hasMarketingTools: true, hasApiAccess: true,
    hasRefundSystem: true, hasHajjUmrah: true, hasPrioritySupport: true,
  },
];

export function getPlan(planId: PlanType): PlanConfig {
  // "free" is deprecated; fall back to Basic for legacy tenants.
  return PLANS.find((p) => p.id === planId) || PLANS[0];
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
  // Usage counters
  usedClients?: number;
  usedBookings?: number;
  usedUsers?: number;
  usedSms?: number;
  usedStorageMB?: number;
  usedBranches?: number;
  usedLeads?: number;
  usedQuotations?: number;
}

// ── Usage helper ──
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
    ["Clients", sub.usedClients || 0, plan.maxClients],
    ["Bookings", sub.usedBookings || 0, plan.maxBookings],
    ["Users", sub.usedUsers || 0, plan.maxUsers],
    ["SMS", sub.usedSms || 0, plan.maxSmsPerMonth],
    ["Storage (MB)", sub.usedStorageMB || 0, plan.maxStorageMB],
    ["Branches", sub.usedBranches || 0, plan.maxBranches],
    ["Leads", sub.usedLeads || 0, plan.maxLeads],
    ["Quotations", sub.usedQuotations || 0, plan.maxQuotations],
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

// Feature comparison table
export const FEATURE_COMPARISON = [
  { category: "Core", features: [
    { name: "Dashboard", basic: true, pro: true, business: true, enterprise: true },
    { name: "Automatic daily backup (data safety)", basic: true, pro: true, business: true, enterprise: true },
    { name: "CRM System", basic: "500 clients", pro: "1,000 clients", business: "2,000 clients", enterprise: "Unlimited" },
    { name: "Bookings", basic: "500", pro: "1,000", business: "2,000", enterprise: "Unlimited" },
    { name: "Team Members", basic: "3", pro: "10", business: "25", enterprise: "Unlimited" },
    { name: "Branches", basic: "1", pro: "1", business: "1", enterprise: "Unlimited" },
  ]},
  { category: "Billing & Payments", features: [
    { name: "Accounting", basic: true, pro: true, business: true, enterprise: true },
    { name: "Invoice System", basic: true, pro: true, business: true, enterprise: true },
    { name: "Manual Payment", basic: true, pro: true, business: true, enterprise: true },
    { name: "SSLCommerz Gateway", basic: false, pro: true, business: true, enterprise: true },
    { name: "bKash Gateway", basic: false, pro: false, business: true, enterprise: true },
    { name: "Refund System", basic: false, pro: false, business: true, enterprise: true },
  ]},
  { category: "Communication", features: [
    { name: "Email Integration", basic: false, pro: true, business: true, enterprise: true },
    { name: "SMS Integration", basic: "None", pro: "500/mo", business: "2,000/mo", enterprise: "Unlimited" },
    { name: "WhatsApp", basic: false, pro: false, business: true, enterprise: true },
    { name: "Marketing Campaigns (bulk SMS / WhatsApp / Email)", basic: false, pro: false, business: true, enterprise: true },
    { name: "Daily WhatsApp summary to owner (+ auto-backup confirmation)", basic: false, pro: false, business: true, enterprise: true },
  ]},
  { category: "Website & Storage", features: [
    { name: "Company Domain (charges excluded)", basic: false, pro: "1", business: "2", enterprise: "Unlimited" },
    { name: "Website Design", basic: false, pro: false, business: true, enterprise: true },
    { name: "Storage", basic: "500 MB", pro: "2 GB", business: "10 GB", enterprise: "Unlimited" },
  ]},
  { category: "Advanced", features: [
    { name: "Sell all services (Hajj, Umrah, Visa, Air Ticket, Hotel, Tour, Transport, Manpower, Student)", basic: true, pro: true, business: true, enterprise: true },
    { name: "CRM suite (leads, complaints, campaigns, analytics)", basic: false, pro: false, business: true, enterprise: true },
    { name: "Operations desks (Hajj/Umrah, ticketing, visa, corporate)", basic: false, pro: false, business: true, enterprise: true },
    { name: "Advanced Analytics", basic: false, pro: false, business: true, enterprise: true },
    { name: "Full Automation & Workflow Engine", basic: false, pro: false, business: false, enterprise: true },
    { name: "API Access & Custom Integrations", basic: false, pro: false, business: false, enterprise: true },
    { name: "Multi-branch Management", basic: false, pro: false, business: false, enterprise: true },
    { name: "Dedicated Account Manager", basic: false, pro: false, business: false, enterprise: true },
    { name: "Priority 24/7 WhatsApp Support", basic: false, pro: false, business: true, enterprise: true },
  ]},
];
