const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token");
  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  }).then(async (res) => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || "Request failed");
    }
    return res.json();
  });
}

export type WhatsAppTemplateType =
  | "subscriptionRenewal"
  | "subscriptionExpiring"
  | "paymentReminder"
  | "trialDripLast"
  | "passportExpiryAlert"
  | "passportExpiryAlertBn"
  | "travelDepartureReminder"
  | "travelDepartureReminderBn"
  | "custom";

export interface WhatsAppTemplate {
  id: string;
  name: string;
  type: WhatsAppTemplateType | string;
  message: string;
  metaTemplateName?: string | null;
  variables: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export const WHATSAPP_TEMPLATE_VARIABLES: Record<string, { key: string; label: string }[]> = {
  subscriptionRenewal: [
    { key: "ownerName", label: "Owner name" },
    { key: "plan", label: "Plan" },
    { key: "expiryDate", label: "Expiry date" },
  ],
  subscriptionExpiring: [
    { key: "ownerName", label: "Owner name" },
    { key: "plan", label: "Plan" },
    { key: "expiryDate", label: "Expiry date" },
  ],
  paymentReminder: [
    { key: "name", label: "Client name" },
    { key: "invoiceNumber", label: "Invoice #" },
    { key: "dueAmount", label: "Due amount" },
    { key: "dueDate", label: "Due date" },
    { key: "company", label: "Company" },
  ],
  trialDripLast: [
    { key: "ownerName", label: "Owner name" },
    { key: "trialDays", label: "Trial days" },
    { key: "expiryDate", label: "Expiry date" },
  ],
  passportExpiryAlert: [
    { key: "clientName", label: "Client name" },
    { key: "passportNumber", label: "Passport #" },
    { key: "expiryDate", label: "Expiry date" },
    { key: "daysLeft", label: "Days left" },
    { key: "companyName", label: "Agency" },
  ],
  travelDepartureReminder: [
    { key: "clientName", label: "Client name" },
    { key: "destination", label: "Destination" },
    { key: "travelDate", label: "Travel date" },
    { key: "daysLeft", label: "Days left" },
    { key: "companyName", label: "Agency" },
  ],
  custom: [{ key: "name", label: "Recipient" }],
};

export const DEFAULT_WHATSAPP_TEMPLATES: Omit<WhatsAppTemplate, "id" | "createdAt">[] = [
  {
    name: "Subscription renewal",
    type: "subscriptionRenewal",
    message:
      "Dear {{ownerName}}, your {{plan}} plan has expired. Renew at app.travelagencyweb.com/subscription — Travel Agency Web",
    metaTemplateName: null,
    variables: ["ownerName", "plan", "expiryDate"],
    isActive: true,
  },
  {
    name: "Subscription expiring soon",
    type: "subscriptionExpiring",
    message: "Your {{plan}} plan expires on {{expiryDate}}. Renew now to avoid interruption.",
    metaTemplateName: null,
    variables: ["plan", "expiryDate"],
    isActive: true,
  },
  {
    name: "Payment reminder",
    type: "paymentReminder",
    message:
      "Reminder: Invoice {{invoiceNumber}} for ৳{{dueAmount}} is due on {{dueDate}}. — {{company}}",
    metaTemplateName: null,
    variables: ["invoiceNumber", "dueAmount", "dueDate", "company"],
    isActive: true,
  },
];

export function extractVariables(message: string) {
  const matches = String(message || "").match(/\{\{(\w+)\}\}/g) || [];
  return [...new Set(matches.map((m) => m.replace(/[{}]/g, "")))];
}

export const whatsappTemplateApi = {
  list: () => request<WhatsAppTemplate[]>("/whatsapp/templates"),
  create: (data: Partial<WhatsAppTemplate>) =>
    request<WhatsAppTemplate>("/whatsapp/templates", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<WhatsAppTemplate>) =>
    request<WhatsAppTemplate>(`/whatsapp/templates/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) => request<{ success: boolean }>(`/whatsapp/templates/${id}`, { method: "DELETE" }),
};

export interface SubscriptionCoupon {
  id: string;
  code: string;
  description?: string | null;
  discountType: "percent" | "fixed";
  discountValue: number;
  maxUses?: number | null;
  usedCount: number;
  validFrom?: string | null;
  validUntil?: string | null;
  applicablePlans: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CouponValidation {
  valid: boolean;
  code?: string;
  originalAmount?: number;
  discountAmount?: number;
  finalAmount?: number;
  description?: string | null;
  message?: string;
}

export const subscriptionCouponApi = {
  list: () => request<SubscriptionCoupon[]>("/subscription-coupons"),
  create: (data: Partial<SubscriptionCoupon>) =>
    request<SubscriptionCoupon>("/subscription-coupons", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<SubscriptionCoupon>) =>
    request<SubscriptionCoupon>(`/subscription-coupons/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) => request<{ success: boolean }>(`/subscription-coupons/${id}`, { method: "DELETE" }),
  validate: (code: string, plan: string, billingCycle: string) =>
    request<CouponValidation>("/subscription-coupons/validate", {
      method: "POST",
      body: JSON.stringify({ code, plan, billingCycle }),
    }),
};

export interface TenantHealthRow {
  tenantId: string;
  name: string;
  slug?: string | null;
  subscriptionPlan?: string;
  subscriptionStatus?: string;
  subscriptionExpiry?: string | null;
  lastLoginAt?: string | null;
  bookingsLast30d: number;
  clientCount: number;
  userCount: number;
  healthScore: number;
  healthLabel: "healthy" | "moderate" | "at_risk";
}

export const tenantHealthApi = {
  list: () => request<{ generatedAt: string; tenants: TenantHealthRow[] }>("/admin/tenants/health"),
};
