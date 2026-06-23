import type { BookingType } from "@/lib/api";
import type { ServiceType } from "@/lib/serviceTypes";
import {
  resolveEffectiveServiceTypes,
  showsAllServiceTypes,
  normalizeEnabledServiceTypes,
} from "@/lib/enabledServiceTypes";

const DEFAULT_TYPES: BookingType[] = ["tour", "ticket", "hotel", "visa"];

export function getTenantBookingTypes(
  enabledServiceTypes?: string[] | null,
  enabledSubcategories?: string[] | null,
): BookingType[] {
  const types = normalizeEnabledServiceTypes(enabledServiceTypes);
  const subs = enabledSubcategories || [];
  const all = showsAllServiceTypes(types, subs);
  const effective = resolveEffectiveServiceTypes(types, subs);

  if (all) {
    return ["tour", "ticket", "hotel", "visa", "package", "transport", "student", "manpower", "insurance", "corporate"];
  }

  const out = new Set<BookingType>();
  const has = (t: ServiceType) => effective.includes(t);

  if (has("tour_domestic") || has("tour_international") || has("cruise") || has("medical_tourism")) {
    out.add("tour");
  }
  if (has("air_ticket")) out.add("ticket");
  if (has("hotel")) out.add("hotel");
  if (has("visa")) out.add("visa");
  if (has("hajj_umrah")) out.add("package");
  if (has("transport")) out.add("transport");
  if (has("study_abroad")) out.add("student");
  if (has("b2b_agent")) out.add("manpower");
  if (has("corporate_travel") || has("mice_event")) out.add("corporate");

  if (subs.some((id) => id.startsWith("ins_"))) out.add("insurance");

  return out.size > 0 ? [...out] : DEFAULT_TYPES;
}

export function bookingTypeFromServiceTypes(
  enabledServiceTypes?: string[] | null,
  enabledSubcategories?: string[] | null,
): BookingType {
  const list = getTenantBookingTypes(enabledServiceTypes, enabledSubcategories);
  return list[0] || "tour";
}
