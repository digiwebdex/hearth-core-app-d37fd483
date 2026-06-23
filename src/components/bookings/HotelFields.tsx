import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MasterDataSelect from "@/components/MasterDataSelect";
import type { BookingFormState, RoomType } from "./types";

const ROOM_TYPES: RoomType[] = ["single", "double", "twin", "triple", "suite", "other"];

interface HotelFieldsProps {
  form: BookingFormState;
  setForm: (form: BookingFormState) => void;
}

export function HotelFields({ form, setForm }: HotelFieldsProps) {
  const { t } = useTranslation();

  const patch = <K extends keyof BookingFormState>(key: K, value: BookingFormState[K]) => {
    setForm({ ...form, [key]: value });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="hotelName">{t("bookingsForm.hotelFields.hotelName")}</Label>
          <MasterDataSelect category="hotel" value={form.hotelName} onChange={(v) => patch("hotelName", v)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hotelCity">{t("bookingsForm.hotelFields.hotelCity")}</Label>
          <MasterDataSelect
            category="city"
            value={form.hotelCity}
            onChange={(v) => patch("hotelCity", v)}
            parentName={form.hotelCountry}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="hotelCountry">{t("bookingsForm.hotelFields.hotelCountry")}</Label>
        <MasterDataSelect category="country" value={form.hotelCountry} onChange={(v) => patch("hotelCountry", v)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="checkInDate">{t("bookingsForm.hotelFields.checkInDate")}</Label>
          <Input id="checkInDate" type="date" value={form.checkInDate} onChange={(e) => patch("checkInDate", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="checkOutDate">{t("bookingsForm.hotelFields.checkOutDate")}</Label>
          <Input id="checkOutDate" type="date" value={form.checkOutDate} onChange={(e) => patch("checkOutDate", e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>{t("bookingsForm.hotelFields.roomType")}</Label>
          <Select value={form.roomType} onValueChange={(v) => patch("roomType", v as RoomType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROOM_TYPES.map((rt) => (
                <SelectItem key={rt} value={rt}>{t(`bookingsForm.hotelFields.roomTypes.${rt}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="roomCount">{t("bookingsForm.hotelFields.roomCount")}</Label>
          <Input id="roomCount" type="number" min={1} value={form.roomCount} onChange={(e) => patch("roomCount", Math.max(1, parseInt(e.target.value, 10) || 1))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="guestCount">{t("bookingsForm.hotelFields.guestCount")}</Label>
          <Input id="guestCount" type="number" min={1} value={form.guestCount} onChange={(e) => patch("guestCount", Math.max(1, parseInt(e.target.value, 10) || 1))} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmationNumber">{t("bookingsForm.hotelFields.confirmationNumber")}</Label>
        <Input id="confirmationNumber" value={form.confirmationNumber} onChange={(e) => patch("confirmationNumber", e.target.value)} />
      </div>
    </div>
  );
}
