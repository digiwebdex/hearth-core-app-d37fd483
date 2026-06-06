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
  tenant?: {
    id: string;
    name: string;
    slug?: string | null;
    subscriptionPlan?: string | null;
  };
}

export const domainApi = {
  list: () => request<TenantDomainRecord[]>("/domains"),
  create: (data: { tenantId: string; domain: string; wwwRedirect?: string }) =>
    request<TenantDomainRecord>("/domains", { method: "POST", body: JSON.stringify(data) }),
  verify: (id: string) =>
    request<{ verified: boolean; domain: TenantDomainRecord }>(`/domains/${id}/verify`, { method: "POST" }),
  updateSsl: (id: string, sslStatus: "active" | "pending" | "none") =>
    request<TenantDomainRecord>(`/domains/${id}/ssl`, { method: "PATCH", body: JSON.stringify({ sslStatus }) }),
  updateStatus: (id: string, status: "active" | "pending" | "error") =>
    request<TenantDomainRecord>(`/domains/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  setPrimary: (id: string) =>
    request<TenantDomainRecord>(`/domains/${id}/primary`, { method: "PATCH" }),
  remove: (id: string) =>
    request<{ message: string }>(`/domains/${id}`, { method: "DELETE" }),
};
