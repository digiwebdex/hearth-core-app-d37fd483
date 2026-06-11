import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { HajjPackageFormState } from "./types";

interface Props {
  form: HajjPackageFormState;
  setForm: React.Dispatch<React.SetStateAction<HajjPackageFormState>>;
}

export function HajjPackageStayFields({ form, setForm }: Props) {
  const { t } = useTranslation();

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>{t("hajjForm.fields.makkahNights")}</Label>
          <Input type="number" min={0} value={form.makkahNights} onChange={(e) => setForm((v) => ({ ...v, makkahNights: Number(e.target.value || 0) }))} />
        </div>
        <div className="space-y-2">
          <Label>{t("hajjForm.fields.madinahNights")}</Label>
          <Input type="number" min={0} value={form.madinahNights} onChange={(e) => setForm((v) => ({ ...v, madinahNights: Number(e.target.value || 0) }))} />
        </div>
        <div className="space-y-2">
          <Label>{t("hajjForm.fields.makkahHotel")}</Label>
          <Input value={form.makkahHotel} onChange={(e) => setForm((v) => ({ ...v, makkahHotel: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>{t("hajjForm.fields.madinahHotel")}</Label>
          <Input value={form.madinahHotel} onChange={(e) => setForm((v) => ({ ...v, madinahHotel: e.target.value }))} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>{t("hajjForm.fields.flightInfo")}</Label>
          <Input value={form.flightInfo} onChange={(e) => setForm((v) => ({ ...v, flightInfo: e.target.value }))} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t("hajjForm.fields.notes")}</Label>
        <Textarea rows={3} value={form.notes} onChange={(e) => setForm((v) => ({ ...v, notes: e.target.value }))} />
      </div>
    </>
  );
}
