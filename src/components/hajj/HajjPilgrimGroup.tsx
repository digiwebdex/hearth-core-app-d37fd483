import { useState } from "react";
import { useTranslation } from "react-i18next";
import PermissionGate from "@/components/PermissionGate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Users, UserPlus } from "lucide-react";
import type { HajjGroup, HajjPackage } from "@/lib/hajjApi";
import { emptyGroupForm } from "./constants";
import type { HajjGroupFormState } from "./types";

interface Props {
  packages: HajjPackage[];
  groups: HajjGroup[];
  getPackageName: (id: string) => string;
  getPilgrimCountForGroup: (id: string) => number;
  onSave: (form: HajjGroupFormState, editingId: string | null) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function HajjPilgrimGroup({ packages, groups, getPackageName, getPilgrimCountForGroup, onSave, onDelete }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<HajjGroupFormState>(emptyGroupForm);

  const reset = () => { setForm(emptyGroupForm); setEditingId(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(form, editingId);
    reset();
    setOpen(false);
  };

  const startEdit = (group: HajjGroup) => {
    setForm({
      packageId: group.packageId,
      name: group.name,
      leader: group.leader,
      leaderPhone: group.leaderPhone ?? "",
      departureDate: group.departureDate,
      returnDate: group.returnDate,
      flightDetails: group.flightDetails ?? "",
      transportSchedule: group.transportSchedule ?? "",
      notes: group.notes ?? "",
    });
    setEditingId(group.id);
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{t("hajjForm.tabs.groups")}</h2>
          <p className="text-sm text-muted-foreground">{t("hajjForm.groupsSubtitle")}</p>
        </div>
        <PermissionGate module="hajj_umrah" action="create">
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild><Button onClick={reset}><Plus className="mr-2 h-4 w-4" />{t("hajjForm.addGroup")}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingId ? t("hajjForm.editGroup") : t("hajjForm.addGroup")}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2"><Label>{t("hajjForm.fields.package")}</Label>
                  <Select value={form.packageId} onValueChange={(v) => setForm((f) => ({ ...f, packageId: v }))}>
                    <SelectTrigger><SelectValue placeholder={t("hajjForm.fields.selectPackage")} /></SelectTrigger>
                    <SelectContent>{packages.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>{t("hajjForm.fields.groupName")}</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>{t("hajjForm.fields.leader")}</Label><Input value={form.leader} onChange={(e) => setForm((f) => ({ ...f, leader: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>{t("hajjForm.fields.leaderPhone")}</Label><Input value={form.leaderPhone} onChange={(e) => setForm((f) => ({ ...f, leaderPhone: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>{t("hajjForm.fields.departure")}</Label><Input type="date" value={form.departureDate} onChange={(e) => setForm((f) => ({ ...f, departureDate: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>{t("hajjForm.fields.return")}</Label><Input type="date" value={form.returnDate} onChange={(e) => setForm((f) => ({ ...f, returnDate: e.target.value }))} /></div>
                </div>
                <div className="space-y-2"><Label>{t("hajjForm.fields.flightDetails")}</Label><Input value={form.flightDetails} onChange={(e) => setForm((f) => ({ ...f, flightDetails: e.target.value }))} /></div>
                <div className="space-y-2"><Label>{t("hajjForm.fields.transportSchedule")}</Label><Input value={form.transportSchedule} onChange={(e) => setForm((f) => ({ ...f, transportSchedule: e.target.value }))} /></div>
                <div className="space-y-2"><Label>{t("hajjForm.fields.notes")}</Label><Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} /></div>
                <div className="flex justify-end gap-2"><DialogClose asChild><Button type="button" variant="outline">{t("hajjForm.cancel")}</Button></DialogClose><Button type="submit">{t("hajjForm.save")}</Button></div>
              </form>
            </DialogContent>
          </Dialog>
        </PermissionGate>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => (
          <Card key={g.id}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Users className="h-4 w-4" /> {g.name}</CardTitle>
              <CardDescription>{getPackageName(g.packageId)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">{t("hajjForm.fields.leader")}:</span><div className="font-medium">{g.leader || "—"}</div></div>
                <div><span className="text-muted-foreground">{t("hajjForm.fields.leaderPhone")}:</span><div className="font-medium">{g.leaderPhone || "—"}</div></div>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-2"><UserPlus className="h-3.5 w-3.5" />{getPilgrimCountForGroup(g.id)} {t("hajjForm.pilgrimsCount")}</div>
              <div className="flex gap-2">
                <PermissionGate module="hajj_umrah" action="edit"><Button variant="outline" size="sm" onClick={() => startEdit(g)}><Pencil className="h-3.5 w-3.5" /></Button></PermissionGate>
                <PermissionGate module="hajj_umrah" action="delete"><Button variant="ghost" size="sm" onClick={() => onDelete(g.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></PermissionGate>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
