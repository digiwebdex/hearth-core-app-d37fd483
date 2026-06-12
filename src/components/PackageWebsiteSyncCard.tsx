import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Globe, AlertCircle, CheckCircle2, FileEdit, Archive } from "lucide-react";
import type { TravelPackage } from "@/lib/travelPackageApi";
import { getPackageWebsiteSync, summarizePackageWebsiteSync } from "@/lib/packageWebsiteSync";

interface PackageWebsiteSyncCardProps {
  packages: TravelPackage[];
}

export default function PackageWebsiteSyncCard({ packages }: PackageWebsiteSyncCardProps) {
  const { t } = useTranslation();
  const counts = summarizePackageWebsiteSync(packages);

  const items = [
    { key: "live", count: counts.live, icon: CheckCircle2, variant: "default" as const },
    { key: "incomplete", count: counts.published_incomplete, icon: AlertCircle, variant: "secondary" as const },
    { key: "draft", count: counts.draft, icon: FileEdit, variant: "outline" as const },
    { key: "archived", count: counts.archived, icon: Archive, variant: "outline" as const },
  ];

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="h-5 w-5" />
          {t("packageWebsiteSync.title")}
        </CardTitle>
        <CardDescription>{t("packageWebsiteSync.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {items.map(({ key, count, icon: Icon, variant }) => (
            <Badge key={key} variant={variant} className="gap-1.5 py-1 px-2.5">
              <Icon className="h-3.5 w-3.5" />
              {t(`packageWebsiteSync.status.${key}`)}: {count}
            </Badge>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{t("packageWebsiteSync.autoSyncNote")}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/site/packages" target="_blank" rel="noopener noreferrer">
              {t("packageWebsiteSync.previewPublic")}
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/website">{t("packageWebsiteSync.openWebsite")}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const BADGE_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  live: "default",
  published_incomplete: "secondary",
  draft: "outline",
  archived: "outline",
};

export function PackageWebsiteSyncBadge({ pkg }: { pkg: TravelPackage }) {
  const { t } = useTranslation();
  const sync = getPackageWebsiteSync(pkg);
  const labelKey =
    sync.status === "published_incomplete"
      ? "packageWebsiteSync.status.incomplete"
      : `packageWebsiteSync.status.${sync.status}`;

  return (
    <Badge variant={BADGE_VARIANT[sync.status] || "outline"} title={t(sync.hintKey)}>
      {t(labelKey)}
    </Badge>
  );
}
