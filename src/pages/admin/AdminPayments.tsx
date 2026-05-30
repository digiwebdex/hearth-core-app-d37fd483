import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { adminSubscriptionWorkflowApi, type WorkflowPaymentRequest } from "@/lib/subscriptionWorkflowApi";
import { PLANS, type BillingCycle, type PlanType } from "@/lib/plans";

const statusClasses: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  needs_info: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  duplicate: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

const AdminPayments = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<WorkflowPaymentRequest[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<WorkflowPaymentRequest | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [approvalPlan, setApprovalPlan] = useState<PlanType>("basic");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [activationMode, setActivationMode] = useState<"activate_now" | "after_current_expiry">("activate_now");
  const [reviewerComment, setReviewerComment] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await adminSubscriptionWorkflowApi.listPaymentRequests();
      setRequests(data);
    } catch (err: any) {
      toast({ title: "Failed to load payment requests", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRequests(); }, []);

  const filtered = useMemo(() => requests.filter((request) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || [
      request.tenant?.name,
      request.transactionId,
      request.trxId,
      request.senderAccountOrNumber,
      request.requestedPlan,
      request.plan,
    ].some((value) => String(value || "").toLowerCase().includes(q));
    const matchesStatus = statusFilter === "all" || request.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [requests, search, statusFilter]);

  const openDetails = (request: WorkflowPaymentRequest) => {
    setSelected(request);
    setApprovalPlan((request.requestedPlan || request.plan || "basic") as PlanType);
    setBillingCycle((request.billingCycle as BillingCycle) || "monthly");
    setActivationMode((request.activationMode as "activate_now" | "after_current_expiry") || "activate_now");
    setReviewerComment(request.reviewerComment || "");
    setAdminNote(request.adminNote || "");
    setRejectionReason(request.rejectionReason || "");
    setDialogOpen(true);
  };

  const runAction = async (action: string) => {
    if (!selected) return;
    setActionLoading(true);
    try {
      await adminSubscriptionWorkflowApi.updatePaymentRequest(selected.id, {
        action,
        targetPlan: approvalPlan,
        billingCycle,
        activationMode,
        reviewerComment: reviewerComment || undefined,
        adminNote: adminNote || undefined,
        rejectionReason: rejectionReason || undefined,
        endTrialNow: true,
      });
      toast({ title: `Payment request ${action}` });
      setDialogOpen(false);
      await loadRequests();
    } catch (err: any) {
      toast({ title: `Failed to ${action} request`, description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const stats = useMemo(() => ({
    total: requests.length,
    pending: requests.filter((request) => request.status === "pending").length,
    approvedAmount: requests.filter((request) => request.status === "approved").reduce((sum, request) => sum + (request.amountSent || request.amount || 0), 0),
  }), [requests]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Subscription payment requests</h1>
            <p className="text-muted-foreground">Verify manual bKash, Nagad, Rocket, and bank transfer payments before activating plans.</p>
          </div>
          <Button variant="outline" onClick={loadRequests} disabled={loading}>Refresh</Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardContent className="pt-6"><p className="text-2xl font-bold">{stats.total}</p><p className="text-sm text-muted-foreground">Total requests</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-2xl font-bold">{stats.pending}</p><p className="text-sm text-muted-foreground">Pending review</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-2xl font-bold">৳{stats.approvedAmount.toLocaleString()}</p><p className="text-sm text-muted-foreground">Approved amount</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Input className="max-w-sm" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tenant, transaction ID, sender number" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {Object.keys(statusClasses).map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Requests</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agency</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Transaction</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No payment requests found.</TableCell></TableRow>
                ) : filtered.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>{request.tenant?.name || request.tenantId}</TableCell>
                    <TableCell className="capitalize">{request.requestedPlan || request.plan}</TableCell>
                    <TableCell className="capitalize">{request.requestType || "activate"}</TableCell>
                    <TableCell>৳{(request.amountSent || request.amount || 0).toLocaleString()}</TableCell>
                    <TableCell className="capitalize">{request.paymentMethod || request.method}</TableCell>
                    <TableCell className="font-mono text-xs">{request.transactionId || request.trxId || "—"}</TableCell>
                    <TableCell><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusClasses[request.status] || ""}`}>{request.status}</span></TableCell>
                    <TableCell>{new Date(request.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => openDetails(request)}>Review</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader><DialogTitle>Payment request review</DialogTitle></DialogHeader>
            {selected && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader><CardTitle className="text-base">Request details</CardTitle></CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <p><span className="text-muted-foreground">Agency:</span> {selected.tenant?.name || selected.tenantId}</p>
                      <p><span className="text-muted-foreground">Current plan:</span> {selected.currentPlan || selected.tenant?.subscriptionPlan || "free"}</p>
                      <p><span className="text-muted-foreground">Requested plan:</span> {selected.requestedPlan || selected.plan}</p>
                      <p><span className="text-muted-foreground">Request type:</span> {selected.requestType || "activate"}</p>
                      <p><span className="text-muted-foreground">Billing cycle:</span> {selected.billingCycle || "monthly"}</p>
                      <p><span className="text-muted-foreground">Amount sent:</span> ৳{(selected.amountSent || selected.amount || 0).toLocaleString()}</p>
                      <p><span className="text-muted-foreground">Expected amount:</span> ৳{(selected.expectedAmount || selected.amount || 0).toLocaleString()}</p>
                      <p><span className="text-muted-foreground">Method:</span> {selected.paymentMethod || selected.method}</p>
                      <p><span className="text-muted-foreground">Transaction ID:</span> {selected.transactionId || selected.trxId || "—"}</p>
                      <p><span className="text-muted-foreground">Sender account:</span> {selected.senderAccountOrNumber || "—"}</p>
                      <p><span className="text-muted-foreground">Payment date:</span> {selected.paymentDate || "—"}</p>
                      <p><span className="text-muted-foreground">Status:</span> <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusClasses[selected.status] || ""}`}>{selected.status}</span></p>
                      {selected.proofUrl && <a href={selected.proofUrl} target="_blank" rel="noreferrer" className="text-primary underline">Open proof</a>}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle className="text-base">Approval controls</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label>Target plan</Label>
                        <Select value={approvalPlan} onValueChange={(value: PlanType) => setApprovalPlan(value)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PLANS.map((plan) => <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>)}
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
                      <div>
                        <Label>Activation mode</Label>
                        <Select value={activationMode} onValueChange={(value: "activate_now" | "after_current_expiry") => setActivationMode(value)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="activate_now">Activate now</SelectItem>
                            <SelectItem value="after_current_expiry">After current expiry</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Reviewer comment</Label>
                        <Textarea value={reviewerComment} onChange={(e) => setReviewerComment(e.target.value)} placeholder="Visible to agency" />
                      </div>
                      <div>
                        <Label>Internal admin note</Label>
                        <Textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} placeholder="Internal note" />
                      </div>
                      <div>
                        <Label>Rejection reason</Label>
                        <Textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Why are you rejecting or asking for more info?" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" onClick={() => runAction("needs_info")} disabled={actionLoading}>Need info</Button>
                  <Button variant="outline" onClick={() => runAction("duplicate")} disabled={actionLoading}>Mark duplicate</Button>
                  <Button variant="destructive" onClick={() => runAction("rejected")} disabled={actionLoading}>Reject</Button>
                  <Button onClick={() => runAction("approve")} disabled={actionLoading}>Approve & activate</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminPayments;