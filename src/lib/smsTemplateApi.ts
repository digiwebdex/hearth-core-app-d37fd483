import { API_BASE_URL } from "@/lib/apiConfig";
// SMS Template types and API
const BASE_URL = API_BASE_URL;

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

export type SmsTemplateType = "booking" | "payment" | "otp" | "reminder" | "custom";

export interface SmsTemplate {
  id: string;
  name: string;
  type: SmsTemplateType;
  message: string;
  variables: string[];
  isActive: boolean;
  createdAt: string;
}

// Available variables per template type
export const TEMPLATE_VARIABLES: Record<SmsTemplateType, { key: string; label: string }[]> = {
  booking: [
    { key: "name", label: "Client Name" },
    { key: "bookingId", label: "Booking ID" },
    { key: "type", label: "Booking Type" },
    { key: "amount", label: "Amount" },
    { key: "status", label: "Status" },
    { key: "date", label: "Booking Date" },
    { key: "agent", label: "Agent Name" },
    { key: "company", label: "Company Name" },
  ],
  payment: [
    { key: "name", label: "Client Name" },
    { key: "amount", label: "Payment Amount" },
    { key: "invoiceId", label: "Invoice ID" },
    { key: "method", label: "Payment Method" },
    { key: "balance", label: "Remaining Balance" },
    { key: "company", label: "Company Name" },
  ],
  otp: [
    { key: "otp", label: "OTP Code" },
    { key: "name", label: "User Name" },
    { key: "expiry", label: "Expiry Time" },
  ],
  reminder: [
    { key: "name", label: "Client Name" },
    { key: "dueDate", label: "Due Date" },
    { key: "amount", label: "Due Amount" },
    { key: "invoiceId", label: "Invoice ID" },
    { key: "company", label: "Company Name" },
  ],
  custom: [
    { key: "name", label: "Recipient Name" },
    { key: "company", label: "Company Name" },
  ],
};

export const DEFAULT_TEMPLATES: Omit<SmsTemplate, "id" | "createdAt">[] = [
  {
    name: "Booking Confirmation",
    type: "booking",
    message: "Dear {{name}}, your {{type}} booking ({{bookingId}}) is confirmed. Amount: {{amount}} BDT. Thank you! - {{company}}",
    variables: ["name", "type", "bookingId", "amount", "company"],
    isActive: true,
  },
  {
    name: "Payment Received",
    type: "payment",
    message: "Dear {{name}}, we received your payment of {{amount}} BDT for Invoice #{{invoiceId}}. Remaining: {{balance}} BDT. - {{company}}",
    variables: ["name", "amount", "invoiceId", "balance", "company"],
    isActive: true,
  },
  {
    name: "OTP Verification",
    type: "otp",
    message: "Dear {{name}}, your verification code is {{otp}}. Valid for {{expiry}}. Do not share this code.",
    variables: ["name", "otp", "expiry"],
    isActive: true,
  },
  {
    name: "Payment Reminder",
    type: "reminder",
    message: "Dear {{name}}, a payment of {{amount}} BDT for Invoice #{{invoiceId}} is due on {{dueDate}}. Please pay on time. - {{company}}",
    variables: ["name", "amount", "invoiceId", "dueDate", "company"],
    isActive: true,
  },
];

/** Replace {{var}} placeholders with actual values */
export function renderTemplate(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? `{{${key}}}`);
}

/** Extract variable keys from a template string */
export function extractVariables(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, "")))];
}

export const smsTemplateApi = {
  list: () => request<SmsTemplate[]>("/sms/templates"),
  get: (id: string) => request<SmsTemplate>(`/sms/templates/${id}`),
  create: (data: Omit<SmsTemplate, "id" | "createdAt">) =>
    request<SmsTemplate>("/sms/templates", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<SmsTemplate>) =>
    request<SmsTemplate>(`/sms/templates/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`/sms/templates/${id}`, { method: "DELETE" }),
};
