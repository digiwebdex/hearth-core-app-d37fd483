import { useEffect, useState } from "react";
import { paymentGatewayApi, type GatewayStatusResponse } from "@/lib/paymentGatewayApi";

const EMPTY: GatewayStatusResponse = {
  bkash: { configured: false, sandbox: true, mode: "disabled" },
  sslcommerz: { configured: false, sandbox: true, mode: "disabled" },
  manual: { configured: false },
};

export function useGatewayStatus() {
  const [status, setStatus] = useState<GatewayStatusResponse>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    paymentGatewayApi
      .gatewayStatus()
      .then((s) => { if (!cancelled) setStatus(s); })
      .catch(() => { if (!cancelled) setStatus(EMPTY); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const hasOnlineGateway = status.bkash.configured || status.sslcommerz.configured;

  return { status, loading, hasOnlineGateway };
}
