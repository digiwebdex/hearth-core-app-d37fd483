import type { ServiceType } from "@/lib/serviceTypes";
import { SERVICE_TYPES } from "@/lib/serviceTypes";
import {
  PACKAGE_PRESET_CONFIG,
  type PackagePresetId,
} from "@/lib/packageRoutePresets";

/** Common agency focus options shown in onboarding and settings. */
export const ONBOARDING_SERVICE_TYPES: ServiceType[] = [
  "tour_domestic",
  "tour_international",
  "hajj_umrah",
  "visa",
  "air_ticket",
  "hotel",
  "transport",
  "study_abroad",
  "medical_tourism",
  "corporate_travel",
];

export function normalizeEnabledServiceTypes(values?: string[] | null): ServiceType[] {
  if (!values) return [];
  const list = Array.isArray(values) ? values : [String(values)];
  if (!list.length) return [];
  return list
    .map((v) => String(v).trim().toLowerCase())
    .filter((v): v is ServiceType => (SERVICE_TYPES as readonly string[]).includes(v));
}

export function showsAllServiceTypes(enabled: ServiceType[]): boolean {
  return enabled.length === 0;
}

export function isServiceTypeEnabled(type: string | null | undefined, enabled: ServiceType[]): boolean {
  if (showsAllServiceTypes(enabled)) return true;
  return enabled.includes(String(type || "").toLowerCase() as ServiceType);
}

export function presetAllowedForServiceTypes(preset: PackagePresetId, enabled: ServiceType[]): boolean {
  if (preset === "all" || showsAllServiceTypes(enabled)) return true;

  const config = PACKAGE_PRESET_CONFIG[preset];
  if (config.filterMode === "single" && config.serviceType) {
    return enabled.includes(config.serviceType);
  }

  if (config.serviceTypes?.length) {
    return config.serviceTypes.some((type) => enabled.includes(type));
  }

  return true;
}

export function deriveModuleFlagsFromServiceTypes(types: ServiceType[]) {
  const flags: { enableHajjUmrahModule?: boolean; enableBdOperationsModule?: boolean } = {};
  if (types.includes("hajj_umrah")) flags.enableHajjUmrahModule = true;
  if (types.includes("study_abroad")) flags.enableBdOperationsModule = true;
  return flags;
}

export function filterServiceTypesForTenant(all: readonly ServiceType[], enabled: ServiceType[]): ServiceType[] {
  if (showsAllServiceTypes(enabled)) return [...all];
  return all.filter((type) => enabled.includes(type));
}
