import type { BookingType } from "@/lib/api";

export const BOOKING_PRESET_IDS = [
  "all",
  "tour",
  "flight",
  "hotel",
  "hajj",
  "umrah",
  "visa",
  "transport",
  "student",
  "manpower",
] as const;

export type BookingPresetId = (typeof BOOKING_PRESET_IDS)[number];

export const DEFAULT_BOOKING_PRESET: BookingPresetId = "all";

export function isBookingPreset(value: string): value is BookingPresetId {
  return (BOOKING_PRESET_IDS as readonly string[]).includes(value);
}

export interface BookingPresetConfig {
  typeFilter: BookingType | "all";
  titleKeywords?: string[];
}

export const BOOKING_PRESET_CONFIG: Record<BookingPresetId, BookingPresetConfig> = {
  all: { typeFilter: "all" },
  tour: { typeFilter: "tour" },
  flight: { typeFilter: "ticket" },
  hotel: { typeFilter: "hotel" },
  hajj: { typeFilter: "package", titleKeywords: ["hajj", "haj", "হজ"] },
  umrah: { typeFilter: "package", titleKeywords: ["umrah", "উমরাহ"] },
  visa: { typeFilter: "visa" },
  transport: { typeFilter: "transport" },
  student: { typeFilter: "student" },
  manpower: { typeFilter: "manpower" },
};

export function bookingMatchesPreset(
  booking: {
    type?: string | null;
    title?: string | null;
    packageTitleSnapshot?: string | null;
    destination?: string | null;
  },
  preset: BookingPresetId,
): boolean {
  const config = BOOKING_PRESET_CONFIG[preset];
  if (config.typeFilter !== "all" && booking.type !== config.typeFilter) return false;
  if (!config.titleKeywords?.length) return true;

  const haystack = `${booking.title || ""} ${booking.packageTitleSnapshot || ""} ${booking.destination || ""}`.toLowerCase();
  return config.titleKeywords.some((kw) => haystack.includes(kw.toLowerCase()));
}

export function bookingTypeToPreset(type: string): BookingPresetId {
  switch (type) {
    case "tour":
      return "tour";
    case "ticket":
      return "flight";
    case "hotel":
      return "hotel";
    case "visa":
      return "visa";
    case "transport":
      return "transport";
    case "student":
      return "student";
    case "manpower":
      return "manpower";
    case "package":
      return "hajj";
    default:
      return "all";
  }
}

export function bookingPresetPath(preset: BookingPresetId): string {
  return preset === "all" ? "/bookings" : `/bookings/${preset}`;
}

export function bookingPresetToTypeFilter(preset: BookingPresetId): string {
  return BOOKING_PRESET_CONFIG[preset].typeFilter;
}
