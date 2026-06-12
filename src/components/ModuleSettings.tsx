import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Moon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { tenantApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function ModuleSettings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { tenant, appRole, refreshTenant } = useAuth();
  const [saving, setSaving] = useState(false);

  const enabled = tenant?.enableHajjUmrahModule !== false;
  const canEdit = appRole === "tenant_owner" || appRole === "owner";

  const handleToggle = async (checked: boolean) => {
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
        <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
          <div className="space-y-1">
            <Label htmlFor="hajj-module">{t("settingsModules.hajjLabel")}</Label>
            <p className="text-sm text-muted-foreground">{t("settingsModules.hajjDesc")}</p>
          </div>
          <Switch
            id="hajj-module"
            checked={enabled}
            disabled={!canEdit || saving}
            onCheckedChange={handleToggle}
          />
        </div>
        {!canEdit ? (
          <p className="text-xs text-muted-foreground">{t("settingsModules.ownerOnly")}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
