import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { adminApi, type AdminTenant } from "@/lib/api";
import { adminSubscriptionWorkflowApi } from "@/lib/subscriptionWorkflowApi";
import { PLANS, type BillingCycle, type PlanType } from "@/lib/plans";

const statusClasses: Record<string, string> = {
  trial: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  expired: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  suspended: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

type ActionType = "activate" | "extend" | "suspend" | "skip_trial";

const AdminSubscriptions = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<AdminTenant | null>(null);
  const [actionType, setActionType] = useState<ActionType | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [plan, setPlan] = useState<PlanType>("basic");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [months, setMonths] = useState("1");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const loadTenants = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getTenants();
      setTenants(data);
    } catch (err: any) {
      toast({ title: "Failed to load subscriptions", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTenants(); }, []);

  const filtered = useMemo(() => tenants.filter((tenant) => {
    const q = search.toLowerCase();
    const ownerEmail = tenant.users?.find((user) => user.role === "tenant_owner")?.email || "";
    const matchSearch = !q || tenant.name.toLowerCase().includes(q) || ownerEmail.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || tenant.subscriptionStatus === statusFilter;
    return matchSearch && matchStatus;
  }), [tenants, search, statusFilter]);

  const openAction = (tenant: AdminTenant, nextAction: ActionType) => {
    setSelected(tenant);
    setActionType(nextAction);
    setPlan((tenant.subscriptionPlan || "basic") as PlanType);
    setBillingCycle("monthly");
    setMonths("1");
    setNote("");
    setDialogOpen(true);
  };

  const submitAction = async () => {
    if (!selected || !actionType) return;
    setSaving(true);
    try {
      if (actionType === "activate") {
        await adminSubscriptionWorkflowApi.manualActivate(selected.id, { plan, billingCycle, subscriptionStatus: "active", note, actionType: "activated" });
      } else if (actionType === "extend") {
        await adminSubscriptionWorkflowApi.extendSubscription(selected.id, Number(months || 1), note || undefined);
      } else if (actionType === "suspend") {
        await adminSubscriptionWorkflowApi.suspendSubscription(selected.id, note || undefined);
      } else if (actionType === "skip_trial") {
        await adminSubscriptionWorkflowApi.skipTrial(selected.id, { targetPlan: plan, billingCycle, note });
      }
      toast({ title: "Subscription updated", description: selected.name });
      setDialogOpen(false);
      await loadTenants();
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const stats = useMemo(() => ({
    total: tenants.length,
    active: tenants.filter((tenant) => tenant.subscriptionStatus === "active").length,
    trial: tenants.filter((tenant) => tenant.subscriptionStatus === "trial").length,
    suspended: tenants.filter((tenant) => tenant.subscriptionStatus === "suspended").length,
  }), [tenants]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Subscriptions</h1>
            <p className="text-muted-foreground">Manage agency plans, skip trials, extend expiry, or suspend service.</p>
          </div>
          <Button variant="outline" onClick={loadTenants} disabled={loading}>Refresh</Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardContent className="pt-6"><p className="text-2xl font-bold">{stats.total}</p><p className="text-sm text-muted-foreground">Total agencies</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-2xl font-bold">{stats.active}</p><p className="text-sm text-muted-foreground">Active</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-2xl font-bold">{stats.trial}</p><p className="text-sm text-muted-foreground">On trial</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-2xl font-bold">{stats.suspended}</p><p className="text-sm text-muted-foreground">Suspended</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Input className="max-w-sm" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search agency or owner email" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Agency subscriptions</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agency</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Bookings</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No subscriptions found.</TableCell></TableRow>
                ) : filtered.map((tenant) => {
                  const owner = tenant.users?.find((user) => user.role === "tenant_owner") || tenant.users?.[0];
                  return (
                    <TableRow key={tenant.id}>
                      <TableCell className="font-medium">{tenant.name}</TableCell>
                      <TableCell>{owner?.email || "—"}</TableCell>
                      <TableCell className="capitalize">{tenant.subscriptionPlan}</TableCell>
                      <TableCell><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusClasses[tenant.subscriptionStatus] || ""}`}>{tenant.subscriptionStatus}</span></TableCell>
                      <TableCell>{tenant.subscriptionExpiry ? new Date(tenant.subscriptionExpiry).toLocaleDateString() : "—"}</TableCell>
                      <TableCell>{tenant._count?.users || tenant.users?.length || 0}</TableCell>
                      <TableCell>{tenant._count?.bookings || 0}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="outline" onClick={() => navigate(`/admin/tenants/${tenant.id}`, { state: { tenant } })}>View</Button>
                        <Button size="sm" variant="outline" onClick={() => openAction(tenant, "activate")}>Activate / change</Button>
                        <Button size="sm" variant="outline" onClick={() => openAction(tenant, "extend")}>Extend</Button>
                        {tenant.subscriptionStatus === "trial" && <Button size="sm" variant="outline" onClick={() => openAction(tenant, "skip_trial")}>Skip trial</Button>}
                        {tenant.subscriptionStatus !== "suspended" && <Button size="sm" variant="destructive" onClick={() => openAction(tenant, "suspend")}>Suspend</Button>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{actionType === "activate" ? "Activate or change plan" : actionType === "extend" ? "Extend subscription" : actionType === "skip_trial" ? "Skip trial and activate paid plan" : "Suspend subscription"}</DialogTitle></DialogHeader>
            {selected && (
              <div className="space-y-4">
                <div className="rounded-lg border p-3 text-sm bg-muted/30">
                  <p><span className="text-muted-foreground">Agency:</span> {selected.name}</p>
                  <p><span className="text-muted-foreground">Current plan:</span> {selected.subscriptionPlan}</p>
                  <p><span className="text-muted-foreground">Current status:</span> {selected.subscriptionStatus}</p>
                </div>

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
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminSubscriptions;