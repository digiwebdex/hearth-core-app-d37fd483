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

export interface TravelPackageDay {
  id?: string;
  packageId?: string;
  dayNumber: number;
  title: string;
  description?: string | null;
  overnightLocation?: string | null;
}

export interface TravelPackageInclusion {
  id?: string;
  packageId?: string;
  type: "included" | "excluded";
  label: string;
  sortOrder?: number;
}

export interface TravelPackagePricing {
  id?: string;
  packageId?: string;
  label: string;
  travelerMin: number;
  travelerMax?: number | null;
  price: number;
  currency?: string;
}

export interface TravelPackageMedia {
  id?: string;
  packageId?: string;
  url: string;
  altText?: string | null;
  sortOrder?: number;
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
  visaRequired?: boolean;
  cancellationPolicy?: string;
  seasonalPricing?: unknown;
  heroImage?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  days?: TravelPackageDay[];
  inclusions?: TravelPackageInclusion[];
  pricing?: TravelPackagePricing[];
  media?: TravelPackageMedia[];
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
  getDays: (id: string) => request<TravelPackageDay[]>(`/travel-packages/${id}/days`),
  addDay: (id: string, data: Partial<TravelPackageDay>) =>
    request<TravelPackageDay>(`/travel-packages/${id}/days`, { method: "POST", body: JSON.stringify(data) }),
  updateDay: (id: string, childId: string, data: Partial<TravelPackageDay>) =>
    request<TravelPackageDay>(`/travel-packages/${id}/days/${childId}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteDay: (id: string, childId: string) =>
    request<{ success: boolean }>(`/travel-packages/${id}/days/${childId}`, { method: "DELETE" }),
  getInclusions: (id: string) => request<TravelPackageInclusion[]>(`/travel-packages/${id}/inclusions`),
  addInclusion: (id: string, data: Partial<TravelPackageInclusion>) =>
    request<TravelPackageInclusion>(`/travel-packages/${id}/inclusions`, { method: "POST", body: JSON.stringify(data) }),
  updateInclusion: (id: string, childId: string, data: Partial<TravelPackageInclusion>) =>
    request<TravelPackageInclusion>(`/travel-packages/${id}/inclusions/${childId}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteInclusion: (id: string, childId: string) =>
    request<{ success: boolean }>(`/travel-packages/${id}/inclusions/${childId}`, { method: "DELETE" }),
  getPricing: (id: string) => request<TravelPackagePricing[]>(`/travel-packages/${id}/pricing`),
  addPricing: (id: string, data: Partial<TravelPackagePricing>) =>
    request<TravelPackagePricing>(`/travel-packages/${id}/pricing`, { method: "POST", body: JSON.stringify(data) }),
  updatePricing: (id: string, childId: string, data: Partial<TravelPackagePricing>) =>
    request<TravelPackagePricing>(`/travel-packages/${id}/pricing/${childId}`, { method: "PATCH", body: JSON.stringify(data) }),
  deletePricing: (id: string, childId: string) =>
    request<{ success: boolean }>(`/travel-packages/${id}/pricing/${childId}`, { method: "DELETE" }),
  getMedia: (id: string) => request<TravelPackageMedia[]>(`/travel-packages/${id}/media`),
  addMedia: (id: string, data: Partial<TravelPackageMedia>) =>
    request<TravelPackageMedia>(`/travel-packages/${id}/media`, { method: "POST", body: JSON.stringify(data) }),
  updateMedia: (id: string, childId: string, data: Partial<TravelPackageMedia>) =>
    request<TravelPackageMedia>(`/travel-packages/${id}/media/${childId}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteMedia: (id: string, childId: string) =>
    request<{ success: boolean }>(`/travel-packages/${id}/media/${childId}`, { method: "DELETE" }),
};
