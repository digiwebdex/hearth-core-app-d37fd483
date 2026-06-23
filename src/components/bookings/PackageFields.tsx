import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { travelPackageApi, type TravelPackage } from "@/lib/travelPackageApi";
import type { BookingFormState } from "./types";

interface PackageFieldsProps {
  form: BookingFormState;
  setForm: (form: BookingFormState) => void;
}

export function PackageFields({ form, setForm }: PackageFieldsProps) {
  const { t } = useTranslation();
  const [packages, setPackages] = useState<TravelPackage[]>([]);

  useEffect(() => {
    travelPackageApi.list().then(setPackages).catch(() => setPackages([]));
  }, []);

  const packageOptions = useMemo(
    () => packages.filter((p) => p.serviceType === "hajj_umrah" || (p.title || "").toLowerCase().includes("umrah") || (p.title || "").toLowerCase().includes("hajj")),
    [packages],
  );

  const patch = <K extends keyof BookingFormState>(key: K, value: BookingFormState[K]) => {
    setForm({ ...form, [key]: value });
  };

  const handlePackageChange = async (packageId: string) => {
    if (packageId === "none") {
      setForm({ ...form, packageId: "", packageTitleSnapshot: "", packageCodeSnapshot: "" });
      return;
    }
    const pkg = packageOptions.find((p) => p.id === packageId) || packages.find((p) => p.id === packageId);
    if (!pkg) return;

    try {
      const full = await travelPackageApi.get(packageId);
      const unitPrice = Number(full.pricing?.[0]?.price || full.basePrice || 0);
      const travelers = Math.max(1, form.travelerCount || 1);
      setForm({
        ...form,
        packageId,
        packageTitleSnapshot: full.title ?? "",
        packageCodeSnapshot: full.code ?? "",
        title: form.title || full.title || "",
        destination: full.destination || form.destination,
        amount: form.amount || unitPrice * travelers,
        cost: form.cost || 0,
      });
    } catch {
      setForm({
        ...form,
        packageId,
        packageTitleSnapshot: pkg.title ?? "",
        packageCodeSnapshot: pkg.code ?? "",
        title: form.title || pkg.title || "",
        destination: pkg.destination || form.destination,
      });
    }
  };

  const list = packageOptions.length > 0 ? packageOptions : packages;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t("bookingsForm.packageFields.packageId")}</Label>
        <Select value={form.packageId || "none"} onValueChange={handlePackageChange}>
          <SelectTrigger><SelectValue placeholder={t("bookingsForm.packageFields.selectPackage")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("bookingsForm.packageFields.noPackage")}</SelectItem>
            {list.map((pkg) => (
              <SelectItem key={pkg.id} value={pkg.id}>
                {pkg.code} — {pkg.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="packageTitleSnapshot">{t("bookingsForm.packageFields.packageTitleSnapshot")}</Label>
          <Input id="packageTitleSnapshot" readOnly value={form.packageTitleSnapshot} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="packageCodeSnapshot">{t("bookingsForm.packageFields.packageCodeSnapshot")}</Label>
          <Input id="packageCodeSnapshot" readOnly value={form.packageCodeSnapshot} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="customizations">{t("bookingsForm.packageFields.customizations")}</Label>
        <Textarea
          id="customizations"
          rows={4}
          value={form.customizations}
          onChange={(e) => patch("customizations", e.target.value)}
        />
      </div>
    </div>
  );
}
