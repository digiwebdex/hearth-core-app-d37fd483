import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { PLANS, type BillingCycle, type PlanType, getPlanPrice } from "@/lib/plans";
import {
  tenantSubscriptionWorkflowApi,
  type WorkflowPaymentMethod,
  type WorkflowPaymentRequest,
} from "@/lib/subscriptionWorkflowApi";
import { subscriptionCouponApi, type CouponValidation } from "@/lib/platformAdminApi";

const emptyForm = {
  billingCycle: "monthly" as BillingCycle,
  paymentMethod: "bkash",
  amountSent: "",
  senderAccountOrNumber: "",
  transactionId: "",
  paymentDate: new Date().toISOString().slice(0, 10),
  note: "",
  proofUrl: "",
  proofFileName: "",
};

export const nextSuggestedPlan = (currentPlan: string): PlanType => {
  const normalized = (currentPlan || "free").toLowerCase();
  if (normalized === "basic") return "pro";
  if (normalized === "pro") return "business";
  // Business is the top self-serve tier; Enterprise is Contact Sales (not suggested).
  if (normalized === "business") return "business";
  return "pro";
};

export function useSubscriptionPayment() {
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
  const [proofUploading, setProofUploading] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidation | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [summary, paymentRequests] = await Promise.all([
        tenantSubscriptionWorkflowApi.getSummary(),
        tenantSubscriptionWorkflowApi.listRequests(),
      ]);
      setSummaryMethods(summary.paymentMethods || []);
      setRequests(paymentRequests || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load subscription";
      toast({ title: "Failed to load subscription", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const pendingRequest = requests.find((item) =>
    ["pending", "submitted", "pending_review", "needs_info"].includes(item.status)
  );

  const selectedPlanMeta = useMemo(
    () => PLANS.find((plan) => plan.id === selectedPlan),
    [selectedPlan]
  );

  const listPrice = useMemo(
    () => (selectedPlanMeta ? getPlanPrice(selectedPlanMeta.id, form.billingCycle) : 0),
    [selectedPlanMeta, form.billingCycle],
  );

  const payableAmount = useMemo(() => {
    if (appliedCoupon?.valid && appliedCoupon.finalAmount != null) return appliedCoupon.finalAmount;
    return listPrice;
  }, [appliedCoupon, listPrice]);

  useEffect(() => {
    setAppliedCoupon(null);
    setCouponCode("");
  }, [form.billingCycle, selectedPlan]);

  const selectedMethodMeta = summaryMethods.find((method) => method.methodCode === form.paymentMethod);
  const selectedMethodHasReceiverDetails = Boolean(
    selectedMethodMeta?.accountNumber ||
      selectedMethodMeta?.accountName ||
      selectedMethodMeta?.bankName ||
      selectedMethodMeta?.branchName
  );

  const openRequestDialog = (
    plan: PlanType,
    request?: WorkflowPaymentRequest,
    preferredMethod?: string
  ) => {
    setSelectedPlan(plan);
    setEditingRequest(request || null);
    const method =
      preferredMethod ||
      request?.paymentMethod ||
      request?.method ||
      summaryMethods[0]?.methodCode ||
      "bkash";
    const cycle = (request?.billingCycle as BillingCycle) || "monthly";
    setForm({
      billingCycle: cycle,
      paymentMethod: method,
      amountSent: String(
        request?.amountSent || request?.expectedAmount || getPlanPrice(plan, cycle) || ""
      ),
      senderAccountOrNumber: request?.senderAccountOrNumber || "",
      transactionId: request?.transactionId || request?.trxId || "",
      paymentDate: request?.paymentDate || new Date().toISOString().slice(0, 10),
      note: request?.note || "",
      proofUrl: request?.proofUrl || "",
      proofFileName: request?.proofFileName || "",
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setSelectedPlan(null);
    setEditingRequest(null);
    setForm(emptyForm);
    setProofUploading(false);
    setCouponCode("");
    setAppliedCoupon(null);
  };

  const applyCoupon = async () => {
    if (!selectedPlan || !couponCode.trim()) return;
    setCouponLoading(true);
    try {
      const result = await subscriptionCouponApi.validate(couponCode.trim(), selectedPlan, form.billingCycle);
      setAppliedCoupon(result);
      setForm((prev) => ({ ...prev, amountSent: String(result.finalAmount ?? payableAmount) }));
      toast({ title: "Coupon applied", description: result.description || `You save ৳${result.discountAmount}` });
    } catch (err: unknown) {
      setAppliedCoupon(null);
      toast({
        variant: "destructive",
        title: "Invalid coupon",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setCouponLoading(false);
    }
  };

  const clearCoupon = () => {
    setCouponCode("");
    setAppliedCoupon(null);
    if (selectedPlanMeta) {
      setForm((prev) => ({ ...prev, amountSent: String(listPrice || "") }));
    }
  };

  const uploadProof = async (file: File | null) => {
    if (!file) return;
    setProofUploading(true);
    try {
      const uploaded = await tenantSubscriptionWorkflowApi.uploadProof(file);
      setForm((prev) => ({
        ...prev,
        proofUrl: uploaded.proofUrl,
        proofFileName: uploaded.proofFileName,
      }));
      toast({ title: "Screenshot uploaded" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload failed";
      toast({ title: "Upload failed", description: message, variant: "destructive" });
    } finally {
      setProofUploading(false);
    }
  };

  const submitRequest = async () => {
    if (!selectedPlan) return;
    setSubmitting(true);
    try {
      const payload = {
        requestedPlan: selectedPlan,
        billingCycle: form.billingCycle,
        paymentMethod: form.paymentMethod,
        amountSent: Number(form.amountSent || payableAmount),
        expectedAmount: listPrice,
        couponCode: appliedCoupon?.code || (couponCode.trim() || undefined),
        senderAccountOrNumber: form.senderAccountOrNumber,
        transactionId: form.transactionId,
        paymentDate: form.paymentDate,
        note: form.note,
        proofUrl: form.proofUrl || undefined,
        proofFileName: form.proofFileName || undefined,
      };
      if (editingRequest) {
        await tenantSubscriptionWorkflowApi.resubmitRequest(editingRequest.id, payload);
        toast({ title: "Payment request resubmitted" });
      } else {
        await tenantSubscriptionWorkflowApi.createRequest(payload);
        toast({
          title: "Payment request submitted",
          description: "Super admin will verify and activate your subscription.",
        });
      }
      closeDialog();
      await refreshTenant();
      await loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Request failed";
      toast({ title: "Request failed", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const cancelRequest = async (requestId: string) => {
    try {
      await tenantSubscriptionWorkflowApi.cancelRequest(requestId, "Cancelled by agency user");
      toast({ title: "Payment request cancelled" });
      await loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Cancel failed";
      toast({ title: "Cancel failed", description: message, variant: "destructive" });
    }
  };

  return {
    tenant,
    currentPlan,
    loading,
    summaryMethods,
    requests,
    pendingRequest,
    dialogOpen,
    setDialogOpen,
    selectedPlan,
    selectedPlanMeta,
    editingRequest,
    form,
    setForm,
    submitting,
    proofUploading,
    payableAmount,
    listPrice,
    couponCode,
    setCouponCode,
    appliedCoupon,
    couponLoading,
    applyCoupon,
    clearCoupon,
    selectedMethodMeta,
    selectedMethodHasReceiverDetails,
    openRequestDialog,
    closeDialog,
    uploadProof,
    submitRequest,
    cancelRequest,
    loadData,
    refreshTenant,
    PLANS,
    getPlanPrice,
  };
}
