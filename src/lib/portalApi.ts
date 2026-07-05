import { API_BASE_URL } from "@/lib/apiConfig";
// Portal API client — separate token namespace from the agency app.
const BASE_URL = API_BASE_URL;
const TOKEN_KEY = "portal_token";

export function getPortalToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setPortalToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearPortalToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getPortalToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || "Request failed");
  }
  return res.json();
}

export type PortalRole = "customer" | "supplier" | "agent";

export interface PortalSession {
  token: string;
  email: string;
  roles: PortalRole[];
}

export interface PortalBooking {
  id: string;
  title?: string | null;
  destination?: string | null;
  travelDateFrom?: string | null;
  travelDateTo?: string | null;
  status: string;
  paymentStatus: string;
  amount: number;
  paidAmount: number;
  dueAmount: number;
  tenantName?: string;
}

export interface PortalInstallment {
  id: string;
  label: string;
  amount: number;
  paidAmount: number;
  dueDate?: string | null;
  status: string;
}

export interface PortalInvoiceSummary {
  id: string;
  invoiceNumber?: string | null;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: string;
  dueDate?: string | null;
  issuedDate?: string | null;
  installments: PortalInstallment[];
}

export interface PortalTimelineEvent {
  id: string;
  type: string;
  content: string;
  oldStatus?: string | null;
  newStatus?: string | null;
  createdAt: string;
}

export interface PortalBookingDetail extends PortalBooking {
  type: string;
  travelerCount?: number | null;
  serviceType?: string | null;
  travelers: { id: string; name: string; nationality?: string | null }[];
  invoices: PortalInvoiceSummary[];
  timeline: PortalTimelineEvent[];
}

export interface PortalAgentBooking {
  id: string;
  title?: string | null;
  destination?: string | null;
  travelDateFrom?: string | null;
  travelDateTo?: string | null;
  status: string;
  amount: number;
  clientName: string;
  tenantName?: string;
  commissionAmount: number | null;
  commissionStatus: string | null;
}

export interface PortalAgentCommissions {
  pendingTotal: number;
  paidTotal: number;
  bookingCount: number;
  items: PortalAgentBooking[];
}

export interface PortalPurchaseOrder {
  id: string;
  description: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: string;
  dueDate?: string | null;
  createdAt: string;
  tenantName?: string;
}

export const portalApi = {
  requestMagicLink: (email: string) =>
    req<{ ok: true }>("/portal/auth/request-link", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  verify: (token: string) =>
    req<PortalSession>("/portal/auth/verify", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
  me: () => req<PortalSession>("/portal/auth/me"),
  bookings: () => req<PortalBooking[]>("/portal/bookings"),
  bookingDetail: (id: string) => req<PortalBookingDetail>(`/portal/bookings/${id}`),
  agentBookings: () => req<PortalAgentBooking[]>("/portal/agent/bookings"),
  agentCommissions: () => req<PortalAgentCommissions>("/portal/agent/commissions"),
  purchaseOrders: () => req<PortalPurchaseOrder[]>("/portal/purchase-orders"),
};
