import type { BookingType } from "@/lib/api";
import type { Lead } from "@/lib/api";

export function buildLeadQuotationParams(lead: Lead): URLSearchParams {
  const params = new URLSearchParams();
  params.set("leadId", lead.id);
  params.set("leadName", lead.name);
  if (lead.destination) params.set("destination", lead.destination);
  if (lead.travelDateFrom) params.set("travelDateFrom", lead.travelDateFrom);
  if (lead.travelDateTo) params.set("travelDateTo", lead.travelDateTo);
  if (lead.travelerCount) params.set("travelerCount", String(lead.travelerCount));
  if (lead.budget) params.set("budget", String(lead.budget));
  return params;
}

export function buildLeadBookingParams(lead: Lead, type: BookingType = "tour"): URLSearchParams {
  const params = new URLSearchParams();
  params.set("new", "1");
  params.set("leadId", lead.id);
  params.set("clientName", lead.name);
  params.set("type", type);
  if (lead.phone) params.set("clientPhone", lead.phone);
  if (lead.email) params.set("clientEmail", lead.email);
  if (lead.destination) params.set("destination", lead.destination);
  if (lead.travelDateFrom) params.set("travelDateFrom", lead.travelDateFrom);
  if (lead.travelDateTo) params.set("travelDateTo", lead.travelDateTo);
  if (lead.travelerCount) params.set("travelerCount", String(lead.travelerCount));
  if (lead.budget) params.set("amount", String(lead.budget));
  return params;
}

export function parseLeadBookingPrefill(searchParams: URLSearchParams) {
  if (searchParams.get("new") !== "1") return null;
  const clientName = searchParams.get("clientName") || "";
  if (!clientName && !searchParams.get("destination")) return null;
  return {
    leadId: searchParams.get("leadId") || "",
    clientName,
    clientPhone: searchParams.get("clientPhone") || "",
    clientEmail: searchParams.get("clientEmail") || "",
    destination: searchParams.get("destination") || "",
    type: (searchParams.get("type") || "tour") as BookingType,
    amount: Number(searchParams.get("amount") || searchParams.get("budget") || 0),
    travelerCount: Math.max(1, Number(searchParams.get("travelerCount") || 1)),
    travelDateFrom: searchParams.get("travelDateFrom") || "",
    travelDateTo: searchParams.get("travelDateTo") || "",
  };
}
