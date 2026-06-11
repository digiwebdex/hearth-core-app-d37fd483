import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { HajjPilgrim } from "@/lib/hajjApi";
import { PAY_METHODS } from "./constants";
import type { HajjPayFormState } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pilgrim: HajjPilgrim | null;
  form: HajjPayFormState;
  setForm: React.Dispatch<React.SetStateAction<HajjPayFormState>>;
  onSubmit: (e: React.FormEvent) => void;
}

export function HajjPilgrimPayment({ open, onOpenChange, pilgrim, form, setForm, onSubmit }: Props) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("hajjForm.recordPayment")}{pilgrim ? ` — ${pilgrim.name}` : ""}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("hajjForm.fields.amount")}</Label>
            <Input type="number" min={0} value={form.amount || ""} onChange={(e) => setForm((v) => ({ ...v, amount: Number(e.target.value || 0) }))} />
          </div>
          <div className="space-y-2">
            <Label>{t("hajjForm.fields.method")}</Label>
            <Select value={form.method} onValueChange={(v) => setForm((f) => ({ ...f, method: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PAY_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{t(m.labelKey)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>{t("hajjForm.fields.reference")}</Label><Input value={form.reference} onChange={(e) => setForm((v) => ({ ...v, reference: e.target.value }))} /></div>
          <div className="space-y-2"><Label>{t("hajjForm.fields.date")}</Label><Input type="date" value={form.date} onChange={(e) => setForm((v) => ({ ...v, date: e.target.value }))} /></div>
          <div className="space-y-2"><Label>{t("hajjForm.fields.installment")}</Label><Input value={form.installmentLabel} onChange={(e) => setForm((v) => ({ ...v, installmentLabel: e.target.value }))} placeholder={t("hajjForm.fields.installmentPlaceholder")} /></div>
          <div className="space-y-2"><Label>{t("hajjForm.fields.note")}</Label><Textarea rows={3} value={form.note} onChange={(e) => setForm((v) => ({ ...v, note: e.target.value }))} /></div>
          <div className="flex justify-end gap-2">
            <DialogClose asChild><Button type="button" variant="outline">{t("hajjForm.cancel")}</Button></DialogClose>
            <Button type="submit">{t("hajjForm.recordPayment")}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
