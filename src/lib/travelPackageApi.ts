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

export interface TravelPackage {
  id: string;
  tenantId: string;
  serviceType?: string;
  code: string;
  title: string;
  slug: string;
  summary?: string;
  destination?: string;
  country?: string;
  durationDays?: number;
  durationNights?: number;
  basePrice?: number;
  currency?: string;
  status?: string;
  isFeatured?: boolean;
  heroImage?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const travelPackageApi = {
  list: () => request<TravelPackage[]>("/travel-packages"),
  get: (id: string) => request<TravelPackage>(`/travel-packages/${id}`),
  create: (data: Partial<TravelPackage>) =>
    request<TravelPackage>("/travel-packages", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<TravelPackage>) =>
    request<TravelPackage>(`/travel-packages/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ success: boolean }>(`/travel-packages/${id}`, { method: "DELETE" }),
};
