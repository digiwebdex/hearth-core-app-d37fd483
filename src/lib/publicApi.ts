import { API_BASE_URL } from "@/lib/apiConfig";
// Public API — no auth required, fetches tenant data by slug
const BASE_URL = API_BASE_URL;

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
  isFeatured?: boolean;
  visaRequired?: boolean;
  cancellationPolicy?: string;
  serviceType?: string;
}

export interface BlogPostPublic {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body?: string;
  coverImage?: string | null;
  publishedAt?: string | null;
  authorName?: string | null;
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
  getBlogPosts: (slug: string) => publicRequest<BlogPostPublic[]>(`/public/${slug}/blog-posts`),
  getBlogPost: (slug: string, postSlug: string) =>
    publicRequest<BlogPostPublic>(`/public/${slug}/blog-posts/${postSlug}`),
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
