import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Plus, X, Sparkles, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { crmSettingsApi, type CrmConfig, type CrmCustomField } from "@/lib/api";

function ChipList({ title, desc, items, onChange }: { title: string; desc: string; items: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState("");
  const add = () => { const v = input.trim(); if (v && !items.includes(v)) { onChange([...items, v]); setInput(""); } };
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle><CardDescription>{desc}</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {items.length === 0 && <span className="text-sm text-muted-foreground">None yet.</span>}
          {items.map((it) => (
            <Badge key={it} variant="secondary" className="gap-1 capitalize">
              {it.replace(/_/g, " ")}
              <button onClick={() => onChange(items.filter((x) => x !== it))} aria-label={`Remove ${it}`}><X className="h-3 w-3" /></button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input className="h-9" placeholder="Add option…" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} />
          <Button size="sm" variant="outline" className="h-9" onClick={add}><Plus className="h-4 w-4" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CrmSettings() {
  const { toast } = useToast();
  const [cfg, setCfg] = useState<CrmConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [newField, setNewField] = useState<CrmCustomField>({ key: "", label: "", type: "text", appliesTo: "client", options: [] });

  useEffect(() => { crmSettingsApi.get().then(setCfg).catch(() => setCfg(null)); }, []);

  const patch = (p: Partial<CrmConfig>) => setCfg((c) => (c ? { ...c, ...p } : c));

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    try {
      const saved = await crmSettingsApi.update({
        leadSources: cfg.leadSources, followUpTypes: cfg.followUpTypes, complaintCategories: cfg.complaintCategories,
        customFields: cfg.customFields, automations: cfg.automations,
      });
      setCfg(saved);
      toast({ title: "CRM settings saved" });
    } catch (err: unknown) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally { setSaving(false); }
  };

  const addField = () => {
    if (!newField.label.trim() || !cfg) return;
    patch({ customFields: [...cfg.customFields, { ...newField, key: newField.label.toLowerCase().replace(/[^a-z0-9]+/g, "_") }] });
    setNewField({ key: "", label: "", type: "text", appliesTo: "client", options: [] });
  };

  if (!cfg) return <DashboardLayout><p className="p-6 text-sm text-muted-foreground">Loading…</p></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Settings className="h-7 w-7 text-primary" />
              <h1 className="text-3xl font-bold tracking-tight">CRM settings</h1>
            </div>
            <p className="text-muted-foreground">Configure the lists, custom fields and automations your CRM uses.</p>
          </div>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <ChipList title="Lead sources" desc="Where your leads come from." items={cfg.leadSources} onChange={(v) => patch({ leadSources: v })} />
          <ChipList title="Follow-up types" desc="How your team follows up." items={cfg.followUpTypes} onChange={(v) => patch({ followUpTypes: v })} />
          <ChipList title="Complaint categories" desc="Used on the complaints desk." items={cfg.complaintCategories} onChange={(v) => patch({ complaintCategories: v })} />
        </div>

        {/* Custom fields */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Custom fields</CardTitle>
            <CardDescription>Extra fields shown on customer records. Great for anything specific to your agency.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {cfg.customFields.length > 0 && (
              <div className="space-y-2">
                {cfg.customFields.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 rounded border p-2 text-sm">
                    <span className="font-medium flex-1">{f.label}</span>
                    <Badge variant="outline" className="capitalize">{f.type}</Badge>
                    <Badge variant="secondary" className="capitalize">{f.appliesTo}</Badge>
                    <button onClick={() => patch({ customFields: cfg.customFields.filter((_, j) => j !== i) })} aria-label="Remove field"><X className="h-4 w-4 text-muted-foreground" /></button>
                  </div>
                ))}
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-4 border-t pt-3">
              <Input className="h-9" placeholder="Field label" value={newField.label} onChange={(e) => setNewField({ ...newField, label: e.target.value })} />
              <Select value={newField.type} onValueChange={(v) => setNewField({ ...newField, type: v as CrmCustomField["type"] })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{["text", "number", "date", "select"].map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={newField.appliesTo} onValueChange={(v) => setNewField({ ...newField, appliesTo: v as CrmCustomField["appliesTo"] })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="client">Customer</SelectItem><SelectItem value="lead">Lead</SelectItem></SelectContent>
              </Select>
              <Button variant="outline" className="h-9" onClick={addField} disabled={!newField.label.trim()}><Plus className="mr-1.5 h-4 w-4" /> Add field</Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Custom fields for customers appear on each customer's profile.</p>
          </CardContent>
        </Card>

        {/* Automations */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Automation rules</CardTitle>
            <CardDescription>Let the system act automatically on key CRM events.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <div className="flex items-start justify-between gap-3 py-3">
              <div><p className="text-sm font-medium">Create a task when a lead is won</p><p className="text-xs text-muted-foreground">Auto-adds a high-priority onboarding task assigned to the lead's owner.</p></div>
              <Switch checked={!!cfg.automations.leadWonCreateTask} onCheckedChange={(v) => patch({ automations: { ...cfg.automations, leadWonCreateTask: v } })} />
            </div>
            <div className="flex items-start justify-between gap-3 py-3">
              <div><p className="text-sm font-medium">Notify the owner on a new complaint</p><p className="text-xs text-muted-foreground">Sends an in-app notification to the agency owner when a complaint is logged.</p></div>
              <Switch checked={!!cfg.automations.complaintNotifyOwner} onCheckedChange={(v) => patch({ automations: { ...cfg.automations, complaintNotifyOwner: v } })} />
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
