import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import PermissionGate from "@/components/PermissionGate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Megaphone, Plus, Send, Mail, MessageCircle, Smartphone, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { campaignApi, type Campaign } from "@/lib/api";

const CHANNEL_ICON = { sms: Smartphone, email: Mail, whatsapp: MessageCircle };
const CHANNELS = [
  { value: "sms", label: "SMS" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
] as const;
const AUDIENCES = [
  { type: "all", value: "", label: "All customers" },
  { type: "tag", value: "vip", label: "Tagged: VIP" },
  { type: "tag", value: "repeat", label: "Tagged: Repeat" },
  { type: "clientType", value: "individual", label: "Individual customers" },
  { type: "clientType", value: "corporate", label: "Corporate customers" },
];
const audienceLabel = (t: string, v?: string) => AUDIENCES.find((a) => a.type === t && a.value === (v || ""))?.label || "All customers";
const emptyForm = { name: "", channel: "sms" as Campaign["channel"], subject: "", body: "", audienceIdx: 0 };

export default function Campaigns() {
  const { toast } = useToast();
  const [items, setItems] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await campaignApi.list()); }
    catch (err: unknown) { toast({ title: "Failed to load campaigns", description: err instanceof Error ? err.message : String(err), variant: "destructive" }); }
    finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  // Live audience-size preview as channel/audience change in the create dialog.
  useEffect(() => {
    if (!createOpen) return;
    const a = AUDIENCES[form.audienceIdx];
    let active = true;
    setPreview(null);
    campaignApi.audiencePreview(a.type, a.value, form.channel).then((r) => active && setPreview(r.count)).catch(() => active && setPreview(null));
    return () => { active = false; };
  }, [createOpen, form.audienceIdx, form.channel]);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.body.trim()) return;
    const a = AUDIENCES[form.audienceIdx];
    setSaving(true);
    try {
      const created = await campaignApi.create({
        name: form.name, channel: form.channel, subject: form.subject,
        body: form.body, audienceType: a.type as Campaign["audienceType"], audienceValue: a.value,
      } as unknown as Omit<Campaign, "id" | "tenantId" | "createdAt">);
      setItems((p) => [created, ...p]);
      setCreateOpen(false); setForm(emptyForm);
      toast({ title: "Campaign saved as draft" });
    } catch (err: unknown) {
      toast({ title: "Could not save", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleSend = async (c: Campaign) => {
    if (!confirm(`Send "${c.name}" to ${audienceLabel(c.audienceType, c.audienceValue)} via ${c.channel.toUpperCase()}? This cannot be undone.`)) return;
    setSendingId(c.id);
    try {
      const sent = await campaignApi.send(c.id);
      setItems((p) => p.map((i) => (i.id === c.id ? sent : i)));
      toast({ title: "Campaign sent", description: `${sent.sentCount} sent · ${sent.failedCount} failed` });
    } catch (err: unknown) {
      toast({ title: "Send failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally { setSendingId(null); }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Megaphone className="h-7 w-7 text-primary" />
              <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
            </div>
            <p className="text-muted-foreground">Send bulk SMS, WhatsApp and email to a customer segment. Use {"{{name}}"} to personalise.</p>
          </div>
          <PermissionGate module="clients" action="create">
            <Button onClick={() => setCreateOpen(true)}><Plus className="mr-1.5 h-4 w-4" /> New campaign</Button>
          </PermissionGate>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No campaigns yet. Create one to reach your customers.</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {items.map((c) => {
              const Icon = CHANNEL_ICON[c.channel];
              return (
                <Card key={c.id}>
                  <CardContent className="flex items-center gap-3 p-3">
                    <span className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0"><Icon className="h-4 w-4 text-primary" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.channel.toUpperCase()} · {audienceLabel(c.audienceType, c.audienceValue)}
                        {c.status === "sent" ? ` · ${c.sentCount} sent${c.failedCount ? `, ${c.failedCount} failed` : ""}` : ""}
                      </p>
                    </div>
                    {c.status === "sent" ? (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 shrink-0">Sent</Badge>
                    ) : (
                      <PermissionGate module="clients" action="edit" fallback={<Badge variant="secondary">Draft</Badge>}>
                        <Button size="sm" disabled={sendingId === c.id} onClick={() => handleSend(c)}>
                          <Send className="mr-1.5 h-3.5 w-3.5" /> {sendingId === c.id ? "Sending…" : "Send"}
                        </Button>
                      </PermissionGate>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New campaign</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Campaign name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Eid Umrah offer" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Channel</Label>
                <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v as Campaign["channel"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CHANNELS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Audience</Label>
                <Select value={String(form.audienceIdx)} onValueChange={(v) => setForm({ ...form, audienceIdx: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{AUDIENCES.map((a, i) => <SelectItem key={i} value={String(i)}>{a.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              {preview === null ? "Counting recipients…" : `${preview} contactable ${form.channel === "email" ? "emails" : "phone numbers"} in this segment`}
            </p>
            {form.channel === "email" && (
              <div><Label>Subject</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Special offer just for you" /></div>
            )}
            <div>
              <Label>Message</Label>
              <Textarea rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Assalamu Alaikum {{name}}, our Eid Umrah package is now open for booking…" />
              <p className="text-[11px] text-muted-foreground mt-1">Tip: {"{{name}}"} is replaced with each customer's name.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !form.name.trim() || !form.body.trim()}>Save draft</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
