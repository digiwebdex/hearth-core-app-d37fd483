import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BookingFormState, CabinClass } from "./types";

interface TicketFieldsProps {
  form: BookingFormState;
  setForm: (form: BookingFormState) => void;
}

export function TicketFields({ form, setForm }: TicketFieldsProps) {
  const { t } = useTranslation();

  const patch = <K extends keyof BookingFormState>(key: K, value: BookingFormState[K]) => {
    setForm({ ...form, [key]: value });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="flightNumber">{t("bookingsForm.ticketFields.flightNumber")}</Label>
          <Input id="flightNumber" value={form.flightNumber} onChange={(e) => patch("flightNumber", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="airline">{t("bookingsForm.ticketFields.airline")}</Label>
          <Input id="airline" value={form.airline} onChange={(e) => patch("airline", e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="fromCity">{t("bookingsForm.ticketFields.fromCity")}</Label>
          <Input id="fromCity" value={form.fromCity} onChange={(e) => patch("fromCity", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="toCity">{t("bookingsForm.ticketFields.toCity")}</Label>
          <Input id="toCity" value={form.toCity} onChange={(e) => patch("toCity", e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="departureDate">{t("bookingsForm.ticketFields.departureDate")}</Label>
          <Input id="departureDate" type="date" value={form.departureDate} onChange={(e) => patch("departureDate", e.target.value)} />
        </div>
        {form.isRoundTrip && (
          <div className="space-y-2">
            <Label htmlFor="returnDate">{t("bookingsForm.ticketFields.returnDate")}</Label>
            <Input id="returnDate" type="date" value={form.returnDate} onChange={(e) => patch("returnDate", e.target.value)} />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="isRoundTrip"
          checked={form.isRoundTrip}
          onCheckedChange={(checked) => patch("isRoundTrip", checked === true)}
        />
        <Label htmlFor="isRoundTrip" className="cursor-pointer font-normal">
          {t("bookingsForm.ticketFields.isRoundTrip")}
        </Label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("bookingsForm.ticketFields.cabinClass")}</Label>
          <Select value={form.cabinClass} onValueChange={(v) => patch("cabinClass", v as CabinClass)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="economy">{t("bookingsForm.ticketFields.cabinEconomy")}</SelectItem>
              <SelectItem value="business">{t("bookingsForm.ticketFields.cabinBusiness")}</SelectItem>
              <SelectItem value="first">{t("bookingsForm.ticketFields.cabinFirst")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="travelerCount">{t("bookingsForm.ticketFields.travelerCount")}</Label>
          <Input
            id="travelerCount"
            type="number"
            min={1}
            value={form.travelerCount}
            onChange={(e) => patch("travelerCount", Math.max(1, parseInt(e.target.value, 10) || 1))}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="pnrNumber">{t("bookingsForm.ticketFields.pnrNumber")}</Label>
          <Input id="pnrNumber" value={form.pnrNumber} onChange={(e) => patch("pnrNumber", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ticketDeadline">{t("bookingsForm.ticketFields.ticketDeadline")}</Label>
          <Input id="ticketDeadline" type="date" value={form.ticketDeadline} onChange={(e) => patch("ticketDeadline", e.target.value)} />
        </div>
      </div>
    </div>
  );
}
