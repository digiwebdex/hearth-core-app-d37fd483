// API service layer — point BASE_URL to your VPS backend
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

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
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || "Request failed");
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
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (data: { name: string; email: string; password: string; tenantName: string; plan?: string }) =>
    request<{ token?: string; user?: User; tenant?: Tenant; pendingApproval?: boolean; message?: string; trialDays?: number; intendedPlan?: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
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
  getMembers: () => request<User[]>("/tenants/me/members"),
  inviteMember: (email: string, role: string, name?: string) =>
    request<User>("/tenants/me/members", {
      method: "POST",
      body: JSON.stringify({ email, role, name }),
    }),
  removeMember: (userId: string) =>
    request<void>(`/tenants/me/members/${userId}`, { method: "DELETE" }),
};

// ── Dashboard Stats ──
export interface DashboardStats {
  totalUsers: number;
  totalClients: number;
  totalBookings: number;
  totalRevenue: number;
  recentBookings: Booking[];
  recentPayments: Payment[];
  // Extended travel dashboard stats
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
  uploadDocument: (id: string, data: FormData) =>
    fetch(`${import.meta.env.VITE_API_URL || "http://localhost:4000/api"}/clients/${id}/documents`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      body: data,
    }).then((r) => r.json()),
};
export const agentApi = createCrudApi<Agent>("agents");
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
export const leadApi = {
  ...createCrudApi<Lead>("leads"),
  updateStatus: (id: string, status: string) =>
    request<Lead>(`/leads/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  getActivities: (id: string) =>
    request<LeadActivity[]>(`/leads/${id}/activities`),
  addActivity: (id: string, data: { type: string; content: string }) =>
    request<LeadActivity>(`/leads/${id}/activities`, { method: "POST", body: JSON.stringify(data) }),
  convertToClient: (id: string) =>
    request<Client>(`/leads/${id}/convert`, { method: "POST" }),
  getQuotations: (id: string) =>
    request<Quotation[]>(`/leads/${id}/quotations`).catch(() => []),
  checkDuplicateClient: (email: string, phone: string) =>
    request<{ exists: boolean; client?: Client }>(`/leads/check-duplicate?email=${encodeURIComponent(email)}&phone=${encodeURIComponent(phone)}`).catch(() => ({ exists: false })),
};
export const taskApi = createCrudApi<Task>("tasks");
export const bookingApi = {
  ...createCrudApi<Booking>("bookings"),
  updateStatus: (id: string, status: BookingStatus) =>
    request<Booking>(`/bookings/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  getSegments: (id: string) => request<BookingSegment[]>(`/bookings/${id}/segments`),
  addSegment: (id: string, data: Omit<BookingSegment, "id">) =>
    request<BookingSegment>(`/bookings/${id}/segments`, { method: "POST", body: JSON.stringify(data) }),
  deleteSegment: (id: string, segId: string) =>
    request<void>(`/bookings/${id}/segments/${segId}`, { method: "DELETE" }),
  getTravelers: (id: string) => request<BookingTraveler[]>(`/bookings/${id}/travelers`),
  addTraveler: (id: string, data: Omit<BookingTraveler, "id">) =>
    request<BookingTraveler>(`/bookings/${id}/travelers`, { method: "POST", body: JSON.stringify(data) }),
  deleteTraveler: (id: string, tId: string) =>
    request<void>(`/bookings/${id}/travelers/${tId}`, { method: "DELETE" }),
  getChecklist: (id: string) => request<BookingChecklistItem[]>(`/bookings/${id}/checklist`),
  updateChecklistItem: (id: string, itemId: string, done: boolean) =>
    request<BookingChecklistItem>(`/bookings/${id}/checklist/${itemId}`, { method: "PATCH", body: JSON.stringify({ done }) }),
  addChecklistItem: (id: string, data: { label: string }) =>
    request<BookingChecklistItem>(`/bookings/${id}/checklist`, { method: "POST", body: JSON.stringify(data) }),
  getTimeline: (id: string) => request<BookingTimelineEvent[]>(`/bookings/${id}/timeline`),
  addTimelineEvent: (id: string, data: { type: string; content: string }) =>
    request<BookingTimelineEvent>(`/bookings/${id}/timeline`, { method: "POST", body: JSON.stringify(data) }),
  getDocuments: (id: string) => request<BookingDocument[]>(`/bookings/${id}/documents`),
  uploadDocument: (id: string, data: FormData) =>
    fetch(`${import.meta.env.VITE_API_URL || "http://localhost:4000/api"}/bookings/${id}/documents`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      body: data,
    }).then((r) => r.json()),
  deleteDocument: (id: string, docId: string) =>
    request<void>(`/bookings/${id}/documents/${docId}`, { method: "DELETE" }),
};
export const invoiceApi = {
  ...createCrudApi<Invoice>("invoices"),
  updateStatus: (id: string, status: InvoiceStatus) =>
    request<Invoice>(`/invoices/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  getPayments: (id: string) => request<Payment[]>(`/invoices/${id}/payments`),
  addPayment: (id: string, data: Omit<Payment, "id" | "createdAt">) =>
    request<Payment>(`/invoices/${id}/payments`, { method: "POST", body: JSON.stringify(data) }),
  deletePayment: (id: string, payId: string) =>
    request<void>(`/invoices/${id}/payments/${payId}`, { method: "DELETE" }),
  addRefund: (id: string, data: { amount: number; reason: string; method?: string }) =>
    request<InvoiceRefund>(`/invoices/${id}/refunds`, { method: "POST", body: JSON.stringify(data) }),
  getRefunds: (id: string) => request<InvoiceRefund[]>(`/invoices/${id}/refunds`),
  getAuditTrail: (id: string) => request<InvoiceAuditEvent[]>(`/invoices/${id}/audit`),
  uploadProof: (id: string, payId: string, data: FormData) =>
    fetch(`${import.meta.env.VITE_API_URL || "http://localhost:4000/api"}/invoices/${id}/payments/${payId}/proof`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      body: data,
    }).then((r) => r.json()),
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
  updateStatus: (id: string, status: QuotationStatus) =>
    request<Quotation>(`/quotations/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  getVersions: (id: string) =>
    request<QuotationVersion[]>(`/quotations/${id}/versions`),
  duplicate: (id: string) =>
    request<Quotation>(`/quotations/${id}/duplicate`, { method: "POST" }),
  convertToBooking: (id: string) =>
    request<Booking>(`/quotations/${id}/convert-to-booking`, { method: "POST" }),
};

// ── Types ──
export interface User {
  id: string;
  name: string;
  email: string;
  role: "super_admin" | "tenant_owner" | "manager" | "sales_agent" | "accountant" | "operations" | "owner" | "admin" | "member";
  tenantId: string;
  emailVerified?: boolean;
  createdAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  ownerId: string;
  subscriptionPlan: "free" | "basic" | "pro" | "business" | "enterprise";
  subscriptionExpiry?: string;
  subscriptionStatus?: "active" | "trial" | "expired" | "cancelled" | "pending" | "suspended" | "overdue";
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  alternatePhone?: string;
  address?: string;
  dateOfBirth?: string;
  passportNumber?: string;
  passportExpiry?: string;
  nidNumber?: string;
  nationality?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  notes?: string;
  tags?: string[];
  documents?: ClientDocument[];
  tenantId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ClientDocument {
  id: string;
  clientId: string;
  name: string;
  type: string;
  url: string;
  uploadedAt: string;
}

export interface Agent {
  id: string;
  name: string;
  phone: string;
  email: string;
  tenantId: string;
  createdAt: string;
}

export type VendorCategory = "hotel" | "airline" | "transport" | "visa_partner" | "guide" | "tour_operator" | "other";
export type VendorBillStatus = "unpaid" | "partial" | "paid" | "overdue";

export interface Vendor {
  id: string;
  name: string;
  phone: string;
  email: string;
  category: VendorCategory;
  contactPerson?: string;
  address?: string;
  serviceAreas?: string;
  website?: string;
  bankDetails?: string;
  notes?: string;
  status: "active" | "inactive";
  tenantId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface VendorBill {
  id: string;
  vendorId: string;
  vendorName?: string;
  bookingId?: string;
  bookingTitle?: string;
  segmentId?: string;
  description: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: VendorBillStatus;
  dueDate?: string;
  invoiceRef?: string;
  notes?: string;
  payments?: VendorBillPayment[];
  tenantId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface VendorBillPayment {
  id: string;
  billId: string;
  amount: number;
  method: string;
  reference?: string;
  date: string;
  notes?: string;
  paidBy?: string;
  paidByName?: string;
  createdAt: string;
}

export interface VendorNote {
  id: string;
  vendorId: string;
  type: "note" | "call" | "email" | "meeting" | "issue";
  content: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
}

export type LeadStatus = "new" | "contacted" | "qualified" | "quoted" | "won" | "lost";

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  status: LeadStatus;
  source?: string;
  destination?: string;
  travelDateFrom?: string;
  travelDateTo?: string;
  travelerCount?: number;
  budget?: number;
  assignedTo?: string;
  assignedToName?: string;
  nextFollowUp?: string;
  notes?: string;
  tags?: string[];
  tenantId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface LeadActivity {
  id: string;
  leadId: string;
  type: "note" | "status_change" | "follow_up" | "call" | "email" | "meeting";
  content: string;
  oldStatus?: LeadStatus;
  newStatus?: LeadStatus;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  dueDate?: string;
  assignedTo?: string;
  tenantId: string;
  createdAt: string;
}

export type BookingStatus = "pending" | "confirmed" | "ticketed" | "traveling" | "completed" | "cancelled";
export type BookingType = "tour" | "ticket" | "hotel" | "visa" | "package";

export interface Booking {
  id: string;
  type: BookingType;
  title?: string;
  clientId: string;
  clientName?: string;
  agentId: string;
  agentName?: string;
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
  tenantId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface BookingSegment {
  id: string;
  bookingId?: string;
  type: "hotel" | "flight" | "transfer" | "visa" | "activity" | "package";
  description: string;
  supplier?: string;
  supplierRef?: string;
  startDate?: string;
  endDate?: string;
  details?: string;
  cost: number;
  sellingPrice: number;
  status?: "pending" | "confirmed" | "cancelled";
}

export interface BookingTraveler {
  id: string;
  bookingId?: string;
  name: string;
  passportNumber?: string;
  passportExpiry?: string;
  nationality?: string;
  dateOfBirth?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface BookingChecklistItem {
  id: string;
  bookingId?: string;
  label: string;
  done: boolean;
  doneAt?: string;
  doneBy?: string;
}

export interface BookingTimelineEvent {
  id: string;
  bookingId?: string;
  type: "status_change" | "note" | "payment" | "document" | "checklist" | "system";
  content: string;
  oldStatus?: string;
  newStatus?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
}

export interface BookingDocument {
  id: string;
  bookingId?: string;
  name: string;
  type: string;
  url: string;
  uploadedAt: string;
  uploadedBy?: string;
}

export type InvoiceStatus = "unpaid" | "partial" | "paid" | "overdue" | "refunded" | "cancelled";
export type PaymentMethod = "cash" | "bank" | "card" | "mobile_banking" | "cheque" | "online";

export interface Invoice {
  id: string;
  invoiceNumber?: string;
  bookingId: string;
  bookingTitle?: string;
  clientId?: string;
  clientName?: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  refundedAmount?: number;
  bookingCost?: number;
  status: InvoiceStatus;
  dueDate?: string;
  issuedDate?: string;
  notes?: string;
  payments?: Payment[];
  refunds?: InvoiceRefund[];
  auditTrail?: InvoiceAuditEvent[];
  tenantId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  bookingId: string;
  amount: number;
  method: PaymentMethod | string;
  transactionRef?: string;
  proofUrl?: string;
  date: string;
  notes?: string;
  receivedBy?: string;
  tenantId: string;
  createdAt: string;
}

export interface InvoiceRefund {
  id: string;
  invoiceId: string;
  amount: number;
  reason: string;
  method?: PaymentMethod | string;
  processedBy?: string;
  createdAt: string;
}

export interface InvoiceAuditEvent {
  id: string;
  invoiceId: string;
  type: "status_change" | "payment" | "refund" | "note" | "system";
  content: string;
  oldStatus?: InvoiceStatus;
  newStatus?: InvoiceStatus;
  amount?: number;
  createdBy?: string;
  createdAt: string;
}

export type QuotationStatus = "draft" | "sent" | "approved" | "rejected" | "expired";
export type QuotationItemType = "hotel" | "flight" | "visa" | "transport" | "tour" | "activity" | "insurance" | "service_fee" | "discount" | "tax";

export interface QuotationItem {
  id: string;
  type: QuotationItemType;
  day?: number;
  description: string;
  details?: string;
  supplier?: string;
  costPrice: number;
  markupPercent: number;
  sellingPrice: number;
  quantity: number;
  nights?: number;
  subtotal: number;
}

export interface ItineraryDay {
  dayNumber: number;
  date?: string;
  title: string;
  description: string;
  meals?: string;
  accommodation?: string;
  activities?: string[];
}

export interface Quotation {
  id: string;
  title: string;
  clientId?: string;
  clientName?: string;
  leadId?: string;
  leadName?: string;
  packageId?: string;
  serviceType?: string;
  packageTitleSnapshot?: string;
  packageCodeSnapshot?: string;
  destination: string;
  travelDateFrom?: string;
  travelDateTo?: string;
  travelerCount: number;
  status: QuotationStatus;
  version: number;
  items: QuotationItem[];
  itinerary: ItineraryDay[];
  totalCost: number;
  totalSelling: number;
  totalProfit: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
  validUntil?: string;
  notes?: string;
  termsAndConditions?: string;
  createdBy?: string;
  tenantId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface QuotationVersion {
  id: string;
  quotationId: string;
  versionNumber: number;
  snapshot: string;
  changeNote?: string;
  changedBy?: string;
  createdAt: string;
}

export type AccountType = "cash" | "bank" | "mobile_banking" | "card" | "other";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  accountNumber?: string;
  bankName?: string;
  notes?: string;
  status: "active" | "inactive";
  tenantId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Transaction {
  id: string;
  accountId?: string;
  accountName?: string;
  type: "income" | "expense" | "transfer" | "refund";
  category: string;
  description: string;
  amount: number;
  referenceId?: string;
  referenceType?: string;
  clientId?: string;
  bookingId?: string;
  invoiceId?: string;
  paymentMethod?: string;
  status?: "pending" | "completed" | "cancelled";
  date: string;
  tenantId: string;
  createdBy?: string;
  createdAt: string;
}

export interface BookingProfitability {
  bookingId: string;
  title?: string;
  destination?: string;
  amount: number;
  cost: number;
  profit: number;
  marginPercent: number;
  travelDateFrom?: string;
  clientName?: string;
}

export interface AccountsSummary {
  totalBalance: number;
  totalIncome: number;
  totalExpense: number;
  accounts: Account[];
  recentTransactions: Transaction[];
}

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  paymentMethod: string;
  reference?: string;
  notes?: string;
  attachmentUrl?: string;
  vendorId?: string;
  vendorName?: string;
  accountId?: string;
  accountName?: string;
  approvedBy?: string;
  status: "pending" | "approved" | "rejected";
  tenantId: string;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Subscription {
  id: string;
  tenantId: string;
  plan: string;
  startDate: string;
  endDate: string;
  status: "active" | "expired" | "scheduled" | string;
  billingCycle?: string;
  source?: string;
  paymentRequestId?: string;
  note?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PaymentRequest {
  id: string;
  tenantId: string;
  plan: string;
  amount: number;
  method: string;
  trxId: string;
  proofUrl?: string;
  status: "pending" | "approved" | "rejected" | string;
  reviewerComment?: string;
  processedAt?: string;
  currentPlan?: string;
  requestedPlan?: string;
  billingCycle?: string;
  requestType?: string;
  paymentMethod?: string;
  expectedAmount?: number;
  amountSent?: number;
  senderAccountOrNumber?: string;
  transactionId?: string;
  paymentDate?: string;
  paymentTime?: string;
  proofFileName?: string;
  note?: string;
  adminNote?: string;
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  activationMode?: string;
  activationDate?: string;
  expiryDateAfterApproval?: string;
  requestSource?: string;
  createdAt: string;
  updatedAt?: string;
}
