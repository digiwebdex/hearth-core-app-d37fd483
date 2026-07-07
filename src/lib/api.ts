import { API_BASE_URL } from "@/lib/apiConfig";
// API service layer — point BASE_URL to your VPS backend
const BASE_URL = API_BASE_URL;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token");
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    let message = res.statusText || "Request failed";
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { message?: string; error?: string };
        message = parsed.message || parsed.error || message;
      } catch {
        if (!raw.trimStart().startsWith("<")) message = raw.slice(0, 200) || message;
      }
    }
    throw new Error(message);
  }
  return res.json();
}

// ── Generic CRUD factory ──
function createCrudApi<T extends { id: string }>(resource: string) {
  return {
    list: () => request<T[]>(`/${resource}`),
    get: (id: string) => request<T>(`/${resource}/${id}`),
    create: (data: Omit<T, "id" | "tenantId" | "createdAt">) =>
      request<T>(`/${resource}`, { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<T>) =>
      request<T>(`/${resource}/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<void>(`/${resource}/${id}`, { method: "DELETE" }),
  };
}

// ── Auth ──
export const authApi = {
  login: (email: string, password: string, totpCode?: string) =>
    request<{ token: string; user: User; requires2FA?: boolean }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, ...(totpCode ? { totpCode } : {}) }),
    }),
  totpSetup: () =>
    request<{ secret: string; qrDataUrl: string }>("/auth/totp/setup"),
  totpEnable: (code: string) =>
    request<{ message: string }>("/auth/totp/enable", { method: "POST", body: JSON.stringify({ code }) }),
  totpDisable: (code: string) =>
    request<{ message: string }>("/auth/totp/disable", { method: "POST", body: JSON.stringify({ code }) }),
  totpStatus: () =>
    request<{ totpEnabled: boolean }>("/auth/totp/status"),
  register: (data: { name: string; email: string; phone: string; whatsapp?: string; whatsappVerifyToken?: string; password: string; tenantName: string; plan?: string; enabledSubcategories?: string[]; enabledServiceTypes?: string[] }) =>
    request<{ token?: string; user?: User; tenant?: Tenant; pendingApproval?: boolean; message?: string; trialDays?: number; intendedPlan?: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  checkEmail: (email: string) =>
    request<{ available: boolean; email?: string; message?: string }>(`/auth/check-email?email=${encodeURIComponent(email)}`),
  sendWhatsappOtp: (whatsapp: string) =>
    request<{ sent: boolean; delivered: boolean; whatsapp: string; expiresInSec: number; message: string }>("/auth/whatsapp-otp/send", {
      method: "POST",
      body: JSON.stringify({ whatsapp }),
    }),
  verifyWhatsappOtp: (whatsapp: string, code: string) =>
    request<{ verified: boolean; whatsapp: string; whatsappVerifyToken: string }>("/auth/whatsapp-otp/verify", {
      method: "POST",
      body: JSON.stringify({ whatsapp, code }),
    }),
  me: () => request<User>("/auth/me"),
  forgotPassword: (email: string) =>
    request<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, password: string) =>
    request<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),
  verifyEmail: (token: string) =>
    request<{ message: string; email: string }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
  resendVerification: () =>
    request<{ message: string }>("/auth/resend-verification", { method: "POST" }),
  logout: () =>
    request<{ message: string }>("/auth/logout", { method: "POST" }).catch(() => {}),
};

// ── Tenants ──
export const tenantApi = {
  get: () => request<Tenant>("/tenants/me"),
  update: (data: Partial<Tenant>) =>
    request<Tenant>("/tenants/me", { method: "PATCH", body: JSON.stringify(data) }),
  completeOnboarding: () => request<{ onboardingCompletedAt: string }>("/tenants/me/complete-onboarding", { method: "POST" }),
  getMembers: () => request<User[]>("/tenants/me/members"),
  inviteMember: (email: string, role: string, name?: string, branchId?: string) =>
    request<User>("/tenants/me/members", {
      method: "POST",
      body: JSON.stringify({ email, role, name, branchId }),
    }),
  removeMember: (userId: string) =>
    request<void>(`/tenants/me/members/${userId}`, { method: "DELETE" }),
  updateMember: (userId: string, data: { role?: string; name?: string; branchId?: string | null }) =>
    request<User>(`/tenants/me/members/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};

// ── Dashboard Stats ──
export interface DashboardStats {
  totalUsers: number;
  totalClients: number;
  totalBookings: number;
  totalRevenue: number;
  recentBookings: Booking[];
  recentPayments: Payment[];
  activeLeads: number;
  followUpsDueToday: number;
  quotationsSentThisMonth: number;
  quotationsAwaitingApproval: number;
  confirmedBookings: number;
  upcomingDepartures: number;
  overdueInvoices: number;
  overdueInvoiceAmount: number;
  vendorDues: number;
  salesThisMonth: number;
  topDestinations: { destination: string; count: number }[];
  bookingsByType?: { type: string; count: number }[];
  openSupportTickets?: number;
  passportsExpiringSoon?: number;
  passportsExpired?: number;
}

export const dashboardApi = {
  getStats: () => request<DashboardStats>("/dashboard/stats"),
};

// ── Resource APIs ──
export const clientApi = {
  ...createCrudApi<Client>("clients"),
  getBookings: (id: string) => request<Booking[]>(`/clients/${id}/bookings`),
  getInvoices: (id: string) => request<Invoice[]>(`/clients/${id}/invoices`),
  getPayments: (id: string) => request<Payment[]>(`/clients/${id}/payments`),
  getCorporateSummary: (month?: string) =>
    request<CorporateSummary>(`/clients/corporate-summary${month ? `?month=${month}` : ""}`),
  getExpiringPassports: (days = 30, includeExpired = true) =>
    request<ExpiringPassportsResponse>(
      `/clients/expiring-passports?days=${days}&includeExpired=${includeExpired ? "true" : "false"}`,
    ),
  uploadDocument: (id: string, data: FormData) =>
    fetch(`${API_BASE_URL}/clients/${id}/documents`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      body: data,
    }).then((r) => r.json()),
  getFamily: (id: string) => request<ClientFamilyMember[]>(`/clients/${id}/family`),
  addFamily: (id: string, data: Partial<ClientFamilyMember>) =>
    request<ClientFamilyMember>(`/clients/${id}/family`, { method: "POST", body: JSON.stringify(data) }),
  deleteFamily: (id: string, memberId: string) =>
    request<void>(`/clients/${id}/family/${memberId}`, { method: "DELETE" }),
  getWallet: (id: string) => request<{ balance: number; transactions: WalletTransaction[] }>(`/clients/${id}/wallet`),
  adjustWallet: (id: string, data: { amount: number; type: "credit" | "debit"; note?: string }) =>
    request<{ balance: number; transaction: WalletTransaction }>(`/clients/${id}/wallet`, { method: "POST", body: JSON.stringify(data) }),
  getBirthdays: (days = 30) => request<ClientBirthday[]>(`/clients/birthdays?days=${days}`),
};
export interface ClientFamilyMember { id: string; clientId: string; name: string; relation: string; passportNumber?: string; dateOfBirth?: string; createdAt: string }
export interface WalletTransaction { id: string; clientId: string; type: "credit" | "debit"; amount: number; balance: number; note?: string; createdAt: string }
export interface ClientBirthday { id: string; name: string; phone?: string; date?: string; inDays: number }
export interface AgentTransaction { id: string; agentId: string; type: "deposit" | "payment" | "adjustment"; amount: number; balance: number; method?: string; note?: string; createdAt: string }
export const agentApi = {
  ...createCrudApi<Agent>("agents"),
  getMe: () => request<Agent | null>("/agents/me"),
  getSummary: (id: string) => request<AgentSummary>(`/agents/${id}/summary`),
  getLedger: (id: string) => request<{ balance: number; transactions: AgentTransaction[] }>(`/agents/${id}/ledger`),
  addLedger: (id: string, data: { type: "deposit" | "payment" | "adjustment"; amount: number; method?: string; note?: string }) =>
    request<{ balance: number; transaction: AgentTransaction }>(`/agents/${id}/ledger`, { method: "POST", body: JSON.stringify(data) }),
};

export interface VisaStock {
  id: string; visaType: string; country?: string; duration?: string; sponsorId?: string; visaId?: string;
  occupation?: string; buyingPrice: number; sellingPrice: number; profit: number;
  status: "available" | "processing" | "sold" | "completed"; buyerName?: string; agentId?: string; notes?: string;
  tenantId: string; createdAt: string; updatedAt?: string;
}
export interface VisaStockStats { total: number; available: number; processing: number; sold: number; completed: number; stockValue: number; soldProfit: number }
export const visaStockApi = {
  ...createCrudApi<VisaStock>("visa-stock"),
  getStats: () => request<VisaStockStats>("/visa-stock/stats"),
  sell: (id: string, data: { buyerName?: string; sellingPrice?: number; agentId?: string }) =>
    request<VisaStock>(`/visa-stock/${id}/sell`, { method: "POST", body: JSON.stringify(data) }),
};
export const vendorApi = {
  ...createCrudApi<Vendor>("vendors"),
  getBills: (id: string) => request<VendorBill[]>(`/vendors/${id}/bills`),
  addBill: (id: string, data: Omit<VendorBill, "id" | "createdAt">) =>
    request<VendorBill>(`/vendors/${id}/bills`, { method: "POST", body: JSON.stringify(data) }),
  updateBill: (id: string, billId: string, data: Partial<VendorBill>) =>
    request<VendorBill>(`/vendors/${id}/bills/${billId}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteBill: (id: string, billId: string) =>
    request<void>(`/vendors/${id}/bills/${billId}`, { method: "DELETE" }),
  addBillPayment: (id: string, billId: string, data: { amount: number; method: string; reference?: string; date: string; notes?: string }) =>
    request<VendorBillPayment>(`/vendors/${id}/bills/${billId}/payments`, { method: "POST", body: JSON.stringify(data) }),
  getNotes: (id: string) => request<VendorNote[]>(`/vendors/${id}/notes`),
  addNote: (id: string, data: { content: string; type?: string }) =>
    request<VendorNote>(`/vendors/${id}/notes`, { method: "POST", body: JSON.stringify(data) }),
  getPayableReport: () => request<VendorBill[]>("/vendors/reports/payables"),
};
export interface Complaint {
  id: string; subject: string; description?: string;
  clientId?: string; clientName?: string; bookingId?: string;
  category: string; priority: "low" | "medium" | "high";
  status: "open" | "in_progress" | "resolved" | "closed";
  assignedTo?: string; resolution?: string; resolvedAt?: string;
  feedback?: string; rating?: number;
  createdBy?: string; tenantId: string; createdAt: string; updatedAt?: string;
}
export interface ComplaintStats { open: number; in_progress: number; resolved: number; closed: number; total: number }
export const complaintApi = {
  ...createCrudApi<Complaint>("complaints"),
  getStats: () => request<ComplaintStats>("/complaints/stats"),
};

export interface Campaign {
  id: string; name: string;
  channel: "sms" | "email" | "whatsapp";
  subject?: string; body: string;
  audienceType: "all" | "tag" | "clientType"; audienceValue?: string;
  status: "draft" | "sent";
  recipientCount: number; sentCount: number; failedCount: number;
  sentAt?: string; createdBy?: string; tenantId: string; createdAt: string; updatedAt?: string;
}
export const campaignApi = {
  ...createCrudApi<Campaign>("campaigns"),
  audiencePreview: (type: string, value: string, channel: string) =>
    request<{ count: number }>(`/campaigns/audience-preview?type=${encodeURIComponent(type)}&value=${encodeURIComponent(value)}&channel=${encodeURIComponent(channel)}`),
  send: (id: string) => request<Campaign>(`/campaigns/${id}/send`, { method: "POST" }),
};

export interface CrmAnalytics {
  leads: { total: number; won: number; lost: number; conversionRate: number; lostRate: number; funnel: Array<{ status: string; count: number; pct: number }> };
  bySource: Array<{ source: string; total: number; won: number; value: number; conversion: number }>;
  byAssignee: Array<{ userId: string; name: string; total: number; won: number; conversion: number }>;
  retention: { totalCustomers: number; repeatCustomers: number; repeatRate: number };
  complaints: { total: number; open: number; resolved: number; avgRating: number | null };
  campaigns: { total: number; messagesSent: number };
}
export const crmAnalyticsApi = {
  get: (from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    const qs = q.toString();
    return request<CrmAnalytics>(`/crm-analytics${qs ? `?${qs}` : ""}`);
  },
};

export interface CrmCustomField { key: string; label: string; type: "text" | "number" | "date" | "select"; appliesTo: "client" | "lead"; options?: string[] }
export interface CrmConfig {
  id: string; tenantId: string;
  leadSources: string[]; followUpTypes: string[]; complaintCategories: string[];
  customFields: CrmCustomField[];
  automations: { leadWonCreateTask?: boolean; complaintNotifyOwner?: boolean };
}
export const crmSettingsApi = {
  get: () => request<CrmConfig>("/crm-settings"),
  update: (data: Partial<CrmConfig>) => request<CrmConfig>("/crm-settings", { method: "PATCH", body: JSON.stringify(data) }),
};

export const leadApi = {
  ...createCrudApi<Lead>("leads"),
  updateStatus: (id: string, status: string) =>
    request<Lead>(`/leads/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  getActivities: (id: string) => request<LeadActivity[]>(`/leads/${id}/activities`),
  addActivity: (id: string, data: { type: string; content: string }) =>
    request<LeadActivity>(`/leads/${id}/activities`, { method: "POST", body: JSON.stringify(data) }),
  convertToClient: (id: string) => request<Client>(`/leads/${id}/convert`, { method: "POST" }),
  getQuotations: (id: string) => request<Quotation[]>(`/leads/${id}/quotations`).catch(() => []),
  checkDuplicateClient: (email: string, phone: string) =>
    request<{ exists: boolean; client?: Client }>(`/leads/check-duplicate?email=${encodeURIComponent(email)}&phone=${encodeURIComponent(phone)}`).catch(() => ({ exists: false })),
  getPipelineStats: () =>
    request<LeadPipelineStats>("/leads/pipeline-stats"),
};

export interface LeadPipelineStats {
  total: number;
  won: number;
  lost: number;
  active: number;
  conversionRate: string;
  byStage: Array<{ status: string; count: number }>;
  bySource: Array<{ source: string; total: number; won: number; conversionRate: string }>;
}

export interface HubDocument {
  id: string;
  source: "client" | "booking";
  sourceId: string;
  sourceLabel: string;
  name: string;
  type: string;
  url: string;
  uploadedAt: string;
}

export const documentHubApi = {
  list: () => request<HubDocument[]>("/documents"),
};
export const taskApi = createCrudApi<Task>("tasks");

// ── Branches (core tenant-scoped ERP entity; plan-limited) ──
export interface Branch {
  id: string;
  tenantId: string;
  name: string;
  code?: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { users: number };
}
export const branchApi = {
  ...createCrudApi<Branch>("branches"),
  setPrimary: (id: string) => request<Branch>(`/branches/${id}/primary`, { method: "PATCH" }),
};

export type SupportTicketStatus = "open" | "assigned" | "in_progress" | "resolved" | "closed";
export type SupportTicketPriority = "low" | "medium" | "high" | "urgent";

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  category: string;
  source: string;
  clientId?: string | null;
  bookingId?: string | null;
  assignedTo?: string | null;
  createdBy?: string | null;
  resolutionNotes?: string | null;
  resolvedAt?: string | null;
  clientName?: string;
  clientPhone?: string;
  assigneeName?: string;
  creatorName?: string;
  client?: { id: string; name: string; phone?: string; email?: string };
  booking?: { id: string; title?: string; type?: string };
  createdAt: string;
  updatedAt?: string;
}

export const supportTicketApi = {
  list: (params?: { status?: string; assignedTo?: string; clientId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.assignedTo) qs.set("assignedTo", params.assignedTo);
    if (params?.clientId) qs.set("clientId", params.clientId);
    const q = qs.toString();
    return request<SupportTicket[]>(`/support-tickets${q ? `?${q}` : ""}`);
  },
  get: (id: string) => request<SupportTicket>(`/support-tickets/${id}`),
  create: (data: Partial<SupportTicket>) =>
    request<SupportTicket>("/support-tickets", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<SupportTicket>) =>
    request<SupportTicket>(`/support-tickets/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  assign: (id: string, assignedTo: string | null) =>
    request<SupportTicket>(`/support-tickets/${id}/assign`, {
      method: "POST",
      body: JSON.stringify({ assignedTo }),
    }),
  resolve: (id: string, resolutionNotes?: string) =>
    request<SupportTicket>(`/support-tickets/${id}/resolve`, {
      method: "POST",
      body: JSON.stringify({ resolutionNotes }),
    }),
  delete: (id: string) => request<{ success: boolean }>(`/support-tickets/${id}`, { method: "DELETE" }),
};

export interface BlogPost {
  id: string;
  tenantId: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverImage?: string | null;
  status: "draft" | "published";
  publishedAt?: string | null;
  authorName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const blogApi = {
  list: (status?: string) =>
    request<BlogPost[]>(`/blogs${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  get: (id: string) => request<BlogPost>(`/blogs/${id}`),
  create: (data: Partial<BlogPost>) =>
    request<BlogPost>("/blogs", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<BlogPost>) =>
    request<BlogPost>(`/blogs/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) => request<{ success: boolean }>(`/blogs/${id}`, { method: "DELETE" }),
};

export interface StaffProfile {
  id: string;
  userId: string;
  tenantId: string;
  jobTitle?: string | null;
  department?: string | null;
  joinDate?: string | null;
  emergencyContact?: string | null;
  emergencyPhone?: string | null;
  notes?: string | null;
}

export interface StaffMemberRow {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string | null;
  status: string;
  createdAt: string;
  profile: StaffProfile | null;
}

export type AttendanceStatus = "present" | "absent" | "half_day" | "remote" | "on_leave";
export type LeaveType = "annual" | "sick" | "unpaid" | "other";
export type LeaveStatus = "pending" | "approved" | "rejected";

export interface StaffAttendanceRow {
  id: string;
  userId: string;
  date: string;
  status: AttendanceStatus;
  checkIn?: string | null;
  checkOut?: string | null;
  notes?: string | null;
  userName?: string;
}

export interface StaffLeaveRow {
  id: string;
  userId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveStatus;
  userName?: string;
  reviewerName?: string;
  reviewNotes?: string | null;
  createdAt: string;
}

export const hrmApi = {
  listProfiles: () => request<StaffMemberRow[]>("/hrm/profiles"),
  upsertProfile: (userId: string, data: Partial<StaffProfile>) =>
    request<StaffProfile>(`/hrm/profiles/${userId}`, { method: "PUT", body: JSON.stringify(data) }),
  listAttendance: (date: string) =>
    request<StaffAttendanceRow[]>(`/hrm/attendance?date=${encodeURIComponent(date)}`),
  markAttendance: (data: { userId: string; date: string; status: AttendanceStatus; checkIn?: string; checkOut?: string; notes?: string }) =>
    request<StaffAttendanceRow>("/hrm/attendance", { method: "POST", body: JSON.stringify(data) }),
  listLeave: (status?: string) =>
    request<StaffLeaveRow[]>(`/hrm/leave${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  createLeave: (data: { startDate: string; endDate: string; leaveType?: LeaveType; reason?: string }) =>
    request<StaffLeaveRow>("/hrm/leave", { method: "POST", body: JSON.stringify(data) }),
  reviewLeave: (id: string, status: "approved" | "rejected", reviewNotes?: string) =>
    request<StaffLeaveRow>(`/hrm/leave/${id}/review`, {
      method: "PATCH",
      body: JSON.stringify({ status, reviewNotes }),
    }),
};

export const bookingApi = {
  ...createCrudApi<Booking>("bookings"),
  list: (params?: BookingListParams) => {
    const qs = new URLSearchParams();
    if (params?.type) qs.set("type", params.type);
    if (params?.opsStatus) qs.set("opsStatus", params.opsStatus);
    if (params?.status) qs.set("status", params.status);
    if (params?.limit != null) qs.set("limit", String(params.limit));
    if (params?.offset != null) qs.set("offset", String(params.offset));
    const query = qs.toString();
    return request<Booking[]>(`/bookings${query ? `?${query}` : ""}`);
  },
  updateStatus: (id: string, status: BookingStatus) => request<Booking>(`/bookings/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  getFollowUps: () => request<BookingFollowUps>(`/bookings/board/follow-ups`),
  updateFollowUp: (id: string, data: { followUpDate?: string | null; followUpNote?: string | null; status?: BookingStatus }) =>
    request<Booking>(`/bookings/${id}/follow-up`, { method: "PATCH", body: JSON.stringify(data) }),
  getSegments: (id: string) => request<BookingSegment[]>(`/bookings/${id}/segments`),
  addSegment: (id: string, data: Omit<BookingSegment, "id">) => request<BookingSegment>(`/bookings/${id}/segments`, { method: "POST", body: JSON.stringify(data) }),
  deleteSegment: (id: string, segId: string) => request<void>(`/bookings/${id}/segments/${segId}`, { method: "DELETE" }),
  getTravelers: (id: string) => request<BookingTraveler[]>(`/bookings/${id}/travelers`),
  addTraveler: (id: string, data: Omit<BookingTraveler, "id">) => request<BookingTraveler>(`/bookings/${id}/travelers`, { method: "POST", body: JSON.stringify(data) }),
  deleteTraveler: (id: string, tId: string) => request<void>(`/bookings/${id}/travelers/${tId}`, { method: "DELETE" }),
  getChecklist: (id: string) => request<BookingChecklistItem[]>(`/bookings/${id}/checklist`),
  updateChecklistItem: (id: string, itemId: string, done: boolean) => request<BookingChecklistItem>(`/bookings/${id}/checklist/${itemId}`, { method: "PATCH", body: JSON.stringify({ done }) }),
  addChecklistItem: (id: string, data: { label: string }) => request<BookingChecklistItem>(`/bookings/${id}/checklist`, { method: "POST", body: JSON.stringify(data) }),
  getTimeline: (id: string) => request<BookingTimelineEvent[]>(`/bookings/${id}/timeline`),
  addTimelineEvent: (id: string, data: { type: string; content: string }) => request<BookingTimelineEvent>(`/bookings/${id}/timeline`, { method: "POST", body: JSON.stringify(data) }),
  getDocuments: (id: string) => request<BookingDocument[]>(`/bookings/${id}/documents`),
  uploadDocument: (id: string, data: FormData) =>
    fetch(`${API_BASE_URL}/bookings/${id}/documents`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      body: data,
    }).then((r) => r.json()),
  deleteDocument: (id: string, docId: string) => request<void>(`/bookings/${id}/documents/${docId}`, { method: "DELETE" }),
  markCommissionPaid: (id: string) =>
    request<Booking>(`/bookings/${id}/commission`, { method: "PATCH", body: JSON.stringify({ status: "paid" }) }),
};
export const invoiceApi = {
  ...createCrudApi<Invoice>("invoices"),
  updateStatus: (id: string, status: InvoiceStatus) => request<Invoice>(`/invoices/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  getPayments: (id: string) => request<Payment[]>(`/invoices/${id}/payments`),
  addPayment: (id: string, data: Omit<Payment, "id" | "createdAt">) => request<Payment>(`/invoices/${id}/payments`, { method: "POST", body: JSON.stringify(data) }),
  deletePayment: (id: string, payId: string) => request<void>(`/invoices/${id}/payments/${payId}`, { method: "DELETE" }),
  addRefund: (id: string, data: { amount: number; reason: string; method?: string }) => request<InvoiceRefund>(`/invoices/${id}/refunds`, { method: "POST", body: JSON.stringify(data) }),
  getRefunds: (id: string) => request<InvoiceRefund[]>(`/invoices/${id}/refunds`),
  getAuditTrail: (id: string) => request<InvoiceAuditEvent[]>(`/invoices/${id}/audit`),
  getInstallments: (id: string) => request<InvoiceInstallment[]>(`/invoices/${id}/installments`),
  addInstallment: (id: string, data: { label: string; amount: number; dueDate?: string; sortOrder?: number }) =>
    request<InvoiceInstallment>(`/invoices/${id}/installments`, { method: "POST", body: JSON.stringify(data) }),
  deleteInstallment: (id: string, instId: string) =>
    request<void>(`/invoices/${id}/installments/${instId}`, { method: "DELETE" }),
  uploadProof: (id: string, payId: string, data: FormData) =>
    fetch(`${API_BASE_URL}/invoices/${id}/payments/${payId}/proof`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      body: data,
    }).then((r) => r.json()),
};
export const financeApi = {
  getReminders: () => request<FinanceRemindersPayload>("/finance/reminders"),
  sendInvoiceReminder: (invoiceId: string) =>
    request<{ success: boolean }>(`/finance/reminders/${invoiceId}/send`, { method: "POST" }),
  getPL: (from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    return request<PLReport>(`/finance/pl?${q}`);
  },
  getBalanceSheet: () => request<BalanceSheet>("/finance/balance-sheet"),
  getCashFlow: (from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    return request<CashFlowReport>(`/finance/cash-flow?${q}`);
  },
  getTaxReport: (from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    return request<TaxReport>(`/finance/tax-report?${q}`);
  },
};

// ── Tax Rules API ──
export const taxRuleApi = {
  list: () => request<TaxRule[]>("/tax-rules"),
  create: (data: Omit<TaxRule, "id" | "tenantId" | "createdAt" | "updatedAt">) =>
    request<TaxRule>("/tax-rules", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<TaxRule>) =>
    request<TaxRule>(`/tax-rules/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/tax-rules/${id}`, { method: "DELETE" }),
  getDefault: () => request<TaxRule | null>("/tax-rules/default"),
};

// ── Payroll API ──
export const payrollApi = {
  getSalaryStructure: (staffProfileId: string) =>
    request<SalaryStructure | null>(`/payroll/salary-structures/${staffProfileId}`),
  upsertSalaryStructure: (staffProfileId: string, data: Partial<SalaryStructure>) =>
    request<SalaryStructure>(`/payroll/salary-structures/${staffProfileId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listRuns: () => request<PayrollRun[]>("/payroll/runs"),
  createRun: (data: { month: string; year: number; notes?: string }) =>
    request<PayrollRun>("/payroll/runs", { method: "POST", body: JSON.stringify(data) }),
  getRun: (id: string) => request<PayrollRun>(`/payroll/runs/${id}`),
  updateRun: (id: string, data: { status: string }) =>
    request<PayrollRun>(`/payroll/runs/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  payPayslip: (id: string, data: { paymentMethod: string; paymentReference?: string }) =>
    request<PayslipEntry>(`/payroll/payslips/${id}/pay`, { method: "PATCH", body: JSON.stringify(data) }),
};
export const paymentApi = createCrudApi<Payment>("payments");
export const accountApi = {
  ...createCrudApi<Account>("accounts"),
  getSummary: () => request<AccountsSummary>("/accounts/summary"),
  getLedger: (params?: Record<string, string>) => {
    const query = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<Transaction[]>(`/accounts/ledger${query}`);
  },
  getProfitability: () => request<BookingProfitability[]>("/accounts/profitability"),
};
export const transactionApi = createCrudApi<Transaction>("transactions");
export const expenseApi = {
  ...createCrudApi<Expense>("expenses"),
  approve: (id: string) => request<Expense>(`/expenses/${id}/approve`, { method: "POST" }),
  reject: (id: string, reason: string) => request<Expense>(`/expenses/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
};
export const subscriptionApi = createCrudApi<Subscription>("subscriptions");
export const paymentRequestApi = createCrudApi<PaymentRequest>("payment-requests");

// ── Quotation API ──
export const quotationApi = {
  ...createCrudApi<Quotation>("quotations"),
  updateStatus: (id: string, status: QuotationStatus) => request<Quotation>(`/quotations/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  getVersions: (id: string) => request<QuotationVersion[]>(`/quotations/${id}/versions`),
  duplicate: (id: string) => request<Quotation>(`/quotations/${id}/duplicate`, { method: "POST" }),
  convertToBooking: (id: string) => request<Booking>(`/quotations/${id}/convert-to-booking`, { method: "POST" }),
};

// ── Types ──
export interface User { id: string; name: string; email: string; role: "super_admin" | "tenant_owner" | "manager" | "sales_agent" | "accountant" | "operations" | "owner" | "admin" | "member"; tenantId: string; branchId?: string | null; branch?: { id: string; name: string } | null; emailVerified?: boolean; createdAt: string; }
export interface Tenant {
  id: string;
  name: string;
  slug?: string;
  ownerId: string;
  phone?: string;
  whatsapp?: string;
  website?: string;
  address?: string;
  city?: string;
  country?: string;
  logo?: string;
  currency?: string;
  timezone?: string;
  subscriptionPlan: "free" | "basic" | "pro" | "business" | "enterprise";
  subscriptionExpiry?: string;
  subscriptionStatus?: "active" | "trial" | "expired" | "cancelled" | "pending" | "suspended" | "overdue";
  enableHajjUmrahModule?: boolean;
  enableBdOperationsModule?: boolean;
  enabledServiceTypes?: string[];
  enabledSubcategories?: string[];
  enabledModules?: string[];
  createdAt: string;
  trialDaysConfigured?: number;
}
export interface Client { id: string; name: string; phone: string; email: string; alternatePhone?: string; address?: string; dateOfBirth?: string; passportNumber?: string; passportExpiry?: string; nidNumber?: string; nationality?: string; emergencyContact?: string; emergencyPhone?: string; notes?: string; tags?: string[]; documents?: ClientDocument[]; companyName?: string; clientType?: "individual" | "corporate"; walletBalance?: number; creditLimit?: number; contractRef?: string; contractExpiry?: string; customFields?: Record<string, string>; tenantId: string; createdAt: string; updatedAt?: string; }
export interface ClientDocument { id: string; clientId: string; name: string; type: string; url: string; uploadedAt: string; }
export interface CorporateSummaryRow {
  clientId: string;
  name: string;
  companyName: string;
  email: string;
  phone: string;
  month: string;
  invoiceCount: number;
  monthTotal: number;
  monthPaid: number;
  monthDue: number;
  openInvoices: number;
}
export interface CorporateSummary {
  month: string;
  clients: CorporateSummaryRow[];
  totals: {
    clients: number;
    invoiceCount: number;
    monthTotal: number;
    monthPaid: number;
    monthDue: number;
  };
}

export interface ExpiringPassportClient {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  passportNumber?: string | null;
  passportExpiry?: string | null;
  nationality?: string | null;
  daysLeft: number;
  status: "expiring" | "expired";
}

export interface ExpiringPassportsResponse {
  windowDays: number;
  summary: { expiring: number; expired: number; total: number };
  items: ExpiringPassportClient[];
}
export type AgentStatus = "active" | "inactive";
export type AgentCommissionStatus = "pending" | "paid";

export interface Agent {
  id: string;
  name: string;
  phone: string;
  email: string;
  commissionRate: number;
  status: AgentStatus;
  address?: string;
  balance?: number;
  userId?: string | null;
  tenantId: string;
  createdAt: string;
  updatedAt?: string;
  totalBookings?: number;
  totalRevenue?: number;
  pendingCommission?: number;
  paidCommission?: number;
}

export interface AgentSummaryBooking {
  id: string;
  title?: string | null;
  amount: number;
  status: string;
  travelDateFrom?: string | null;
  clientName: string;
  agentCommissionAmount?: number | null;
  agentCommissionStatus?: AgentCommissionStatus | null;
}

export interface AgentSummary {
  agent: Agent;
  totalBookings: number;
  totalRevenue: number;
  pendingCommission: number;
  paidCommission: number;
  recentBookings: AgentSummaryBooking[];
}
export type VendorCategory = "hotel" | "airline" | "transport" | "visa_partner" | "guide" | "tour_operator" | "other";
export type VendorBillStatus = "unpaid" | "partial" | "paid" | "overdue";
export interface Vendor { id: string; name: string; phone: string; email: string; category: VendorCategory; contactPerson?: string; address?: string; serviceAreas?: string; website?: string; bankDetails?: string; notes?: string; status: "active" | "inactive"; tenantId: string; createdAt: string; updatedAt?: string; }
export interface VendorBill { id: string; vendorId: string; vendorName?: string; bookingId?: string; bookingTitle?: string; segmentId?: string; description: string; totalAmount: number; paidAmount: number; dueAmount: number; status: VendorBillStatus; dueDate?: string; invoiceRef?: string; notes?: string; payments?: VendorBillPayment[]; tenantId: string; createdAt: string; updatedAt?: string; }
export interface VendorBillPayment { id: string; billId: string; amount: number; method: string; reference?: string; date: string; notes?: string; paidBy?: string; paidByName?: string; createdAt: string; }
export interface VendorNote { id: string; vendorId: string; type: "note" | "call" | "email" | "meeting" | "issue"; content: string; createdBy?: string; createdByName?: string; createdAt: string; }
export type LeadStatus = "new" | "contacted" | "qualified" | "quoted" | "won" | "lost";
export interface Lead { id: string; name: string; phone: string; email: string; status: LeadStatus; source?: string; destination?: string; travelDateFrom?: string; travelDateTo?: string; travelerCount?: number; budget?: number; score?: number; assignedTo?: string; assignedToName?: string; nextFollowUp?: string; notes?: string; tags?: string[]; tenantId: string; createdAt: string; updatedAt?: string; }
export interface LeadActivity { id: string; leadId: string; type: "note" | "status_change" | "follow_up" | "call" | "whatsapp" | "email" | "meeting"; content: string; oldStatus?: LeadStatus; newStatus?: LeadStatus; createdBy?: string; createdByName?: string; createdAt: string; }
export interface Task { id: string; title: string; description: string; status: "todo" | "in_progress" | "done"; priority: "low" | "medium" | "high"; dueDate?: string; assignedTo?: string; tenantId: string; createdAt: string; }
export type BookingStatus = "inquiry" | "pending" | "confirmed" | "ticketed" | "traveling" | "completed" | "cancelled";
export interface BookingFollowUps {
  due: Booking[];
  upcoming: Booking[];
  noDate: Booking[];
  counts: { due: number; upcoming: number; noDate: number; total: number };
}
export type BookingType = "tour" | "ticket" | "hotel" | "visa" | "package" | "student" | "manpower" | "transport" | "corporate" | "insurance";
export interface BookingListParams {
  type?: BookingType | string;
  opsStatus?: string;
  status?: BookingStatus;
  limit?: number;
  offset?: number;
}
export interface Booking {
  id: string;
  type: BookingType;
  title?: string;
  clientId: string;
  clientName?: string;
  agentId?: string | null;
  agentName?: string;
  agentCommissionAmount?: number | null;
  agentCommissionStatus?: AgentCommissionStatus | null;
  quotationId?: string;
  packageId?: string;
  serviceType?: string;
  packageTitleSnapshot?: string;
  packageCodeSnapshot?: string;
  destination?: string;
  travelDateFrom?: string;
  travelDateTo?: string;
  travelerCount?: number;
  amount: number;
  cost: number;
  profit: number;
  paidAmount?: number;
  dueAmount?: number;
  paymentStatus?: "unpaid" | "partial" | "paid";
  status: BookingStatus;
  assignedTo?: string;
  assignedToName?: string;
  supplierName?: string;
  supplierRef?: string;
  internalNotes?: string;
  serviceDetails?: Record<string, unknown> | null;
  opsStatus?: string;
  followUpDate?: string | null;
  followUpNote?: string | null;
  tenantId: string;
  createdAt: string;
  updatedAt?: string;
  flightNumber?: string;
  airline?: string;
  pnrNumber?: string;
  tourOperator?: string;
  hotelName?: string;
  checkInDate?: string;
  checkOutDate?: string;
  visaCountry?: string;
  passportNumber?: string;
  passportExpiry?: string;
  instituteName?: string;
  courseProgram?: string;
  enrollmentDate?: string;
  workCountry?: string;
  employer?: string;
  jobTitle?: string;
  contractDuration?: string;
  medicalStatus?: string;
  bmetRegistration?: string;
  routeDescription?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  pickupDate?: string;
  pickupTime?: string;
  vehicleType?: string;
  driverName?: string;
  driverPhone?: string;
  transportVendor?: string;
  workflowStatus?: string;
  fromCity?: string;
  toCity?: string;
  confirmationNumber?: string;
  guestCount?: number;
  submissionDate?: string;
  appointmentDate?: string;
  visaType?: string;
  ticketDeadline?: string;
}
export interface BookingSegment { id: string; bookingId?: string; type: "hotel" | "flight" | "transfer" | "visa" | "activity" | "package"; description: string; supplier?: string; supplierRef?: string; startDate?: string; endDate?: string; details?: string; cost: number; sellingPrice: number; status?: "pending" | "confirmed" | "cancelled"; }
export interface BookingTraveler { id: string; bookingId?: string; name: string; passportNumber?: string; passportExpiry?: string; nationality?: string; dateOfBirth?: string; phone?: string; email?: string; notes?: string; }
export interface BookingChecklistItem { id: string; bookingId?: string; label: string; done: boolean; doneAt?: string; doneBy?: string; }
export interface BookingTimelineEvent { id: string; bookingId?: string; type: "status_change" | "note" | "payment" | "document" | "checklist" | "system"; content: string; oldStatus?: string; newStatus?: string; createdBy?: string; createdByName?: string; createdAt: string; }
export interface BookingDocument { id: string; bookingId?: string; name: string; type: string; url: string; uploadedAt: string; uploadedBy?: string; }
export type InvoiceStatus = "unpaid" | "partial" | "paid" | "overdue" | "refunded" | "cancelled";
export type PaymentMethod = "cash" | "bank" | "card" | "mobile_banking" | "cheque" | "online";
export interface Invoice { id: string; invoiceNumber?: string; bookingId: string; bookingTitle?: string; clientId?: string; clientName?: string; totalAmount: number; paidAmount: number; dueAmount: number; refundedAmount?: number; subTotal?: number; taxAmount?: number; taxRate?: number; taxRuleId?: string; status: InvoiceStatus; dueDate?: string; issuedDate?: string; notes?: string; payments?: Payment[]; refunds?: InvoiceRefund[]; auditTrail?: InvoiceAuditEvent[]; tenantId: string; createdAt: string; updatedAt?: string; }
export interface Payment { id: string; invoiceId: string; bookingId: string; amount: number; method: PaymentMethod | string; transactionRef?: string; proofUrl?: string; date: string; notes?: string; receivedBy?: string; tenantId: string; createdAt: string; }
export interface InvoiceRefund { id: string; invoiceId: string; amount: number; reason: string; method?: PaymentMethod | string; processedBy?: string; createdAt: string; }
export interface InvoiceInstallment {
  id: string;
  invoiceId: string;
  label: string;
  amount: number;
  dueDate?: string | null;
  paidAmount: number;
  status: "pending" | "partial" | "paid" | string;
  sortOrder?: number;
  tenantId?: string;
  invoice?: Pick<Invoice, "id" | "invoiceNumber" | "clientName" | "bookingTitle" | "dueAmount">;
}
export interface FinanceRemindersPayload {
  today: string;
  overdueInvoices: Invoice[];
  dueSoonInvoices: Invoice[];
  overdueInstallments: InvoiceInstallment[];
  dueSoonInstallments: InvoiceInstallment[];
  counts: {
    overdueInvoices: number;
    dueSoonInvoices: number;
    overdueInstallments: number;
    dueSoonInstallments: number;
  };
}
export interface InvoiceAuditEvent { id: string; invoiceId: string; type: "status_change" | "payment" | "refund" | "note" | "system"; content: string; oldStatus?: InvoiceStatus; newStatus?: InvoiceStatus; amount?: number; createdBy?: string; createdAt: string; }
export type QuotationStatus = "draft" | "sent" | "approved" | "rejected" | "expired";
export type QuotationItemType = "hotel" | "flight" | "visa" | "transport" | "tour" | "activity" | "insurance" | "service_fee" | "discount" | "tax";
export interface QuotationItem { id: string; type: QuotationItemType; day?: number; description: string; details?: string; supplier?: string; costPrice: number; markupPercent: number; sellingPrice: number; quantity: number; nights?: number; subtotal: number; }
export interface ItineraryDay { dayNumber: number; date?: string; title: string; description: string; meals?: string; accommodation?: string; activities?: string[]; }
export interface Quotation { id: string; title: string; clientId?: string; clientName?: string; leadId?: string; leadName?: string; packageId?: string; serviceType?: string; packageTitleSnapshot?: string; packageCodeSnapshot?: string; destination: string; travelDateFrom?: string; travelDateTo?: string; travelerCount: number; status: QuotationStatus; version: number; items: QuotationItem[]; itinerary: ItineraryDay[]; totalCost: number; totalSelling: number; totalProfit: number; discountAmount: number; taxAmount: number; grandTotal: number; validUntil?: string; notes?: string; termsAndConditions?: string; createdBy?: string; tenantId: string; createdAt: string; updatedAt?: string; }
export interface QuotationVersion { id: string; quotationId: string; versionNumber: number; snapshot: string; changeNote?: string; changedBy?: string; createdAt: string; }
export type AccountType = "cash" | "bank" | "mobile_banking" | "card" | "other";
export interface Account { id: string; name: string; type: AccountType; balance: number; accountNumber?: string; bankName?: string; notes?: string; status: "active" | "inactive"; tenantId: string; createdAt: string; updatedAt?: string; }
export interface Transaction { id: string; accountId?: string; accountName?: string; type: "income" | "expense" | "transfer" | "refund"; category: string; description: string; amount: number; referenceId?: string; referenceType?: string; clientId?: string; bookingId?: string; invoiceId?: string; paymentMethod?: string; status?: "pending" | "completed" | "cancelled"; date: string; tenantId: string; createdBy?: string; createdAt: string; }
export interface BookingProfitability { bookingId: string; title?: string; destination?: string; amount: number; cost: number; profit: number; marginPercent: number; travelDateFrom?: string; clientName?: string; }
export interface AccountsSummary { totalBalance: number; totalIncome: number; totalExpense: number; accounts: Account[]; recentTransactions: Transaction[]; }
export interface Expense { id: string; category: string; description: string; amount: number; date: string; paymentMethod: string; reference?: string; notes?: string; attachmentUrl?: string; vendorId?: string; vendorName?: string; accountId?: string; accountName?: string; approvedBy?: string; status: "pending" | "approved" | "rejected"; tenantId: string; createdBy?: string; createdAt: string; updatedAt?: string; }
export interface Subscription { id: string; tenantId: string; plan: string; startDate: string; endDate: string; status: "active" | "expired" | "scheduled" | string; billingCycle?: string; source?: string; paymentRequestId?: string; note?: string; createdAt: string; updatedAt?: string; }
export interface PaymentRequest { id: string; tenantId: string; plan: string; amount: number; method: string; trxId: string; proofUrl?: string; status: "pending" | "approved" | "rejected" | string; reviewerComment?: string; processedAt?: string; currentPlan?: string; requestedPlan?: string; billingCycle?: string; requestType?: string; paymentMethod?: string; expectedAmount?: number; amountSent?: number; senderAccountOrNumber?: string; transactionId?: string; paymentDate?: string; paymentTime?: string; proofFileName?: string; note?: string; adminNote?: string; rejectionReason?: string; reviewedBy?: string; reviewedAt?: string; activationMode?: string; activationDate?: string; expiryDateAfterApproval?: string; requestSource?: string; createdAt: string; updatedAt?: string; }

// ── Admin types and API ──
export interface PendingUser { id: string; name: string; email: string; role: string; status: string; phone?: string; whatsapp?: string; tenantId: string; tenant?: { id: string; name: string; slug?: string }; createdAt: string; rejectionReason?: string | null; }
export interface AdminStats { totalTenants: number; totalUsers: number; totalBookings: number; totalRevenue: number; }
export interface AdminTenant { id: string; name: string; slug?: string | null; ownerId?: string | null; phone?: string | null; whatsapp?: string | null; address?: string | null; city?: string | null; country?: string | null; website?: string | null; notes?: string | null; subscriptionPlan?: string; subscriptionStatus?: string; subscriptionExpiry?: string | null; enableHajjUmrahModule?: boolean; enableBdOperationsModule?: boolean; enabledServiceTypes?: string[]; enabledSubcategories?: string[]; createdAt: string; updatedAt?: string; users?: Array<{ id: string; name: string; email: string; role: string; phone?: string | null; whatsapp?: string | null; createdAt?: string }>; _count?: { users?: number; bookings?: number; clients?: number; invoices?: number }; }

export interface TrialExpiryAlert {
  tenantId: string;
  tenantName: string;
  ownerName?: string | null;
  ownerEmail?: string | null;
  ownerPhone?: string | null;
  ownerWhatsapp?: string | null;
  subscriptionPlan?: string;
  subscriptionExpiry?: string | null;
  wasTrial: boolean;
  expiredAt?: string | null;
  autoNotified: boolean;
  emailSent: boolean;
  smsSent: boolean;
  whatsappSent: boolean;
  lastNotifyAt?: string | null;
}
export interface AdminPaymentRequest extends PaymentRequest { tenant?: { name?: string }; }

export const adminApi = {
  getStats: () => request<AdminStats>("/admin/stats"),
  getTenants: (opts?: { excludePlatform?: boolean }) =>
    request<AdminTenant[]>(`/admin/tenants${opts?.excludePlatform ? "?excludePlatform=1" : ""}`),
  getTenant: (id: string) => request<AdminTenant>(`/admin/tenants/${id}`),
  createTenant: (data: Record<string, unknown>) => request<{ tenant: AdminTenant }>("/admin/tenants", { method: "POST", body: JSON.stringify(data) }),
  updateTenant: (id: string, data: Record<string, unknown>) => request<AdminTenant>(`/admin/tenants/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  updateTenantOwner: (id: string, data: { name?: string; email?: string; password?: string; phone?: string; whatsapp?: string }) => request<{ id: string; name: string; email: string; role: string }>(`/admin/tenants/${id}/owner`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteTenant: (id: string) => request<{ success: boolean }>(`/admin/tenants/${id}`, { method: "DELETE" }),
  getPaymentRequests: () => request<AdminPaymentRequest[]>("/admin/payment-requests"),
  updatePaymentRequest: (id: string, data: { status: string; reviewerComment?: string }) => request<AdminPaymentRequest>(`/admin/payment-requests/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  getPendingUsers: () => request<PendingUser[]>("/admin/pending-users"),
  approveUser: (id: string) => request<{ success: boolean }>(`/admin/users/${id}/approve`, { method: "POST" }),
  rejectUser: (id: string, reason?: string) => request<{ success: boolean }>(`/admin/users/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
  getTrialExpiryAlerts: () => request<{ items: TrialExpiryAlert[]; total: number }>("/admin/trial-expiry-alerts"),
  sendTrialExpiryNotify: (tenantId: string, channels: ("sms" | "whatsapp" | "email")[]) =>
    request<{ ok: boolean; phone?: string; whatsapp?: string; results?: unknown }>(`/admin/tenants/${tenantId}/trial-expiry-notify`, {
      method: "POST",
      body: JSON.stringify({ channels }),
    }),
  sendBulkTrialExpiryNotify: (tenantIds: string[], channels: ("sms" | "whatsapp" | "email")[]) =>
    request<{ ok: boolean; sent: number; failed: number; total: number; results: Array<{ ok: boolean; tenantId: string; tenantName?: string; error?: string }> }>(
      "/admin/trial-expiry-notify-bulk",
      { method: "POST", body: JSON.stringify({ tenantIds, channels }) },
    ),
  getGatewayStatus: () =>
    request<{
      bkash: { configured: boolean; sandbox: boolean; mode: string };
      sslcommerz: { configured: boolean; sandbox: boolean; mode: string };
      manual: { configured: boolean; methodsEnabled: number };
      apiBaseUrl: string;
      callbacks: {
        sslcommerz: { success: string; fail: string; cancel: string; ipn: string };
        bkash: { callback: string };
      };
      manualMethods: Array<{ methodCode: string; label: string; enabled: boolean; hasAccount: boolean }>;
    }>("/admin/gateway-status"),
};

// ── Domain types and API ──
export interface TenantDomainRecord {
  id: string;
  tenantId: string;
  domain: string;
  wwwRedirect?: string | null;
  verificationToken?: string | null;
  verificationStatus?: "unverified" | "verifying" | "verified" | string;
  status?: "active" | "pending" | "error" | string;
  sslStatus?: "active" | "pending" | "none" | string;
  isPrimary?: boolean;
  lastDnsCheck?: string | null;
  createdAt: string;
  updatedAt?: string;
  tenant?: { id: string; name: string; slug?: string | null; subscriptionPlan?: string | null };
}

export const domainApi = {
  list: () => request<TenantDomainRecord[]>("/admin/domains"),
  create: (data: { tenantId: string; domain: string; wwwRedirect?: string }) => request<TenantDomainRecord>("/admin/domains", { method: "POST", body: JSON.stringify(data) }),
  add: (data: { tenantId: string; domain: string; wwwRedirect?: string }) => request<TenantDomainRecord>("/admin/domains", { method: "POST", body: JSON.stringify(data) }),
  verify: (id: string) => request<{ verified: boolean; domain: TenantDomainRecord }>(`/admin/domains/${id}/verify`, { method: "POST" }),
  updateSsl: (id: string, sslStatus: "active" | "pending" | "none") => request<TenantDomainRecord>(`/admin/domains/${id}/ssl`, { method: "PATCH", body: JSON.stringify({ sslStatus }) }),
  updateStatus: (id: string, status: "active" | "pending" | "error") => request<TenantDomainRecord>(`/admin/domains/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  setPrimary: (id: string) => request<TenantDomainRecord>(`/admin/domains/${id}/primary`, { method: "PATCH" }),
  remove: (id: string) => request<{ message: string }>(`/admin/domains/${id}`, { method: "DELETE" }),
};

// ── Loyalty API ──
export const loyaltyApi = {
  getRules: () => request<LoyaltyRule | null>("/loyalty/rules"),
  upsertRules: (data: Partial<LoyaltyRule>) =>
    request<LoyaltyRule>("/loyalty/rules", { method: "PUT", body: JSON.stringify(data) }),
  getAccount: (clientId: string) => request<LoyaltyAccount>(`/loyalty/accounts/${clientId}`),
  awardPoints: (clientId: string, data: { points: number; description?: string; referenceId?: string }) =>
    request<{ success: boolean; pointsAwarded: number }>(`/loyalty/accounts/${clientId}/award`, { method: "POST", body: JSON.stringify(data) }),
  redeemPoints: (clientId: string, data: { points: number; invoiceId?: string }) =>
    request<{ success: boolean; pointsRedeemed: number; discountAmount: number }>(`/loyalty/accounts/${clientId}/redeem`, { method: "POST", body: JSON.stringify(data) }),
  getLeaderboard: () => request<LoyaltyAccount[]>("/loyalty/leaderboard"),
};

// ── Referral API ──
export const referralApi = {
  list: () => request<ReferralCode[]>("/referrals"),
  create: (data: { ownerType: string; ownerId: string; commissionRate?: number }) =>
    request<ReferralCode>("/referrals", { method: "POST", body: JSON.stringify(data) }),
  getByOwner: (ownerId: string) => request<ReferralCode[]>(`/referrals/owner/${ownerId}`),
  convert: (data: { code: string; referredClientId?: string; bookingId?: string; commissionEarned?: number }) =>
    request<ReferralConversion>("/referrals/convert", { method: "POST", body: JSON.stringify(data) }),
  payConversion: (id: string) =>
    request<ReferralConversion>(`/referrals/conversions/${id}/pay`, { method: "PATCH" }),
  getSummary: () => request<ReferralSummary[]>("/referrals/summary"),
};

// ── Group Tour API ──
export const groupTourApi = {
  list: () => request<GroupTour[]>("/group-tours"),
  create: (data: Omit<GroupTour, "id" | "tenantId" | "createdAt" | "updatedAt">) =>
    request<GroupTour>("/group-tours", { method: "POST", body: JSON.stringify(data) }),
  get: (id: string) => request<GroupTour>(`/group-tours/${id}`),
  update: (id: string, data: Partial<GroupTour>) =>
    request<GroupTour>(`/group-tours/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/group-tours/${id}`, { method: "DELETE" }),
  addBooking: (tourId: string, data: { bookingId: string; seatNumber?: string; roomNumber?: string; roomType?: string }) =>
    request<GroupTourBooking>(`/group-tours/${tourId}/bookings`, { method: "POST", body: JSON.stringify(data) }),
  removeBooking: (tourId: string, bookingId: string) =>
    request<void>(`/group-tours/${tourId}/bookings/${bookingId}`, { method: "DELETE" }),
};

// ── Advanced Analytics API ──
export const analyticsApi = {
  getSalesAnalytics: (params?: { from?: string; to?: string }) => {
    const q = new URLSearchParams();
    if (params?.from) q.set("from", params.from);
    if (params?.to) q.set("to", params.to);
    return request<SalesAnalytics>(`/finance/sales-analytics?${q}`);
  },
};

// ── New Phase 1 Types ──

export interface TaxRule {
  id: string;
  tenantId: string;
  name: string;
  rate: number;
  type: "percentage" | "fixed";
  appliesTo: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SalaryStructure {
  id: string;
  staffProfileId: string;
  tenantId: string;
  basicSalary: number;
  houseAllowance: number;
  transportAllowance: number;
  medicalAllowance: number;
  otherAllowance: number;
  taxDeduction: number;
  providentFund: number;
  otherDeduction: number;
  currency: string;
  effectiveFrom?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayslipEntry {
  id: string;
  payrollRunId: string;
  staffProfileId: string;
  tenantId: string;
  staffName: string;
  basicSalary: number;
  houseAllowance: number;
  transportAllowance: number;
  medicalAllowance: number;
  otherAllowance: number;
  grossSalary: number;
  taxDeduction: number;
  providentFund: number;
  otherDeduction: number;
  totalDeductions: number;
  netSalary: number;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  status: "pending" | "paid";
  paidAt?: string;
  paymentMethod?: string;
  paymentReference?: string;
  staffProfile?: { user?: { name: string; email: string } };
  createdAt: string;
  updatedAt: string;
}

export interface PayrollRun {
  id: string;
  tenantId: string;
  month: string;
  year: number;
  status: "draft" | "approved" | "paid";
  totalAmount: number;
  paidCount: number;
  processedBy?: string;
  processedAt?: string;
  notes?: string;
  payslips?: PayslipEntry[];
  _count?: { payslips: number };
  createdAt: string;
  updatedAt: string;
}

export interface PLReport {
  period: { from?: string; to?: string };
  revenue: { total: number; taxCollected: number; netRevenue: number };
  costOfSales: { vendorCosts: number };
  grossProfit: number;
  operatingExpenses: { total: number; byCategory: Record<string, number> };
  netProfit: number;
}

export interface BalanceSheet {
  assets: { cashAndBank: { total: number; accounts: { id: string; name: string; type: string; balance: number }[] }; accountsReceivable: number; totalAssets: number };
  liabilities: { accountsPayable: number; totalLiabilities: number };
  equity: number;
}

export interface CashFlowReport {
  period: { from?: string; to?: string };
  summary: { totalInflows: number; totalOutflows: number; net: number };
  monthly: { month: string; inflows: number; outflows: number; net: number }[];
}

export interface TaxReport {
  period: { from?: string; to?: string };
  summary: { totalSubTotal: number; totalTaxCollected: number; invoiceCount: number };
  invoices: { id: string; invoiceNumber?: string; clientName?: string; issuedDate?: string; subTotal: number; taxAmount: number; taxRate: number; totalAmount: number }[];
}

// ── Phase 2 Types ──

export interface LoyaltyRule {
  id: string;
  tenantId: string;
  pointsPerUnit: number;
  unitAmount: number;
  redemptionValue: number;
  expiryDays: number;
  silverThreshold: number;
  goldThreshold: number;
  platinumThreshold: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LoyaltyTransaction {
  id: string;
  accountId: string;
  tenantId: string;
  type: "earned" | "redeemed" | "expired" | "adjusted";
  points: number;
  description: string;
  referenceId?: string;
  referenceType?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface LoyaltyAccount {
  id: string;
  clientId: string;
  tenantId: string;
  totalPoints: number;
  usedPoints: number;
  expiredPoints: number;
  availablePoints?: number;
  tier: "standard" | "silver" | "gold" | "platinum";
  transactions?: LoyaltyTransaction[];
  rule?: LoyaltyRule;
  client?: { id: string; name: string; phone: string; email: string };
  createdAt: string;
  updatedAt: string;
}

export interface ReferralCode {
  id: string;
  tenantId: string;
  code: string;
  ownerType: "agent" | "client";
  ownerId: string;
  commissionRate: number;
  usageCount: number;
  isActive: boolean;
  conversions?: ReferralConversion[];
  _count?: { conversions: number };
  createdAt: string;
  updatedAt: string;
}

export interface ReferralConversion {
  id: string;
  referralCodeId: string;
  tenantId: string;
  referredClientId?: string;
  bookingId?: string;
  commissionEarned: number;
  status: "pending" | "paid";
  paidAt?: string;
  createdAt: string;
}

export interface ReferralSummary {
  id: string;
  code: string;
  ownerType: string;
  ownerId: string;
  usageCount: number;
  totalEarned: number;
  paidEarned: number;
  pendingEarned: number;
  isActive: boolean;
}

export interface GroupTourBooking {
  id: string;
  groupTourId: string;
  bookingId: string;
  seatNumber?: string;
  roomNumber?: string;
  roomType?: string;
  notes?: string;
  addedAt: string;
  booking?: {
    id: string;
    client?: { id: string; name: string; phone: string; email: string };
    travelers?: { id: string; name: string; passportNumber?: string; nationality?: string }[];
  };
}

export interface GroupTour {
  id: string;
  tenantId: string;
  name: string;
  destination?: string;
  departureDate?: string;
  returnDate?: string;
  capacity: number;
  status: "upcoming" | "ongoing" | "completed" | "cancelled";
  notes?: string;
  createdBy?: string;
  bookings?: GroupTourBooking[];
  _count?: { bookings: number };
  createdAt: string;
  updatedAt: string;
}

export interface SalesAnalytics {
  period: { from?: string; to?: string };
  summary: { totalBookings: number; totalRevenue: number; totalProfit: number; avgBookingValue: number };
  topDestinations: { destination: string; bookings: number; revenue: number; profit: number }[];
  agentPerformance: { agentId: string; agentName: string; bookings: number; revenue: number; profit: number }[];
  serviceBreakdown: { serviceType: string; bookings: number; revenue: number }[];
  monthlyTrend: { month: string; bookings: number; revenue: number }[];
  conversionFunnel: { leads: number; leadsConverted: number; leadConversionRate: number; quotations: number; quotationsAccepted: number; quotationConversionRate: number; bookings: number; bookingsConfirmed: number };
}

// ── Phase 3 Types ──

export interface MiceEventItem {
  id: string;
  miceEventId: string;
  itemType: string;
  description?: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  vendorId?: string;
  notes?: string;
  createdAt: string;
}

export interface MiceEvent {
  id: string;
  tenantId: string;
  title: string;
  eventType: string;
  clientId?: string;
  client?: { id: string; name: string; phone: string; email?: string };
  venue?: string;
  city?: string;
  country?: string;
  startDate?: string;
  endDate?: string;
  pax: number;
  budget: number;
  status: string;
  notes?: string;
  items?: MiceEventItem[];
  _count?: { items: number };
  createdAt: string;
  updatedAt: string;
}

export interface TravelPolicy {
  id: string;
  name: string;
  maxFlightBudget?: number;
  maxHotelPerNight?: number;
  maxMealPerDay?: number;
  requiresApproval: boolean;
  approverRole: string;
  advanceNoticeDays: number;
  allowedClasses: string[];
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TravelApprovalRequest {
  id: string;
  policyId?: string;
  policy?: { id: string; name: string };
  requestedBy: string;
  approvedBy?: string;
  destination?: string;
  travelDate?: string;
  returnDate?: string;
  purpose?: string;
  estimatedCost?: number;
  status: "pending" | "approved" | "rejected" | "cancelled";
  rejectionNote?: string;
  bookingId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VisaApplication {
  id: string;
  clientId?: string;
  client?: { id: string; name: string; phone: string };
  bookingId?: string;
  booking?: { id: string; bookingNumber?: string };
  applicantName: string;
  passportNumber?: string;
  nationality?: string;
  visaType?: string;
  destination?: string;
  appliedDate?: string;
  appointmentDate?: string;
  decisionDate?: string;
  expiryDate?: string;
  status: string;
  referenceNo?: string;
  embassyFee?: number;
  serviceFee?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HotelContract {
  id: string;
  vendorId?: string;
  hotelName: string;
  city?: string;
  country?: string;
  starRating?: number;
  contractStart?: string;
  contractEnd?: string;
  totalRooms: number;
  allocatedRooms: number;
  ratePerNight?: number;
  mealPlan?: string;
  status: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransportContract {
  id: string;
  vendorId?: string;
  transportType: string;
  vehicleModel?: string;
  capacity: number;
  registrationNo?: string;
  driverName?: string;
  driverPhone?: string;
  ratePerDay?: number;
  ratePerTrip?: number;
  contractStart?: string;
  contractEnd?: string;
  status: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobPosting {
  id: string;
  title: string;
  department?: string;
  location?: string;
  jobType: string;
  salaryMin?: number;
  salaryMax?: number;
  description?: string;
  requirements?: string;
  openings: number;
  deadline?: string;
  status: string;
  _count?: { applications: number };
  createdAt: string;
  updatedAt: string;
}

export interface JobApplication {
  id: string;
  jobPostingId: string;
  applicantName: string;
  email?: string;
  phone?: string;
  resumeUrl?: string;
  coverLetter?: string;
  experience?: number;
  currentSalary?: number;
  expectedSalary?: number;
  stage: string;
  rating?: number;
  notes?: string;
  appliedAt: string;
  updatedAt: string;
}

// ── Phase 3 API objects ──

export const miceApi = {
  list: (params?: { status?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.search) q.set("search", params.search);
    return request<MiceEvent[]>(`/mice?${q}`);
  },
  get: (id: string) => request<MiceEvent>(`/mice/${id}`),
  create: (data: Partial<MiceEvent>) => request<MiceEvent>("/mice", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<MiceEvent>) => request<MiceEvent>(`/mice/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) => request<{ message: string }>(`/mice/${id}`, { method: "DELETE" }),
  addItem: (id: string, data: Partial<MiceEventItem>) => request<MiceEventItem>(`/mice/${id}/items`, { method: "POST", body: JSON.stringify(data) }),
  updateItem: (id: string, itemId: string, data: Partial<MiceEventItem>) => request<MiceEventItem>(`/mice/${id}/items/${itemId}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteItem: (id: string, itemId: string) => request<{ message: string }>(`/mice/${id}/items/${itemId}`, { method: "DELETE" }),
};

export const travelPolicyApi = {
  listPolicies: () => request<TravelPolicy[]>("/travel-policy/policies"),
  createPolicy: (data: Partial<TravelPolicy>) => request<TravelPolicy>("/travel-policy/policies", { method: "POST", body: JSON.stringify(data) }),
  updatePolicy: (id: string, data: Partial<TravelPolicy>) => request<TravelPolicy>(`/travel-policy/policies/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deletePolicy: (id: string) => request<{ message: string }>(`/travel-policy/policies/${id}`, { method: "DELETE" }),
  listApprovals: (status?: string) => {
    const q = status ? `?status=${status}` : "";
    return request<TravelApprovalRequest[]>(`/travel-policy/approvals${q}`);
  },
  createApproval: (data: Partial<TravelApprovalRequest>) => request<TravelApprovalRequest>("/travel-policy/approvals", { method: "POST", body: JSON.stringify(data) }),
  updateApproval: (id: string, data: { status: string; rejectionNote?: string }) => request<TravelApprovalRequest>(`/travel-policy/approvals/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
};

export const visaApi = {
  list: (params?: { status?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.search) q.set("search", params.search);
    return request<VisaApplication[]>(`/visa?${q}`);
  },
  get: (id: string) => request<VisaApplication>(`/visa/${id}`),
  create: (data: Partial<VisaApplication>) => request<VisaApplication>("/visa", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<VisaApplication>) => request<VisaApplication>(`/visa/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) => request<{ message: string }>(`/visa/${id}`, { method: "DELETE" }),
  summary: () => request<Record<string, number>>("/visa/stats/summary"),
};

export const inventoryApi = {
  listHotels: (params?: { status?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.search) q.set("search", params.search);
    return request<HotelContract[]>(`/inventory/hotels?${q}`);
  },
  createHotel: (data: Partial<HotelContract>) => request<HotelContract>("/inventory/hotels", { method: "POST", body: JSON.stringify(data) }),
  updateHotel: (id: string, data: Partial<HotelContract>) => request<HotelContract>(`/inventory/hotels/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteHotel: (id: string) => request<{ message: string }>(`/inventory/hotels/${id}`, { method: "DELETE" }),
  listTransport: (params?: { status?: string; transportType?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.transportType) q.set("transportType", params.transportType);
    return request<TransportContract[]>(`/inventory/transport?${q}`);
  },
  createTransport: (data: Partial<TransportContract>) => request<TransportContract>("/inventory/transport", { method: "POST", body: JSON.stringify(data) }),
  updateTransport: (id: string, data: Partial<TransportContract>) => request<TransportContract>(`/inventory/transport/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteTransport: (id: string) => request<{ message: string }>(`/inventory/transport/${id}`, { method: "DELETE" }),
};

export const recruitmentApi = {
  listJobs: (status?: string) => {
    const q = status ? `?status=${status}` : "";
    return request<JobPosting[]>(`/recruitment/jobs${q}`);
  },
  createJob: (data: Partial<JobPosting>) => request<JobPosting>("/recruitment/jobs", { method: "POST", body: JSON.stringify(data) }),
  updateJob: (id: string, data: Partial<JobPosting>) => request<JobPosting>(`/recruitment/jobs/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteJob: (id: string) => request<{ message: string }>(`/recruitment/jobs/${id}`, { method: "DELETE" }),
  listApplications: (jobId: string) => request<JobApplication[]>(`/recruitment/jobs/${jobId}/applications`),
  addApplication: (jobId: string, data: Partial<JobApplication>) => request<JobApplication>(`/recruitment/jobs/${jobId}/applications`, { method: "POST", body: JSON.stringify(data) }),
  updateApplication: (id: string, data: Partial<JobApplication>) => request<JobApplication>(`/recruitment/applications/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteApplication: (id: string) => request<{ message: string }>(`/recruitment/applications/${id}`, { method: "DELETE" }),
  pipeline: () => request<Record<string, number>>("/recruitment/pipeline"),
};

// ── Module Registry (Phase 1 — v2 Architecture Freeze) ──
// Read-only, additive. See backend/src/lib/moduleRegistry.js and
// docs/v2-master/11-Architecture-Freeze.md §6. Not yet consumed by any
// component — AppSidebar continues to use src/config/navigation.ts until the
// Dynamic Sidebar milestone wires this in behind a feature flag.
export interface ModuleRegistryEntry {
  id: string;
  group: string;
  groupLabelKey: string;
  route: string;
  titleKey: string;
  rbacModule: string;
  minPlan?: string;
  requiredFeature?: string;
  requiredServiceTypes?: string[];
  website: boolean;
  reports: boolean;
  api: string | null;
}
export interface ModuleRegistryGroup {
  id: string;
  labelKey: string;
  items: ModuleRegistryEntry[];
}
export const registryApi = {
  get: () => request<{ groups: ModuleRegistryGroup[] }>("/registry"),
};
