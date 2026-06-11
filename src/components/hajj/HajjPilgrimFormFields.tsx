import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { HajjGroup, HajjPackage, HajjRoomType } from "@/lib/hajjApi";
import { PILGRIM_STATUS_META, ROOM_TYPES, VISA_STATUS_META } from "./constants";
import type { HajjPilgrimFormState } from "./types";

interface Props {
  form: HajjPilgrimFormState;
  setForm: React.Dispatch<React.SetStateAction<HajjPilgrimFormState>>;
  packages: HajjPackage[];
  groups: HajjGroup[];
}

export function HajjPilgrimFormFields({ form, setForm, packages, groups }: Props) {
  const { t } = useTranslation();
  const patch = <K extends keyof HajjPilgrimFormState>(key: K, value: HajjPilgrimFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>{t("hajjForm.fields.package")}</Label>
          <Select value={form.packageId} onValueChange={(v) => setForm((f) => ({ ...f, packageId: v, groupId: "" }))}>
            <SelectTrigger><SelectValue placeholder={t("hajjForm.fields.selectPackage")} /></SelectTrigger>
            <SelectContent>{packages.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t("hajjForm.fields.group")}</Label>
          <Select value={form.groupId} onValueChange={(v) => patch("groupId", v)}>
            <SelectTrigger><SelectValue placeholder={t("hajjForm.fields.selectGroup")} /></SelectTrigger>
            <SelectContent>{groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label>{t("hajjForm.fields.name")}</Label><Input value={form.name} onChange={(e) => patch("name", e.target.value)} required /></div>
        <div className="space-y-2"><Label>{t("hajjForm.fields.phone")}</Label><Input value={form.phone} onChange={(e) => patch("phone", e.target.value)} required /></div>
        <div className="space-y-2"><Label>{t("hajjForm.fields.email")}</Label><Input value={form.email} onChange={(e) => patch("email", e.target.value)} /></div>
        <div className="space-y-2"><Label>{t("hajjForm.fields.dob")}</Label><Input type="date" value={form.dateOfBirth} onChange={(e) => patch("dateOfBirth", e.target.value)} /></div>
        <div className="space-y-2">
          <Label>{t("hajjForm.fields.gender")}</Label>
          <Select value={form.gender} onValueChange={(v) => patch("gender", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="male">{t("hajjForm.fields.male")}</SelectItem>
              <SelectItem value="female">{t("hajjForm.fields.female")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label>{t("hajjForm.fields.nationality")}</Label><Input value={form.nationality} onChange={(e) => patch("nationality", e.target.value)} /></div>
        <div className="space-y-2"><Label>{t("hajjForm.fields.passport")}</Label><Input value={form.passportNumber} onChange={(e) => patch("passportNumber", e.target.value)} required /></div>
        <div className="space-y-2"><Label>{t("hajjForm.fields.passportExpiry")}</Label><Input type="date" value={form.passportExpiry} onChange={(e) => patch("passportExpiry", e.target.value)} /></div>
        <div className="space-y-2"><Label>{t("hajjForm.fields.nid")}</Label><Input value={form.nidNumber} onChange={(e) => patch("nidNumber", e.target.value)} /></div>
        <div className="space-y-2">
          <Label>{t("hajjForm.fields.roomType")}</Label>
          <Select value={form.roomType} onValueChange={(v) => patch("roomType", v as HajjRoomType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{ROOM_TYPES.map((r) => <SelectItem key={r.value} value={r.value}>{t(r.labelKey)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t("hajjForm.fields.pilgrimStatus")}</Label>
          <Select value={form.status} onValueChange={(v) => patch("status", v as HajjPilgrimFormState["status"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{PILGRIM_STATUS_META.map((s) => <SelectItem key={s.value} value={s.value}>{t(s.labelKey)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t("hajjForm.fields.visaStatus")}</Label>
          <Select value={form.visaStatus} onValueChange={(v) => patch("visaStatus", v as HajjPilgrimFormState["visaStatus"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{VISA_STATUS_META.map((s) => <SelectItem key={s.value} value={s.value}>{t(s.labelKey)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label>{t("hajjForm.fields.mahramName")}</Label><Input value={form.mahramName} onChange={(e) => patch("mahramName", e.target.value)} /></div>
        <div className="space-y-2"><Label>{t("hajjForm.fields.mahramRelation")}</Label><Input value={form.mahramRelation} onChange={(e) => patch("mahramRelation", e.target.value)} /></div>
        <div className="space-y-2"><Label>{t("hajjForm.fields.emergencyContact")}</Label><Input value={form.emergencyContact} onChange={(e) => patch("emergencyContact", e.target.value)} /></div>
        <div className="space-y-2"><Label>{t("hajjForm.fields.emergencyPhone")}</Label><Input value={form.emergencyPhone} onChange={(e) => patch("emergencyPhone", e.target.value)} /></div>
      </div>
      <div className="space-y-2"><Label>{t("hajjForm.fields.medicalNotes")}</Label><Textarea rows={3} value={form.medicalNotes} onChange={(e) => patch("medicalNotes", e.target.value)} /></div>
      <div className="space-y-2"><Label>{t("hajjForm.fields.notes")}</Label><Textarea rows={3} value={form.notes} onChange={(e) => patch("notes", e.target.value)} /></div>
    </div>
  );
}
