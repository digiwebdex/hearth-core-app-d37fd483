import type { ServiceType } from "@/lib/serviceTypes";

export const PACKAGE_PRESET_IDS = [
  "all",
  "tour",
  "hajj",
  "umrah",
  "visa",
  "hotel",
  "student",
  "manpower",
] as const;

export type PackagePresetId = (typeof PACKAGE_PRESET_IDS)[number];

export const DEFAULT_PACKAGE_PRESET: PackagePresetId = "tour";

export function isPackagePreset(value: string): value is PackagePresetId {
  return (PACKAGE_PRESET_IDS as readonly string[]).includes(value);
}

export interface PackagePresetConfig {
  /** Single serviceType for dropdown sync, or "all" / "multi" */
  filterMode: "all" | "single" | "multi" | "keywords";
  serviceType?: ServiceType;
  serviceTypes?: ServiceType[];
  titleKeywords?: string[];
  defaultServiceType?: ServiceType;
}

export const PACKAGE_PRESET_CONFIG: Record<PackagePresetId, PackagePresetConfig> = {
  all: { filterMode: "all", defaultServiceType: "tour_domestic" },
  tour: {
    filterMode: "multi",
    serviceTypes: ["tour_domestic", "tour_international"],
    defaultServiceType: "tour_domestic",
  },
  hajj: {
    filterMode: "keywords",
    serviceTypes: ["hajj_umrah"],
    titleKeywords: ["hajj", "haj", "হজ"],
    defaultServiceType: "hajj_umrah",
  },
  umrah: {
    filterMode: "keywords",
    serviceTypes: ["hajj_umrah"],
    titleKeywords: ["umrah", "উমরাহ"],
    defaultServiceType: "hajj_umrah",
  },
  visa: { filterMode: "single", serviceType: "visa", defaultServiceType: "visa" },
  hotel: { filterMode: "single", serviceType: "hotel", defaultServiceType: "hotel" },
  student: {
    filterMode: "single",
    serviceType: "study_abroad",
    defaultServiceType: "study_abroad",
  },
  manpower: {
    filterMode: "multi",
    serviceTypes: ["corporate_travel", "b2b_agent", "custom"],
    defaultServiceType: "custom",
  },
};

export function packageMatchesPreset(
  item: { serviceType?: string | null; title?: string | null; code?: string | null },
  preset: PackagePresetId,
): boolean {
  const config = PACKAGE_PRESET_CONFIG[preset];
  if (config.filterMode === "all") return true;

  const type = String(item.serviceType || "").toLowerCase();
  const haystack = `${item.title || ""} ${item.code || ""}`.toLowerCase();

  if (config.filterMode === "single" && config.serviceType) {
    return type === config.serviceType;
  }

  if (config.serviceTypes?.length) {
    const typeMatch = config.serviceTypes.includes(type as ServiceType);
    if (config.filterMode === "multi") return typeMatch;
    if (config.filterMode === "keywords") {
      if (!typeMatch) return false;
      if (!config.titleKeywords?.length) return true;
      return config.titleKeywords.some((kw) => haystack.includes(kw.toLowerCase()));
    }
  }

  return true;
}

export function serviceTypeToPackagePreset(serviceType: string): PackagePresetId | "all" {
  switch (serviceType) {
    case "tour_domestic":
    case "tour_international":
      return "tour";
    case "hajj_umrah":
      return "hajj";
    case "visa":
      return "visa";
    case "hotel":
      return "hotel";
    case "study_abroad":
      return "student";
    case "corporate_travel":
    case "b2b_agent":
      return "manpower";
    default:
      return "all";
  }
}

export function packagePresetPath(preset: PackagePresetId): string {
  return preset === "all" ? "/packages/all" : `/packages/${preset}`;
}
