import type { BookingType, QuotationItemType } from "@/lib/api";
import type { BookingPresetId } from "@/lib/bookingRoutePresets";
import type { ServiceDeskId } from "@/lib/bookingServiceDetails";
import { SERVICE_TYPES, type ServiceType } from "@/lib/serviceTypes";
import {
  resolveEffectiveServiceTypes,
  showsAllServiceTypes,
  normalizeEnabledServiceTypes,
} from "@/lib/enabledServiceTypes";

const DEFAULT_TYPES: BookingType[] = ["tour", "ticket", "hotel", "visa"];

function effectiveTypes(
  enabledServiceTypes?: string[] | null,
  enabledSubcategories?: string[] | null,
) {
  const types = normalizeEnabledServiceTypes(enabledServiceTypes);
  const subs = enabledSubcategories || [];
  const all = showsAllServiceTypes(types, subs);
  const effective = resolveEffectiveServiceTypes(types, subs);
  return { all, effective, subs };
}

function hasService(effective: ServiceType[], t: ServiceType) {
  return effective.includes(t);
}

export function getTenantBookingTypes(
  enabledServiceTypes?: string[] | null,
  enabledSubcategories?: string[] | null,
): BookingType[] {
  const { all, effective, subs } = effectiveTypes(enabledServiceTypes, enabledSubcategories);

  if (all) {
    return ["tour", "ticket", "hotel", "visa", "package", "transport", "student", "manpower", "insurance", "corporate"];
  }

  const out = new Set<BookingType>();

  if (hasService(effective, "tour_domestic") || hasService(effective, "tour_international") || hasService(effective, "cruise") || hasService(effective, "medical_tourism")) {
    out.add("tour");
  }
  if (hasService(effective, "air_ticket")) out.add("ticket");
  if (hasService(effective, "hotel")) out.add("hotel");
  if (hasService(effective, "visa")) out.add("visa");
  if (hasService(effective, "hajj_umrah")) out.add("package");
  if (hasService(effective, "transport")) out.add("transport");
  if (hasService(effective, "study_abroad")) out.add("student");
  if (hasService(effective, "b2b_agent")) out.add("manpower");
  if (hasService(effective, "corporate_travel") || hasService(effective, "mice_event")) out.add("corporate");

  if (subs.some((id) => id.startsWith("ins_"))) out.add("insurance");

  return out.size > 0 ? [...out] : DEFAULT_TYPES;
}

export function getTenantBookingPresets(
  enabledServiceTypes?: string[] | null,
  enabledSubcategories?: string[] | null,
): BookingPresetId[] {
  const bookingTypes = new Set(getTenantBookingTypes(enabledServiceTypes, enabledSubcategories));
  const { all, effective } = effectiveTypes(enabledServiceTypes, enabledSubcategories);
  const presets: BookingPresetId[] = [];

  if (bookingTypes.has("tour")) presets.push("tour");
  if (bookingTypes.has("ticket")) presets.push("flight");
  if (bookingTypes.has("hotel")) presets.push("hotel");
  if (all || hasService(effective, "hajj_umrah")) {
    presets.push("hajj", "umrah");
  }
  if (bookingTypes.has("visa")) presets.push("visa");
  if (bookingTypes.has("transport")) presets.push("transport");
  if (bookingTypes.has("student")) presets.push("student");
  if (bookingTypes.has("manpower")) presets.push("manpower");
  if (bookingTypes.has("corporate")) presets.push("corporate");
  if (bookingTypes.has("insurance")) presets.push("insurance");

  return presets;
}

export function getTenantServiceTypes(
  enabledServiceTypes?: string[] | null,
  enabledSubcategories?: string[] | null,
): ServiceType[] {
  const { all, effective } = effectiveTypes(enabledServiceTypes, enabledSubcategories);
  if (all) return [...SERVICE_TYPES];
  return SERVICE_TYPES.filter((t) => t === "custom" || effective.includes(t));
}

export function getTenantQuotationItemTypes(
  enabledServiceTypes?: string[] | null,
  enabledSubcategories?: string[] | null,
): QuotationItemType[] {
  const { all, effective, subs } = effectiveTypes(enabledServiceTypes, enabledSubcategories);
  const always: QuotationItemType[] = ["activity", "service_fee", "discount", "tax"];

  if (all) {
    return ["hotel", "flight", "visa", "transport", "tour", ...always, "insurance"];
  }

  const out = new Set<QuotationItemType>(always);
  if (hasService(effective, "air_ticket")) out.add("flight");
  if (hasService(effective, "hotel")) out.add("hotel");
  if (hasService(effective, "visa")) out.add("visa");
  if (hasService(effective, "transport")) out.add("transport");
  if (
    hasService(effective, "tour_domestic") ||
    hasService(effective, "tour_international") ||
    hasService(effective, "cruise") ||
    hasService(effective, "medical_tourism") ||
    hasService(effective, "hajj_umrah")
  ) {
    out.add("tour");
  }
  if (subs.some((id) => id.startsWith("ins_"))) out.add("insurance");

  return [...out];
}

export function bookingTypeFromServiceTypes(
  enabledServiceTypes?: string[] | null,
  enabledSubcategories?: string[] | null,
): BookingType {
  const list = getTenantBookingTypes(enabledServiceTypes, enabledSubcategories);
  return list[0] || "tour";
}

export function getTenantServiceDesks(
  enabledServiceTypes?: string[] | null,
  enabledSubcategories?: string[] | null,
): ServiceDeskId[] {
  const types = new Set(getTenantBookingTypes(enabledServiceTypes, enabledSubcategories));
  const desks: ServiceDeskId[] = [];
  if (types.has("visa")) desks.push("visa");
  if (types.has("ticket")) desks.push("ticket");
  if (types.has("hotel")) desks.push("hotel");
  if (types.has("transport")) desks.push("transport");
  if (types.has("insurance")) desks.push("insurance");
  if (types.has("tour") || types.has("package")) desks.push("departures");
  return desks.length > 0 ? desks : ["visa", "ticket", "hotel", "transport", "departures"];
}
