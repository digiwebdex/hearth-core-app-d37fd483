import { useEffect, useMemo, useState, useCallback } from "react";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertCircle, Plus, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { complaintApi, tenantApi, crmSettingsApi, type Complaint, type User } from "@/lib/api";

const STATUS: Record<string, string> = {
  open: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  in_progress: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  resolved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  closed: "bg-muted text-muted-foreground",
};
const PRIORITY: Record<string, string> = {
  high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  low: "bg-muted text-muted-foreground",
};
const DEFAULT_CATEGORIES = ["general", "booking", "payment", "service", "refund", "staff"];
const TABS = ["all", "open", "in_progress", "resolved", "closed"] as const;

const emptyForm = { subject: "", clientName: "", description: "", category: "general", priority: "medium" as Complaint["priority"] };

export default function Complaints() {
  const { toast } = useToast();
  const [items, setItems] = useState<Complaint[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<(typeof TABS)[number]>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Complaint | null>(null);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await complaintApi.list()); }
    catch (err: unknown) { toast({ title: "Failed to load complaints", description: err instanceof Error ? err.message : String(err), variant: "destructive" }); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { tenantApi.getMembers().then(setMembers).catch(() => setMembers([])); }, []);
  useEffect(() => {
    crmSettingsApi.get().then((c) => { if (c.complaintCategories?.length) setCategories(c.complaintCategories); }).catch(() => {});
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length, open: 0, in_progress: 0, resolved: 0, closed: 0 };
    for (const it of items) c[it.status] = (c[it.status] || 0) + 1;
    return c;
  }, [items]);

  const filtered = tab === "all" ? items : items.filter((i) => i.status === tab);

  const handleCreate = async () => {
    if (!form.subject.trim()) return;
    setSaving(true);
    try {
      const created = await complaintApi.create(form as unknown as Omit<Complaint, "id" | "tenantId" | "createdAt">);
      setItems((p) => [created, ...p]);
      setCreateOpen(false); setForm(emptyForm);
      toast({ title: "Complaint logged" });
    } catch (err: unknown) {
      toast({ title: "Could not save", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally { setSaving(false); }
  };

  const patch = async (id: string, data: Partial<Complaint>) => {
    try {
      const updated = await complaintApi.update(id, data);
      setItems((p) => p.map((i) => (i.id === id ? updated : i)));
      setSelected((s) => (s && s.id === id ? updated : s));
    } catch (err: unknown) {
      toast({ title: "Update failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const memberName = (id?: string) => members.find((m) => m.id === id)?.name;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="h-7 w-7 text-primary" />
              <h1 className="text-3xl font-bold tracking-tight">Complaints</h1>
            </div>
            <p className="text-muted-foreground">Log customer complaints, assign staff, resolve them, and capture feedback.</p>
          </div>
          <PermissionGate module="clients" action="create">
            <Button onClick={() => setCreateOpen(true)}><Plus className="mr-1.5 h-4 w-4" /> New complaint</Button>
          </PermissionGate>
        </div>

        <div className="flex flex-wrap gap-2">
          {TABS.map((tb) => (
            <Button key={tb} size="sm" variant={tab === tb ? "default" : "outline"} onClick={() => setTab(tb)} className="capitalize">
              {tb.replace("_", " ")} ({counts[tb] ?? 0})
            </Button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No complaints here. That's a good sign.</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((c) => (
              <button key={c.id} onClick={() => setSelected(c)} className="w-full text-left">
                <Card className="transition-colors hover:border-primary/40 hover:bg-muted/30">
                  <CardContent className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{c.subject}</p>
                        <Badge variant="secondary" className={`text-[10px] ${PRIORITY[c.priority]}`}>{c.priority}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.clientName || "—"} · {c.category}{memberName(c.assignedTo) ? ` · ${memberName(c.assignedTo)}` : ""}
                      </p>
                    </div>
                    {c.rating ? <span className="text-xs text-amber-600 flex items-center gap-0.5"><Star className="h-3 w-3" />{c.rating}</span> : null}
                    <Badge className={`shrink-0 capitalize ${STATUS[c.status]}`}>{c.status.replace("_", " ")}</Badge>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New complaint</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Subject *</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Flight delayed, no notification" /></div>
            <div><Label>Customer</Label><Input value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} placeholder="Customer name" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{categories.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as Complaint["priority"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["low", "medium", "high"].map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Details</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !form.subject.trim()}>Log complaint</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selected && (
            <>
              <SheetHeader><SheetTitle>{selected.subject}</SheetTitle></SheetHeader>
              <div className="mt-4 space-y-4 text-sm">
                <div className="flex items-center gap-2">
                  <Badge className={`capitalize ${STATUS[selected.status]}`}>{selected.status.replace("_", " ")}</Badge>
                  <Badge variant="secondary" className={PRIORITY[selected.priority]}>{selected.priority}</Badge>
                  <Badge variant="outline" className="capitalize">{selected.category}</Badge>
                </div>
                {selected.clientName && <p><span className="text-muted-foreground">Customer:</span> {selected.clientName}</p>}
                {selected.description && <p className="text-muted-foreground whitespace-pre-wrap">{selected.description}</p>}

                <PermissionGate module="clients" action="edit" fallback={null}>
                  <div className="space-y-3 border-t pt-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Status</Label>
                      <Select value={selected.status} onValueChange={(v) => patch(selected.id, { status: v as Complaint["status"] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{["open", "in_progress", "resolved", "closed"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Assigned staff</Label>
                      <Select value={selected.assignedTo || "unassigned"} onValueChange={(v) => patch(selected.id, { assignedTo: v === "unassigned" ? "" : v })}>
                        <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Resolution</Label>
                      <Textarea rows={2} defaultValue={selected.resolution || ""} placeholder="How was it resolved?"
                        onBlur={(e) => e.target.value !== (selected.resolution || "") && patch(selected.id, { resolution: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Customer feedback</Label>
                      <Textarea rows={2} defaultValue={selected.feedback || ""} placeholder="What did the customer say?"
                        onBlur={(e) => e.target.value !== (selected.feedback || "") && patch(selected.id, { feedback: e.target.value })} />
                      <div className="flex items-center gap-1 pt-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button key={n} onClick={() => patch(selected.id, { rating: n })} aria-label={`Rate ${n}`}>
                            <Star className={`h-5 w-5 ${(selected.rating || 0) >= n ? "text-amber-500 fill-amber-500" : "text-muted-foreground/40"}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </PermissionGate>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
