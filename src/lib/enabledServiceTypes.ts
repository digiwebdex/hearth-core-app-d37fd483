import type { ServiceType } from "@/lib/serviceTypes";
import { SERVICE_TYPES } from "@/lib/serviceTypes";
import {
  PACKAGE_PRESET_CONFIG,
  type PackagePresetId,
} from "@/lib/packageRoutePresets";
import {
  deriveServiceTypesFromSubcategories,
  getSubcategoryIdsForCategories,
  normalizeEnabledSubcategories,
} from "@/lib/serviceCatalog";

/** All catalog service types — full-service agencies enable these for the team. */
export const ALL_SERVICE_TYPES: ServiceType[] = [...SERVICE_TYPES];

/** Shown in onboarding and settings (same as full catalog). */
export const ONBOARDING_SERVICE_TYPES: ServiceType[] = ALL_SERVICE_TYPES;

export function getFullServiceTypesPayload() {
  return {
    enabledServiceTypes: [...ALL_SERVICE_TYPES],
    enableHajjUmrahModule: true,
    enableBdOperationsModule: true,
  };
}

export function normalizeEnabledServiceTypes(values?: string[] | null): ServiceType[] {
  if (!values) return [];
  const list = Array.isArray(values) ? values : [String(values)];
  if (!list.length) return [];
  return list
    .map((v) => String(v).trim().toLowerCase())
    .filter((v): v is ServiceType => (SERVICE_TYPES as readonly string[]).includes(v));
}

export function showsAllServiceTypes(enabled: ServiceType[], subcategories?: string[] | null): boolean {
  const subs = normalizeEnabledSubcategories(subcategories);
  if (subs.length > 0) return false;
  return enabled.length === 0;
}

export function resolveEffectiveServiceTypes(
  enabled: ServiceType[],
  subcategories?: string[] | null,
): ServiceType[] {
  const subs = normalizeEnabledSubcategories(subcategories);
  if (subs.length > 0) return deriveServiceTypesFromSubcategories(subs);
  return enabled;
}

export function isServiceTypeEnabled(
  type: string | null | undefined,
  enabled: ServiceType[],
  subcategories?: string[] | null,
): boolean {
  if (showsAllServiceTypes(enabled, subcategories)) return true;
  const effective = resolveEffectiveServiceTypes(enabled, subcategories);
  return effective.includes(String(type || "").toLowerCase() as ServiceType);
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

export function deriveModuleFlagsFromServiceTypes(
  types: ServiceType[],
  subcategories?: string[] | null,
) {
  const effective = resolveEffectiveServiceTypes(types, subcategories);
  const flags: { enableHajjUmrahModule?: boolean; enableBdOperationsModule?: boolean } = {};
  const all = showsAllServiceTypes(types, subcategories);
  if (all || effective.includes("hajj_umrah")) flags.enableHajjUmrahModule = true;
  if (all || effective.includes("study_abroad") || effective.includes("b2b_agent")) {
    flags.enableBdOperationsModule = true;
  }
  return flags;
}

export function filterServiceTypesForTenant(
  all: readonly ServiceType[],
  enabled: ServiceType[],
  subcategories?: string[] | null,
): ServiceType[] {
  if (showsAllServiceTypes(enabled, subcategories)) return [...all];
  const effective = resolveEffectiveServiceTypes(enabled, subcategories);
  return all.filter((type) => effective.includes(type));
}

export function buildServiceSelectionPayload(subcategoryIds: string[]) {
  const enabledSubcategories = normalizeEnabledSubcategories(subcategoryIds);
  const enabledServiceTypes = deriveServiceTypesFromSubcategories(enabledSubcategories);
  return {
    enabledSubcategories,
    enabledServiceTypes,
    ...deriveModuleFlagsFromServiceTypes(enabledServiceTypes, enabledSubcategories),
  };
}

export { normalizeEnabledSubcategories, getSubcategoryIdsForCategories };
