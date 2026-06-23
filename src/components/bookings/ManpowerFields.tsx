import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MasterDataSelect from "@/components/MasterDataSelect";
import type { BookingFormState, MedicalStatus } from "./types";

const MEDICAL_STATUSES: MedicalStatus[] = ["pending", "cleared", "failed", "not_required"];

interface ManpowerFieldsProps {
  form: BookingFormState;
  setForm: (form: BookingFormState) => void;
}

export function ManpowerFields({ form, setForm }: ManpowerFieldsProps) {
  const { t } = useTranslation();

  const patch = <K extends keyof BookingFormState>(key: K, value: BookingFormState[K]) => {
    setForm({ ...form, [key]: value });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="workCountry">{t("bookingsForm.manpowerFields.workCountry")}</Label>
          <MasterDataSelect category="country" value={form.workCountry} onChange={(v) => patch("workCountry", v)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="employer">{t("bookingsForm.manpowerFields.employer")}</Label>
          <Input id="employer" value={form.employer} onChange={(e) => patch("employer", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="jobTitle">{t("bookingsForm.manpowerFields.jobTitle")}</Label>
          <Input id="jobTitle" value={form.jobTitle} onChange={(e) => patch("jobTitle", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contractDuration">{t("bookingsForm.manpowerFields.contractDuration")}</Label>
          <Input id="contractDuration" value={form.contractDuration} onChange={(e) => patch("contractDuration", e.target.value)} placeholder={t("bookingsForm.manpowerFields.contractDurationPh")} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="manpowerPassport">{t("bookingsForm.manpowerFields.passportNumber")}</Label>
          <Input id="manpowerPassport" value={form.passportNumber} onChange={(e) => patch("passportNumber", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="manpowerPassportExpiry">{t("bookingsForm.manpowerFields.passportExpiry")}</Label>
          <Input id="manpowerPassportExpiry" type="date" value={form.passportExpiry} onChange={(e) => patch("passportExpiry", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("bookingsForm.manpowerFields.medicalStatus")}</Label>
          <Select value={form.medicalStatus} onValueChange={(v) => patch("medicalStatus", v as MedicalStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MEDICAL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{t(`bookingsForm.manpowerFields.medicalStatuses.${s}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="bmetRegistration">{t("bookingsForm.manpowerFields.bmetRegistration")}</Label>
          <Input id="bmetRegistration" value={form.bmetRegistration} onChange={(e) => patch("bmetRegistration", e.target.value)} />
        </div>
      </div>
    </div>
  );
}
