import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
import { adminApi, domainApi, type AdminTenant, type TenantDomainRecord } from "@/lib/api";
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
  const { i18n } = useTranslation();
  const isBn = String(i18n.resolvedLanguage || i18n.language || "en").startsWith("bn");
  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<AdminTenant | null>(null);
  const [requests, setRequests] = useState<WorkflowPaymentRequest[]>([]);
  const [history, setHistory] = useState<WorkflowSubscriptionHistory[]>([]);
  const [domains, setDomains] = useState<TenantDomainRecord[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<ActionType | null>(null);
  const [plan, setPlan] = useState<PlanType>("basic");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [months, setMonths] = useState("1");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const text = {
    loadFailed: isBn ? "টেন্যান্ট লোড ব্যর্থ" : "Failed to load tenant",
    updated: isBn ? "টেন্যান্ট সাবস্ক্রিপশন আপডেট হয়েছে" : "Tenant subscription updated",
    actionFailed: isBn ? "অ্যাকশন ব্যর্থ হয়েছে" : "Action failed",
    loading: isBn ? "টেন্যান্ট তথ্য লোড হচ্ছে..." : "Loading tenant details...",
    notFound: isBn ? "টেন্যান্ট পাওয়া যায়নি।" : "Tenant not found.",
    back: isBn ? "এজেন্সি তালিকায় ফিরে যান" : "Back to agencies",
    tenantId: isBn ? "টেন্যান্ট আইডি:" : "Tenant ID:",
    companyProfile: isBn ? "কোম্পানি প্রোফাইল" : "Company profile",
    owner: isBn ? "ওনার:" : "Owner:",
    ownerEmail: isBn ? "ওনার ইমেইল:" : "Owner email:",
    created: isBn ? "তৈরির তারিখ:" : "Created:",
    users: isBn ? "ব্যবহারকারী:" : "Users:",
    bookings: isBn ? "বুকিং:" : "Bookings:",
    subscription: isBn ? "সাবস্ক্রিপশন" : "Subscription",
    currentPlan: isBn ? "বর্তমান প্ল্যান:" : "Current plan:",
    expiry: isBn ? "মেয়াদ শেষ:" : "Expiry:",
    availablePlans: isBn ? "উপলব্ধ প্ল্যান:" : "Available plans:",
    activateChange: isBn ? "অ্যাক্টিভ / প্ল্যান পরিবর্তন" : "Activate / change plan",
    extend: isBn ? "এক্সটেন্ড" : "Extend",
    skipTrial: isBn ? "ট্রায়াল শেষ করুন" : "Skip trial",
    suspend: isBn ? "সাসপেন্ড" : "Suspend",
    customDomains: isBn ? "কাস্টম ডোমেইন" : "Custom domains",
    openDomainManagement: isBn ? "ডোমেইন ম্যানেজমেন্ট খুলুন" : "Open domain management",
    noDomains: isBn ? "এই এজেন্সি এখনো কোনো কাস্টম ডোমেইন সংযুক্ত করেনি।" : "This agency has not connected any custom domain yet.",
    domain: isBn ? "ডোমেইন" : "Domain",
    verification: isBn ? "ভেরিফিকেশন" : "Verification",
    status: isBn ? "স্ট্যাটাস" : "Status",
    ssl: "SSL",
    primary: isBn ? "প্রাইমারি" : "Primary",
    recentRequests: isBn ? "সাম্প্রতিক পেমেন্ট রিকোয়েস্ট" : "Recent payment requests",
    requestType: isBn ? "ধরন" : "Type",
    amount: isBn ? "পরিমাণ" : "Amount",
    method: isBn ? "মেথড" : "Method",
    submitted: isBn ? "জমা দেওয়া হয়েছে" : "Submitted",
    noRequests: isBn ? "এই এজেন্সির জন্য কোনো পেমেন্ট রিকোয়েস্ট নেই।" : "No payment requests for this agency.",
    history: isBn ? "সাবস্ক্রিপশন ইতিহাস" : "Subscription history",
    action: isBn ? "অ্যাকশন" : "Action",
    oldPlan: isBn ? "আগের প্ল্যান" : "Old plan",
    newPlan: isBn ? "নতুন প্ল্যান" : "New plan",
    noHistory: isBn ? "এখনো কোনো সাবস্ক্রিপশন ইতিহাস নেই।" : "No subscription history yet.",
    activateTitle: isBn ? "প্ল্যান অ্যাক্টিভ বা পরিবর্তন করুন" : "Activate or change plan",
    extendTitle: isBn ? "সাবস্ক্রিপশন এক্সটেন্ড করুন" : "Extend subscription",
    skipTrialTitle: isBn ? "ট্রায়াল শেষ করে পেইড প্ল্যান অ্যাক্টিভ করুন" : "Skip trial and activate paid plan",
    suspendTitle: isBn ? "সাবস্ক্রিপশন সাসপেন্ড করুন" : "Suspend subscription",
    targetPlan: isBn ? "টার্গেট প্ল্যান" : "Target plan",
    billingCycle: isBn ? "বিলিং সাইকেল" : "Billing cycle",
    monthly: isBn ? "মাসিক" : "Monthly",
    yearly: isBn ? "বার্ষিক" : "Yearly",
    extendMonths: isBn ? "কত মাস বাড়াবেন" : "Extend by months",
    note: isBn ? "নোট" : "Note",
    optionalNote: isBn ? "ঐচ্ছিক অ্যাডমিন নোট" : "Optional admin note",
    cancel: isBn ? "বাতিল" : "Cancel",
    saving: isBn ? "সংরক্ষণ হচ্ছে..." : "Saving...",
    confirm: isBn ? "নিশ্চিত করুন" : "Confirm",
  };

  const planLabel = (value?: string | null) => {
    const normalized = String(value || "").toLowerCase();
    const map: Record<string, string> = {
      free: isBn ? "ফ্রি" : "free",
      basic: isBn ? "বেসিক" : "basic",
      pro: isBn ? "প্রো" : "pro",
      business: isBn ? "বিজনেস" : "business",
      enterprise: isBn ? "এন্টারপ্রাইজ" : "enterprise",
    };
    return map[normalized] || value || "—";
  };

  const requestTypeLabel = (value?: string | null) => {
    const normalized = String(value || "activate").toLowerCase();
    const map: Record<string, string> = {
      activate: isBn ? "অ্যাক্টিভেশন" : "activate",
      renew: isBn ? "নবায়ন" : "renew",
      upgrade: isBn ? "আপগ্রেড" : "upgrade",
      downgrade: isBn ? "ডাউনগ্রেড" : "downgrade",
    };
    return map[normalized] || normalized;
  };

  const statusLabel = (value?: string | null) => {
    const normalized = String(value || "").toLowerCase();
    const map: Record<string, string> = {
      trial: isBn ? "ট্রায়াল" : "trial",
      active: isBn ? "সক্রিয়" : "active",
      expired: isBn ? "মেয়াদোত্তীর্ণ" : "expired",
      suspended: isBn ? "সাসপেন্ড" : "suspended",
      cancelled: isBn ? "বাতিল" : "cancelled",
      pending: isBn ? "অপেক্ষমান" : "pending",
      approved: isBn ? "অনুমোদিত" : "approved",
      rejected: isBn ? "প্রত্যাখ্যাত" : "rejected",
      needs_info: isBn ? "তথ্য প্রয়োজন" : "needs info",
    };
    return map[normalized] || value || "—";
  };

  const loadData = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [tenantResult, requestResult, historyResult, domainResult] = await Promise.allSettled([
        adminApi.getTenant(tenantId),
        adminSubscriptionWorkflowApi.listPaymentRequests({ tenantId }),
        adminSubscriptionWorkflowApi.getSubscriptionHistory(tenantId),
        domainApi.list(),
      ]);

      if (tenantResult.status === "rejected") {
        toast({ title: text.loadFailed, description: tenantResult.reason?.message || "Request failed", variant: "destructive" });
        setTenant(null);
        return;
      }

      const tenantData = tenantResult.value;
      setTenant(tenantData);
      setPlan((tenantData.subscriptionPlan || "basic") as PlanType);

      if (requestResult.status === "fulfilled") {
        setRequests(requestResult.value);
      } else {
        setRequests([]);
      }

      if (historyResult.status === "fulfilled") {
        setHistory(historyResult.value);
      } else {
        setHistory([]);
      }

      if (domainResult.status === "fulfilled") {
        setDomains((domainResult.value || []).filter((item) => item.tenantId === tenantId));
      } else {
        setDomains([]);
      }

      const secondaryFailures = [requestResult, historyResult, domainResult].filter((result) => result.status === "rejected");
      if (secondaryFailures.length > 0) {
        const firstError = secondaryFailures[0].status === "rejected" ? secondaryFailures[0].reason?.message : "";
        toast({
          title: isBn ? "কিছু তথ্য লোড হয়নি" : "Some details could not be loaded",
          description: firstError || (isBn ? "পেমেন্ট, ইতিহাস বা ডোমেইন তথ্য আংশিকভাবে লোড হয়েছে।" : "Payment, history, or domain data loaded partially."),
          variant: "destructive",
        });
      }
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
      toast({ title: text.updated, description: tenant.name });
      setDialogOpen(false);
      await loadData();
    } catch (err: any) {
      toast({ title: text.actionFailed, description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <AdminLayout><p className="text-center py-12 text-muted-foreground">{text.loading}</p></AdminLayout>;
  }

  if (!tenant) {
    return <AdminLayout><div className="space-y-4"><Button variant="outline" onClick={() => navigate("/admin/tenants")}>{text.back}</Button><p className="text-muted-foreground">{text.notFound}</p></div></AdminLayout>;
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/tenants")}>{text.back}</Button>
            <h1 className="text-3xl font-bold tracking-tight">{tenant.name}</h1>
            <p className="text-muted-foreground">{text.tenantId} {tenant.id}</p>
          </div>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium capitalize ${statusClasses[tenant.subscriptionStatus] || ""}`}>{statusLabel(tenant.subscriptionStatus)}</span>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>{text.companyProfile}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">{text.owner}</span> {owner?.name || "—"}</p>
              <p><span className="text-muted-foreground">{text.ownerEmail}</span> {owner?.email || "—"}</p>
              <p><span className="text-muted-foreground">{text.created}</span> {new Date(tenant.createdAt).toLocaleDateString(isBn ? "bn-BD" : undefined)}</p>
              <p><span className="text-muted-foreground">{text.users}</span> {tenant._count?.users || tenant.users?.length || 0}</p>
              <p><span className="text-muted-foreground">{text.bookings}</span> {tenant._count?.bookings || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{text.subscription}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">{text.currentPlan}</span> <Badge variant="secondary" className="ml-1 capitalize">{planLabel(tenant.subscriptionPlan)}</Badge></p>
              <p><span className="text-muted-foreground">{text.expiry}</span> {tenant.subscriptionExpiry ? new Date(tenant.subscriptionExpiry).toLocaleDateString(isBn ? "bn-BD" : undefined) : "—"}</p>
              <p><span className="text-muted-foreground">{text.availablePlans}</span> {PLANS.map((item) => item.name).join(", ")}</p>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => openAction("activate")}>{text.activateChange}</Button>
                <Button size="sm" variant="outline" onClick={() => openAction("extend")}>{text.extend}</Button>
                {tenant.subscriptionStatus === "trial" && <Button size="sm" variant="outline" onClick={() => openAction("skip_trial")}>{text.skipTrial}</Button>}
                {tenant.subscriptionStatus !== "suspended" && <Button size="sm" variant="destructive" onClick={() => openAction("suspend")}>{text.suspend}</Button>}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{text.customDomains}</CardTitle>
            <Button variant="outline" onClick={() => navigate("/admin/domains")}>{text.openDomainManagement}</Button>
          </CardHeader>
          <CardContent>
            {domains.length === 0 ? (
              <p className="text-sm text-muted-foreground">{text.noDomains}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{text.domain}</TableHead>
                    <TableHead>{text.verification}</TableHead>
                    <TableHead>{text.status}</TableHead>
                    <TableHead>{text.ssl}</TableHead>
                    <TableHead>{text.primary}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {domains.map((domain) => (
                    <TableRow key={domain.id}>
                      <TableCell className="font-medium">{domain.domain}</TableCell>
                      <TableCell className="capitalize">{statusLabel(domain.verificationStatus)}</TableCell>
                      <TableCell className="capitalize">{statusLabel(domain.status)}</TableCell>
                      <TableCell className="uppercase">{domain.sslStatus || "—"}</TableCell>
                      <TableCell>{domain.isPrimary ? (isBn ? "হ্যাঁ" : "Yes") : (isBn ? "না" : "No")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{text.recentRequests}</CardTitle></CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <p className="text-sm text-muted-foreground">{text.noRequests}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{text.requestType}</TableHead>
                    <TableHead>{text.amount}</TableHead>
                    <TableHead>{text.method}</TableHead>
                    <TableHead>{text.status}</TableHead>
                    <TableHead>{text.submitted}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>{requestTypeLabel(request.requestType)}</TableCell>
                      <TableCell>৳{Number(request.amount || 0).toLocaleString()}</TableCell>
                      <TableCell>{request.paymentMethod || request.method || "—"}</TableCell>
                      <TableCell className="capitalize">{statusLabel(request.status)}</TableCell>
                      <TableCell>{new Date(request.createdAt).toLocaleDateString(isBn ? "bn-BD" : undefined)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{text.history}</CardTitle></CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">{text.noHistory}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{text.action}</TableHead>
                    <TableHead>{text.oldPlan}</TableHead>
                    <TableHead>{text.newPlan}</TableHead>
                    <TableHead>{text.note}</TableHead>
                    <TableHead>{text.submitted}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="capitalize">{item.actionType || item.action || "—"}</TableCell>
                      <TableCell>{planLabel(item.oldPlan)}</TableCell>
                      <TableCell>{planLabel(item.newPlan)}</TableCell>
                      <TableCell>{item.note || "—"}</TableCell>
                      <TableCell>{item.createdAt ? new Date(item.createdAt).toLocaleDateString(isBn ? "bn-BD" : undefined) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {actionType === "activate" ? text.activateTitle : actionType === "extend" ? text.extendTitle : actionType === "skip_trial" ? text.skipTrialTitle : text.suspendTitle}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {(actionType === "activate" || actionType === "skip_trial") && (
                <div className="space-y-2">
                  <Label>{text.targetPlan}</Label>
                  <Select value={plan} onValueChange={(value: PlanType) => setPlan(value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PLANS.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(actionType === "activate" || actionType === "skip_trial") && (
                <div className="space-y-2">
                  <Label>{text.billingCycle}</Label>
                  <Select value={billingCycle} onValueChange={(value: BillingCycle) => setBillingCycle(value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">{text.monthly}</SelectItem>
                      <SelectItem value="yearly">{text.yearly}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {actionType === "extend" && (
                <div className="space-y-2">
                  <Label>{text.extendMonths}</Label>
                  <Input type="number" min="1" value={months} onChange={(e) => setMonths(e.target.value)} />
                </div>
              )}

              <div className="space-y-2">
                <Label>{text.optionalNote}</Label>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>{text.cancel}</Button>
              <Button onClick={submitAction} disabled={saving}>{saving ? text.saving : text.confirm}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminTenantDetails;
