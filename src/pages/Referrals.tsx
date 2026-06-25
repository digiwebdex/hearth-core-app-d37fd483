import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, RefreshCw, Copy, Check } from "lucide-react";
import { referralApi, type ReferralCode, type ReferralSummary } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const statusColor: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-100 text-gray-600",
  expired: "bg-red-100 text-red-700",
};

export default function Referrals() {
  const { toast } = useToast();
  const [codes, setCodes] = useState<ReferralCode[]>([]);
  const [summary, setSummary] = useState<ReferralSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [form, setForm] = useState({ ownerType: "agent", ownerId: "", commissionType: "percentage", commissionValue: 5, maxUses: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([referralApi.list(), referralApi.summary()]);
      setCodes(c);
      setSummary(s);
    } catch { toast({ title: "Failed to load referral data", variant: "destructive" }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createCode() {
    if (!form.ownerId.trim()) { toast({ title: "Owner ID is required", variant: "destructive" }); return; }
    setCreating(true);
    try {
      await referralApi.create({
        ownerType: form.ownerType,
        ownerId: form.ownerId.trim(),
        commissionType: form.commissionType,
        commissionValue: parseFloat(form.commissionValue.toString()) || 0,
        maxUses: form.maxUses ? parseInt(form.maxUses) : null,
      });
      toast({ title: "Referral code created" });
      setShowCreate(false);
      setForm({ ownerType: "agent", ownerId: "", commissionType: "percentage", commissionValue: 5, maxUses: "" });
      load();
    } catch { toast({ title: "Failed to create code", variant: "destructive" }); }
    finally { setCreating(false); }
  }

  function copyCode(code: string, id: string) {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Referral Program</h1>
            <p className="text-muted-foreground text-sm mt-1">Generate referral codes for agents and clients, track conversions and commissions</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1.5" />New Code</Button>
          </div>
        </div>

        {/* Summary cards */}
        {summary.length > 0 && (
          <div>
            <h2 className="font-semibold text-sm mb-3 text-muted-foreground uppercase tracking-wide">Top Referrers</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {summary.slice(0, 6).map((s) => (
                <Card key={s.ownerId}>
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">{s.ownerName || s.ownerId}</p>
                        <p className="text-xs text-muted-foreground capitalize">{s.ownerType}</p>
                      </div>
                      <Badge variant="secondary">{s.conversions} conversions</Badge>
                    </div>
                    <div className="mt-3 flex gap-4 text-sm">
                      <div><p className="text-muted-foreground text-xs">Commission Earned</p><p className="font-semibold">৳ {s.totalCommission.toLocaleString()}</p></div>
                      <div><p className="text-muted-foreground text-xs">Pending</p><p className="font-semibold text-amber-600">৳ {s.unpaidCommission.toLocaleString()}</p></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Codes table */}
        <Card>
          <CardHeader><CardTitle className="text-base">All Referral Codes</CardTitle></CardHeader>
          <CardContent className="p-0">
            {loading ? <div className="p-6"><Skeleton className="h-40 w-full" /></div> : codes.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No referral codes yet. Create one for your agents or clients.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Code</th>
                    <th className="text-left px-4 py-2 font-medium">Owner</th>
                    <th className="text-left px-4 py-2 font-medium">Commission</th>
                    <th className="text-left px-4 py-2 font-medium">Uses</th>
                    <th className="text-left px-4 py-2 font-medium">Status</th>
                    <th className="text-left px-4 py-2 font-medium">Expires</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono">{c.code}</code>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{c.ownerName || c.ownerId}</p>
                        <p className="text-xs text-muted-foreground capitalize">{c.ownerType}</p>
                      </td>
                      <td className="px-4 py-3">
                        {c.commissionValue}{c.commissionType === "percentage" ? "%" : " ৳"} {c.commissionType === "percentage" ? "" : "flat"}
                      </td>
                      <td className="px-4 py-3">
                        {c.currentUses}{c.maxUses ? ` / ${c.maxUses}` : " / ∞"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${statusColor[c.status] || statusColor.inactive}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : "No expiry"}
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm" onClick={() => copyCode(c.code, c.id)}>
                          {copiedId === c.id ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Create dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Referral Code</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Owner Type</Label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.ownerType} onChange={(e) => setForm({ ...form, ownerType: e.target.value })}>
                    <option value="agent">Agent</option>
                    <option value="client">Client</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Owner ID</Label>
                  <Input placeholder="Agent or Client ID" value={form.ownerId} onChange={(e) => setForm({ ...form, ownerId: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Commission Type</Label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.commissionType} onChange={(e) => setForm({ ...form, commissionType: e.target.value })}>
                    <option value="percentage">Percentage (%)</option>
                    <option value="flat">Flat (৳)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Commission Value</Label>
                  <Input type="number" min={0} value={form.commissionValue} onChange={(e) => setForm({ ...form, commissionValue: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Max Uses (optional)</Label>
                <Input type="number" min={1} placeholder="Leave blank for unlimited" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={createCode} disabled={creating}>{creating ? "Creating..." : "Create Code"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
