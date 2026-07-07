import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { portalApi, type PortalProfile } from "@/lib/portalApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const EDITABLE: (keyof PortalProfile)[] = ["phone", "alternatePhone", "address", "dateOfBirth", "emergencyContact", "emergencyPhone"];

export default function Profile() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["portal-profile"], queryFn: portalApi.getProfile });
  const [form, setForm] = useState<Partial<PortalProfile>>({});

  useEffect(() => { if (data) setForm(data); }, [data]);

  const mutation = useMutation({
    mutationFn: (payload: Partial<PortalProfile>) => portalApi.updateProfile(payload),
    onSuccess: (updated) => { qc.setQueryData(["portal-profile"], updated); toast({ title: t("portal.profileSaved", { defaultValue: "Profile updated" }) }); },
    onError: (e: Error) => toast({ title: t("portal.saveFailed", { defaultValue: "Save failed" }), description: e.message, variant: "destructive" }),
  });

  const set = (k: keyof PortalProfile, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Partial<PortalProfile> = {};
    for (const k of EDITABLE) payload[k] = (form[k] as string) ?? "";
    mutation.mutate(payload);
  };

  const fieldLabel: Record<string, string> = {
    phone: t("portal.phone", { defaultValue: "Phone" }),
    alternatePhone: t("portal.altPhone", { defaultValue: "Alternate phone" }),
    address: t("portal.address", { defaultValue: "Address" }),
    dateOfBirth: t("portal.dob", { defaultValue: "Date of birth" }),
    emergencyContact: t("portal.emergencyContact", { defaultValue: "Emergency contact" }),
    emergencyPhone: t("portal.emergencyPhone", { defaultValue: "Emergency phone" }),
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">{t("portal.profile", { defaultValue: "Profile" })}</h1>
        <p className="text-sm text-muted-foreground">{t("portal.profileHint", { defaultValue: "Keep your contact details up to date." })}</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">{data?.name}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t("portal.email", { defaultValue: "Email" })}</Label>
                  <Input value={data?.email || ""} readOnly disabled />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("portal.nationality", { defaultValue: "Nationality" })}</Label>
                  <Input value={data?.nationality || ""} readOnly disabled />
                </div>
                {EDITABLE.map((k) => (
                  <div key={k} className={`space-y-1.5 ${k === "address" ? "sm:col-span-2" : ""}`}>
                    <Label>{fieldLabel[k]}</Label>
                    <Input
                      type={k === "dateOfBirth" ? "date" : "text"}
                      value={(form[k] as string)?.slice(0, k === "dateOfBirth" ? 10 : undefined) || ""}
                      onChange={(e) => set(k, e.target.value)}
                    />
                  </div>
                ))}
              </div>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? t("common.saving", { defaultValue: "Saving…" }) : t("common.save", { defaultValue: "Save" })}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
