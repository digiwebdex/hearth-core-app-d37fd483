import { type PlanType } from "@/lib/plans";

// ── Feature Definitions ──
export interface FeatureDefinition {
  id: string;
  name: string;
  description: string;
  category: "payment" | "communication" | "website" | "analytics" | "core";
}

export const FEATURE_DEFINITIONS: FeatureDefinition[] = [
  // Payment
  { id: "payment_gateway", name: "Payment Gateway", description: "Accept online payments via SSLCommerz, bKash", category: "payment" },
  { id: "sslcommerz", name: "SSLCommerz", description: "Visa, Mastercard, Mobile Banking", category: "payment" },
  { id: "bkash", name: "bKash", description: "bKash mobile wallet payments", category: "payment" },
  { id: "custom_gateway", name: "Custom Gateway", description: "Custom payment gateway integration", category: "payment" },
  { id: "refund_system", name: "Refund System", description: "Full and partial refund processing", category: "payment" },

  // Communication
  { id: "email_notifications", name: "Email Notifications", description: "Automated booking & payment emails", category: "communication" },
  { id: "sms_integration", name: "SMS Integration", description: "Send SMS to clients and agents", category: "communication" },
  { id: "whatsapp", name: "WhatsApp Integration", description: "WhatsApp messaging for clients", category: "communication" },
  { id: "marketing_tools", name: "Marketing Tools", description: "SMS/email campaign management", category: "communication" },

  // Platform capabilities
  { id: "automation", name: "Automation (Level 1)", description: "Rule-based notifications & workflow triggers", category: "core" },
  { id: "advanced_automation", name: "Advanced Automation", description: "Multi-step workflow engine", category: "core" },
  { id: "hr_payroll", name: "HR & Payroll", description: "Staff HRM, attendance and payroll", category: "core" },
  { id: "white_label", name: "White Label", description: "Remove branding / fully branded platform", category: "core" },
  { id: "marketplace", name: "Marketplace", description: "B2B marketplace access", category: "core" },

  // Website
  { id: "website_templates", name: "Website Templates", description: "Pre-built website designs", category: "website" },
  { id: "custom_domain", name: "Custom Domain", description: "Connect your own domain", category: "website" },
  { id: "custom_website_design", name: "Custom Website Design", description: "Fully custom website design", category: "website" },

  // Analytics
  { id: "advanced_analytics", name: "Advanced Analytics", description: "Detailed reports and dashboards", category: "analytics" },
  { id: "payment_reports", name: "Payment Reports", description: "Revenue and payment analytics", category: "analytics" },

  // Core
  { id: "accounting", name: "Accounting System", description: "Full accounting and ledger management", category: "core" },
  { id: "agent_commission", name: "Agent Commission", description: "Agent commission tracking and payments", category: "core" },
  { id: "api_access", name: "API Access", description: "REST API access for integrations", category: "core" },
];

// ── Default feature-plan mapping ──
// true = enabled for that plan
export type FeaturePlanMap = Record<string, Record<PlanType, boolean>>;

export const DEFAULT_FEATURE_MAP: FeaturePlanMap = {
  payment_gateway:      { free: false, basic: false, pro: true,  business: true,  enterprise: true },
  sslcommerz:           { free: false, basic: false, pro: true,  business: true,  enterprise: true },
  bkash:                { free: false, basic: false, pro: false, business: true,  enterprise: true },
  custom_gateway:       { free: false, basic: false, pro: false, business: false, enterprise: true },
  refund_system:        { free: false, basic: false, pro: false, business: true,  enterprise: true },
  email_notifications:  { free: false, basic: false, pro: true,  business: true,  enterprise: true },
  sms_integration:      { free: false, basic: false, pro: true,  business: true,  enterprise: true },
  whatsapp:             { free: false, basic: false, pro: true,  business: true,  enterprise: true },
  marketing_tools:      { free: false, basic: false, pro: false, business: true,  enterprise: true },
  website_templates:    { free: false, basic: false, pro: true,  business: true,  enterprise: true },
  custom_domain:        { free: false, basic: false, pro: true,  business: true,  enterprise: true },
  custom_website_design:{ free: false, basic: false, pro: false, business: false, enterprise: true },
  advanced_analytics:   { free: false, basic: false, pro: false, business: true,  enterprise: true },
  payment_reports:      { free: false, basic: false, pro: false, business: true,  enterprise: true },
  accounting:           { free: false, basic: true,  pro: true,  business: true,  enterprise: true },
  agent_commission:     { free: false, basic: false, pro: true,  business: true,  enterprise: true },
  automation:           { free: false, basic: false, pro: true,  business: true,  enterprise: true },
  advanced_automation:  { free: false, basic: false, pro: false, business: true,  enterprise: true },
  hr_payroll:           { free: false, basic: false, pro: false, business: true,  enterprise: true },
  api_access:           { free: false, basic: false, pro: false, business: false, enterprise: true },
  white_label:          { free: false, basic: false, pro: false, business: false, enterprise: true },
  marketplace:          { free: false, basic: false, pro: false, business: false, enterprise: true },
};

// ── Helpers ──
export function isFeatureEnabled(
  featureId: string,
  planId: PlanType,
  overrides?: FeaturePlanMap
): boolean {
  const map = overrides || DEFAULT_FEATURE_MAP;
  return map[featureId]?.[planId] ?? false;
}

export function getEnabledFeatures(planId: PlanType, overrides?: FeaturePlanMap): string[] {
  const map = overrides || DEFAULT_FEATURE_MAP;
  return Object.keys(map).filter((fId) => map[fId]?.[planId]);
}

export function getFeatureDefinition(featureId: string): FeatureDefinition | undefined {
  return FEATURE_DEFINITIONS.find((f) => f.id === featureId);
}

export const FEATURE_CATEGORIES = [
  { id: "payment", label: "Payment & Billing", icon: "CreditCard" },
  { id: "communication", label: "Communication", icon: "MessageSquare" },
  { id: "website", label: "Website & Domain", icon: "Globe" },
  { id: "analytics", label: "Analytics & Reports", icon: "BarChart3" },
  { id: "core", label: "Core Features", icon: "Settings" },
] as const;
