import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "react-i18next";
import type { BillingCycle, PlanType } from "@/lib/plans";
import { getPlanPrice } from "@/lib/plans";
import type { WorkflowPaymentMethod, WorkflowPaymentRequest } from "@/lib/subscriptionWorkflowApi";
import { SubscriptionOnlinePay } from "@/components/SubscriptionOnlinePay";

const friendlyMethodName = (method?: string | null) => {
  if (!method) return "Manual payment";
  const map: Record<string, string> = {
    bkash: "bKash",
    nagad: "Nagad",
    rocket: "Rocket",
    bank_transfer: "Bank transfer",
  };
  return map[method] || method;
};

export type SubscriptionPaymentForm = {
  billingCycle: BillingCycle;
  paymentMethod: string;
  amountSent: string;
  senderAccountOrNumber: string;
  transactionId: string;
  paymentDate: string;
  note: string;
  proofUrl: string;
  proofFileName: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRequest: WorkflowPaymentRequest | null;
  selectedPlanMeta?: { id: string; name: string };
  form: SubscriptionPaymentForm;
  setForm: React.Dispatch<React.SetStateAction<SubscriptionPaymentForm>>;
  summaryMethods: WorkflowPaymentMethod[];
  selectedMethodMeta?: WorkflowPaymentMethod;
  selectedMethodHasReceiverDetails: boolean;
  payableAmount: number;
  listPrice?: number;
  couponCode?: string;
  setCouponCode?: (value: string) => void;
  appliedCoupon?: { valid?: boolean; discountAmount?: number; code?: string } | null;
  couponLoading?: boolean;
  onApplyCoupon?: () => void;
  onClearCoupon?: () => void;
  selectedPlan: PlanType | null;
  submitting: boolean;
  proofUploading: boolean;
  onUploadProof: (file: File | null) => void;
  onRemoveProof: () => void;
  onSubmit: () => void;
  onClose: () => void;
};

