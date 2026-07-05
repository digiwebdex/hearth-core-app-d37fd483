import { API_BASE_URL } from "@/lib/apiConfig";
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
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || "Request failed");
  }
  return res.json();
}

export interface AuditLogEntry {
  id: string;
  actorId?: string | null;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  tenantId?: string | null;
  tenantName?: string | null;
  module: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  targetLabel?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  ipAddress?: string | null;
  createdAt: string;
}

export const auditLogApi = {
  /** Super admin: all logs. Tenant admin: tenant-scoped logs. */
  list: () => request<AuditLogEntry[]>("/audit-logs"),
};
