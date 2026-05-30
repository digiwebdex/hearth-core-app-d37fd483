import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { adminApi, type AdminTenant } from "@/lib/api";
import { adminSubscriptionWorkflowApi, type WorkflowPaymentRequest, type WorkflowSubscriptionHistory } from "@/lib/subscriptionWorkflowApi";
import { PLANS, type BillingCycle, type PlanType } from "@/lib/plans";

const statusClasses: Record<string, string> = {
  trial: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  expired: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  suspended: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

type ActionType = "activate" | "extend" | "skip_trial" | "suspend";

const AdminTenantDetails = () => {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<AdminTenant | null>(null);
  const [requests, setRequests] = useState<WorkflowPaymentRequest[]>([]);
  const [history, setHistory] = useState<WorkflowSubscriptionHistory[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<ActionType | null>(null);
  const [plan, setPlan] = useState<PlanType>("basic");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [months, setMonths] = useState("1");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [tenantData, requestData, historyData] = await Promise.all([
        adminApi.getTenant(tenantId),
        adminSubscriptionWorkflowApi.listPaymentRequests({ tenantId }),
        adminSubscriptionWorkflowApi.getSubscriptionHistory(tenantId),
      ]);
      setTenant(tenantData);
      setRequests(requestData);
      setHistory(historyData);
      setPlan((tenantData.subscriptionPlan || "basic") as PlanType);
    } catch (err: any) {
      toast({ title: "Failed to load tenant", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [tenantId]);

  const owner = useMemo(() => tenant?.users?.find((user) => user.role === "tenant_owner") || tenant?.users?.[0], [tenant]);

  const openAction = (nextAction: ActionType) => {
    if (!tenant) return;
    setActionType(nextAction);
    setPlan((tenant.subscriptionPlan || "basic") as PlanType);
    setBillingCycle("monthly");
    setMonths("1");
    setNote("");
    setDialogOpen(true);
  };

  const submitAction = async () => {
    if (!tenant || !actionType) return;
    setSaving(true);
    try {
      if (actionType === "activate") {
        await adminSubscriptionWorkflowApi.manualActivate(tenant.id, { plan, billingCycle, subscriptionStatus: "active", note, actionType: "activated" });
      } else if (actionType === "extend") {
        await adminSubscriptionWorkflowApi.extendSubscription(tenant.id, Number(months || 1), note || undefined);
      } else if (actionType === "skip_trial") {
        await adminSubscriptionWorkflowApi.skipTrial(tenant.id, { targetPlan: plan, billingCycle, note });
      } else if (actionType === "suspend") {
        await adminSubscriptionWorkflowApi.suspendSubscription(tenant.id, note || undefined);
      }
      toast({ title: "Tenant subscription updated", description: tenant.name });
      setDialogOpen(false);
      await loadData();
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <AdminLayout><p className="text-center py-12 text-muted-foreground">Loading tenant details...</p></AdminLayout>;
  }

  if (!tenant) {
    return <AdminLayout><div className="space-y-4"><Button variant="outline" onClick={() => navigate("/admin/tenants")}>Back</Button><p className="text-muted-foreground">Tenant not found.</p></div></AdminLayout>;
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/tenants")}>Back to agencies</Button>
            <h1 className="text-3xl font-bold tracking-tight">{tenant.name}</h1>
            <p className="text-muted-foreground">Tenant ID: {tenant.id}</p>
          </div>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium capitalize ${statusClasses[tenant.subscriptionStatus] || ""}`}>{tenant.subscriptionStatus}</span>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Company profile</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">Owner:</span> {owner?.name || "—"}</p>
              <p><span className="text-muted-foreground">Owner email:</span> {owner?.email || "—"}</p>
              <p><span className="text-muted-foreground">Created:</span> {new Date(tenant.createdAt).toLocaleDateString()}</p>
              <p><span className="text-muted-foreground">Users:</span> {tenant._count?.users || tenant.users?.length || 0}</p>
              <p><span className="text-muted-foreground">Bookings:</span> {tenant._count?.bookings || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Subscription</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">Current plan:</span> <Badge variant="secondary" className="ml-1 capitalize">{tenant.subscriptionPlan}</Badge></p>
              <p><span className="text-muted-foreground">Expiry:</span> {tenant.subscriptionExpiry ? new Date(tenant.subscriptionExpiry).toLocaleDateString() : "—"}</p>
              <p><span className="text-muted-foreground">Available plans:</span> {PLANS.map((item) => item.name).join(", ")}</p>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => openAction("activate")}>Activate / change plan</Button>
                <Button size="sm" variant="outline" onClick={() => openAction("extend")}>Extend</Button>
                {tenant.subscriptionStatus === "trial" && <Button size="sm" variant="outline" onClick={() => openAction("skip_trial")}>Skip trial</Button>}
                {tenant.subscriptionStatus !== "suspended" && <Button size="sm" variant="destructive" onClick={() => openAction("suspend")}>Suspend</Button>}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Recent payment requests</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No payment requests for this agency.</TableCell></TableRow>
                ) : requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="capitalize">{request.requestedPlan || request.plan}</TableCell>
                    <TableCell className="capitalize">{request.requestType || "activate"}</TableCell>
                    <TableCell>৳{(request.amountSent || request.amount || 0).toLocaleString()}</TableCell>
                    <TableCell className="capitalize">{request.paymentMethod || request.method}</TableCell>
                    <TableCell><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusClasses[request.status] || ""}`}>{request.status}</span></TableCell>
                    <TableCell>{new Date(request.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Subscription history</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Old plan</TableHead>
                  <TableHead>New plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No subscription history yet.</TableCell></TableRow>
                ) : history.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="capitalize">{item.actionType.replace(/_/g, " ")}</TableCell>
                    <TableCell className="capitalize">{item.oldPlan || "—"}</TableCell>
                    <TableCell className="capitalize">{item.newPlan}</TableCell>
                    <TableCell>{item.oldStatus || "—"} → {item.newStatus}</TableCell>
                    <TableCell>{item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>{new Date(item.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{actionType === "activate" ? "Activate or change plan" : actionType === "extend" ? "Extend subscription" : actionType === "skip_trial" ? "Skip trial and activate paid plan" : "Suspend subscription"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              {(actionType === "activate" || actionType === "skip_trial") && (
                <>
                  <div>
                    <Label>Target plan</Label>
                    <Select value={plan} onValueChange={(value: PlanType) => setPlan(value)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PLANS.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Billing cycle</Label>
                    <Select value={billingCycle} onValueChange={(value: BillingCycle) => setBillingCycle(value)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              {actionType === "extend" && (
                <div>
                  <Label>Extend by months</Label>
                  <Input value={months} onChange={(e) => setMonths(e.target.value)} />
                </div>
              )}
              <div>
                <Label>Note</Label>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional admin note" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={submitAction} disabled={saving}>{saving ? "Saving..." : "Confirm"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminTenantDetails;