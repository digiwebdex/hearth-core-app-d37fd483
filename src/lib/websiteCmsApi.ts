const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export type CmsSectionType =
  | "hero"
  | "about"
  | "services"
  | "featured-packages"
  | "why-choose-us"
  | "testimonials"
  | "faq"
  | "team"
  | "cta"
  | "contact"
  | "custom";

export interface CmsSection {
  id: string;
  type: CmsSectionType | string;
  label: string;
  enabled: boolean;
  order: number;
  fields: Record<string, any>;
  items: any[];
}

export interface WebsiteCms {
  version: number;
  sections: CmsSection[];
}

export const websiteCmsApi = {
  getSections: async (): Promise<CmsSection[]> => {
    const res = await fetch(`${BASE_URL}/website/sections`, { headers: authHeaders() });
    if (!res.ok) throw new Error("Failed to load CMS sections");
    return res.json();
  },

  createSection: async (payload: Partial<CmsSection> & { type: string }): Promise<CmsSection[]> => {
    const res = await fetch(`${BASE_URL}/website/sections`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to create section");
    return res.json();
  },

  updateSection: async (sectionId: string, payload: Partial<CmsSection>): Promise<CmsSection> => {
    const res = await fetch(`${BASE_URL}/website/sections/${sectionId}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to update section");
    return res.json();
  },

  reorderSections: async (sectionIds: string[]): Promise<CmsSection[]> => {
    const res = await fetch(`${BASE_URL}/website/sections/reorder`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ sectionIds }),
    });
    if (!res.ok) throw new Error("Failed to reorder sections");
    return res.json();
  },

  deleteSection: async (sectionId: string): Promise<CmsSection[]> => {
    const res = await fetch(`${BASE_URL}/website/sections/${sectionId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete section");
    return res.json();
  },
};