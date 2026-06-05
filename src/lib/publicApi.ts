// Public API — no auth required, fetches tenant data by slug
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

async function publicRequest<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

export interface TenantPublic {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  description?: string;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
  socialLinks?: { facebook?: string; instagram?: string; twitter?: string };
}

export interface PackagePublic {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: string;
  image?: string;
  type: string;
  highlights: string[];
  source?: "travel_package" | "hajj";
}

/** Normalize domain — strip www prefix for consistent lookups */
function normalizeDomain(domain: string): string {
  return domain.replace(/^www\./, "").toLowerCase();
}

export const publicApi = {
  getTenant: (slug: string) => publicRequest<TenantPublic>(`/public/${slug}`),
  getPackages: (slug: string) => publicRequest<PackagePublic[]>(`/public/${slug}/packages`),
  getTenantByDomain: (domain: string) =>
    publicRequest<TenantPublic>(`/public/domain/${normalizeDomain(domain)}`),
  getPackagesByDomain: (domain: string) =>
    publicRequest<PackagePublic[]>(`/public/domain/${normalizeDomain(domain)}/packages`),
  submitContact: (data: { name: string; email: string; phone?: string; subject?: string; message: string; tenantSlug?: string }) =>
    publicPost<{ success: boolean; id: string }>("/contact", data),
  submitDemo: (data: { name: string; email: string; phone?: string; company?: string; teamSize?: string; message?: string }) =>
    publicPost<{ success: boolean; id: string }>("/demo-requests", data),
};

async function publicPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || "Request failed");
  }
  return res.json();
}
