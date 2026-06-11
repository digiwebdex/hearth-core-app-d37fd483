import { useState } from "react";
import { useTranslation } from "react-i18next";
import PermissionGate from "@/components/PermissionGate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import type { HajjPackage } from "@/lib/hajjApi";
import { emptyPkgForm } from "./constants";
import { HajjPackageCard } from "./HajjPackageCard";
import { HajjPackageForm } from "./HajjPackageForm";
import type { HajjPackageFormState } from "./types";

interface Props {
  packages: HajjPackage[];
  onSave: (form: HajjPackageFormState, editingId: string | null) => Promise<void>;
}

export function HajjPackagesTab({ packages, onSave }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<HajjPackageFormState>(emptyPkgForm);

  const reset = () => { setForm(emptyPkgForm); setEditingId(null); };

  const editPkg = (pkg: HajjPackage) => {
    setForm({
      name: pkg.name, type: pkg.type, status: pkg.status, duration: pkg.duration,
      makkahNights: pkg.makkahNights, madinahNights: pkg.madinahNights,
      makkahHotel: pkg.makkahHotel ?? "", madinahHotel: pkg.madinahHotel ?? "",
      hotelClass: pkg.hotelClass, flightInfo: pkg.flightInfo ?? "",
      visaIncluded: pkg.visaIncluded, transportIncluded: pkg.transportIncluded,
      mealsIncluded: pkg.mealsIncluded, ziyaratIncluded: pkg.ziyaratIncluded,
      packagePrice: pkg.packagePrice, costPrice: pkg.costPrice, capacity: pkg.capacity,
      departureDate: pkg.departureDate ?? "", returnDate: pkg.returnDate ?? "",
      highlights: pkg.highlights ?? "", notes: pkg.notes ?? "",
    });
    setEditingId(pkg.id);
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(form, editingId);
    reset();
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{t("hajjForm.tabs.packages")}</h2>
          <p className="text-sm text-muted-foreground">{t("hajjForm.packagesSubtitle")}</p>
        </div>
        <PermissionGate module="hajj_umrah" action="create">
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild><Button onClick={reset}><Plus className="mr-2 h-4 w-4" />{t("hajjForm.addPackage")}</Button></DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editingId ? t("hajjForm.editPackage") : t("hajjForm.addPackage")}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <HajjPackageForm form={form} setForm={setForm} editingId={editingId} />
              </form>
            </DialogContent>
          </Dialog>
        </PermissionGate>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {packages.map((pkg) => <HajjPackageCard key={pkg.id} pkg={pkg} onEdit={editPkg} />)}
      </div>
    </div>
  );
}
