import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, RefreshCw, Edit2 } from "lucide-react";
import { visaApi, type VisaApplication } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const STAGES = [
  { key: "not_applied", label: "Not Applied", color: "bg-gray-100 text-gray-600" },
  { key: "applied", label: "Applied", color: "bg-blue-100 text-blue-800" },
  { key: "in_progress", label: "In Progress", color: "bg-yellow-100 text-yellow-800" },
  { key: "approved", label: "Approved", color: "bg-green-100 text-green-800" },
  { key: "rejected", label: "Rejected", color: "bg-red-100 text-red-700" },
  { key: "collected", label: "Collected", color: "bg-purple-100 text-purple-800" },
];

const emptyForm = {
  applicantName: "", passportNumber: "", nationality: "", visaType: "", destination: "",
  appliedDate: "", appointmentDate: "", decisionDate: "", expiryDate: "",
  status: "not_applied", referenceNo: "", embassyFee: "", serviceFee: "", notes: "",
  clientId: "", bookingId: "",
};

export default function VisaTracker() {
  const { toast } = useToast();
  const [visas, setVisas] = useState<VisaApplication[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<VisaApplication | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [v, s] = await Promise.all([
        visaApi.list({ status: filterStatus || undefined, search: searchQ || undefined }),
        visaApi.summary(),
      ]);
      setVisas(v);
      setSummary(s);
    } catch { toast({ title: "Failed to load", variant: "destructive" }); }
    finally { setLoading(false); }
  }, [searchQ, filterStatus]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setForm(emptyForm); setEditTarget(null); setShowCreate(true); }
  function openEdit(v: VisaApplication) {
    setForm({
      applicantName: v.applicantName, passportNumber: v.passportNumber || "", nationality: v.nationality || "",
      visaType: v.visaType || "", destination: v.destination || "",
      appliedDate: v.appliedDate ? v.appliedDate.split("T")[0] : "",
      appointmentDate: v.appointmentDate ? v.appointmentDate.split("T")[0] : "",
      decisionDate: v.decisionDate ? v.decisionDate.split("T")[0] : "",
      expiryDate: v.expiryDate ? v.expiryDate.split("T")[0] : "",
      status: v.status, referenceNo: v.referenceNo || "",
      embassyFee: v.embassyFee?.toString() || "", serviceFee: v.serviceFee?.toString() || "",
      notes: v.notes || "", clientId: v.clientId || "", bookingId: v.bookingId || "",
    });
    setEditTarget(v);
    setShowCreate(true);
  }

  async function save() {
    if (!form.applicantName.trim()) { toast({ title: "Applicant name is required", variant: "destructive" }); return; }
    setSaving(true);
    const data = {
      applicantName: form.applicantName,
      passportNumber: form.passportNumber || undefined,
      nationality: form.nationality || undefined,
      visaType: form.visaType || undefined,
      destination: form.destination || undefined,
      appliedDate: form.appliedDate || undefined,
      appointmentDate: form.appointmentDate || undefined,
      decisionDate: form.decisionDate || undefined,
      expiryDate: form.expiryDate || undefined,
      status: form.status,
      referenceNo: form.referenceNo || undefined,
      embassyFee: form.embassyFee ? parseFloat(form.embassyFee) : undefined,
      serviceFee: form.serviceFee ? parseFloat(form.serviceFee) : undefined,
      notes: form.notes || undefined,
      clientId: form.clientId || undefined,
      bookingId: form.bookingId || undefined,
    };
    try {
      if (editTarget) {
        await visaApi.update(editTarget.id, data);
        toast({ title: "Visa application updated" });
      } else {
        await visaApi.create(data);
        toast({ title: "Visa application created" });
      }
      setShowCreate(false);
      load();
    } catch { toast({ title: "Save failed", variant: "destructive" }); }
    finally { setSaving(false); }
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold">Visa Tracker</h1>
            <p className="text-muted-foreground text-sm mt-1">Track visa applications through every stage — from submission to collection</p>
          </div>
          <div className="ml-auto flex gap-2 flex-wrap">
            <Input className="w-48 h-8 text-sm" placeholder="Search by name / passport..." value={searchQ} onChange={(e) => setSearchQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
            <select className="border rounded-md px-2 py-1 text-sm h-8" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></Button>
            <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1.5" />New Application</Button>
          </div>
        </div>

        {/* Stage summary */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {STAGES.map((s) => (
            <button key={s.key} onClick={() => setFilterStatus(filterStatus === s.key ? "" : s.key)} className={`rounded-lg border p-3 text-center cursor-pointer transition-all hover:shadow-sm ${filterStatus === s.key ? "ring-2 ring-primary" : ""}`}>
              <p className="text-xl font-bold">{summary[s.key] || 0}</p>
              <p className={`text-xs font-medium mt-1 px-1.5 py-0.5 rounded-full inline-block ${s.color}`}>{s.label}</p>
            </button>
          ))}
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? <div className="p-6"><Skeleton className="h-60 w-full" /></div> : visas.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No visa applications found. Click "New Application" to add one.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Applicant</th>
                      <th className="text-left px-4 py-2 font-medium">Passport</th>
                      <th className="text-left px-4 py-2 font-medium">Destination</th>
                      <th className="text-left px-4 py-2 font-medium">Visa Type</th>
                      <th className="text-left px-4 py-2 font-medium">Applied</th>
                      <th className="text-left px-4 py-2 font-medium">Decision</th>
                      <th className="text-left px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visas.map((v) => {
                      const stage = STAGES.find((s) => s.key === v.status);
                      return (
                        <tr key={v.id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-2.5">
                            <p className="font-medium">{v.applicantName}</p>
                            {v.client && <p className="text-xs text-muted-foreground">{v.client.name}</p>}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs">{v.passportNumber || "—"}</td>
                          <td className="px-4 py-2.5">{v.destination || "—"}</td>
                          <td className="px-4 py-2.5">{v.visaType || "—"}</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{v.appliedDate ? new Date(v.appliedDate).toLocaleDateString() : "—"}</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{v.decisionDate ? new Date(v.decisionDate).toLocaleDateString() : "—"}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${stage?.color || ""}`}>{stage?.label || v.status}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(v)}><Edit2 className="w-3.5 h-3.5" /></Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create / Edit dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{editTarget ? "Edit Visa Application" : "New Visa Application"}</DialogTitle></DialogHeader>
            <div className="grid md:grid-cols-2 gap-3 py-2 max-h-[70vh] overflow-y-auto pr-1">
              <div className="space-y-1.5 md:col-span-2"><Label>Applicant Name *</Label><Input value={form.applicantName} onChange={(e) => setForm({ ...form, applicantName: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Passport Number</Label><Input value={form.passportNumber} onChange={(e) => setForm({ ...form, passportNumber: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Nationality</Label><Input value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Destination Country</Label><Input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Visa Type</Label><Input placeholder="e.g. Tourist, Business, Umrah" value={form.visaType} onChange={(e) => setForm({ ...form, visaType: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Applied Date</Label><Input type="date" value={form.appliedDate} onChange={(e) => setForm({ ...form, appliedDate: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Appointment Date</Label><Input type="date" value={form.appointmentDate} onChange={(e) => setForm({ ...form, appointmentDate: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Decision Date</Label><Input type="date" value={form.decisionDate} onChange={(e) => setForm({ ...form, decisionDate: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Expiry Date</Label><Input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} /></div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5"><Label>Reference No</Label><Input value={form.referenceNo} onChange={(e) => setForm({ ...form, referenceNo: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Embassy Fee (৳)</Label><Input type="number" min={0} value={form.embassyFee} onChange={(e) => setForm({ ...form, embassyFee: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Service Fee (৳)</Label><Input type="number" min={0} value={form.serviceFee} onChange={(e) => setForm({ ...form, serviceFee: e.target.value })} /></div>
              <div className="space-y-1.5 md:col-span-2"><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={save} disabled={saving}>{saving ? "Saving..." : editTarget ? "Update" : "Create"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
