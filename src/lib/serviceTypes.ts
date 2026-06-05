export const SERVICE_TYPES = [
  "hajj_umrah",
  "tour_domestic",
  "tour_international",
  "visa",
  "air_ticket",
  "hotel",
  "transport",
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
  switch (normalizeServiceType(value)) {
    case "hajj_umrah":
      return "Hajj / Umrah";
    case "tour_domestic":
      return "Domestic Tour";
    case "tour_international":
      return "International Tour";
    case "visa":
      return "Visa";
    case "air_ticket":
      return "Air Ticket";
    case "hotel":
      return "Hotel";
    case "transport":
      return "Transport";
    default:
      return "Custom";
  }
}
