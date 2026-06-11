import { useTranslation } from "react-i18next";
import PermissionGate from "@/components/PermissionGate";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { HajjGroup, HajjPackage } from "@/lib/hajjApi";
import { useHajjPilgrim } from "@/hooks/useHajjPilgrim";
import { HajjPilgrimFilters } from "./HajjPilgrimFilters";
import { HajjPilgrimsList } from "./HajjPilgrimsList";
import { HajjPilgrimForm } from "./HajjPilgrimForm";
import { HajjPilgrimPayment } from "./HajjPilgrimPayment";
import { HajjPilgrimDetails } from "./HajjPilgrimDetails";
import { HajjPilgrimTabs } from "./HajjPilgrimTabs";

interface Props {
  packages: HajjPackage[];
  groups: HajjGroup[];
  pilgrim: ReturnType<typeof useHajjPilgrim>;
  getPackageName: (id: string) => string;
  getGroupName: (id: string) => string;
}

export function HajjPilgrimsTab({ packages, groups, pilgrim, getPackageName, getGroupName }: Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{t("hajjForm.tabs.pilgrims")}</h2>
          <p className="text-sm text-muted-foreground">{t("hajjForm.pilgrimsSubtitle")}</p>
        </div>
        <PermissionGate module="hajj_umrah" action="create">
          <Button onClick={pilgrim.openCreatePilgrim}>
            <Plus className="mr-2 h-4 w-4" />
            {t("hajjForm.addPilgrim")}
          </Button>
        </PermissionGate>
      </div>
      <HajjPilgrimFilters filters={pilgrim.filters} onChange={pilgrim.setFilters} packages={packages} groups={groups} />
      <HajjPilgrimsList
        pilgrims={pilgrim.paginatedPilgrims}
        totalCount={pilgrim.filteredPilgrims.length}
        page={pilgrim.page}
        pageSize={pilgrim.pageSize}
        totalPages={pilgrim.totalPages}
        onPageChange={pilgrim.setPage}
        onPageSizeChange={(size) => { pilgrim.setPageSize(size); pilgrim.setPage(1); }}
        getPackageName={getPackageName}
        getGroupName={getGroupName}
        onView={pilgrim.selectPilgrim}
        onEdit={pilgrim.openEditPilgrim}
        onDelete={pilgrim.deletePilgrim}
        onPay={pilgrim.openPayDialog}
      />
      {pilgrim.selectedPilgrim ? (
        <>
          <HajjPilgrimDetails
            pilgrim={pilgrim.selectedPilgrim}
            packageName={getPackageName(pilgrim.selectedPilgrim.packageId)}
            groupName={getGroupName(pilgrim.selectedPilgrim.groupId)}
          />
          <HajjPilgrimTabs pilgrim={pilgrim.selectedPilgrim} payments={pilgrim.selectedPilgrimPayments} />
        </>
      ) : null}
      <HajjPilgrimForm
        open={pilgrim.pilgrimDialogOpen}
        onOpenChange={pilgrim.setPilgrimDialogOpen}
        editingId={pilgrim.editingPilgrimId}
        form={pilgrim.pilgrimForm}
        setForm={pilgrim.setPilgrimForm}
        packages={packages}
        groups={pilgrim.groupsForPilgrimForm}
        onSubmit={pilgrim.submitPilgrim}
      />
      <HajjPilgrimPayment
        open={pilgrim.payDialogOpen}
        onOpenChange={pilgrim.setPayDialogOpen}
        pilgrim={pilgrim.selectedPilgrim}
        form={pilgrim.payForm}
        setForm={pilgrim.setPayForm}
        onSubmit={pilgrim.submitPayment}
      />
    </div>
  );
}
