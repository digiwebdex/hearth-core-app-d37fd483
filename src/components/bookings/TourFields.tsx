import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import MasterDataSelect from "@/components/MasterDataSelect";
import type { BookingFormState } from "./types";

interface TourFieldsProps {
  form: BookingFormState;
  setForm: (form: BookingFormState) => void;
}

export function TourFields({ form, setForm }: TourFieldsProps) {
  const { t } = useTranslation();

  const patch = <K extends keyof BookingFormState>(key: K, value: BookingFormState[K]) => {
    setForm({ ...form, [key]: value });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="destination">{t("bookingsForm.tourFields.destination")}</Label>
          <MasterDataSelect category="city" value={form.destination} onChange={(v) => patch("destination", v)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tourOperator">{t("bookingsForm.tourFields.tourOperator")}</Label>
          <Input
            id="tourOperator"
            value={form.tourOperator}
            onChange={(e) => patch("tourOperator", e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="itinerary">{t("bookingsForm.tourFields.itinerary")}</Label>
        <Textarea
          id="itinerary"
          rows={4}
          value={form.itinerary}
          onChange={(e) => patch("itinerary", e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-6">
        <div className="flex items-center gap-2">
          <Checkbox
            id="includesHotel"
            checked={form.includesHotel}
            onCheckedChange={(checked) => patch("includesHotel", checked === true)}
          />
          <Label htmlFor="includesHotel" className="cursor-pointer font-normal">
            {t("bookingsForm.tourFields.includesHotel")}
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="includesTransfer"
            checked={form.includesTransfer}
            onCheckedChange={(checked) => patch("includesTransfer", checked === true)}
          />
          <Label htmlFor="includesTransfer" className="cursor-pointer font-normal">
            {t("bookingsForm.tourFields.includesTransfer")}
          </Label>
        </div>
      </div>
    </div>
  );
}
