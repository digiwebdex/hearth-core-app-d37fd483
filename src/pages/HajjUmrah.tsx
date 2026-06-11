import { useState } from "react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/DashboardLayout";
import PermissionGate from "@/components/PermissionGate";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Moon } from "lucide-react";
import { useHajjData } from "@/hooks/useHajjData";
import { useHajjPilgrim } from "@/hooks/useHajjPilgrim";
import { HajjPilgrimStats } from "@/components/hajj/HajjPilgrimStats";
import { HajjPilgrimGroup } from "@/components/hajj/HajjPilgrimGroup";
import { HajjPilgrimsTab } from "@/components/hajj/HajjPilgrimsTab";
import { HajjPackagesTab } from "@/components/hajj/HajjPackagesTab";
import { HajjAnalyticsTab } from "@/components/hajj/HajjAnalyticsTab";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import type { HajjTopTab } from "@/components/hajj/types";

const HajjUmrah = () => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<HajjTopTab>("packages");

  const data = useHajjData();
  const pilgrim = useHajjPilgrim({
    packages: data.packages,
    groups: data.groups,
    pilgrims: data.pilgrims,
    setPilgrims: data.setPilgrims,
    getPackageName: data.getPackageName,
    getGroupName: data.getGroupName,
  });

  const isEmpty = !data.loading && data.packages.length === 0 && data.groups.length === 0 && data.pilgrims.length === 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Moon className="h-8 w-8" /> {t("pages.hajjTitle")}
            </h1>
            <p className="text-muted-foreground">{t("pages.hajjSubtitle")}</p>
          </div>
          <PermissionGate module="hajj_umrah" action="export">
            <Button variant="outline" size="sm" onClick={pilgrim.exportPilgrimsCsv}>
              <Download className="mr-1 h-4 w-4" /> {t("pages.export")}
            </Button>
          </PermissionGate>
        </div>

        <HajjPilgrimStats summary={data.summary} packageCount={data.packages.length} />
        {data.error ? <ErrorState message={data.error} onRetry={data.refetch} /> : null}
        {data.loading ? <LoadingState rows={6} /> : null}
        {isEmpty ? (
          <EmptyState title={t("hajjForm.emptyTitle")} description={t("hajjForm.emptyDesc")} />
        ) : null}

        {!data.loading && !isEmpty && (
          <Tabs value={tab} onValueChange={(v) => setTab(v as HajjTopTab)} className="space-y-4">
            <TabsList className="grid grid-cols-4 md:w-[520px]">
              <TabsTrigger value="packages">{t("hajjForm.tabs.packages")}</TabsTrigger>
              <TabsTrigger value="groups">{t("hajjForm.tabs.groups")}</TabsTrigger>
              <TabsTrigger value="pilgrims">{t("hajjForm.tabs.pilgrims")}</TabsTrigger>
              <TabsTrigger value="analytics">{t("hajjForm.tabs.analytics")}</TabsTrigger>
            </TabsList>

            <TabsContent value="packages">
              <HajjPackagesTab packages={data.packages} onSave={data.savePackage} />
            </TabsContent>

            <TabsContent value="groups">
              <HajjPilgrimGroup
                packages={data.packages}
                groups={data.groups}
                getPackageName={data.getPackageName}
                getPilgrimCountForGroup={data.getPilgrimCountForGroup}
                onSave={data.saveGroup}
                onDelete={data.deleteGroup}
              />
            </TabsContent>

            <TabsContent value="pilgrims">
              <HajjPilgrimsTab
                packages={data.packages}
                groups={data.groups}
                pilgrim={pilgrim}
                getPackageName={data.getPackageName}
                getGroupName={data.getGroupName}
              />
            </TabsContent>

            <TabsContent value="analytics">
              <HajjAnalyticsTab summary={data.summary} packages={data.packages} pkgProfitability={data.pkgProfitability} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
};

export default HajjUmrah;
