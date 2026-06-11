import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { HajjGroup, HajjPackage } from "@/lib/hajjApi";
import { HajjPilgrimFormFields } from "./HajjPilgrimFormFields";
import type { HajjPilgrimFormState } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId: string | null;
  form: HajjPilgrimFormState;
  setForm: React.Dispatch<React.SetStateAction<HajjPilgrimFormState>>;
  packages: HajjPackage[];
  groups: HajjGroup[];
  onSubmit: (e: React.FormEvent) => void;
}

export function HajjPilgrimForm({ open, onOpenChange, editingId, form, setForm, packages, groups, onSubmit }: Props) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingId ? t("hajjForm.editPilgrim") : t("hajjForm.addPilgrim")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <HajjPilgrimFormFields form={form} setForm={setForm} packages={packages} groups={groups} />
          <div className="flex justify-end gap-2">
            <DialogClose asChild><Button type="button" variant="outline">{t("hajjForm.cancel")}</Button></DialogClose>
            <Button type="submit">{editingId ? t("hajjForm.update") : t("hajjForm.save")}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
