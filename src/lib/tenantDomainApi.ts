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
  wwwRedirect: "www-to-root" | "root-to-www";
  verificationToken: string;
  verificationStatus: "unverified" | "verifying" | "verified";
  status: "pending" | "active" | "error";
  sslStatus: "none" | "pending" | "active";
  isPrimary: boolean;
  lastDnsCheck?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface TenantDomainSummary {
  tenantId: string;
  tenantName: string;
  tenantSlug?: string | null;
  subscriptionPlan: string;
  subscriptionStatus: string;
  domainLimit: number;
  usedDomains: number;
  canAddDomain: boolean;
  defaultWebsiteUrl: string;
}

export const tenantDomainApi = {
  getSummary: () => request<TenantDomainSummary>("/tenant-domains/summary"),
  list: () => request<TenantDomainRecord[]>("/tenant-domains"),
  add: (data: { domain: string; wwwRedirect?: "www-to-root" | "root-to-www" }) =>
    request<TenantDomainRecord>("/tenant-domains", { method: "POST", body: JSON.stringify(data) }),
  verify: (id: string) => request<{ verified: boolean; domain: TenantDomainRecord }>(`/tenant-domains/${id}/verify`, { method: "POST" }),
  setPrimary: (id: string) => request<TenantDomainRecord>(`/tenant-domains/${id}/primary`, { method: "PATCH" }),
  remove: (id: string) => request<{ message: string }>(`/tenant-domains/${id}`, { method: "DELETE" }),
};