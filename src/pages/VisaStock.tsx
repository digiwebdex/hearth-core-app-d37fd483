import { useEffect, useMemo, useState, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import PermissionGate from "@/components/PermissionGate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plane, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { visaStockApi, type VisaStock } from "@/lib/api";

const money = (n: number) => `৳${(n || 0).toLocaleString()}`;
const STATUS: Record<string, string> = {
  available: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  processing: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  sold: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  completed: "bg-muted text-muted-foreground",
};
const TABS = ["all", "available", "processing", "sold", "completed"] as const;
const empty = { visaType: "", country: "", duration: "", sponsorId: "", visaId: "", occupation: "", buyingPrice: "", sellingPrice: "", notes: "" };

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-muted/40 p-4"><p className="text-[13px] text-muted-foreground">{label}</p><p className="text-2xl font-semibold">{value}</p></div>;
}

export default function VisaStockPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<VisaStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<(typeof TABS)[number]>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await visaStockApi.list()); }
    catch (err: unknown) { toast({ title: "Failed to load", description: err instanceof Error ? err.message : String(err), variant: "destructive" }); }
    finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const s = { available: 0, processing: 0, sold: 0, completed: 0, stockValue: 0, soldProfit: 0 };
    for (const v of items) {
      s[v.status] = (s[v.status] || 0) + 1;
      if (v.status === "available" || v.status === "processing") s.stockValue += v.buyingPrice || 0;
      if (v.status === "sold" || v.status === "completed") s.soldProfit += v.profit || 0;
    }
    return s;
  }, [items]);

  const filtered = tab === "all" ? items : items.filter((v) => v.status === tab);
  const profitOf = (v: { sellingPrice: string | number; buyingPrice: string | number }) => (Number(v.sellingPrice) || 0) - (Number(v.buyingPrice) || 0);

  const create = async () => {
    if (!form.visaType.trim()) return;
    setSaving(true);
    try {
      const created = await visaStockApi.create({ ...form, buyingPrice: Number(form.buyingPrice) || 0, sellingPrice: Number(form.sellingPrice) || 0 } as unknown as Omit<VisaStock, "id" | "tenantId" | "createdAt">);
      setItems((p) => [created, ...p]); setCreateOpen(false); setForm(empty);
      toast({ title: "Visa added to stock" });
    } catch (err: unknown) {
      toast({ title: "Could not save", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally { setSaving(false); }
  };

  const setStatus = async (v: VisaStock, status: VisaStock["status"]) => {
    try {
      const updated = status === "sold"
        ? await visaStockApi.sell(v.id, {})
        : await visaStockApi.update(v.id, { status });
      setItems((p) => p.map((x) => (x.id === v.id ? updated : x)));
    } catch (err: unknown) {
      toast({ title: "Update failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Plane className="h-7 w-7 text-primary" />
              <h1 className="text-3xl font-bold tracking-tight">Visa stock</h1>
            </div>
            <p className="text-muted-foreground">Track visa inventory — buying/selling price, sponsor, status, and auto-calculated profit.</p>
          </div>
          <PermissionGate module="bookings" action="create">
            <Button onClick={() => setCreateOpen(true)}><Plus className="mr-1.5 h-4 w-4" /> Add visa</Button>
          </PermissionGate>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Available" value={String(stats.available + stats.processing)} />
          <Metric label="Sold" value={String(stats.sold + stats.completed)} />
          <Metric label="Stock value (buying)" value={money(stats.stockValue)} />
          <Metric label="Profit (sold)" value={money(stats.soldProfit)} />
        </div>

        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Button key={t} size="sm" variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)} className="capitalize">{t}</Button>
          ))}
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            {loading ? <p className="p-6 text-sm text-muted-foreground">Loading…</p> : filtered.length === 0 ? (
              <p className="p-8 text-center text-muted-foreground">No visas here yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Visa type</TableHead><TableHead>Country</TableHead><TableHead>Sponsor</TableHead><TableHead>Occupation</TableHead>
                    <TableHead className="text-right">Buying</TableHead><TableHead className="text-right">Selling</TableHead><TableHead className="text-right">Profit</TableHead>
                    <TableHead>Status</TableHead><TableHead className="w-[150px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.visaType}{v.visaId ? <span className="text-xs text-muted-foreground"> · {v.visaId}</span> : null}</TableCell>
                      <TableCell>{v.country || "—"}{v.duration ? <span className="text-xs text-muted-foreground"> · {v.duration}</span> : null}</TableCell>
                      <TableCell>{v.sponsorId || "—"}</TableCell>
                      <TableCell>{v.occupation || "—"}</TableCell>
                      <TableCell className="text-right">{money(v.buyingPrice)}</TableCell>
                      <TableCell className="text-right">{money(v.sellingPrice)}</TableCell>
                      <TableCell className={`text-right font-medium ${v.profit >= 0 ? "text-green-600" : "text-destructive"}`}>{money(v.profit)}</TableCell>
                      <TableCell><Badge className={`capitalize ${STATUS[v.status]}`}>{v.status}</Badge></TableCell>
                      <TableCell>
                        <PermissionGate module="bookings" action="edit" fallback={null}>
                          {v.status === "available" && <Button size="sm" variant="outline" className="h-8" onClick={() => setStatus(v, "processing")}>Processing</Button>}
                          {(v.status === "available" || v.status === "processing") && <Button size="sm" className="h-8 ml-1" onClick={() => setStatus(v, "sold")}>Sell</Button>}
                          {v.status === "sold" && <Button size="sm" variant="outline" className="h-8" onClick={() => setStatus(v, "completed")}>Complete</Button>}
                        </PermissionGate>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add visa to stock</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Visa type *</Label><Input value={form.visaType} onChange={(e) => setForm({ ...form, visaType: e.target.value })} placeholder="Work visa, Umrah visa…" /></div>
            <div><Label>Country</Label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="Saudi Arabia" /></div>
            <div><Label>Duration</Label><Input value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="2 years" /></div>
            <div><Label>Sponsor ID</Label><Input value={form.sponsorId} onChange={(e) => setForm({ ...form, sponsorId: e.target.value })} /></div>
            <div><Label>Visa ID</Label><Input value={form.visaId} onChange={(e) => setForm({ ...form, visaId: e.target.value })} /></div>
            <div className="col-span-2"><Label>Occupation</Label><Input value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })} placeholder="Driver, cleaner…" /></div>
            <div><Label>Buying price</Label><Input type="number" value={form.buyingPrice} onChange={(e) => setForm({ ...form, buyingPrice: e.target.value })} /></div>
            <div><Label>Selling price</Label><Input type="number" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} /></div>
            <div className="col-span-2 text-sm text-muted-foreground">Profit: <span className="font-medium text-foreground">{money(profitOf(form))}</span></div>
            <div className="col-span-2"><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={saving || !form.visaType.trim()}>Add to stock</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
