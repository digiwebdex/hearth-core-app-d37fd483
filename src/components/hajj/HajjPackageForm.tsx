import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogClose } from "@/components/ui/dialog";
import type { HajjPackageStatus, HajjPackageType } from "@/lib/hajjApi";
import { HOTEL_CLASSES, PKG_STATUS_META } from "./constants";
import { HajjPackageStayFields } from "./HajjPackageStayFields";
import type { HajjPackageFormState } from "./types";

interface Props {
  form: HajjPackageFormState;
  setForm: React.Dispatch<React.SetStateAction<HajjPackageFormState>>;
  editingId: string | null;
}

export function HajjPackageForm({ form, setForm, editingId }: Props) {
  const { t } = useTranslation();

  return (
  <>
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2"><Label>{t("hajjForm.fields.name")}</Label><Input value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} required /></div>
      <div className="space-y-2"><Label>{t("hajjForm.fields.type")}</Label>
        <Select value={form.type} onValueChange={(v: HajjPackageType) => setForm((f) => ({ ...f, type: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="hajj">{t("hajjForm.types.hajj")}</SelectItem><SelectItem value="umrah">{t("hajjForm.types.umrah")}</SelectItem></SelectContent>
        </Select>
      </div>
      <div className="space-y-2"><Label>{t("hajjForm.fields.status")}</Label>
        <Select value={form.status} onValueChange={(v: HajjPackageStatus) => setForm((f) => ({ ...f, status: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{PKG_STATUS_META.map((s) => <SelectItem key={s.value} value={s.value}>{t(s.labelKey)}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2"><Label>{t("hajjForm.fields.duration")}</Label><Input value={form.duration} onChange={(e) => setForm((v) => ({ ...v, duration: e.target.value }))} /></div>
      <div className="space-y-2"><Label>{t("hajjForm.fields.packagePrice")}</Label><Input type="number" min={0} value={form.packagePrice} onChange={(e) => setForm((v) => ({ ...v, packagePrice: Number(e.target.value || 0) }))} /></div>
      <div className="space-y-2"><Label>{t("hajjForm.fields.costPrice")}</Label><Input type="number" min={0} value={form.costPrice} onChange={(e) => setForm((v) => ({ ...v, costPrice: Number(e.target.value || 0) }))} /></div>
      <div className="space-y-2"><Label>{t("hajjForm.fields.capacity")}</Label><Input type="number" min={0} value={form.capacity} onChange={(e) => setForm((v) => ({ ...v, capacity: Number(e.target.value || 0) }))} /></div>
      <div className="space-y-2"><Label>{t("hajjForm.fields.hotelClass")}</Label>
        <Select value={form.hotelClass} onValueChange={(v) => setForm((f) => ({ ...f, hotelClass: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{HOTEL_CLASSES.map((h) => <SelectItem key={h.value} value={h.value}>{t(h.labelKey)}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2"><Label>{t("hajjForm.fields.departure")}</Label><Input type="date" value={form.departureDate} onChange={(e) => setForm((v) => ({ ...v, departureDate: e.target.value }))} /></div>
      <div className="space-y-2"><Label>{t("hajjForm.fields.return")}</Label><Input type="date" value={form.returnDate} onChange={(e) => setForm((v) => ({ ...v, returnDate: e.target.value }))} /></div>
      <HajjPackageStayFields form={form} setForm={setForm} />
    </div>
    <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-2">
      <div className="flex items-center justify-between"><Label htmlFor="visaIncluded">{t("hajjForm.inclusions.visa")}</Label><Switch id="visaIncluded" checked={form.visaIncluded} onCheckedChange={(c) => setForm((v) => ({ ...v, visaIncluded: c }))} /></div>
      <div className="flex items-center justify-between"><Label htmlFor="transportIncluded">{t("hajjForm.inclusions.transport")}</Label><Switch id="transportIncluded" checked={form.transportIncluded} onCheckedChange={(c) => setForm((v) => ({ ...v, transportIncluded: c }))} /></div>
      <div className="flex items-center justify-between"><Label htmlFor="mealsIncluded">{t("hajjForm.inclusions.meals")}</Label><Switch id="mealsIncluded" checked={form.mealsIncluded} onCheckedChange={(c) => setForm((v) => ({ ...v, mealsIncluded: c }))} /></div>
      <div className="flex items-center justify-between"><Label htmlFor="ziyaratIncluded">{t("hajjForm.inclusions.ziyarat")}</Label><Switch id="ziyaratIncluded" checked={form.ziyaratIncluded} onCheckedChange={(c) => setForm((v) => ({ ...v, ziyaratIncluded: c }))} /></div>
    </div>
    <div className="space-y-2"><Label>{t("hajjForm.fields.highlights")}</Label><Textarea rows={3} value={form.highlights} onChange={(e) => setForm((v) => ({ ...v, highlights: e.target.value }))} /></div>
    <div className="flex justify-end gap-2">
      <DialogClose asChild><Button type="button" variant="outline">{t("hajjForm.cancel")}</Button></DialogClose>
      <Button type="submit">{editingId ? t("hajjForm.updatePackage") : t("hajjForm.createPackage")}</Button>
    </div>
  </>
  );
}
