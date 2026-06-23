import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MasterDataSelect from "@/components/MasterDataSelect";
import type { BookingFormState } from "./types";

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
          <MasterDataSelect
            category="visa_type"
            value={form.visaType}
            onChange={(v) => patch("visaType", v)}
            placeholder={t("bookingsForm.studentFields.visaType")}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="studentPassport">{t("bookingsForm.studentFields.passportNumber")}</Label>
          <Input id="studentPassport" value={form.passportNumber} onChange={(e) => patch("passportNumber", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="studentEnrollment">{t("bookingsForm.studentFields.enrollmentDate")}</Label>
          <Input id="studentEnrollment" type="date" value={form.enrollmentDate} onChange={(e) => patch("enrollmentDate", e.target.value)} />
        </div>
      </div>
    </div>
  );
}
