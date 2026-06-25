import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, CreditCard, Smartphone, Wallet, CheckCircle2, XCircle } from "lucide-react";
import { adminApi } from "@/lib/api";

type DetailedStatus = Awaited<ReturnType<typeof adminApi.getGatewayStatus>>;

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Badge variant={ok ? "default" : "secondary"} className="gap-1">
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </Badge>
  );
}

export function GatewayStatusPanel() {
  const { t, i18n } = useTranslation();
  const isBn = String(i18n.resolvedLanguage || i18n.language || "en").startsWith("bn");
  const [data, setData] = useState<DetailedStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    adminApi
      .getGatewayStatus()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {isBn ? "সার্ভার পেমেন্ট স্ট্যাটাস (লাইভ)" : "Live server payment status"}
            </CardTitle>
            <CardDescription>
              {isBn
                ? "PM2/API .env থেকে পড়া হয় — Admin UI তে সেভ হয় না।"
                : "Read from PM2/API .env — not saved from this admin UI."}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {error && <p className="text-destructive">{error}</p>}
        {data && (
          <>
            <div className="flex flex-wrap gap-2">
              <StatusBadge
                ok={data.sslcommerz.configured}
                label={`SSLCommerz ${data.sslcommerz.mode}`}
              />
              <StatusBadge ok={data.bkash.configured} label={`bKash ${data.bkash.mode}`} />
              <StatusBadge
                ok={data.manual.configured}
                label={isBn ? `ম্যানুয়াল ${data.manual.methodsEnabled}টি` : `Manual ${data.manual.methodsEnabled} methods`}
              />
            </div>
            <div className="rounded-md bg-muted/50 p-3 space-y-1 font-mono text-xs break-all">
              <p className="flex items-center gap-2 font-sans text-sm font-medium">
                <Smartphone className="h-4 w-4" /> bKash callback
              </p>
              <p>{data.callbacks.bkash.callback}</p>
              <p className="flex items-center gap-2 font-sans text-sm font-medium mt-2">
                <Wallet className="h-4 w-4" /> SSLCommerz IPN
              </p>
              <p>{data.callbacks.sslcommerz.ipn}</p>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>{isBn ? "লাইভের জন্য BKASH_SANDBOX=false ও SSLCOMMERZ_SANDBOX=false" : "Set BKASH_SANDBOX=false and SSLCOMMERZ_SANDBOX=false for live"}</li>
              <li>{isBn ? "ম্যানুয়াল: BKASH_ACCOUNT_NUMBER, BANK_ACCOUNT_NUMBER ইত্যাদি .env-এ" : "Manual: BKASH_ACCOUNT_NUMBER, BANK_ACCOUNT_NUMBER in .env"}</li>
              <li>{isBn ? "পরিবর্তনের পর: pm2 restart hearth-api" : "After changes: pm2 restart hearth-api"}</li>
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
