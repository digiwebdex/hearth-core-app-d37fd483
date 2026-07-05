import { API_BASE_URL } from "@/lib/apiConfig";
// Admin Notification API layer
const BASE_URL = API_BASE_URL;

function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export type AdminNotificationType =
  | "new_tenant"
  | "payment_request"
  | "subscription_expiring"
  | "subscription_expired"
  | "tenant_suspended"
  | "system";

export interface AdminNotification {
  id: string;
  type: AdminNotificationType;
  title: string;
  message: string;
  read: boolean;
  link?: string;
  metadata?: Record<string, string>;
  createdAt: string;
}

// Demo data
const demoAdminNotifications: AdminNotification[] = [
  {
    id: "an1", type: "new_tenant", title: "New Tenant Registered",
    message: "Dream Trips (dream@trips.com) just signed up for a Free plan.",
    read: false, link: "/admin/tenants",
    createdAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
  },
  {
    id: "an2", type: "payment_request", title: "New Payment Request",
    message: "Acme Travel submitted ৳1,999 payment for Pro plan via bKash (TRX-9876543).",
    read: false, link: "/admin/payments",
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  {
    id: "an3", type: "payment_request", title: "New Payment Request",
    message: "Globe Tours submitted ৳999 payment for Basic plan via Bank Transfer (TRX-1234567).",
    read: false, link: "/admin/payments",
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: "an4", type: "subscription_expiring", title: "Subscription Expiring Soon",
    message: "Globe Tours Pro plan expires in 3 days. No renewal request submitted yet.",
    read: false, link: "/admin/subscriptions",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: "an5", type: "new_tenant", title: "New Tenant Registered",
    message: "Sky Wings (sky@wings.com) just signed up for a Free plan.",
    read: true, link: "/admin/tenants",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
  },
  {
    id: "an6", type: "subscription_expired", title: "Subscription Expired",
    message: "Star Holidays Basic plan has expired. Tenant restricted to Free features.",
    read: true, link: "/admin/subscriptions",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: "an7", type: "payment_request", title: "Payment Approved",
    message: "Star Holidays Business plan payment (৳4,999) was approved and activated.",
    read: true, link: "/admin/payments",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  },
  {
    id: "an8", type: "system", title: "System Update",
    message: "Platform maintenance completed. All systems operational.",
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
  },
];

let localAdminNotifications = [...demoAdminNotifications];

const isDemo = () => {
  const hostname = window.location.hostname;
  return hostname === "localhost" || hostname.includes("lovable.app");
};

export const adminNotificationApi = {
  list: async (): Promise<AdminNotification[]> => {
    if (isDemo()) return localAdminNotifications;
    const res = await fetch(`${BASE_URL}/admin/notifications`, { headers: authHeaders() });
    if (!res.ok) throw new Error("Failed to fetch");
    return res.json();
  },

  unreadCount: async (): Promise<number> => {
    if (isDemo()) return localAdminNotifications.filter((n) => !n.read).length;
    const res = await fetch(`${BASE_URL}/admin/notifications/unread-count`, { headers: authHeaders() });
    if (!res.ok) throw new Error("Failed to fetch");
    const data = await res.json();
    return data.count;
  },

  markAsRead: async (id: string): Promise<void> => {
    if (isDemo()) {
      localAdminNotifications = localAdminNotifications.map((n) => (n.id === id ? { ...n, read: true } : n));
      return;
    }
    await fetch(`${BASE_URL}/admin/notifications/${id}/read`, { method: "PATCH", headers: authHeaders() });
  },

  markAllRead: async (): Promise<void> => {
    if (isDemo()) {
      localAdminNotifications = localAdminNotifications.map((n) => ({ ...n, read: true }));
      return;
    }
    await fetch(`${BASE_URL}/admin/notifications/read-all`, { method: "PATCH", headers: authHeaders() });
  },

  delete: async (id: string): Promise<void> => {
    if (isDemo()) {
      localAdminNotifications = localAdminNotifications.filter((n) => n.id !== id);
      return;
    }
    await fetch(`${BASE_URL}/admin/notifications/${id}`, { method: "DELETE", headers: authHeaders() });
  },
};
