import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layers, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { tenantApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import ServiceCatalogPicker from "@/components/ServiceCatalogPicker";
import {
  buildServiceSelectionPayload,
  normalizeEnabledSubcategories,
} from "@/lib/enabledServiceTypes";

export default function ModuleSettings() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { tenant, appRole, refreshTenant } = useAuth();
  const [saving, setSaving] = useState(false);
  const isBn = String(i18n.resolvedLanguage || i18n.language || "en").startsWith("bn");

  const savedSubs = useMemo(
    () => normalizeEnabledSubcategories(tenant?.enabledSubcategories),
    [tenant?.enabledSubcategories],
  );
  const [selectedSubs, setSelectedSubs] = useState<string[]>(savedSubs);

  useEffect(() => {
    setSelectedSubs(savedSubs);
  }, [savedSubs]);

  const canEdit = appRole === "tenant_owner" || appRole === "owner";

  const handleSaveServiceTypes = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      // buildServiceSelectionPayload also derives the Hajj/BD ops-desk flags
      // from the chosen services, so menus update automatically — no separate toggle.
      await tenantApi.update(buildServiceSelectionPayload(selectedSubs));
      await refreshTenant();
      toast({ title: t("settingsModules.saved") });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast({ title: t("settingsModules.saveFailed"), description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          {t("settingsModules.title")}
        </CardTitle>
        <CardDescription>{t("settingsModules.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            <Label>{t("settingsModules.serviceTypesLabel")}</Label>
          </div>
          <p className="text-sm text-muted-foreground">{t("settingsModules.serviceTypesDesc")}</p>
          <ServiceCatalogPicker value={selectedSubs} onChange={setSelectedSubs} disabled={!canEdit || saving} />
          {canEdit ? (
            <Button size="sm" disabled={saving} onClick={handleSaveServiceTypes}>
              {t("settingsModules.saveServiceTypes")}
            </Button>
          ) : null}
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-dashed p-4 bg-muted/30">
          <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">
            {isBn
              ? "আপনার নির্বাচিত সার্ভিস অনুযায়ী মেনু ও অপারেশন ডেস্ক স্বয়ংক্রিয়ভাবে দেখানো হবে। যেমন — Hajj/Umrah সিলেক্ট করলে Hajj অপারেশন ডেস্ক, এবং Student/Manpower সিলেক্ট করলে BD অপারেশন ডেস্ক আপনাআপনি যুক্ত হবে। আলাদা কোনো সুইচ চালু করার দরকার নেই।"
              : "Menus and operations desks appear automatically based on the services you select above. For example, selecting Hajj/Umrah adds the Hajj operations desk, and selecting Student/Manpower adds the BD operations desk — no separate switch needed."}
          </p>
        </div>

        {!canEdit ? (
          <p className="text-xs text-muted-foreground">{t("settingsModules.ownerOnly")}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
