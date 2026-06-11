const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...options.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || "Request failed");
  }
  return res.json();
}

export type AutomationEventType = "lead_created" | "booking_created" | "payment_received";
export type AutomationChannel = "sms" | "in_app";
export type DeliveryStatus = "pending" | "sent" | "failed";

export interface NotificationSettings {
  tenantId: string;
  smsEnabled: boolean;
  notifyOnBooking: boolean;
  notifyOnPayment: boolean;
  notifyOnLead: boolean;
  smsEnvConfigured: boolean;
  updatedAt: string;
}

export interface AutomationEventConfig {
  eventType: AutomationEventType;
  label: string;
  sms: boolean;
  inApp: boolean;
}

export interface AutomationConfigResponse {
  settings: NotificationSettings;
  events: AutomationEventConfig[];
}

export interface AutomationDelivery {
  id: string;
  eventType: AutomationEventType;
  channel: AutomationChannel;
  status: DeliveryStatus;
  recipient: string;
  recipientName?: string;
  message?: string;
  messagePreview?: string;
  errorMessage?: string;
  relatedType?: string;
  relatedId?: string;
  notificationId?: string;
  attempts: number;
  sentAt?: string;
  createdAt: string;
}

export interface AutomationLogListResponse {
  items: AutomationDelivery[];
  total: number;
  page: number;
  limit: number;
}

export interface AutomationLogStats {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  bySms: number;
  byInApp: number;
}

export interface AutomationLogFilters {
  page?: number;
  limit?: number;
  status?: DeliveryStatus;
  channel?: AutomationChannel;
  eventType?: AutomationEventType;
  search?: string;
}

export const automationApi = {
  getSettings: () => request<NotificationSettings>("/tenants/me/notification-settings"),

  updateSettings: (data: Partial<NotificationSettings>) =>
    request<NotificationSettings>("/tenants/me/notification-settings", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  getAutomation: () => request<AutomationConfigResponse>("/notifications/automation"),

  updateAutomation: (data: {
    settings?: Partial<NotificationSettings>;
    events?: Array<{ eventType: AutomationEventType; sms?: boolean; inApp?: boolean }>;
  }) =>
    request<AutomationConfigResponse>("/notifications/automation", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  getLogs: (filters?: AutomationLogFilters) => {
    const params = new URLSearchParams();
    if (filters?.page) params.set("page", String(filters.page));
    if (filters?.limit) params.set("limit", String(filters.limit));
    if (filters?.status) params.set("status", filters.status);
    if (filters?.channel) params.set("channel", filters.channel);
    if (filters?.eventType) params.set("eventType", filters.eventType);
    if (filters?.search) params.set("search", filters.search);
    const qs = params.toString();
    return request<AutomationLogListResponse>(`/notifications/automation/logs${qs ? `?${qs}` : ""}`);
  },

  getLogStats: () => request<AutomationLogStats>("/notifications/automation/logs/stats"),

  getLog: (id: string) => request<AutomationDelivery>(`/notifications/automation/logs/${id}`),
};
