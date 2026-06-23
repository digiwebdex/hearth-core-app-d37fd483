import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MasterDataSelect from "@/components/MasterDataSelect";
import type { BookingFormState, VisaType } from "./types";

const VISA_TYPES: VisaType[] = ["tourist", "business", "transit", "work", "student", "other"];

interface VisaFieldsProps {
  form: BookingFormState;
  setForm: (form: BookingFormState) => void;
}

export function VisaFields({ form, setForm }: VisaFieldsProps) {
  const { t } = useTranslation();

  const patch = <K extends keyof BookingFormState>(key: K, value: BookingFormState[K]) => {
    setForm({ ...form, [key]: value });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="visaCountry">{t("bookingsForm.visaFields.visaCountry")}</Label>
          <MasterDataSelect
            category="country"
            value={form.visaCountry}
            onChange={(v) => patch("visaCountry", v)}
            placeholder={t("bookingsForm.visaFields.visaCountry")}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("bookingsForm.visaFields.visaType")}</Label>
          <Select value={form.visaType} onValueChange={(v) => patch("visaType", v as VisaType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {VISA_TYPES.map((vt) => (
                <SelectItem key={vt} value={vt}>{t(`bookingsForm.visaFields.visaTypes.${vt}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="passportNumber">{t("bookingsForm.visaFields.passportNumber")}</Label>
          <Input id="passportNumber" value={form.passportNumber} onChange={(e) => patch("passportNumber", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="passportExpiry">{t("bookingsForm.visaFields.passportExpiry")}</Label>
          <Input id="passportExpiry" type="date" value={form.passportExpiry} onChange={(e) => patch("passportExpiry", e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="applicationDate">{t("bookingsForm.visaFields.applicationDate")}</Label>
          <Input id="applicationDate" type="date" value={form.applicationDate} onChange={(e) => patch("applicationDate", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="appointmentDate">{t("bookingsForm.visaFields.appointmentDate")}</Label>
          <Input id="appointmentDate" type="date" value={form.appointmentDate} onChange={(e) => patch("appointmentDate", e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="submissionDate">{t("bookingsForm.visaFields.submissionDate")}</Label>
          <Input id="submissionDate" type="date" value={form.submissionDate} onChange={(e) => patch("submissionDate", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expectedApprovalDate">{t("bookingsForm.visaFields.expectedApprovalDate")}</Label>
          <Input id="expectedApprovalDate" type="date" value={form.expectedApprovalDate} onChange={(e) => patch("expectedApprovalDate", e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="visaFee">{t("bookingsForm.visaFields.visaFee")}</Label>
          <Input id="visaFee" type="number" min={0} step={0.01} value={form.visaFee || ""} onChange={(e) => patch("visaFee", parseFloat(e.target.value) || 0)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="serviceFee">{t("bookingsForm.visaFields.serviceFee")}</Label>
          <Input id="serviceFee" type="number" min={0} step={0.01} value={form.serviceFee || ""} onChange={(e) => patch("serviceFee", parseFloat(e.target.value) || 0)} />
        </div>
      </div>
    </div>
  );
}
