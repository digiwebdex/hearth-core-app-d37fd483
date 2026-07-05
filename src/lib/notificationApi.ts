import { API_BASE_URL } from "@/lib/apiConfig";
// Notification API layer
const BASE_URL = API_BASE_URL;

function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export type NotificationType =
  | "booking_created"
  | "payment_received"
  | "subscription_expiring"
  | "invoice_created"
  | "task_assigned"
  | "system";

export interface Notification {
  id: string;
  tenantId: string;
  userId?: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  link?: string;
  createdAt: string;
}

export interface NotificationListResponse {
  items: Notification[];
  total: number;
  page: number;
  limit: number;
  unreadCount: number;
}

export const notificationApi = {
  list: async (): Promise<Notification[]> => {
    const res = await fetch(`${BASE_URL}/notifications`, { headers: authHeaders() });
    if (!res.ok) throw new Error("Failed to fetch");
    const data: NotificationListResponse = await res.json();
    return data.items ?? [];
  },

  unreadCount: async (): Promise<number> => {
    const res = await fetch(`${BASE_URL}/notifications/unread-count`, { headers: authHeaders() });
    if (!res.ok) throw new Error("Failed to fetch");
    const data = await res.json();
    return data.count;
  },

  markAsRead: async (id: string): Promise<void> => {
    const res = await fetch(`${BASE_URL}/notifications/${id}/read`, { method: "PATCH", headers: authHeaders() });
    if (!res.ok) throw new Error("Failed to mark as read");
  },

  markAllRead: async (): Promise<void> => {
    const res = await fetch(`${BASE_URL}/notifications/read-all`, { method: "PATCH", headers: authHeaders() });
    if (!res.ok) throw new Error("Failed to mark all as read");
  },

  delete: async (id: string): Promise<void> => {
    const res = await fetch(`${BASE_URL}/notifications/${id}`, { method: "DELETE", headers: authHeaders() });
    if (!res.ok) throw new Error("Failed to delete");
  },
};
