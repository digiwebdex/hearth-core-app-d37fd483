import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MasterDataSelect from "@/components/MasterDataSelect";
import type { BookingFormState } from "./types";

interface TransportFieldsProps {
  form: BookingFormState;
  setForm: (form: BookingFormState) => void;
}

export function TransportFields({ form, setForm }: TransportFieldsProps) {
  const { t } = useTranslation();

  const patch = <K extends keyof BookingFormState>(key: K, value: BookingFormState[K]) => {
    setForm({ ...form, [key]: value });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="routeDescription">{t("bookingsForm.transportFields.routeDescription")}</Label>
        <Input
          id="routeDescription"
          value={form.routeDescription}
          onChange={(e) => patch("routeDescription", e.target.value)}
          placeholder={t("bookingsForm.transportFields.routePlaceholder")}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="pickupLocation">{t("bookingsForm.transportFields.pickupLocation")}</Label>
          <Input id="pickupLocation" value={form.pickupLocation} onChange={(e) => patch("pickupLocation", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dropoffLocation">{t("bookingsForm.transportFields.dropoffLocation")}</Label>
          <Input id="dropoffLocation" value={form.dropoffLocation} onChange={(e) => patch("dropoffLocation", e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="pickupDate">{t("bookingsForm.transportFields.pickupDate")}</Label>
          <Input id="pickupDate" type="date" value={form.pickupDate} onChange={(e) => patch("pickupDate", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pickupTime">{t("bookingsForm.transportFields.pickupTime")}</Label>
          <Input id="pickupTime" type="time" value={form.pickupTime} onChange={(e) => patch("pickupTime", e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="vehicleType">{t("bookingsForm.transportFields.vehicleType")}</Label>
          <MasterDataSelect category="vehicle_type" value={form.vehicleType} onChange={(v) => patch("vehicleType", v)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="transportVendor">{t("bookingsForm.transportFields.transportVendor")}</Label>
          <Input id="transportVendor" value={form.transportVendor} onChange={(e) => patch("transportVendor", e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="driverName">{t("bookingsForm.transportFields.driverName")}</Label>
          <Input id="driverName" value={form.driverName} onChange={(e) => patch("driverName", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="driverPhone">{t("bookingsForm.transportFields.driverPhone")}</Label>
          <Input id="driverPhone" value={form.driverPhone} onChange={(e) => patch("driverPhone", e.target.value)} />
        </div>
      </div>
    </div>
  );
}
