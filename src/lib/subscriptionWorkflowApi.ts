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

export interface WorkflowPaymentMethod {
  id?: string;
  methodCode: string;
  label: string;
  enabled: boolean;
  accountName?: string | null;
  accountNumber?: string | null;
  bankName?: string | null;
  branchName?: string | null;
  instructions?: string | null;
  sortOrder?: number;
}

export interface WorkflowPaymentRequest {
  id: string;
  tenantId: string;
  plan: string;
  requestedPlan?: string | null;
  currentPlan?: string | null;
  billingCycle?: "monthly" | "yearly";
  requestType?: "activate" | "renew" | "upgrade" | "downgrade";
  amount: number;
  expectedAmount?: number | null;
  amountSent?: number | null;
  method: string;
  paymentMethod?: string | null;
  trxId?: string | null;
  transactionId?: string | null;
  senderAccountOrNumber?: string | null;
  paymentDate?: string | null;
  paymentTime?: string | null;
  proofUrl?: string | null;
  proofFileName?: string | null;
  note?: string | null;
  status: string;
  reviewerComment?: string | null;
  adminNote?: string | null;
  rejectionReason?: string | null;
  processedAt?: string | null;
  reviewedAt?: string | null;
  activationMode?: string | null;
  activationDate?: string | null;
  expiryDateAfterApproval?: string | null;
  createdAt: string;
  updatedAt?: string;
  tenant?: {
    id: string;
    name: string;
    slug?: string;
    subscriptionPlan?: string;
    subscriptionStatus?: string;
    subscriptionExpiry?: string | null;
  };
}

export interface WorkflowSubscriptionSummary {
  tenantId: string;
  currentPlan: string;
  subscriptionStatus: string;
  subscriptionExpiry?: string | null;
  paymentMethods: WorkflowPaymentMethod[];
}

export interface WorkflowSubscriptionHistory {
  id: string;
  tenantId: string;
  paymentRequestId?: string | null;
  oldPlan?: string | null;
  newPlan: string;
  oldStatus?: string | null;
  newStatus: string;
  billingCycle?: string | null;
  activationDate?: string | null;
  expiryDate?: string | null;
  actionType: string;
  source: string;
  note?: string | null;
  actorUserId?: string | null;
  createdAt: string;
}

export interface ManualActivationPayload {
  plan?: string;
  targetPlan?: string;
  billingCycle?: "monthly" | "yearly";
  subscriptionStatus?: string;
  activationDate?: string;
  expiryDate?: string;
  actionType?: string;
  note?: string;
}

export interface PaymentRequestActionPayload {
  action: string;
  targetPlan?: string;
  billingCycle?: "monthly" | "yearly";
  activationMode?: "activate_now" | "after_current_expiry" | "extend_from_current_expiry";
  activationDate?: string;
  endTrialNow?: boolean;
  reviewerComment?: string;
  adminNote?: string;
  rejectionReason?: string;
  reason?: string;
}

export const tenantSubscriptionWorkflowApi = {
  getSummary: () => request<WorkflowSubscriptionSummary>("/payment-requests/summary"),
  getMethods: () => request<WorkflowPaymentMethod[]>("/payment-requests/methods"),
  listRequests: () => request<WorkflowPaymentRequest[]>("/payment-requests"),
  getRequest: (id: string) => request<WorkflowPaymentRequest>(`/payment-requests/${id}`),
  createRequest: (data: Record<string, unknown>) =>
    request<WorkflowPaymentRequest>("/payment-requests", { method: "POST", body: JSON.stringify(data) }),
  resubmitRequest: (id: string, data: Record<string, unknown>) =>
    request<WorkflowPaymentRequest>(`/payment-requests/${id}/resubmit`, { method: "POST", body: JSON.stringify(data) }),
  cancelRequest: (id: string, note?: string) =>
    request<WorkflowPaymentRequest>(`/payment-requests/${id}/cancel`, { method: "POST", body: JSON.stringify({ note }) }),
};

export const adminSubscriptionWorkflowApi = {
  listPaymentMethods: () => request<WorkflowPaymentMethod[]>("/admin/payment-methods"),
  savePaymentMethods: (methods: WorkflowPaymentMethod[]) =>
    request<WorkflowPaymentMethod[]>("/admin/payment-methods", { method: "PUT", body: JSON.stringify({ methods }) }),
  listPaymentRequests: (params?: Record<string, string>) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    return request<WorkflowPaymentRequest[]>(`/admin/payment-requests${query}`);
  },
  getPaymentRequest: (id: string) => request<WorkflowPaymentRequest & { subscriptionHistory?: WorkflowSubscriptionHistory[] }>(`/admin/payment-requests/${id}`),
  updatePaymentRequest: (id: string, data: PaymentRequestActionPayload) =>
    request<any>(`/admin/payment-requests/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  getSubscriptionHistory: (tenantId: string) => request<WorkflowSubscriptionHistory[]>(`/admin/tenants/${tenantId}/subscription-history`),
  manualActivate: (tenantId: string, data: ManualActivationPayload) =>
    request<any>(`/admin/tenants/${tenantId}/subscription/manual-activate`, { method: "POST", body: JSON.stringify(data) }),
  skipTrial: (tenantId: string, data: ManualActivationPayload = {}) =>
    request<any>(`/admin/tenants/${tenantId}/subscription/skip-trial`, { method: "PATCH", body: JSON.stringify(data) }),
  extendSubscription: (tenantId: string, months: number, note?: string) =>
    request<any>(`/admin/tenants/${tenantId}/subscription/extend`, { method: "PATCH", body: JSON.stringify({ months, note }) }),
  suspendSubscription: (tenantId: string, note?: string) =>
    request<any>(`/admin/tenants/${tenantId}/subscription/suspend`, { method: "PATCH", body: JSON.stringify({ note }) }),
};