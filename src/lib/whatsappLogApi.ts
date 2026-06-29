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

export interface WhatsAppLog {
  id: string;
  tenantId?: string;
  phone: string;
  message: string;
  status: "sent" | "failed" | "pending";
  provider: string;
  errorMessage?: string;
  providerMessageId?: string;
  templateType?: string;
  sentAt?: string;
  createdAt: string;
}

export interface WhatsAppLogFilters {
  page?: number;
  limit?: number;
  status?: string;
  phone?: string;
  tenantId?: string;
}

export interface WhatsAppLogResponse {
  logs: WhatsAppLog[];
  total: number;
  page: number;
  limit: number;
  stats: { total: number; sent: number; failed: number; pending: number };
}

export const whatsappLogApi = {
  list: (filters: WhatsAppLogFilters = {}): Promise<WhatsAppLogResponse> => {
    const params = new URLSearchParams();
    if (filters.page) params.set("page", String(filters.page));
    if (filters.limit) params.set("limit", String(filters.limit));
    if (filters.status && filters.status !== "all") params.set("status", filters.status);
    if (filters.phone) params.set("phone", filters.phone);
    if (filters.tenantId) params.set("tenantId", filters.tenantId);
    return request(`/whatsapp/logs?${params}`);
  },

  send: (to: string, message: string): Promise<{ success: boolean; provider: string; messageId?: string; error?: string }> =>
    request("/whatsapp/send", { method: "POST", body: JSON.stringify({ to, message }) }),
};
