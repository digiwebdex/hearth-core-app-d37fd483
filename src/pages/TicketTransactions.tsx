import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Undo2, Ban, RefreshCw, Plus, Pencil, Trash2, Search } from "lucide-react";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
function authHeaders() {
  const token = localStorage.getItem("token");
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, { ...opts, headers: { ...authHeaders(), ...(opts?.headers || {}) } });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Request failed");
  return res.json();
}

// ── Status badge helpers ──────────────────────────────────────────────────────
const REFUND_STATUS: Record<string, string> = { requested: "secondary", processing: "outline", approved: "outline", completed: "default", rejected: "destructive" };
const VOID_STATUS: Record<string, string> = { pending: "secondary", voided: "default", failed: "destructive" };
const REISSUE_STATUS: Record<string, string> = { requested: "secondary", processing: "outline", completed: "default", rejected: "destructive" };

function StatusBadge({ status, map }: { status: string; map: Record<string, string> }) {
  return <Badge variant={(map[status] || "secondary") as any} className="capitalize">{status}</Badge>;
}

// ── Currency format ───────────────────────────────────────────────────────────
function money(v: number | null | undefined) {
  return (v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Field component ───────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REFUNDS TAB
// ─────────────────────────────────────────────────────────────────────────────
type Refund = {
  id: string; refundRef?: string; pnr?: string; ticketNumber?: string;
  clientName?: string; airline?: string; originalFare: number;
  airlineRefund: number; taxRefund: number; agencyFee: number;
  netRefundAmount: number; reason?: string; status: string;
  refundMethod?: string; notes?: string; createdAt: string;
};
const emptyRefund = {
  refundRef: "", pnr: "", ticketNumber: "", clientName: "", airline: "",
  originalFare: "", airlineRefund: "", taxRefund: "", agencyFee: "",
  reason: "", status: "requested", refundMethod: "", notes: "",
};

function RefundsTab() {
  const { toast } = useToast();
  const [records, setRecords] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyRefund });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRecords(await apiFetch("/ticket-refunds")); } catch { toast({ variant: "destructive", title: "Failed to load refunds" }); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q ? records.filter(r => [r.clientName, r.pnr, r.ticketNumber, r.airline, r.refundRef].some(v => v?.toLowerCase().includes(q))) : records;
  }, [records, search]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const openNew = () => { setForm({ ...emptyRefund }); setEditId(null); setOpen(true); };
  const openEdit = (r: Refund) => {
    setForm({
      refundRef: r.refundRef || "", pnr: r.pnr || "", ticketNumber: r.ticketNumber || "",
      clientName: r.clientName || "", airline: r.airline || "",
      originalFare: String(r.originalFare), airlineRefund: String(r.airlineRefund),
      taxRefund: String(r.taxRefund), agencyFee: String(r.agencyFee),
      reason: r.reason || "", status: r.status, refundMethod: r.refundMethod || "", notes: r.notes || "",
    });
    setEditId(r.id); setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editId) {
        const updated = await apiFetch(`/ticket-refunds/${editId}`, { method: "PATCH", body: JSON.stringify(form) });
        setRecords(prev => prev.map(r => r.id === editId ? updated : r));
        toast({ title: "Refund updated" });
      } else {
        const created = await apiFetch("/ticket-refunds", { method: "POST", body: JSON.stringify(form) });
        setRecords(prev => [created, ...prev]);
        toast({ title: "Refund created" });
      }
      setOpen(false);
    } catch (err: any) { toast({ variant: "destructive", title: err.message }); }
    finally { setSaving(false); }
  };

  const del = async (id: string) => {
    try {
      await apiFetch(`/ticket-refunds/${id}`, { method: "DELETE" });
      setRecords(prev => prev.filter(r => r.id !== id));
      toast({ title: "Deleted" });
    } catch { toast({ variant: "destructive", title: "Delete failed" }); }
  };

  const net = (Number(form.airlineRefund) || 0) + (Number(form.taxRefund) || 0) - (Number(form.agencyFee) || 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search client, PNR, ticket…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />New Refund</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref / PNR</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Airline</TableHead>
                <TableHead className="text-right">Orig Fare</TableHead>
                <TableHead className="text-right">Net Refund</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No refund records found</TableCell></TableRow>
              ) : filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-mono text-xs font-medium">{r.refundRef || "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.pnr || ""}</div>
                  </TableCell>
                  <TableCell>{r.clientName || "—"}</TableCell>
                  <TableCell>{r.airline || "—"}</TableCell>
                  <TableCell className="text-right text-sm">{money(r.originalFare)}</TableCell>
                  <TableCell className="text-right text-sm font-medium text-green-600">{money(r.netRefundAmount)}</TableCell>
                  <TableCell><StatusBadge status={r.status} map={REFUND_STATUS} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(r.createdAt), "PP")}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit Refund" : "New Ticket Refund"}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Refund Ref"><Input value={form.refundRef} onChange={e => set("refundRef", e.target.value)} placeholder="RF-001" /></Field>
              <Field label="PNR"><Input value={form.pnr} onChange={e => set("pnr", e.target.value)} placeholder="ABC123" /></Field>
              <Field label="Ticket Number"><Input value={form.ticketNumber} onChange={e => set("ticketNumber", e.target.value)} /></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Client Name"><Input value={form.clientName} onChange={e => set("clientName", e.target.value)} /></Field>
              <Field label="Airline"><Input value={form.airline} onChange={e => set("airline", e.target.value)} placeholder="Biman, Emirates…" /></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Original Fare"><Input type="number" min="0" step="0.01" value={form.originalFare} onChange={e => set("originalFare", e.target.value)} /></Field>
              <Field label="Airline Refund"><Input type="number" min="0" step="0.01" value={form.airlineRefund} onChange={e => set("airlineRefund", e.target.value)} /></Field>
              <Field label="Tax Refund"><Input type="number" min="0" step="0.01" value={form.taxRefund} onChange={e => set("taxRefund", e.target.value)} /></Field>
              <Field label="Agency Fee (deduct)"><Input type="number" min="0" step="0.01" value={form.agencyFee} onChange={e => set("agencyFee", e.target.value)} /></Field>
            </div>
            <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-medium text-green-800 dark:text-green-300">Net Refund to Client</span>
              <span className="text-lg font-bold text-green-700 dark:text-green-400">{money(net)}</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Status">
                <Select value={form.status} onValueChange={v => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["requested","processing","approved","completed","rejected"].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Refund Method"><Input value={form.refundMethod} onChange={e => set("refundMethod", e.target.value)} placeholder="Bank transfer, cash…" /></Field>
              <Field label="Reason"><Input value={form.reason} onChange={e => set("reason", e.target.value)} /></Field>
            </div>
            <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={e => set("notes", e.target.value)} /></Field>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={saving}>{saving ? "Saving…" : editId ? "Save Changes" : "Create Refund"}</Button>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VOIDS TAB
// ─────────────────────────────────────────────────────────────────────────────
type Void = {
  id: string; voidRef?: string; pnr?: string; ticketNumber?: string;
  clientName?: string; airline?: string; ticketDate?: string;
  voidDeadline?: string; originalFare: number; voidReason?: string;
  status: string; notes?: string; createdAt: string;
};
const emptyVoid = {
  voidRef: "", pnr: "", ticketNumber: "", clientName: "", airline: "",
  ticketDate: "", voidDeadline: "", originalFare: "", voidReason: "",
  status: "pending", notes: "",
};

function VoidsTab() {
  const { toast } = useToast();
  const [records, setRecords] = useState<Void[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyVoid });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRecords(await apiFetch("/ticket-voids")); } catch { toast({ variant: "destructive", title: "Failed to load voids" }); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q ? records.filter(r => [r.clientName, r.pnr, r.ticketNumber, r.airline, r.voidRef].some(v => v?.toLowerCase().includes(q))) : records;
  }, [records, search]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const openNew = () => { setForm({ ...emptyVoid }); setEditId(null); setOpen(true); };
  const openEdit = (r: Void) => {
    setForm({
      voidRef: r.voidRef || "", pnr: r.pnr || "", ticketNumber: r.ticketNumber || "",
      clientName: r.clientName || "", airline: r.airline || "",
      ticketDate: r.ticketDate || "", voidDeadline: r.voidDeadline || "",
      originalFare: String(r.originalFare), voidReason: r.voidReason || "",
      status: r.status, notes: r.notes || "",
    });
    setEditId(r.id); setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editId) {
        const updated = await apiFetch(`/ticket-voids/${editId}`, { method: "PATCH", body: JSON.stringify(form) });
        setRecords(prev => prev.map(r => r.id === editId ? updated : r));
        toast({ title: "Void updated" });
      } else {
        const created = await apiFetch("/ticket-voids", { method: "POST", body: JSON.stringify(form) });
        setRecords(prev => [created, ...prev]);
        toast({ title: "Void created" });
      }
      setOpen(false);
    } catch (err: any) { toast({ variant: "destructive", title: err.message }); }
    finally { setSaving(false); }
  };

  const del = async (id: string) => {
    try {
      await apiFetch(`/ticket-voids/${id}`, { method: "DELETE" });
      setRecords(prev => prev.filter(r => r.id !== id));
      toast({ title: "Deleted" });
    } catch { toast({ variant: "destructive", title: "Delete failed" }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search client, PNR, ticket…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />New Void</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Void Ref / PNR</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Airline</TableHead>
                <TableHead>Ticket Date</TableHead>
                <TableHead>Void Deadline</TableHead>
                <TableHead className="text-right">Fare</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No void records found</TableCell></TableRow>
              ) : filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-mono text-xs font-medium">{r.voidRef || "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.pnr || ""}</div>
                  </TableCell>
                  <TableCell>{r.clientName || "—"}</TableCell>
                  <TableCell>{r.airline || "—"}</TableCell>
                  <TableCell className="text-xs">{r.ticketDate || "—"}</TableCell>
                  <TableCell className="text-xs">
                    {r.voidDeadline ? (
                      <span className={new Date(r.voidDeadline) < new Date() && r.status !== "voided" ? "text-destructive font-medium" : ""}>{r.voidDeadline}</span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm">{money(r.originalFare)}</TableCell>
                  <TableCell><StatusBadge status={r.status} map={VOID_STATUS} /></TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit Void" : "New Ticket Void"}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-4 py-2.5 text-sm text-amber-800 dark:text-amber-300">
              Voids are same-day cancellations before BSP settlement — full fare is returned with no penalty.
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Void Ref"><Input value={form.voidRef} onChange={e => set("voidRef", e.target.value)} placeholder="VD-001" /></Field>
              <Field label="PNR"><Input value={form.pnr} onChange={e => set("pnr", e.target.value)} /></Field>
              <Field label="Ticket Number"><Input value={form.ticketNumber} onChange={e => set("ticketNumber", e.target.value)} /></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Client Name"><Input value={form.clientName} onChange={e => set("clientName", e.target.value)} /></Field>
              <Field label="Airline"><Input value={form.airline} onChange={e => set("airline", e.target.value)} /></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Ticket Issue Date"><Input type="date" value={form.ticketDate} onChange={e => set("ticketDate", e.target.value)} /></Field>
              <Field label="Void Deadline"><Input type="date" value={form.voidDeadline} onChange={e => set("voidDeadline", e.target.value)} /></Field>
              <Field label="Original Fare"><Input type="number" min="0" step="0.01" value={form.originalFare} onChange={e => set("originalFare", e.target.value)} /></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Status">
                <Select value={form.status} onValueChange={v => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["pending","voided","failed"].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Void Reason"><Input value={form.voidReason} onChange={e => set("voidReason", e.target.value)} /></Field>
            </div>
            <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={e => set("notes", e.target.value)} /></Field>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={saving}>{saving ? "Saving…" : editId ? "Save Changes" : "Create Void"}</Button>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REISSUES TAB
// ─────────────────────────────────────────────────────────────────────────────
type Reissue = {
  id: string; reissueRef?: string; pnr?: string; ticketNumber?: string;
  clientName?: string; airline?: string; originalRoute?: string; newRoute?: string;
  originalDate?: string; newDate?: string; originalFare: number; newFare: number;
  fareDifference: number; reissueFee: number; agencyFee: number;
  totalCharge: number; reason?: string; status: string; notes?: string; createdAt: string;
};
const emptyReissue = {
  reissueRef: "", pnr: "", ticketNumber: "", clientName: "", airline: "",
  originalRoute: "", newRoute: "", originalDate: "", newDate: "",
  originalFare: "", newFare: "", fareDifference: "", reissueFee: "", agencyFee: "",
  reason: "", status: "requested", notes: "",
};

function ReissuesTab() {
  const { toast } = useToast();
  const [records, setRecords] = useState<Reissue[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyReissue });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRecords(await apiFetch("/ticket-reissues")); } catch { toast({ variant: "destructive", title: "Failed to load reissues" }); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q ? records.filter(r => [r.clientName, r.pnr, r.ticketNumber, r.airline, r.reissueRef].some(v => v?.toLowerCase().includes(q))) : records;
  }, [records, search]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const openNew = () => { setForm({ ...emptyReissue }); setEditId(null); setOpen(true); };
  const openEdit = (r: Reissue) => {
    setForm({
      reissueRef: r.reissueRef || "", pnr: r.pnr || "", ticketNumber: r.ticketNumber || "",
      clientName: r.clientName || "", airline: r.airline || "",
      originalRoute: r.originalRoute || "", newRoute: r.newRoute || "",
      originalDate: r.originalDate || "", newDate: r.newDate || "",
      originalFare: String(r.originalFare), newFare: String(r.newFare),
      fareDifference: String(r.fareDifference), reissueFee: String(r.reissueFee),
      agencyFee: String(r.agencyFee), reason: r.reason || "",
      status: r.status, notes: r.notes || "",
    });
    setEditId(r.id); setOpen(true);
  };

  const fareDiff = (Number(form.newFare) || 0) - (Number(form.originalFare) || 0);
  const totalCharge = fareDiff + (Number(form.reissueFee) || 0) + (Number(form.agencyFee) || 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { ...form, fareDifference: String(fareDiff), totalCharge: String(totalCharge) };
      if (editId) {
        const updated = await apiFetch(`/ticket-reissues/${editId}`, { method: "PATCH", body: JSON.stringify(payload) });
        setRecords(prev => prev.map(r => r.id === editId ? updated : r));
        toast({ title: "Reissue updated" });
      } else {
        const created = await apiFetch("/ticket-reissues", { method: "POST", body: JSON.stringify(payload) });
        setRecords(prev => [created, ...prev]);
        toast({ title: "Reissue created" });
      }
      setOpen(false);
    } catch (err: any) { toast({ variant: "destructive", title: err.message }); }
    finally { setSaving(false); }
  };

  const del = async (id: string) => {
    try {
      await apiFetch(`/ticket-reissues/${id}`, { method: "DELETE" });
      setRecords(prev => prev.filter(r => r.id !== id));
      toast({ title: "Deleted" });
    } catch { toast({ variant: "destructive", title: "Delete failed" }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search client, PNR, route…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />New Reissue</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref / PNR</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Route change</TableHead>
                <TableHead>Date change</TableHead>
                <TableHead className="text-right">Fare Diff</TableHead>
                <TableHead className="text-right">Total Charge</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No reissue records found</TableCell></TableRow>
              ) : filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-mono text-xs font-medium">{r.reissueRef || "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.pnr || ""}</div>
                  </TableCell>
                  <TableCell>
                    <div>{r.clientName || "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.airline || ""}</div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.originalRoute || r.newRoute ? (
                      <span>{r.originalRoute || "?"} → {r.newRoute || "?"}</span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.originalDate || r.newDate ? (
                      <span>{r.originalDate || "?"} → {r.newDate || "?"}</span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className={`text-right text-sm font-medium ${r.fareDifference >= 0 ? "text-destructive" : "text-green-600"}`}>
                    {r.fareDifference >= 0 ? "+" : ""}{money(r.fareDifference)}
                  </TableCell>
                  <TableCell className="text-right text-sm font-bold">{money(r.totalCharge)}</TableCell>
                  <TableCell><StatusBadge status={r.status} map={REISSUE_STATUS} /></TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit Reissue" : "New Ticket Reissue"}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Reissue Ref"><Input value={form.reissueRef} onChange={e => set("reissueRef", e.target.value)} placeholder="RI-001" /></Field>
              <Field label="PNR"><Input value={form.pnr} onChange={e => set("pnr", e.target.value)} /></Field>
              <Field label="Ticket Number"><Input value={form.ticketNumber} onChange={e => set("ticketNumber", e.target.value)} /></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Client Name"><Input value={form.clientName} onChange={e => set("clientName", e.target.value)} /></Field>
              <Field label="Airline"><Input value={form.airline} onChange={e => set("airline", e.target.value)} /></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Original Route"><Input value={form.originalRoute} onChange={e => set("originalRoute", e.target.value)} placeholder="DAC-DXB" /></Field>
              <Field label="New Route"><Input value={form.newRoute} onChange={e => set("newRoute", e.target.value)} placeholder="DAC-DXB" /></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Original Date"><Input type="date" value={form.originalDate} onChange={e => set("originalDate", e.target.value)} /></Field>
              <Field label="New Date"><Input type="date" value={form.newDate} onChange={e => set("newDate", e.target.value)} /></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Original Fare"><Input type="number" min="0" step="0.01" value={form.originalFare} onChange={e => set("originalFare", e.target.value)} /></Field>
              <Field label="New Fare"><Input type="number" min="0" step="0.01" value={form.newFare} onChange={e => set("newFare", e.target.value)} /></Field>
              <Field label="Reissue Penalty"><Input type="number" min="0" step="0.01" value={form.reissueFee} onChange={e => set("reissueFee", e.target.value)} /></Field>
              <Field label="Agency Fee"><Input type="number" min="0" step="0.01" value={form.agencyFee} onChange={e => set("agencyFee", e.target.value)} /></Field>
            </div>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 px-4 py-3 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-blue-700 dark:text-blue-400">Fare difference</p>
                <p className={`text-base font-bold ${fareDiff >= 0 ? "text-destructive" : "text-green-600"}`}>{fareDiff >= 0 ? "+" : ""}{money(fareDiff)}</p>
              </div>
              <div>
                <p className="text-xs text-blue-700 dark:text-blue-400">Total to charge client</p>
                <p className="text-base font-bold text-blue-800 dark:text-blue-300">{money(totalCharge)}</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Status">
                <Select value={form.status} onValueChange={v => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["requested","processing","completed","rejected"].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Reason"><Input value={form.reason} onChange={e => set("reason", e.target.value)} /></Field>
            </div>
            <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={e => set("notes", e.target.value)} /></Field>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={saving}>{saving ? "Saving…" : editId ? "Save Changes" : "Create Reissue"}</Button>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function TicketTransactions() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            Ticket Transactions
          </h1>
          <p className="text-muted-foreground mt-1">Manage airline ticket refunds, same-day voids, and reissues</p>
        </div>

        <Tabs defaultValue="refunds">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="refunds" className="flex items-center gap-1.5">
              <Undo2 className="h-4 w-4" /> Refunds
            </TabsTrigger>
            <TabsTrigger value="voids" className="flex items-center gap-1.5">
              <Ban className="h-4 w-4" /> Voids
            </TabsTrigger>
            <TabsTrigger value="reissues" className="flex items-center gap-1.5">
              <RefreshCw className="h-4 w-4" /> Reissues
            </TabsTrigger>
          </TabsList>
          <TabsContent value="refunds" className="mt-4"><RefundsTab /></TabsContent>
          <TabsContent value="voids" className="mt-4"><VoidsTab /></TabsContent>
          <TabsContent value="reissues" className="mt-4"><ReissuesTab /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
