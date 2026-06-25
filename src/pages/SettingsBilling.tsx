import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { paymentRequestApi } from "@/lib/api";
import { PLANS } from "@/lib/plans";
import { DEFAULT_TRIAL_DAYS, trialProgressPercent } from "@/lib/trialConfig";
import { useTranslation } from "react-i18next";
import { InlineEmpty } from "@/components/EmptyState";
import { Sparkles, Clock, CheckCircle2, CreditCard, Receipt, ArrowUpRight, AlertCircle } from "lucide-react";

const SettingsBilling = () => {
  const { tenant, currentPlan, isTrialActive, trialDaysLeft, isSubscriptionExpired } = useAuth();
  const { t } = useTranslation();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    paymentRequestApi
      .list()
      .then((d) => setPayments(Array.isArray(d) ? d : []))
      .catch(() => setPayments([]))
      .finally(() => setLoading(false));
  }, []);

  const plan = PLANS.find((p) => p.id === currentPlan) || PLANS[0];
  const configuredTrialDays = tenant?.trialDaysConfigured ?? DEFAULT_TRIAL_DAYS;
  const trialProgress = isTrialActive
    ? trialProgressPercent(trialDaysLeft, tenant?.subscriptionExpiry, tenant?.createdAt, configuredTrialDays)
    : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
          <p className="text-muted-foreground">Manage your plan, trial, and payment history.</p>
        </div>

        {/* Trial banner */}
        {isTrialActive && (
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-600" />
                <CardTitle className="text-lg">{configuredTrialDays}-Day Pro Trial Active</CardTitle>
              </div>
              <CardDescription>
                {trialDaysLeft > 0
                  ? `${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""} remaining — upgrade anytime to keep full access.`
                  : "Trial ends today. Choose a plan to continue."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress value={trialProgress} className="h-2" />
              <Button asChild>
                <Link to="/subscription">
                  <Sparkles className="mr-2 h-4 w-4" /> Choose a paid plan
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {isSubscriptionExpired && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <CardTitle className="text-lg">Subscription expired</CardTitle>
              </div>
              <CardDescription>Renew to restore access to all features.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="destructive">
                <Link to="/subscription">Renew now</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Current plan */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" /> Current Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-2xl font-bold">{plan.name}</h3>
                  <Badge variant={isTrialActive ? "secondary" : "default"}>
                    {tenant?.subscriptionStatus || "active"}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-sm mt-1">
                  ৳{plan.price.toLocaleString()}/month
                </p>
                {tenant?.subscriptionExpiry && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {isTrialActive ? "Trial ends" : "Renews"} on{" "}
                    {new Date(tenant.subscriptionExpiry).toLocaleDateString()}
                  </p>
                )}
              </div>
              <Button asChild variant="outline">
                <Link to="/subscription">
                  Change plan <ArrowUpRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 border-t">
              {plan.features.slice(0, 6).map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Payment history */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" /> Payment History
            </CardTitle>
            <CardDescription>Your subscription invoices and payment requests.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : payments.length === 0 ? (
              <div className="text-center py-8">
                <Receipt className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <InlineEmpty title={t("emptyStates.noBillingPayments")} hint={t("emptyStates.noBillingPaymentsHint")} />
              </div>
            ) : (
              <div className="divide-y">
                {payments.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-sm">
                        {p.planName || p.plan || "Subscription"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(p.createdAt).toLocaleDateString()} · {p.method || "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">৳{(p.amount || 0).toLocaleString()}</p>
                      <Badge
                        variant={
                          p.status === "approved" || p.status === "paid"
                            ? "default"
                            : p.status === "pending"
                            ? "secondary"
                            : "destructive"
                        }
                        className="text-xs"
                      >
                        {p.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default SettingsBilling;