export function SubscriptionPaymentDialog({
  open,
  onOpenChange,
  editingRequest,
  selectedPlanMeta,
  form,
  setForm,
  summaryMethods,
  selectedMethodMeta,
  selectedMethodHasReceiverDetails,
  payableAmount,
  listPrice = payableAmount,
  couponCode = "",
  setCouponCode,
  appliedCoupon,
  couponLoading,
  onApplyCoupon,
  onClearCoupon,
  selectedPlan,
  submitting,
  proofUploading,
  onUploadProof,
  onRemoveProof,
  onSubmit,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const howToPaySteps = t("subscriptionRenewal.paymentSteps", { returnObjects: true }) as string[];

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : onOpenChange(next))}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingRequest
              ? t("subscriptionRenewal.resubmitTitle")
              : t("subscriptionRenewal.requestPlan", { plan: selectedPlanMeta?.name || "" })}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
          <div className="space-y-3">
            {!editingRequest && selectedPlan && (
              <SubscriptionOnlinePay
                plan={selectedPlan as PlanType}
                billingCycle={form.billingCycle}
                amount={payableAmount}
                disabled={submitting}
              />
            )}
            <div>
              <Label>{t("subscriptionRenewal.billingCycle")}</Label>
              <Select
                value={form.billingCycle}
                onValueChange={(value: BillingCycle) =>
                  setForm((prev) => ({
                    ...prev,
                    billingCycle: value,
                    amountSent: String(
                      selectedPlan ? getPlanPrice(selectedPlan, value) : prev.amountSent
                    ),
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">{t("subscriptionRenewal.monthly")}</SelectItem>
                  <SelectItem value="yearly">{t("subscriptionRenewal.yearly")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!editingRequest && setCouponCode && onApplyCoupon ? (
              <div className="space-y-2 rounded-md border p-3 bg-muted/20">
                <Label>{t("subscriptionRenewal.couponCode")}</Label>
                <div className="flex gap-2">
                  <Input
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder={t("subscriptionRenewal.couponPlaceholder")}
                  />
                  <Button type="button" variant="secondary" onClick={onApplyCoupon} disabled={couponLoading || !couponCode}>
                    {couponLoading ? "…" : t("subscriptionRenewal.applyCoupon")}
                  </Button>
                </div>
                {appliedCoupon?.valid ? (
                  <div className="flex items-center justify-between text-sm text-green-700">
                    <span>{t("subscriptionRenewal.couponApplied", { amount: appliedCoupon.discountAmount })}</span>
                    {onClearCoupon ? (
                      <Button type="button" variant="ghost" size="sm" onClick={onClearCoupon}>
                        {t("common.remove")}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div>
              <Label>{t("subscriptionRenewal.paymentMethod")}</Label>
              <Select
                value={form.paymentMethod}
                onValueChange={(value) => setForm((prev) => ({ ...prev, paymentMethod: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {summaryMethods.map((method) => (
                    <SelectItem key={method.methodCode} value={method.methodCode}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("subscriptionRenewal.amountSent")}</Label>
              <Input
                value={form.amountSent}
                onChange={(e) => setForm((prev) => ({ ...prev, amountSent: e.target.value }))}
                placeholder={String(payableAmount)}
              />
            </div>
            <div>
              <Label>{t("subscriptionRenewal.senderAccount")}</Label>
              <Input
                value={form.senderAccountOrNumber}
                onChange={(e) => setForm((prev) => ({ ...prev, senderAccountOrNumber: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t("subscriptionRenewal.transactionId")}</Label>
              <Input
                value={form.transactionId}
                onChange={(e) => setForm((prev) => ({ ...prev, transactionId: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t("subscriptionRenewal.paymentDate")}</Label>
              <Input
                type="date"
                value={form.paymentDate}
                onChange={(e) => setForm((prev) => ({ ...prev, paymentDate: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t("subscriptionRenewal.proofOptional")}</Label>
              <Input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={(e) => onUploadProof(e.target.files?.[0] || null)}
              />
              {proofUploading && (
                <p className="mt-1 text-xs text-primary">{t("subscriptionRenewal.uploading")}</p>
              )}
              {!!form.proofUrl && (
                <div className="mt-2 rounded-md border p-3 text-sm">
                  <p className="font-medium">{form.proofFileName || "payment-proof"}</p>
                  <div className="mt-2 flex gap-2">
                    <a href={form.proofUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                      {t("subscriptionRenewal.openProof")}
                    </a>
                    <Button type="button" size="sm" variant="ghost" onClick={onRemoveProof}>
                      {t("common.remove")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <div>
              <Label>{t("subscriptionRenewal.note")}</Label>
              <Textarea
                value={form.note}
                onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
            <div>
              <p className="text-sm text-muted-foreground">{t("subscriptionRenewal.selectedPlan")}</p>
              <p className="font-semibold">{selectedPlanMeta?.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("subscriptionRenewal.expectedAmount")}</p>
              {appliedCoupon?.valid && listPrice > payableAmount ? (
                <p className="text-sm text-muted-foreground line-through">৳{listPrice.toLocaleString()}</p>
              ) : null}
              <p className="text-2xl font-bold">৳{payableAmount.toLocaleString()}</p>
            </div>
            {selectedMethodMeta && (
              <>
                <Separator />
                <div className="space-y-2 text-sm">
                  <p className="font-medium">{friendlyMethodName(selectedMethodMeta.methodCode)}</p>
                  <p>
                    <span className="text-muted-foreground">{t("subscriptionRenewal.accountName")}: </span>
                    {selectedMethodMeta.accountName || "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">{t("subscriptionRenewal.accountNumber")}: </span>
                    {selectedMethodMeta.accountNumber || "—"}
                  </p>
                  {selectedMethodMeta.bankName && (
                    <p>
                      <span className="text-muted-foreground">{t("subscriptionRenewal.bank")}: </span>
                      {selectedMethodMeta.bankName}
                    </p>
                  )}
                </div>
                {!selectedMethodHasReceiverDetails && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                    {t("subscriptionRenewal.receiverNotConfigured")}
                  </div>
                )}
              </>
            )}
            <Separator />
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              {Array.isArray(howToPaySteps) &&
                howToPaySteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
            </ol>
            {editingRequest?.rejectionReason && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                {t("subscriptionRenewal.rejectionReason")}: {editingRequest.rejectionReason}
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={onSubmit} disabled={submitting || proofUploading || !selectedPlan}>
            {submitting
              ? t("common.saving")
              : editingRequest
                ? t("subscriptionRenewal.resubmit")
                : t("subscriptionRenewal.submitRequest")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
