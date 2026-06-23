import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Moon, GraduationCap, Layers } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

  const hajjEnabled = tenant?.enableHajjUmrahModule !== false;
  const bdEnabled = tenant?.enableBdOperationsModule === true;
  const canEdit = appRole === "tenant_owner" || appRole === "owner";

  const handleSaveServiceTypes = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
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

  const handleHajjToggle = async (checked: boolean) => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await tenantApi.update({ enableHajjUmrahModule: checked });
      await refreshTenant();
      toast({ title: t("settingsModules.saved") });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast({ title: t("settingsModules.saveFailed"), description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleBdToggle = async (checked: boolean) => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await tenantApi.update({ enableBdOperationsModule: checked });
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
          <Moon className="h-5 w-5" />
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

        <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
          <div className="space-y-1">
            <Label htmlFor="hajj-module">{t("settingsModules.hajjLabel")}</Label>
            <p className="text-sm text-muted-foreground">{t("settingsModules.hajjDesc")}</p>
          </div>
          <Switch
            id="hajj-module"
            checked={hajjEnabled}
            disabled={!canEdit || saving}
            onCheckedChange={handleHajjToggle}
          />
        </div>
        <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
          <div className="space-y-1">
            <Label htmlFor="bd-module" className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              {t("settingsModules.bdLabel")}
            </Label>
            <p className="text-sm text-muted-foreground">{t("settingsModules.bdDesc")}</p>
          </div>
          <Switch
            id="bd-module"
            checked={bdEnabled}
            disabled={!canEdit || saving}
            onCheckedChange={handleBdToggle}
          />
        </div>
        {!canEdit ? (
          <p className="text-xs text-muted-foreground">{t("settingsModules.ownerOnly")}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
