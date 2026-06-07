export const SERVICE_TYPES = [
  "hajj_umrah",
  "tour_domestic",
  "tour_international",
  "visa",
  "air_ticket",
  "hotel",
  "transport",
  "cruise",
  "study_abroad",
  "medical_tourism",
  "corporate_travel",
  "mice_event",
  "b2b_agent",
  "custom",
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

export function normalizeServiceType(value?: string | null): ServiceType {
  const normalized = String(value || "custom").trim().toLowerCase();
  return (SERVICE_TYPES as readonly string[]).includes(normalized)
    ? (normalized as ServiceType)
    : "custom";
}

export function getServiceTypeLabel(value?: string | null): string {
  return getLocalizedServiceTypeLabel(value, false);
}

export function getLocalizedServiceTypeLabel(value?: string | null, isBn = false): string {
  switch (normalizeServiceType(value)) {
    case "hajj_umrah":
      return isBn ? "হজ্জ / উমরাহ" : "Hajj / Umrah";
    case "tour_domestic":
      return isBn ? "ডোমেস্টিক ট্যুর" : "Domestic Tour";
    case "tour_international":
      return isBn ? "ইন্টারন্যাশনাল ট্যুর" : "International Tour";
    case "visa":
      return isBn ? "ভিসা" : "Visa";
    case "air_ticket":
      return isBn ? "এয়ার টিকেট" : "Air Ticket";
    case "hotel":
      return isBn ? "হোটেল" : "Hotel";
    case "transport":
      return isBn ? "ট্রান্সপোর্ট / কার রেন্টাল" : "Transport / Car Rental";
    case "cruise":
      return isBn ? "ক্রুজ / লঞ্চ" : "Cruise / Launch";
    case "study_abroad":
      return isBn ? "স্টাডি অ্যাবরড" : "Study Abroad";
    case "medical_tourism":
      return isBn ? "মেডিকেল ট্যুরিজম" : "Medical Tourism";
    case "corporate_travel":
      return isBn ? "কর্পোরেট ট্রাভেল" : "Corporate Travel";
    case "mice_event":
      return isBn ? "মাইস / ইভেন্ট ট্রাভেল" : "MICE / Event Travel";
    case "b2b_agent":
      return isBn ? "বি টু বি এজেন্ট / সাব-এজেন্ট" : "B2B Agent / Sub-Agent";
    default:
      return isBn ? "কাস্টম" : "Custom";
  }
}
