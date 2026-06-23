const SERVICE_TYPES = [
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
];

function normalizeServiceType(value) {
  const normalized = String(value || "custom").trim().toLowerCase();
  return SERVICE_TYPES.includes(normalized) ? normalized : "custom";
}

function serviceTypeLabel(value) {
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
    case "cruise":
      return "Cruise / Launch";
    case "study_abroad":
      return "Study Abroad";
    case "medical_tourism":
      return "Medical Tourism";
    case "corporate_travel":
      return "Corporate Travel";
    case "mice_event":
      return "MICE / Event Travel";
    case "b2b_agent":
      return "B2B Agent / Sub-Agent";
    default:
      return "Custom";
  }
}

module.exports = {
  SERVICE_TYPES,
  normalizeServiceType,
  serviceTypeLabel,
};
