import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MasterDataSelect from "@/components/MasterDataSelect";
import type { BookingFormState, VisaType } from "./types";

const VISA_TYPES: VisaType[] = ["tourist", "business", "transit", "work", "student", "other"];

interface StudentFieldsProps {
  form: BookingFormState;
  setForm: (form: BookingFormState) => void;
}

export function StudentFields({ form, setForm }: StudentFieldsProps) {
  const { t } = useTranslation();

  const patch = <K extends keyof BookingFormState>(key: K, value: BookingFormState[K]) => {
    setForm({ ...form, [key]: value });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="instituteName">{t("bookingsForm.studentFields.instituteName")}</Label>
          <MasterDataSelect category="university" value={form.instituteName} onChange={(v) => patch("instituteName", v)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="courseProgram">{t("bookingsForm.studentFields.courseProgram")}</Label>
          <Input id="courseProgram" value={form.courseProgram} onChange={(e) => patch("courseProgram", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="studentVisaCountry">{t("bookingsForm.studentFields.visaCountry")}</Label>
          <MasterDataSelect category="country" value={form.visaCountry} onChange={(v) => patch("visaCountry", v)} />
        </div>
        <div className="space-y-2">
          <Label>{t("bookingsForm.studentFields.visaType")}</Label>
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
          <Label htmlFor="studentPassport">{t("bookingsForm.studentFields.passportNumber")}</Label>
          <Input id="studentPassport" value={form.passportNumber} onChange={(e) => patch("passportNumber", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="studentPassportExpiry">{t("bookingsForm.studentFields.passportExpiry")}</Label>
          <Input id="studentPassportExpiry" type="date" value={form.passportExpiry} onChange={(e) => patch("passportExpiry", e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="enrollmentDate">{t("bookingsForm.studentFields.enrollmentDate")}</Label>
        <Input id="enrollmentDate" type="date" value={form.enrollmentDate} onChange={(e) => patch("enrollmentDate", e.target.value)} />
      </div>
    </div>
  );
}
