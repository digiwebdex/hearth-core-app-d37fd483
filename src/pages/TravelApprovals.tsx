import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, RefreshCw, CheckCircle, XCircle, Clock, Settings } from "lucide-react";
import { travelPolicyApi, type TravelPolicy, type TravelApprovalRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const statusIcon: Record<string, React.ReactNode> = {
  pending: <Clock className="w-4 h-4 text-yellow-600" />,
  approved: <CheckCircle className="w-4 h-4 text-green-600" />,
  rejected: <XCircle className="w-4 h-4 text-red-600" />,
  cancelled: <XCircle className="w-4 h-4 text-gray-400" />,
};

const statusColor: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-600",
};

const emptyPolicy = { name: "", maxFlightBudget: "", maxHotelPerNight: "", maxMealPerDay: "", requiresApproval: true, approverRole: "manager", advanceNoticeDays: "3", notes: "" };

export default function TravelApprovals() {
  const { toast } = useToast();
  const [tab, setTab] = useState("approvals");
  const [policies, setPolicies] = useState<TravelPolicy[]>([]);
  const [approvals, setApprovals] = useState<TravelApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPolicy, setShowPolicy] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [selectedApproval, setSelectedApproval] = useState<TravelApprovalRequest | null>(null);
  const [policyForm, setPolicyForm] = useState(emptyPolicy);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, a] = await Promise.all([travelPolicyApi.listPolicies(), travelPolicyApi.listApprovals()]);
      setPolicies(p);
      setApprovals(a);
    } catch { toast({ title: "Failed to load", variant: "destructive" }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function savePolicy() {
    if (!policyForm.name.trim()) { toast({ title: "Policy name is required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await travelPolicyApi.createPolicy({
        name: policyForm.name,
        maxFlightBudget: policyForm.maxFlightBudget ? parseFloat(policyForm.maxFlightBudget) : undefined,
        maxHotelPerNight: policyForm.maxHotelPerNight ? parseFloat(policyForm.maxHotelPerNight) : undefined,
        maxMealPerDay: policyForm.maxMealPerDay ? parseFloat(policyForm.maxMealPerDay) : undefined,
        requiresApproval: policyForm.requiresApproval,
        approverRole: policyForm.approverRole,
        advanceNoticeDays: parseInt(policyForm.advanceNoticeDays) || 3,
        notes: policyForm.notes || undefined,
      });
      toast({ title: "Policy created" });
      setShowPolicy(false);
      setPolicyForm(emptyPolicy);
      load();
    } catch { toast({ title: "Failed to save", variant: "destructive" }); }
    finally { setSaving(false); }
  }

  async function approveRequest(id: string) {
    try {
      await travelPolicyApi.updateApproval(id, { status: "approved" });
      toast({ title: "Request approved" });
      load();
    } catch { toast({ title: "Failed", variant: "destructive" }); }
  }

  async function rejectRequest() {
    if (!selectedApproval) return;
    try {
      await travelPolicyApi.updateApproval(selectedApproval.id, { status: "rejected", rejectionNote: rejectNote });
      toast({ title: "Request rejected" });
      setShowRejectDialog(false);
      setRejectNote("");
      setSelectedApproval(null);
      load();
    } catch { toast({ title: "Failed", variant: "destructive" }); }
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Corporate Travel Management</h1>
            <p className="text-muted-foreground text-sm mt-1">Travel policies and approval workflows for corporate clients</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="approvals"><Clock className="w-4 h-4 mr-1.5" />Approval Requests</TabsTrigger>
            <TabsTrigger value="policies"><Settings className="w-4 h-4 mr-1.5" />Travel Policies</TabsTrigger>
          </TabsList>

          <TabsContent value="approvals" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Travel Approval Requests</CardTitle></CardHeader>
              <CardContent className="p-0">
                {loading ? <div className="p-6"><Skeleton className="h-40 w-full" /></div> : approvals.length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground">No approval requests yet. Requests are submitted when corporate travel plans require manager sign-off.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/40">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium">Requestor</th>
                        <th className="text-left px-4 py-2 font-medium">Destination</th>
                        <th className="text-left px-4 py-2 font-medium">Travel Date</th>
                        <th className="text-left px-4 py-2 font-medium">Purpose</th>
                        <th className="text-right px-4 py-2 font-medium">Est. Cost</th>
                        <th className="text-left px-4 py-2 font-medium">Status</th>
                        <th className="px-4 py-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approvals.map((a) => (
                        <tr key={a.id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{a.requestedBy.slice(0, 8)}…</td>
                          <td className="px-4 py-2.5 font-medium">{a.destination || "—"}</td>
                          <td className="px-4 py-2.5">{a.travelDate ? new Date(a.travelDate).toLocaleDateString() : "—"}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{a.purpose || "—"}</td>
                          <td className="px-4 py-2.5 text-right">{a.estimatedCost ? `৳ ${a.estimatedCost.toLocaleString()}` : "—"}</td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full capitalize ${statusColor[a.status]}`}>
                              {statusIcon[a.status]}{a.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            {a.status === "pending" && (
                              <div className="flex gap-1">
                                <Button size="sm" variant="outline" className="h-7 px-2 text-green-700 border-green-300 hover:bg-green-50" onClick={() => approveRequest(a.id)}>
                                  <CheckCircle className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 px-2 text-red-600 border-red-300 hover:bg-red-50" onClick={() => { setSelectedApproval(a); setShowRejectDialog(true); }}>
                                  <XCircle className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="policies" className="mt-4 space-y-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setShowPolicy(true)}><Plus className="w-4 h-4 mr-1.5" />New Policy</Button>
            </div>
            {loading ? <Skeleton className="h-40 w-full" /> : policies.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">
                <p className="font-medium">No travel policies yet</p>
                <p className="text-sm mt-1">Create policies to set budget limits and approval rules for corporate travel.</p>
              </CardContent></Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {policies.map((p) => (
                  <Card key={p.id}>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <h3 className="font-semibold">{p.name}</h3>
                        <Badge variant={p.isActive ? "default" : "secondary"}>{p.isActive ? "Active" : "Inactive"}</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        {p.maxFlightBudget && <div><p className="text-xs text-muted-foreground">Max Flight</p><p className="font-medium">৳ {p.maxFlightBudget.toLocaleString()}</p></div>}
                        {p.maxHotelPerNight && <div><p className="text-xs text-muted-foreground">Hotel/Night</p><p className="font-medium">৳ {p.maxHotelPerNight.toLocaleString()}</p></div>}
                        {p.maxMealPerDay && <div><p className="text-xs text-muted-foreground">Meal/Day</p><p className="font-medium">৳ {p.maxMealPerDay.toLocaleString()}</p></div>}
                      </div>
                      <div className="text-xs text-muted-foreground flex gap-4">
                        <span>Approval: {p.requiresApproval ? `Required (${p.approverRole})` : "Not required"}</span>
                        <span>Notice: {p.advanceNoticeDays} days</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Policy dialog */}
        <Dialog open={showPolicy} onOpenChange={setShowPolicy}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Create Travel Policy</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5"><Label>Policy Name *</Label><Input value={policyForm.name} onChange={(e) => setPolicyForm({ ...policyForm, name: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5"><Label>Max Flight (৳)</Label><Input type="number" min={0} value={policyForm.maxFlightBudget} onChange={(e) => setPolicyForm({ ...policyForm, maxFlightBudget: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Hotel/Night (৳)</Label><Input type="number" min={0} value={policyForm.maxHotelPerNight} onChange={(e) => setPolicyForm({ ...policyForm, maxHotelPerNight: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Meal/Day (৳)</Label><Input type="number" min={0} value={policyForm.maxMealPerDay} onChange={(e) => setPolicyForm({ ...policyForm, maxMealPerDay: e.target.value })} /></div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label>Requires Manager Approval</Label>
                <Switch checked={policyForm.requiresApproval} onCheckedChange={(v) => setPolicyForm({ ...policyForm, requiresApproval: v })} />
              </div>
              {policyForm.requiresApproval && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Approver Role</Label>
                    <select className="w-full border rounded-md px-3 py-2 text-sm" value={policyForm.approverRole} onChange={(e) => setPolicyForm({ ...policyForm, approverRole: e.target.value })}>
                      <option value="manager">Manager</option>
                      <option value="owner">Owner</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="space-y-1.5"><Label>Advance Notice (days)</Label><Input type="number" min={0} value={policyForm.advanceNoticeDays} onChange={(e) => setPolicyForm({ ...policyForm, advanceNoticeDays: e.target.value })} /></div>
                </div>
              )}
              <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={2} value={policyForm.notes} onChange={(e) => setPolicyForm({ ...policyForm, notes: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPolicy(false)}>Cancel</Button>
              <Button onClick={savePolicy} disabled={saving}>{saving ? "Saving..." : "Create Policy"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject dialog */}
        <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Reject Travel Request</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">Optionally provide a reason for rejection:</p>
              <Textarea rows={3} placeholder="Reason for rejection..." value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
              <Button variant="destructive" onClick={rejectRequest}>Reject Request</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
