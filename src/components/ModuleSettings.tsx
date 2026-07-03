import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layers, Info, Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { tenantApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import ServiceCatalogPicker from "@/components/ServiceCatalogPicker";
import {
  buildServiceSelectionPayload,
  normalizeEnabledSubcategories,
} from "@/lib/enabledServiceTypes";
import { ADVANCED_MODULES, planCanUseAdvancedModules } from "@/lib/moduleAccess";

export default function ModuleSettings() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { tenant, appRole, currentPlan, refreshTenant } = useAuth();
  const [saving, setSaving] = useState(false);
  const [savingModules, setSavingModules] = useState(false);
  const isBn = String(i18n.resolvedLanguage || i18n.language || "en").startsWith("bn");

  const savedSubs = useMemo(
    () => normalizeEnabledSubcategories(tenant?.enabledSubcategories),
    [tenant?.enabledSubcategories],
  );
  const [selectedSubs, setSelectedSubs] = useState<string[]>(savedSubs);

  const savedModules = useMemo(
    () => (Array.isArray(tenant?.enabledModules) ? tenant!.enabledModules! : []),
    [tenant?.enabledModules],
  );
  const [modules, setModules] = useState<string[]>(savedModules);

  useEffect(() => {
    setSelectedSubs(savedSubs);
  }, [savedSubs]);

  useEffect(() => {
    setModules(savedModules);
  }, [savedModules]);

  const canEdit = appRole === "tenant_owner" || appRole === "owner";
  const canUseAdvanced = planCanUseAdvancedModules(currentPlan);

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

  const toggleModule = (id: string, on: boolean) => {
    setModules((prev) => (on ? [...new Set([...prev, id])] : prev.filter((m) => m !== id)));
  };

  const handleSaveModules = async () => {
    if (!canEdit || !canUseAdvanced) return;
    setSavingModules(true);
    try {
      await tenantApi.update({ enabledModules: modules });
      await refreshTenant();
      toast({ title: t("settingsModules.saved") });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast({ title: t("settingsModules.saveFailed"), description: message, variant: "destructive" });
    } finally {
      setSavingModules(false);
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
        {/* ── Advanced modules (Business / Ultimate) ── */}
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              <Label>{t("settingsModules.advancedLabel")}</Label>
            </div>
            {!canUseAdvanced ? (
              <Badge variant="secondary" className="gap-1">
                <Lock className="h-3 w-3" />
                {t("settingsModules.businessOnly")}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">{t("settingsModules.advancedDesc")}</p>

          <div className="divide-y rounded-md border">
            {ADVANCED_MODULES.map((m) => {
              const on = modules.includes(m.id);
              return (
                <div key={m.id} className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t(m.labelKey)}</p>
                    <p className="text-xs text-muted-foreground">{t(m.descKey)}</p>
                  </div>
                  <Switch
                    checked={on}
                    disabled={!canEdit || !canUseAdvanced || savingModules}
                    onCheckedChange={(v) => toggleModule(m.id, v)}
                    aria-label={t(m.labelKey)}
                  />
                </div>
              );
            })}
          </div>

          {canEdit && canUseAdvanced ? (
            <Button size="sm" disabled={savingModules} onClick={handleSaveModules}>
              {t("settingsModules.saveModules")}
            </Button>
          ) : null}
          {canEdit && !canUseAdvanced ? (
            <p className="text-xs text-muted-foreground">{t("settingsModules.upgradeHint")}</p>
          ) : null}
        </div>

        {/* ── Service focus (drives catalog tabs and operations content) ── */}
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            <Label>{t("settingsModules.serviceTypesLabel")}</Label>
          </div>
          <p className="text-sm text-muted-foreground">{t("settingsModules.serviceTypesDesc")}</p>
          <ServiceCatalogPicker value={selectedSubs} onChange={setSelectedSubs} disabled={!canEdit || saving} />
          {canEdit ? (
            <Button size="sm" variant="outline" disabled={saving} onClick={handleSaveServiceTypes}>
              {t("settingsModules.saveServiceTypes")}
            </Button>
          ) : null}
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-dashed p-4 bg-muted/30">
          <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">
            {isBn
              ? "সব প্যাকেজে ডিফল্টভাবে প্রয়োজনীয় মূল মেনু চালু থাকে। অতিরিক্ত মডিউলগুলো শুধু Business ও Ultimate প্ল্যানের মালিকরা প্রয়োজন অনুযায়ী চালু করতে পারবেন।"
              : "Every plan starts with the essential core menu switched on. Advanced modules can be activated only by Business and Ultimate plan owners, when they need them."}
          </p>
        </div>

        {!canEdit ? (
          <p className="text-xs text-muted-foreground">{t("settingsModules.ownerOnly")}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
