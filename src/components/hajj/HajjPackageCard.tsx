import { useTranslation } from "react-i18next";
import PermissionGate from "@/components/PermissionGate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Moon, Plane, Pencil } from "lucide-react";
import type { HajjPackage } from "@/lib/hajjApi";
import { getStatusMeta, PKG_STATUS_META } from "./constants";

interface Props {
  pkg: HajjPackage;
  onEdit: (pkg: HajjPackage) => void;
}

export function HajjPackageCard({ pkg, onEdit }: Props) {
  const { t } = useTranslation();
  const meta = getStatusMeta(PKG_STATUS_META, pkg.status);
  const occupancy = pkg.capacity > 0 ? Math.round((pkg.enrolled / pkg.capacity) * 100) : 0;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg flex items-center gap-2"><Moon className="h-4 w-4" /> {pkg.name}</CardTitle>
            <CardDescription>{pkg.type.toUpperCase()} • {pkg.duration}</CardDescription>
          </div>
          <Badge className={meta.color}>{t(meta.labelKey)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">{t("hajjForm.packageCard.price")}:</span><div className="font-medium">৳{pkg.packagePrice.toLocaleString()}</div></div>
          <div><span className="text-muted-foreground">{t("hajjForm.packageCard.profit")}:</span><div className="font-medium text-green-600">৳{pkg.profit.toLocaleString()}</div></div>
        </div>
        <div>
          <div className="flex items-center justify-between text-xs mb-1"><span>{t("hajjForm.packageCard.enrollment")}</span><span>{pkg.enrolled}/{pkg.capacity}</span></div>
          <Progress value={occupancy} />
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div><span className="text-muted-foreground">{t("hajjForm.packageCard.hotels")}:</span><div className="font-medium">{pkg.hotelClass.replace("_", "-")}</div></div>
          <div><span className="text-muted-foreground">{t("hajjForm.packageCard.flight")}:</span><div className="font-medium line-clamp-1">{pkg.flightInfo || "—"}</div></div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {pkg.visaIncluded && <Badge variant="secondary">{t("hajjForm.inclusions.visa")}</Badge>}
          {pkg.transportIncluded && <Badge variant="secondary">{t("hajjForm.inclusions.transport")}</Badge>}
          {pkg.mealsIncluded && <Badge variant="secondary">{t("hajjForm.inclusions.meals")}</Badge>}
          {pkg.ziyaratIncluded && <Badge variant="secondary">{t("hajjForm.inclusions.ziyarat")}</Badge>}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><Plane className="h-3 w-3" /> {pkg.departureDate || t("hajjForm.packageCard.tba")}</div>
          <PermissionGate module="hajj_umrah" action="edit">
            <Button variant="outline" size="sm" onClick={() => onEdit(pkg)}><Pencil className="mr-1 h-3.5 w-3.5" />{t("hajjForm.edit")}</Button>
          </PermissionGate>
        </div>
      </CardContent>
    </Card>
  );
}
