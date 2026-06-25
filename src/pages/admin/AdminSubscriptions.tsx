import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { adminApi, type AdminTenant, type TrialExpiryAlert } from "@/lib/api";
import { adminSubscriptionWorkflowApi } from "@/lib/subscriptionWorkflowApi";
import { PLANS, type BillingCycle, type PlanType } from "@/lib/plans";
import { MessageSquare, Phone, AlertTriangle, Mail, Pencil } from "lucide-react";
import { normalizePhoneInput } from "@/lib/phoneNormalize";
import { Checkbox } from "@/components/ui/checkbox";

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
  const [trialAlerts, setTrialAlerts] = useState<TrialExpiryAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [notifySending, setNotifySending] = useState<string | null>(null);
  const [selectedAlertIds, setSelectedAlertIds] = useState<Set<string>>(new Set());
  const [editContactTenant, setEditContactTenant] = useState<AdminTenant | null>(null);
  const [editContactForm, setEditContactForm] = useState({
    phone: "", whatsapp: "", ownerName: "", ownerEmail: "", ownerPhone: "", ownerWhatsapp: "",
  });
  const [savingContact, setSavingContact] = useState(false);

  const loadTenants = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getTenants({ excludePlatform: true });
      setTenants(data);
    } catch (err: any) {
      toast({ title: "Failed to load subscriptions", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTenants(); }, []);

  const loadTrialAlerts = async () => {
    setAlertsLoading(true);
    try {
      const data = await adminApi.getTrialExpiryAlerts();
      setTrialAlerts(data.items || []);
    } catch {
      setTrialAlerts([]);
    } finally {
      setAlertsLoading(false);
    }
  };

  useEffect(() => { loadTrialAlerts(); }, []);

  const sendTrialNotify = async (tenantId: string, channels: ("sms" | "whatsapp" | "email")[]) => {
    setNotifySending(`${tenantId}:${channels.join(",")}`);
    try {
      const res = await adminApi.sendTrialExpiryNotify(tenantId, channels);
      const label = channels.length === 3
        ? "Email, SMS & WhatsApp sent"
        : channels.includes("email") && channels.includes("sms")
          ? "Email & SMS sent"
          : channels.includes("email") && channels.includes("whatsapp")
            ? "Email & WhatsApp sent"
            : channels.includes("sms") && channels.includes("whatsapp")
              ? "SMS & WhatsApp sent"
              : channels[0] === "email"
                ? "Email sent"
                : channels[0] === "whatsapp"
                  ? "WhatsApp sent"
                  : "SMS sent";
      toast({
        title: label,
        description: res.email || res.phone || res.whatsapp ? `To: ${res.email || res.phone || res.whatsapp}` : undefined,
      });
      await loadTrialAlerts();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Send failed";
      toast({ title: "Notification failed", description: message, variant: "destructive" });
    } finally {
      setNotifySending(null);
    }
  };

  const toggleAlertSelection = (tenantId: string, checked: boolean) => {
    setSelectedAlertIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(tenantId);
      else next.delete(tenantId);
      return next;
    });
  };

  const toggleSelectAllAlerts = (checked: boolean) => {
    if (checked) {
      setSelectedAlertIds(new Set(trialAlerts.map((a) => a.tenantId)));
    } else {
      setSelectedAlertIds(new Set());
    }
  };

  const allAlertsSelected = trialAlerts.length > 0 && trialAlerts.every((a) => selectedAlertIds.has(a.tenantId));
  const someAlertsSelected = selectedAlertIds.size > 0 && !allAlertsSelected;

  const sendBulkTrialNotify = async (channels: ("sms" | "whatsapp" | "email")[]) => {
    const ids = [...selectedAlertIds];
    if (!ids.length) {
      toast({ title: "কোনো এজেন্সি সিলেক্ট করা হয়নি", variant: "destructive" });
      return;
    }
    setNotifySending(`bulk:${channels.join(",")}`);
    try {
      const res = await adminApi.sendBulkTrialExpiryNotify(ids, channels);
      toast({
        title: `নোটিফিকেশন পাঠানো হয়েছে`,
        description: `${res.sent} সফল, ${res.failed} ব্যর্থ (মোট ${res.total})`,
        variant: res.failed > 0 && res.sent === 0 ? "destructive" : undefined,
      });
      setSelectedAlertIds(new Set());
      await loadTrialAlerts();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Send failed";
      toast({ title: "বাল্ক নোটিফিকেশন ব্যর্থ", description: message, variant: "destructive" });
    } finally {
      setNotifySending(null);
    }
  };

  const openEditContact = async (tenant: AdminTenant) => {
    let data = tenant;
    try {
      data = await adminApi.getTenant(tenant.id);
    } catch {
      // use list row if detail fetch fails
    }
    const owner = data.users?.find((user) => user.role === "tenant_owner" || user.role === "owner") || data.users?.[0];
    setEditContactTenant(data);
    setEditContactForm({
      phone: data.phone || "",
      whatsapp: data.whatsapp || "",
      ownerName: owner?.name || "",
      ownerEmail: owner?.email || "",
      ownerPhone: owner?.phone || "",
      ownerWhatsapp: owner?.whatsapp || "",
    });
  };

  const saveEditContact = async () => {
    if (!editContactTenant) return;
    setSavingContact(true);
    try {
      await adminApi.updateTenant(editContactTenant.id, {
        phone: normalizePhoneInput(editContactForm.phone) || null,
        whatsapp: normalizePhoneInput(editContactForm.whatsapp) || null,
      });
      await adminApi.updateTenantOwner(editContactTenant.id, {
        name: editContactForm.ownerName.trim(),
        email: editContactForm.ownerEmail.trim(),
        phone: normalizePhoneInput(editContactForm.ownerPhone),
        whatsapp: normalizePhoneInput(editContactForm.ownerWhatsapp),
      });
      toast({ title: "Contact updated", description: editContactTenant.name });
      setEditContactTenant(null);
      await Promise.all([loadTenants(), loadTrialAlerts()]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Update failed";
      toast({ title: "Update failed", description: message, variant: "destructive" });
    } finally {
      setSavingContact(false);
    }
  };

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
    expired: tenants.filter((tenant) => tenant.subscriptionStatus === "expired").length,
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
          <Button variant="outline" onClick={() => { loadTenants(); loadTrialAlerts(); }} disabled={loading}>Refresh</Button>
        </div>

        {trialAlerts.length > 0 && (
          <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                ট্রায়াল / সাবস্ক্রিপশন মেয়াদ শেষ — রিনিউ করুন
              </CardTitle>
              <CardDescription>
                নিচের এজেন্সিগুলোর ট্রায়াল বা সাবস্ক্রিপশন শেষ হয়েছে। অটো ইমেইল, SMS ও WhatsApp যায় (কনফিগ থাকলে)। আবার পাঠাতে বাটন ব্যবহার করুন।
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedAlertIds.size > 0 && (
                <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-3">
                  <span className="text-sm font-medium mr-2">
                    {selectedAlertIds.size} টি সিলেক্ট — পাঠান:
                  </span>
                  <Button size="sm" variant="outline" disabled={!!notifySending} onClick={() => sendBulkTrialNotify(["email"])}>
                    <Mail className="h-3.5 w-3.5 mr-1" /> Email
                  </Button>
                  <Button size="sm" variant="outline" disabled={!!notifySending} onClick={() => sendBulkTrialNotify(["sms"])}>
                    <Phone className="h-3.5 w-3.5 mr-1" /> SMS
                  </Button>
                  <Button size="sm" variant="outline" disabled={!!notifySending} onClick={() => sendBulkTrialNotify(["whatsapp"])}>
                    <MessageSquare className="h-3.5 w-3.5 mr-1" /> WhatsApp
                  </Button>
                  <Button size="sm" disabled={!!notifySending} onClick={() => sendBulkTrialNotify(["email", "sms", "whatsapp"])}>
                    সব চ্যানেল (All)
                  </Button>
                  <Button size="sm" variant="ghost" disabled={!!notifySending} onClick={() => setSelectedAlertIds(new Set())}>
                    সিলেক্ট বাতিল
                  </Button>
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allAlertsSelected ? true : someAlertsSelected ? "indeterminate" : false}
                        onCheckedChange={(v) => toggleSelectAllAlerts(v === true)}
                        aria-label="সব সিলেক্ট করুন"
                      />
                    </TableHead>
                    <TableHead>এজেন্সি</TableHead>
                    <TableHead>মালিক</TableHead>
                    <TableHead>ফোন</TableHead>
                    <TableHead>প্ল্যান</TableHead>
                    <TableHead>শেষ তারিখ</TableHead>
                    <TableHead>অটো নোটিফাই</TableHead>
                    <TableHead className="text-right">রিনিউ রিমাইন্ডার পাঠান</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trialAlerts.map((alert) => (
                    <TableRow key={alert.tenantId} data-state={selectedAlertIds.has(alert.tenantId) ? "selected" : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={selectedAlertIds.has(alert.tenantId)}
                          onCheckedChange={(v) => toggleAlertSelection(alert.tenantId, v === true)}
                          aria-label={`Select ${alert.tenantName}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {alert.tenantName}
                        {alert.wasTrial ? (
                          <Badge variant="outline" className="ml-2 text-xs">Trial</Badge>
                        ) : (
                          <Badge variant="outline" className="ml-2 text-xs capitalize">{alert.subscriptionPlan || "plan"}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{alert.ownerName || "—"}</div>
                        <div className="text-xs text-muted-foreground">{alert.ownerEmail || ""}</div>
                      </TableCell>
                      <TableCell className="text-sm">{alert.ownerPhone || "—"}</TableCell>
                      <TableCell className="text-sm capitalize">{alert.subscriptionPlan || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {alert.subscriptionExpiry ? new Date(alert.subscriptionExpiry).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {alert.autoNotified ? <Badge variant="secondary" className="text-xs">Auto ✓</Badge> : <Badge variant="outline" className="text-xs">—</Badge>}
                          {alert.emailSent && <Badge variant="outline" className="text-xs">Email</Badge>}
                          {alert.smsSent && <Badge variant="outline" className="text-xs">SMS</Badge>}
                          {alert.whatsappSent && <Badge variant="outline" className="text-xs">WA</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!alert.ownerEmail || !!notifySending}
                          onClick={() => sendTrialNotify(alert.tenantId, ["email"])}
                        >
                          <Mail className="h-3.5 w-3.5 mr-1" />
                          Email
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!alert.ownerPhone || !!notifySending}
                          onClick={() => sendTrialNotify(alert.tenantId, ["sms"])}
                        >
                          <Phone className="h-3.5 w-3.5 mr-1" />
                          SMS
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!alert.ownerWhatsapp && !alert.ownerPhone || !!notifySending}
                          onClick={() => sendTrialNotify(alert.tenantId, ["whatsapp"])}
                        >
                          <MessageSquare className="h-3.5 w-3.5 mr-1" />
                          WA
                        </Button>
                        <Button
                          size="sm"
                          disabled={(!alert.ownerEmail && !alert.ownerPhone && !alert.ownerWhatsapp) || !!notifySending}
                          onClick={() => sendTrialNotify(alert.tenantId, ["email", "sms", "whatsapp"])}
                        >
                          All
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {alertsLoading && <p className="text-sm text-muted-foreground mt-2">Loading alerts…</p>}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-5">
          <Card><CardContent className="pt-6"><p className="text-2xl font-bold">{stats.total}</p><p className="text-sm text-muted-foreground">Total agencies</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-2xl font-bold">{stats.active}</p><p className="text-sm text-muted-foreground">Active</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-2xl font-bold">{stats.trial}</p><p className="text-sm text-muted-foreground">On trial</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-2xl font-bold text-amber-600">{stats.expired}</p><p className="text-sm text-muted-foreground">Expired</p></CardContent></Card>
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
                      <TableCell>
                        <div className="text-sm">{owner?.email || "—"}</div>
                        <div className="text-xs text-muted-foreground">{owner?.phone || tenant.phone || "—"}</div>
                      </TableCell>
                      <TableCell className="capitalize">{tenant.subscriptionPlan}</TableCell>
                      <TableCell><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusClasses[tenant.subscriptionStatus] || ""}`}>{tenant.subscriptionStatus}</span></TableCell>
                      <TableCell>{tenant.subscriptionExpiry ? new Date(tenant.subscriptionExpiry).toLocaleDateString() : "—"}</TableCell>
                      <TableCell>{tenant._count?.users || tenant.users?.length || 0}</TableCell>
                      <TableCell>{tenant._count?.bookings || 0}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="outline" onClick={() => openEditContact(tenant)} title="Edit contact">
                          <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => navigate(`/admin/tenants/${tenant.id}`, { state: { tenant } })}>View</Button>
                        <Button size="sm" variant="outline" onClick={() => openAction(tenant, "activate")}>Activate / change</Button>
                        <Button size="sm" variant="outline" onClick={() => openAction(tenant, "extend")}>Extend</Button>
                        {tenant.subscriptionStatus === "trial" && <Button size="sm" variant="outline" onClick={() => openAction(tenant, "skip_trial")}>Skip trial</Button>}
                        {tenant.subscriptionStatus !== "suspended" && <Button size="sm" variant="destructive" onClick={() => openAction(tenant, "suspend")}>Suspend</Button>}
                        {tenant.subscriptionStatus === "expired" && (
                          <>
                            <Button size="sm" variant="outline" title="Send renewal email" onClick={() => sendTrialNotify(tenant.id, ["email"])} disabled={!!notifySending}>
                              <Mail className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="outline" title="Send renewal SMS" onClick={() => sendTrialNotify(tenant.id, ["sms"])} disabled={!!notifySending}>
                              <Phone className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="outline" title="Send renewal WhatsApp" onClick={() => sendTrialNotify(tenant.id, ["whatsapp"])} disabled={!!notifySending}>
                              <MessageSquare className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
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

        <Dialog open={!!editContactTenant} onOpenChange={(open) => !open && setEditContactTenant(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit agency contact — {editContactTenant?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Company phone</Label>
                  <Input value={editContactForm.phone} onChange={(e) => setEditContactForm({ ...editContactForm, phone: e.target.value })} placeholder="+8801XXXXXXXXX" />
                </div>
                <div className="space-y-2">
                  <Label>Company WhatsApp</Label>
                  <Input value={editContactForm.whatsapp} onChange={(e) => setEditContactForm({ ...editContactForm, whatsapp: e.target.value })} placeholder="+8801XXXXXXXXX" />
                </div>
              </div>
              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Owner account</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Owner name</Label>
                    <Input value={editContactForm.ownerName} onChange={(e) => setEditContactForm({ ...editContactForm, ownerName: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Owner email</Label>
                    <Input type="email" value={editContactForm.ownerEmail} onChange={(e) => setEditContactForm({ ...editContactForm, ownerEmail: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Owner mobile (SMS)</Label>
                    <Input value={editContactForm.ownerPhone} onChange={(e) => setEditContactForm({ ...editContactForm, ownerPhone: e.target.value })} placeholder="+8801XXXXXXXXX" />
                  </div>
                  <div className="space-y-2">
                    <Label>Owner WhatsApp</Label>
                    <Input value={editContactForm.ownerWhatsapp} onChange={(e) => setEditContactForm({ ...editContactForm, ownerWhatsapp: e.target.value })} placeholder="+8801XXXXXXXXX" />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditContactTenant(null)} disabled={savingContact}>Cancel</Button>
                <Button onClick={saveEditContact} disabled={savingContact}>{savingContact ? "Saving..." : "Save contact"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminSubscriptions;