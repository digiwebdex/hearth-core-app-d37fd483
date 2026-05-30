import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
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
import { useAuth } from "@/contexts/AuthContext";
import { PLANS, type BillingCycle, type PlanType, getPlanPrice } from "@/lib/plans";
import { tenantSubscriptionWorkflowApi, type WorkflowPaymentMethod, type WorkflowPaymentRequest } from "@/lib/subscriptionWorkflowApi";

const REQUEST_STATUSES = ["pending", "approved", "rejected", "needs_info", "cancelled"];

const statusClasses: Record<string, string> = {
  trial: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  expired: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  suspended: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  needs_info: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

const emptyForm = {
  billingCycle: "monthly" as BillingCycle,
  paymentMethod: "bkash",
  amountSent: "",
  senderAccountOrNumber: "",
  transactionId: "",
  paymentDate: new Date().toISOString().slice(0, 10),
  note: "",
  proofUrl: "",
};

const Subscriptions = () => {
  const { tenant, currentPlan, refreshTenant } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [summaryMethods, setSummaryMethods] = useState<WorkflowPaymentMethod[]>([]);
  const [requests, setRequests] = useState<WorkflowPaymentRequest[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null);
  const [editingRequest, setEditingRequest] = useState<WorkflowPaymentRequest | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [summary, paymentRequests] = await Promise.all([
        tenantSubscriptionWorkflowApi.getSummary(),
        tenantSubscriptionWorkflowApi.listRequests(),
      ]);
      setSummaryMethods(summary.paymentMethods || []);
      setRequests(paymentRequests || []);
    } catch (err: any) {
      toast({ title: "Failed to load subscription", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const currentExpiry = tenant?.subscriptionExpiry ? new Date(tenant.subscriptionExpiry) : null;
  const daysRemaining = currentExpiry ? Math.ceil((currentExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const pendingRequest = requests.find((item) => ["pending", "submitted", "pending_review", "needs_info"].includes(item.status));

  const selectedPlanMeta = useMemo(() => PLANS.find((plan) => plan.id === selectedPlan), [selectedPlan]);
  const payableAmount = useMemo(() => selectedPlanMeta ? getPlanPrice(selectedPlanMeta.id, form.billingCycle) : 0, [selectedPlanMeta, form.billingCycle]);

  const openRequestDialog = (plan: PlanType, request?: WorkflowPaymentRequest) => {
    setSelectedPlan(plan);
    setEditingRequest(request || null);
    const method = request?.paymentMethod || request?.method || summaryMethods[0]?.methodCode || "bkash";
    setForm({
      billingCycle: (request?.billingCycle as BillingCycle) || "monthly",
      paymentMethod: method,
      amountSent: String(request?.amountSent || request?.expectedAmount || getPlanPrice(plan, "monthly") || ""),
      senderAccountOrNumber: request?.senderAccountOrNumber || "",
      transactionId: request?.transactionId || request?.trxId || "",
      paymentDate: request?.paymentDate || new Date().toISOString().slice(0, 10),
      note: request?.note || "",
      proofUrl: request?.proofUrl || "",
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setSelectedPlan(null);
    setEditingRequest(null);
    setForm(emptyForm);
  };

  const selectedMethodMeta = summaryMethods.find((method) => method.methodCode === form.paymentMethod);

  const submitRequest = async () => {
    if (!selectedPlan) return;
    setSubmitting(true);
    try {
      const payload = {
        requestedPlan: selectedPlan,
        billingCycle: form.billingCycle,
        paymentMethod: form.paymentMethod,
        amountSent: Number(form.amountSent || payableAmount),
        expectedAmount: payableAmount,
        senderAccountOrNumber: form.senderAccountOrNumber,
        transactionId: form.transactionId,
        paymentDate: form.paymentDate,
        note: form.note,
        proofUrl: form.proofUrl,
      };
      if (editingRequest) {
        await tenantSubscriptionWorkflowApi.resubmitRequest(editingRequest.id, payload);
        toast({ title: "Payment request resubmitted" });
      } else {
        await tenantSubscriptionWorkflowApi.createRequest(payload);
        toast({ title: "Payment request submitted", description: "Super admin will review and activate your subscription." });
      }
      closeDialog();
      await refreshTenant();
      await loadData();
    } catch (err: any) {
      toast({ title: "Request failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const cancelRequest = async (requestId: string) => {
    try {
      await tenantSubscriptionWorkflowApi.cancelRequest(requestId, "Cancelled by agency user");
      toast({ title: "Payment request cancelled" });
      await loadData();
    } catch (err: any) {
      toast({ title: "Cancel failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Subscription</h1>
            <p className="text-muted-foreground">Upgrade, renew, and submit your manual payment details for approval.</p>
          </div>
          <Button variant="outline" onClick={() => { refreshTenant(); loadData(); }} disabled={loading}>Refresh</Button>
        </div>

        <Card>
          <CardHeader><CardTitle>Current subscription</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="secondary" className="capitalize text-sm">{currentPlan}</Badge>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusClasses[tenant?.subscriptionStatus || "active"] || ""}`}>
                {tenant?.subscriptionStatus || "active"}
              </span>
              {tenant?.subscriptionExpiry && <span className="text-sm text-muted-foreground">Expires {new Date(tenant.subscriptionExpiry).toLocaleDateString()}</span>}
            </div>
            {daysRemaining !== null && daysRemaining <= 7 && daysRemaining >= 0 && (
              <p className="text-sm text-yellow-700 dark:text-yellow-300">Your subscription expires in {daysRemaining} day(s). Renew early to avoid interruption.</p>
            )}
            {pendingRequest && (
              <p className="text-sm text-muted-foreground">You already have an open payment request in <strong>{pendingRequest.status}</strong> status.</p>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan) => {
            const isCurrent = plan.id === currentPlan;
            const disabled = !!pendingRequest && !editingRequest;
            const price = getPlanPrice(plan.id, "monthly");
            return (
              <Card key={plan.id} className={isCurrent ? "border-primary" : ""}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{plan.name}</span>
                    {plan.badge && <Badge>{plan.badge}</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                  <p className="text-2xl font-bold">{price < 0 ? "Custom" : price === 0 ? "Free" : `৳${price.toLocaleString()}`}</p>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    {plan.features.slice(0, 4).map((feature) => <li key={feature}>• {feature}</li>)}
                  </ul>
                  <Button className="w-full" variant={isCurrent ? "outline" : "default"} disabled={isCurrent || disabled || plan.id === "enterprise"} onClick={() => openRequestDialog(plan.id)}>
                    {isCurrent ? "Current plan" : plan.id === currentPlan ? "Current plan" : currentPlan === plan.id ? "Renew" : `Request ${plan.name}`}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader><CardTitle>Manual payment methods</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {summaryMethods.map((method) => (
              <div key={method.methodCode} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{method.label}</h3>
                  <Badge variant={method.enabled ? "secondary" : "outline"}>{method.enabled ? "Enabled" : "Disabled"}</Badge>
                </div>
                {method.accountName && <p className="text-sm"><span className="text-muted-foreground">Account name:</span> {method.accountName}</p>}
                {method.accountNumber && <p className="text-sm"><span className="text-muted-foreground">Account no:</span> {method.accountNumber}</p>}
                {method.bankName && <p className="text-sm"><span className="text-muted-foreground">Bank:</span> {method.bankName}</p>}
                {method.branchName && <p className="text-sm"><span className="text-muted-foreground">Branch:</span> {method.branchName}</p>}
                {method.instructions && <p className="text-sm text-muted-foreground">{method.instructions}</p>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Payment request history</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Transaction</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No payment requests yet.</TableCell></TableRow>
                ) : requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="capitalize">{request.requestedPlan || request.plan}</TableCell>
                    <TableCell className="capitalize">{request.requestType || "activate"}</TableCell>
                    <TableCell className="capitalize">{request.paymentMethod || request.method}</TableCell>
                    <TableCell className="font-mono text-xs">{request.transactionId || request.trxId || "—"}</TableCell>
                    <TableCell><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusClasses[request.status] || ""}`}>{request.status}</span></TableCell>
                    <TableCell>{new Date(request.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right space-x-2">
                      {["rejected", "needs_info"].includes(request.status) && (
                        <Button size="sm" variant="outline" onClick={() => openRequestDialog((request.requestedPlan || request.plan) as PlanType, request)}>Resubmit</Button>
                      )}
                      {REQUEST_STATUSES.includes(request.status) && ["pending", "submitted", "pending_review", "needs_info"].includes(request.status) && (
                        <Button size="sm" variant="ghost" onClick={() => cancelRequest(request.id)}>Cancel</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={(open) => !open ? closeDialog() : setDialogOpen(open)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingRequest ? "Resubmit payment request" : `Request ${selectedPlanMeta?.name || "plan"}`}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <Label>Billing cycle</Label>
                  <Select value={form.billingCycle} onValueChange={(value: BillingCycle) => setForm((prev) => ({ ...prev, billingCycle: value, amountSent: String(getPlanPrice(selectedPlan || "basic", value)) }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Payment method</Label>
                  <Select value={form.paymentMethod} onValueChange={(value) => setForm((prev) => ({ ...prev, paymentMethod: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {summaryMethods.map((method) => <SelectItem key={method.methodCode} value={method.methodCode}>{method.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Amount sent</Label>
                  <Input value={form.amountSent} onChange={(e) => setForm((prev) => ({ ...prev, amountSent: e.target.value }))} placeholder={String(payableAmount)} />
                </div>
                <div>
                  <Label>Sender mobile/bank account</Label>
                  <Input value={form.senderAccountOrNumber} onChange={(e) => setForm((prev) => ({ ...prev, senderAccountOrNumber: e.target.value }))} placeholder="e.g. 017xxxxxxxx" />
                </div>
                <div>
                  <Label>Transaction / reference ID</Label>
                  <Input value={form.transactionId} onChange={(e) => setForm((prev) => ({ ...prev, transactionId: e.target.value }))} placeholder="Transaction ID" />
                </div>
                <div>
                  <Label>Payment date</Label>
                  <Input type="date" value={form.paymentDate} onChange={(e) => setForm((prev) => ({ ...prev, paymentDate: e.target.value }))} />
                </div>
                <div>
                  <Label>Proof URL</Label>
                  <Input value={form.proofUrl} onChange={(e) => setForm((prev) => ({ ...prev, proofUrl: e.target.value }))} placeholder="https://..." />
                </div>
                <div>
                  <Label>Note</Label>
                  <Textarea value={form.note} onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))} placeholder="Optional note for admin" />
                </div>
              </div>

              <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
                <div>
                  <p className="text-sm text-muted-foreground">Selected plan</p>
                  <p className="font-semibold">{selectedPlanMeta?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Expected amount</p>
                  <p className="font-semibold">৳{payableAmount.toLocaleString()}</p>
                </div>
                {selectedMethodMeta && (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground">Receiver</p>
                      <p className="font-medium">{selectedMethodMeta.label}</p>
                    </div>
                    {selectedMethodMeta.accountName && <p className="text-sm"><span className="text-muted-foreground">Account name:</span> {selectedMethodMeta.accountName}</p>}
                    {selectedMethodMeta.accountNumber && <p className="text-sm"><span className="text-muted-foreground">Account number:</span> {selectedMethodMeta.accountNumber}</p>}
                    {selectedMethodMeta.instructions && <p className="text-sm text-muted-foreground">{selectedMethodMeta.instructions}</p>}
                  </>
                )}
                {editingRequest?.rejectionReason && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                    Previous rejection reason: {editingRequest.rejectionReason}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button onClick={submitRequest} disabled={submitting || !selectedPlan}>{submitting ? "Saving..." : editingRequest ? "Resubmit" : "Submit request"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Subscriptions;