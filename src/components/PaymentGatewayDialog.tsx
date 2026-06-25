import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, Smartphone, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { paymentGatewayApi, type PaymentGateway } from "@/lib/paymentGatewayApi";
import { useGatewayStatus } from "@/hooks/useGatewayStatus";
import { useHumanError } from "@/hooks/useHumanError";

interface PaymentGatewayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  amount: number;
  onSuccess?: () => void;
}

const ALL_GATEWAYS: { id: PaymentGateway; name: string; icon: React.ReactNode; descriptionEn: string; descriptionBn: string; badge?: string }[] = [
  {
    id: "sslcommerz",
    name: "SSLCommerz",
    icon: <CreditCard className="h-6 w-6" />,
    descriptionEn: "Visa, Mastercard, mobile banking, internet banking",
    descriptionBn: "ভিসা, মাস্টারকার্ড, মোবাইল ব্যাংকিং, ইন্টারনেট ব্যাংকিং",
    badge: "Recommended",
  },
  {
    id: "bkash",
    name: "bKash",
    icon: <Smartphone className="h-6 w-6" />,
    descriptionEn: "Pay with bKash wallet",
    descriptionBn: "bKash ওয়ালেট দিয়ে পেমেন্ট",
  },
  {
    id: "cod",
    name: "Cash on Delivery",
    icon: <Truck className="h-6 w-6" />,
    descriptionEn: "Pay in cash when service is delivered",
    descriptionBn: "সেবা ডেলিভারির সময় নগদ পেমেন্ট",
  },
];

const PaymentGatewayDialog = ({ open, onOpenChange, invoiceId, amount, onSuccess }: PaymentGatewayDialogProps) => {
  const { i18n } = useTranslation();
  const isBn = String(i18n.resolvedLanguage || i18n.language || "en").startsWith("bn");
  const { status } = useGatewayStatus();
  const { formatError, errorTitle } = useHumanError();
  const [selectedGateway, setSelectedGateway] = useState<PaymentGateway | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const gateways = useMemo(() => ALL_GATEWAYS.filter((gw) => {
    if (gw.id === "sslcommerz") return status.sslcommerz.configured;
    if (gw.id === "bkash") return status.bkash.configured;
    return true;
  }), [status]);

  const handlePay = async () => {
    if (!selectedGateway) return;
    if (!customerName.trim() || !customerPhone.trim()) {
      toast({
        title: isBn ? "তথ্য অনুপস্থিত" : "Missing info",
        description: isBn ? "নাম ও ফোন আবশ্যক।" : "Name and phone are required.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await paymentGatewayApi.initiate({
        invoiceId,
        amount,
        gateway: selectedGateway,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: customerPhone.trim(),
      });

      if (res.redirectUrl) {
        window.location.href = res.redirectUrl;
      } else {
        toast({
          title: isBn ? "অর্ডার নিশ্চিত" : "Order confirmed",
          description: res.message || (isBn ? "ক্যাশ অন ডেলিভারি নিশ্চিত হয়েছে।" : "Cash on delivery order placed."),
        });
        onSuccess?.();
        onOpenChange(false);
      }
    } catch (err) {
      toast({ variant: "destructive", title: errorTitle(), description: formatError(err) });
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setSelectedGateway(null);
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isBn ? "পেমেন্ট করুন" : "Pay Now"} — ৳{amount.toFixed(2)}</DialogTitle>
        </DialogHeader>

        {gateways.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {isBn
              ? "অনলাইন গেটওয়ে কনফিগার করা নেই। ম্যানুয়াল পেমেন্ট রেকর্ড করুন।"
              : "No online gateways configured. Record payment manually."}
          </p>
        ) : (
          <div className="space-y-3">
            <Label className="text-sm font-medium">{isBn ? "পেমেন্ট পদ্ধতি" : "Select Payment Method"}</Label>
            {gateways.map((gw) => (
              <Card
                key={gw.id}
                className={`cursor-pointer transition-all ${
                  selectedGateway === gw.id
                    ? "ring-2 ring-primary border-primary"
                    : "hover:border-primary/50"
                }`}
                onClick={() => setSelectedGateway(gw.id)}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex-shrink-0 text-primary">{gw.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{gw.name}</span>
                      {gw.badge && <Badge variant="secondary" className="text-xs">{gw.badge}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isBn ? gw.descriptionBn : gw.descriptionEn}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {selectedGateway && (
          <div className="space-y-3 pt-2 border-t">
            <Label className="text-sm font-medium">{isBn ? "কাস্টমার তথ্য" : "Customer Details"}</Label>
            <div className="space-y-2">
              <Input placeholder={isBn ? "পুরো নাম *" : "Full name *"} value={customerName} onChange={(e) => setCustomerName(e.target.value)} maxLength={100} required />
              <Input type="email" placeholder="Email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} maxLength={255} />
              <Input placeholder={isBn ? "ফোন *" : "Phone number *"} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} maxLength={20} required />
            </div>
            <Button className="w-full" onClick={handlePay} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {selectedGateway === "cod"
                ? (isBn ? "COD নিশ্চিত করুন" : "Confirm COD Order")
                : `${isBn ? "পে" : "Pay"} ৳${amount.toFixed(2)}`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PaymentGatewayDialog;
