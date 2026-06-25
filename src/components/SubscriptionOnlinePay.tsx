import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Smartphone, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useGatewayStatus } from "@/hooks/useGatewayStatus";
import { useHumanError } from "@/hooks/useHumanError";
import { paymentGatewayApi } from "@/lib/paymentGatewayApi";
import { tenantSubscriptionWorkflowApi } from "@/lib/subscriptionWorkflowApi";
import type { BillingCycle, PlanType } from "@/lib/plans";

type Props = {
  plan: PlanType;
  billingCycle: BillingCycle;
  amount: number;
  disabled?: boolean;
};

export function SubscriptionOnlinePay({ plan, billingCycle, amount, disabled }: Props) {
  const { t, i18n } = useTranslation();
  const isBn = String(i18n.resolvedLanguage || i18n.language || "en").startsWith("bn");
  const { user } = useAuth();
  const { status, hasOnlineGateway, loading } = useGatewayStatus();
  const { formatError, errorTitle } = useHumanError();
  const { toast } = useToast();
  const [paying, setPaying] = useState<"bkash" | "sslcommerz" | null>(null);

  if (loading || !hasOnlineGateway) return null;

  const pay = async (gateway: "bkash" | "sslcommerz") => {
    setPaying(gateway);
    try {
      const checkout = await tenantSubscriptionWorkflowApi.onlineCheckout({
        gateway,
        requestedPlan: plan,
        billingCycle,
        amountSent: amount,
        expectedAmount: amount,
        customerName: user?.name,
        customerEmail: user?.email,
        customerPhone: user?.phone,
      });

      const res = await paymentGatewayApi.initiate({
        paymentRequestId: checkout.paymentRequestId,
        amount: checkout.amount,
        gateway,
        customerName: checkout.customerName || user?.name || "",
        customerEmail: checkout.customerEmail || user?.email || "",
        customerPhone: checkout.customerPhone || user?.phone || "",
      });

      if (res.redirectUrl) {
        window.location.href = res.redirectUrl;
        return;
      }
      toast({ title: isBn ? "পেমেন্ট শুরু হয়েছে" : "Payment started" });
    } catch (err) {
      toast({ variant: "destructive", title: errorTitle(), description: formatError(err) });
    } finally {
      setPaying(null);
    }
  };

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">
          {isBn ? "তাৎক্ষণিক অনলাইন পেমেন্ট" : "Pay online instantly"}
        </p>
        {status.bkash.configured && (
          <Badge variant="outline" className="text-xs">
            bKash {status.bkash.mode === "live" ? "live" : "sandbox"}
          </Badge>
        )}
        {status.sslcommerz.configured && (
          <Badge variant="outline" className="text-xs">
            SSLCommerz {status.sslcommerz.mode === "live" ? "live" : "sandbox"}
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {isBn
          ? "অথবা নিচে ম্যানুয়াল প্রুফ আপলোড করুন (bKash send money + screenshot)।"
          : "Or submit manual proof below (bKash send money + screenshot)."}
      </p>
      <div className="flex flex-wrap gap-2">
        {status.sslcommerz.configured && (
          <Button
            type="button"
            disabled={disabled || paying !== null}
            onClick={() => pay("sslcommerz")}
          >
            {paying === "sslcommerz" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="mr-2 h-4 w-4" />
            )}
            SSLCommerz — ৳{amount.toLocaleString()}
          </Button>
        )}
        {status.bkash.configured && (
          <Button
            type="button"
            variant="secondary"
            disabled={disabled || paying !== null}
            onClick={() => pay("bkash")}
          >
            {paying === "bkash" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Smartphone className="mr-2 h-4 w-4" />
            )}
            bKash — ৳{amount.toLocaleString()}
          </Button>
        )}
      </div>
    </div>
  );
}
