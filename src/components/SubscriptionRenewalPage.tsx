import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { SubscriptionPaymentDialog } from "@/components/SubscriptionPaymentDialog";
import { useGatewayStatus } from "@/hooks/useGatewayStatus";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { nextSuggestedPlan, useSubscriptionPayment } from "@/hooks/useSubscriptionPayment";
import type { SubscriptionBlockReason } from "@/lib/subscriptionAccess";
import { getPlanDisplayName, type PlanType } from "@/lib/plans";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CreditCard,
  Crown,
  LogOut,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const reasonIcon: Record<SubscriptionBlockReason, typeof AlertTriangle> = {
  trial_ended: Clock,
  expired: AlertTriangle,
  suspended: ShieldAlert,
  cancelled: ShieldAlert,
};

type Props = {
  reason: SubscriptionBlockReason;
};

const SubscriptionRenewalPage = ({ reason }: Props) => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { tenant, logout, subscriptionBlockReason } = useAuth();
  const { canManageSubscription } = usePermissions();
  const blockReason = reason || subscriptionBlockReason || "expired";
  const Icon = reasonIcon[blockReason] || AlertTriangle;
  const { hasOnlineGateway } = useGatewayStatus();

  const payment = useSubscriptionPayment();
  const {
    currentPlan,
    loading,
    summaryMethods,
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
    loadData,
    refreshTenant,
    PLANS,
    getPlanPrice,
  } = payment;

  const titleKey = `subscriptionRenewal.reason.${blockReason}.title` as const;
  const descKey = `subscriptionRenewal.reason.${blockReason}.desc` as const;
  const expiryDate = tenant?.subscriptionExpiry
    ? new Date(tenant.subscriptionExpiry).toLocaleDateString()
    : null;

  const workflowSteps = t("subscriptionRenewal.workflowSteps", { returnObjects: true }) as string[];

  const handleRefresh = async () => {
    await refreshTenant();
    await loadData();
  };

  const defaultPlan = nextSuggestedPlan(currentPlan);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (
      params.get("upgrade") === "1" &&
      !loading &&
      !pendingRequest &&
      canManageSubscription &&
      summaryMethods.length > 0 &&
      !dialogOpen
    ) {
      openRequestDialog(defaultPlan, undefined, summaryMethods[0]?.methodCode);
      params.delete("upgrade");
      navigate(
        { pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : "" },
        { replace: true }
      );
    }
  }, [
    location.search,
    loading,
    pendingRequest,
    canManageSubscription,
    summaryMethods,
    dialogOpen,
    defaultPlan,
    openRequestDialog,
    navigate,
    location.pathname,
  ]);

  const scrollToPlans = () => {
    document.getElementById("renew-plans")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/40">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <Crown className="h-6 w-6 text-primary" />
            <span className="font-semibold">{tenant?.name || t("subscriptionRenewal.platform")}</span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button variant="ghost" size="sm" onClick={logout} className="gap-1">
              <LogOut className="h-4 w-4" />
              {t("common.logout")}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        {/* Hero */}
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] items-start">
          <Card className="border-primary/30 shadow-lg">
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="rounded-full bg-destructive/10 p-3 shrink-0">
                  <Icon className="h-8 w-8 text-destructive" />
                </div>
                <div>
                  <CardTitle className="text-2xl">{t(titleKey)}</CardTitle>
                  <CardDescription className="mt-2 text-base">{t(descKey)}</CardDescription>
                  {expiryDate && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t("subscriptionRenewal.expiredOn", { date: expiryDate })}
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {getPlanDisplayName(currentPlan)}
                </Badge>
                <Badge variant="outline" className="capitalize">
                  {tenant?.subscriptionStatus}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{t("subscriptionRenewal.dataSafe")}</p>

              {pendingRequest ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-medium text-amber-900 dark:text-amber-100">
                        {t("subscriptionRenewal.pendingTitle")}
                      </p>
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        {t("subscriptionRenewal.pendingDesc", { status: pendingRequest.status })}
                      </p>
                      <Button variant="outline" size="sm" className="mt-2" onClick={handleRefresh}>
                        <RefreshCw className="h-4 w-4 mr-1" />
                        {t("subscriptionRenewal.checkActivation")}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : canManageSubscription ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium">{t("subscriptionRenewal.choosePlanBelow")}</p>
                  <Button
                    className="gap-2"
                    onClick={() =>
                      summaryMethods.length > 0
                        ? openRequestDialog(defaultPlan, undefined, summaryMethods[0]?.methodCode)
                        : scrollToPlans()
                    }
                  >
                    <CreditCard className="h-4 w-4" />
                    {t("subscriptionRenewal.payAndActivate")}
                  </Button>
                </div>
              ) : (
                <div className="rounded-lg border p-4 bg-muted/50">
                  <p className="text-sm">{t("subscriptionRenewal.contactOwner")}</p>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  {t("subscriptionRenewal.howItWorks")}
                </p>
                <ol className="space-y-2">
                  {Array.isArray(workflowSteps) &&
                    workflowSteps.map((step, i) => (
                      <li key={step} className="flex gap-3 text-sm">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {i + 1}
                        </span>
                        <span className="text-muted-foreground pt-0.5">{step}</span>
                      </li>
                    ))}
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CreditCard className="h-5 w-5" />
                {t("subscriptionRenewal.paymentMethods")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <>
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </>
              ) : summaryMethods.length === 0 ? (
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>{t("subscriptionRenewal.noMethods")}</p>
                  {hasOnlineGateway && (
                    <p className="text-xs text-primary">{t("subscriptionRenewal.onlinePayAvailable")}</p>
                  )}
                </div>
              ) : (
                summaryMethods.map((method) => (
                  <div key={method.methodCode} className="rounded-lg border p-3 text-sm space-y-1">
                    <p className="font-medium">{method.label}</p>
                    <p className="text-muted-foreground">{method.accountNumber || "—"}</p>
                    <p className="text-xs text-muted-foreground">{method.accountName}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Plans */}
        {canManageSubscription && !pendingRequest && (
          <div id="renew-plans">
            <h2 className="text-xl font-bold mb-4">{t("subscriptionRenewal.selectPlan")}</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {loading
                ? [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-64 w-full" />)
                : PLANS.filter((p) => p.id !== "free" && p.id !== "enterprise").map((plan) => {
                    const price = getPlanPrice(plan.id, "monthly");
                    const highlight = plan.id === defaultPlan;
                    return (
                      <Card
                        key={plan.id}
                        className={highlight ? "border-primary ring-2 ring-primary/20" : ""}
                      >
                        <CardHeader>
                          <CardTitle className="flex items-center justify-between text-lg">
                            {plan.name}
                            {highlight && (
                              <Badge>{t("subscriptionRenewal.recommended")}</Badge>
                            )}
                          </CardTitle>
                          <CardDescription>{plan.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <p className="text-3xl font-bold">
                            {price === 0 ? t("subscriptionRenewal.free") : `৳${price.toLocaleString()}`}
                            {price > 0 && (
                              <span className="text-sm font-normal text-muted-foreground">
                                /{t("subscriptionRenewal.month")}
                              </span>
                            )}
                          </p>
                          <ul className="text-sm space-y-1 text-muted-foreground">
                            {plan.features.slice(0, 3).map((f) => (
                              <li key={f}>• {f}</li>
                            ))}
                          </ul>
                          <Button
                            className="w-full"
                            variant={highlight ? "default" : "outline"}
                            onClick={() =>
                              openRequestDialog(plan.id as PlanType, undefined, summaryMethods[0]?.methodCode)
                            }
                          >
                            {t("subscriptionRenewal.payAndActivate")}
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
            </div>
          </div>
        )}
      </main>

      <SubscriptionPaymentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingRequest={editingRequest}
        selectedPlanMeta={selectedPlanMeta}
        form={form}
        setForm={setForm}
        summaryMethods={summaryMethods}
        selectedMethodMeta={selectedMethodMeta}
        selectedMethodHasReceiverDetails={selectedMethodHasReceiverDetails}
        payableAmount={payableAmount}
        listPrice={listPrice}
        couponCode={couponCode}
        setCouponCode={setCouponCode}
        appliedCoupon={appliedCoupon}
        couponLoading={couponLoading}
        onApplyCoupon={applyCoupon}
        onClearCoupon={clearCoupon}
        selectedPlan={selectedPlan}
        submitting={submitting}
        proofUploading={proofUploading}
        onUploadProof={uploadProof}
        onRemoveProof={() => setForm((prev) => ({ ...prev, proofUrl: "", proofFileName: "" }))}
        onSubmit={submitRequest}
        onClose={closeDialog}
      />
    </div>
  );
};

export default SubscriptionRenewalPage;
