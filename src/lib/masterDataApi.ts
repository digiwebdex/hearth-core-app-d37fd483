import { API_BASE_URL } from "@/lib/apiConfig";
const BASE_URL = API_BASE_URL;

function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token");
  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  }).then(async (res) => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || "Request failed");
    }
    return res.json();
  });
}

export type MasterDataCategory =
  | "country"
  | "city"
  | "airline"
  | "airport"
  | "university"
  | "visa_type"
  | "job_category"
  | "vehicle_type"
  | "hotel"
  | "insurance_plan";

export interface MasterReference {
  id: string;
  category: MasterDataCategory;
  code?: string | null;
  name: string;
  nameBn?: string | null;
  parentId?: string | null;
  parent?: { id: string; name: string; code?: string | null; category: string } | null;
  meta?: Record<string, unknown> | null;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const MASTER_DATA_CATEGORIES: { id: MasterDataCategory; labelEn: string; labelBn: string; parent?: MasterDataCategory }[] = [
  { id: "country", labelEn: "Countries", labelBn: "দেশসমূহ" },
  { id: "city", labelEn: "Cities", labelBn: "শহর", parent: "country" },
  { id: "airline", labelEn: "Airlines", labelBn: "এয়ারলাইন্স" },
  { id: "airport", labelEn: "Airports", labelBn: "বিমানবন্দর" },
  { id: "university", labelEn: "Universities", labelBn: "বিশ্ববিদ্যালয়" },
  { id: "visa_type", labelEn: "Visa Types", labelBn: "ভিসা টাইপ" },
  { id: "job_category", labelEn: "Job Categories", labelBn: "চাকরির ক্যাটাগরি" },
  { id: "vehicle_type", labelEn: "Vehicle Types", labelBn: "যানবাহনের ধরন" },
  { id: "hotel", labelEn: "Hotels & Resorts", labelBn: "হোটেল ও রিসোর্ট" },
  { id: "insurance_plan", labelEn: "Insurance Plans", labelBn: "ইন্স্যুরেন্স প্ল্যান" },
];

export const masterDataApi = {
  list: (category: MasterDataCategory, params?: { parentId?: string; search?: string }) => {
    const q = new URLSearchParams({ category });
    if (params?.parentId) q.set("parentId", params.parentId);
    if (params?.search) q.set("search", params.search);
    return request<MasterReference[]>(`/master-data?${q}`);
  },
};

export const adminMasterDataApi = {
  list: (category?: MasterDataCategory, search?: string) => {
    const q = new URLSearchParams();
    if (category) q.set("category", category);
    if (search) q.set("search", search);
    const qs = q.toString();
    return request<MasterReference[]>(`/admin/master-data${qs ? `?${qs}` : ""}`);
  },
  create: (data: Partial<MasterReference> & { category: MasterDataCategory; name: string }) =>
    request<MasterReference>("/admin/master-data", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<MasterReference>) =>
    request<MasterReference>(`/admin/master-data/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  remove: (id: string) => request<{ ok: boolean }>(`/admin/master-data/${id}`, { method: "DELETE" }),
  seed: () => request<{ ok: boolean; counts: Record<string, number> }>("/admin/master-data/seed", { method: "POST" }),
};
