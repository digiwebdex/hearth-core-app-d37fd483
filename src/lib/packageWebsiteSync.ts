import type { TravelPackage } from "@/lib/travelPackageApi";

export type PackageWebsiteSyncStatus = "live" | "published_incomplete" | "draft" | "archived";

export interface PackageWebsiteSyncInfo {
  status: PackageWebsiteSyncStatus;
  labelKey: string;
  hintKey: string;
}

/** Published packages appear on the public site automatically when complete. */
export function getPackageWebsiteSync(pkg: TravelPackage): PackageWebsiteSyncInfo {
  const status = String(pkg.status || "draft").toLowerCase();

  if (status === "archived") {
    return {
      status: "archived",
      labelKey: "packageWebsiteSync.status.archived",
      hintKey: "packageWebsiteSync.hint.archived",
    };
  }

  if (status !== "published") {
    return {
      status: "draft",
      labelKey: "packageWebsiteSync.status.draft",
      hintKey: "packageWebsiteSync.hint.draft",
    };
  }

  const hasSlug = Boolean(String(pkg.slug || "").trim());
  const hasImage = Boolean(pkg.heroImage || (pkg.media?.length ?? 0) > 0);

  if (hasSlug && hasImage) {
    return {
      status: "live",
      labelKey: "packageWebsiteSync.status.live",
      hintKey: "packageWebsiteSync.hint.live",
    };
  }

  return {
    status: "published_incomplete",
    labelKey: "packageWebsiteSync.status.incomplete",
    hintKey: "packageWebsiteSync.hint.incomplete",
  };
}

export function summarizePackageWebsiteSync(packages: TravelPackage[]) {
  const counts = { live: 0, published_incomplete: 0, draft: 0, archived: 0 };
  for (const pkg of packages) {
    counts[getPackageWebsiteSync(pkg).status] += 1;
  }
  return counts;
}
