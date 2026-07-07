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

// ── Customer portal shapes ──
export interface PortalDashboard {
  totalBookings?: number;
  upcomingCount?: number;
  totalDue?: number;
  totalPaid?: number;
  notificationCount: number;
  recentBookings: PortalBooking[];
}
export interface PortalProfile {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  alternatePhone?: string | null;
  address?: string | null;
  dateOfBirth?: string | null;
  nationality?: string | null;
  emergencyContact?: string | null;
  emergencyPhone?: string | null;
}
export interface PortalPayment {
  id: string;
  amount: number;
  method?: string | null;
  date?: string | null;
  invoiceNumber?: string | null;
}
export interface PortalNotification {
  id: string;
  type: string;
  title?: string;
  message: string;
  date?: string | null;
  severity?: string;
}
export interface PortalDocumentVersion { versionNumber: number; fileName: string; url: string; mimeType?: string; size?: number; uploadedAt?: string }
export interface PortalDocument {
  id: string;
  title: string;
  category: string;
  entityType: string;
  versions: PortalDocumentVersion[];
  createdAt: string;
}
export interface PortalVisa {
  id: string;
  applicantName: string;
  passportNumber?: string | null;
  nationality?: string | null;
  visaType?: string | null;
  destination?: string | null;
  status: string;
  referenceNo?: string | null;
  appliedDate?: string | null;
  appointmentDate?: string | null;
  decisionDate?: string | null;
  expiryDate?: string | null;
  bookingId?: string | null;
}
export interface PortalTicketMessage { authorType: "customer" | "staff"; author?: string; body: string; at: string }
export interface PortalSupportTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  bookingId?: string | null;
  messages?: PortalTicketMessage[] | null;
  createdAt: string;
  updatedAt: string;
}

async function uploadForm<T>(path: string, form: FormData): Promise<T> {
  const token = getPortalToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || "Upload failed");
  }
  return res.json();
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

  // ── Customer ──
  dashboard: () => req<PortalDashboard>("/portal/dashboard"),
  invoices: () => req<PortalInvoiceSummary[]>("/portal/invoices"),
  payments: () => req<PortalPayment[]>("/portal/payments"),
  notifications: () => req<PortalNotification[]>("/portal/notifications"),
  getProfile: () => req<PortalProfile>("/portal/profile"),
  updateProfile: (data: Partial<PortalProfile>) =>
    req<PortalProfile>("/portal/profile", { method: "PATCH", body: JSON.stringify(data) }),
  bookingDocuments: (bookingId: string) => req<PortalDocument[]>(`/portal/bookings/${bookingId}/documents`),
  uploadDocument: (bookingId: string, file: File, meta: { title?: string; category?: string } = {}) => {
    const form = new FormData();
    form.append("file", file);
    if (meta.title) form.append("title", meta.title);
    if (meta.category) form.append("category", meta.category);
    return uploadForm<PortalDocument>(`/portal/bookings/${bookingId}/documents`, form);
  },
  visa: () => req<PortalVisa[]>("/portal/visa"),
  supportTickets: () => req<PortalSupportTicket[]>("/portal/support-tickets"),
  supportTicket: (id: string) => req<PortalSupportTicket>(`/portal/support-tickets/${id}`),
  createSupportTicket: (data: { subject: string; message?: string; bookingId?: string; priority?: string; category?: string }) =>
    req<PortalSupportTicket>("/portal/support-tickets", { method: "POST", body: JSON.stringify(data) }),
  replySupportTicket: (id: string, body: string) =>
    req<PortalSupportTicket>(`/portal/support-tickets/${id}/messages`, { method: "POST", body: JSON.stringify({ body }) }),
};

// Absolute URL for a portal file (documents/tickets served from /uploads).
export function portalFileUrl(url: string): string {
  if (/^https?:\/\//.test(url)) return url;
  const apiRoot = BASE_URL.replace(/\/api\/?$/, "");
  return `${apiRoot}${url.startsWith("/") ? "" : "/"}${url}`;
}
