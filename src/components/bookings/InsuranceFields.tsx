import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MasterDataSelect from "@/components/MasterDataSelect";
import type { BookingFormState } from "./types";

interface InsuranceFieldsProps {
  form: BookingFormState;
  setForm: (form: BookingFormState) => void;
}

export function InsuranceFields({ form, setForm }: InsuranceFieldsProps) {
  const { t } = useTranslation();

  const patch = <K extends keyof BookingFormState>(key: K, value: BookingFormState[K]) => {
    setForm({ ...form, [key]: value });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("bookingsForm.insuranceFields.plan")}</Label>
          <MasterDataSelect
            category="insurance_plan"
            value={form.insurancePlan}
            onChange={(v) => patch("insurancePlan", v)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="insuranceProvider">{t("bookingsForm.insuranceFields.provider")}</Label>
          <Input
            id="insuranceProvider"
            value={form.insuranceProvider}
            onChange={(e) => patch("insuranceProvider", e.target.value)}
            placeholder={t("bookingsForm.insuranceFields.providerPh")}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("bookingsForm.insuranceFields.destination")}</Label>
          <MasterDataSelect category="country" value={form.insuranceDestination} onChange={(v) => patch("insuranceDestination", v)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="policyNumber">{t("bookingsForm.insuranceFields.policyNumber")}</Label>
          <Input id="policyNumber" value={form.policyNumber} onChange={(e) => patch("policyNumber", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="coverageStart">{t("bookingsForm.insuranceFields.coverageStart")}</Label>
          <Input id="coverageStart" type="date" value={form.coverageStart} onChange={(e) => patch("coverageStart", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="coverageEnd">{t("bookingsForm.insuranceFields.coverageEnd")}</Label>
          <Input id="coverageEnd" type="date" value={form.coverageEnd} onChange={(e) => patch("coverageEnd", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="insuredCount">{t("bookingsForm.insuranceFields.insuredCount")}</Label>
          <Input
            id="insuredCount"
            type="number"
            min={1}
            value={form.insuredCount}
            onChange={(e) => patch("insuredCount", Math.max(1, parseInt(e.target.value, 10) || 1))}
          />
        </div>
      </div>
    </div>
  );
}
