// Payment Gateway API — SSLCommerz, bKash, COD
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token");
  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  }).then(async (res) => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || "Request failed");
    }
    return res.json();
  });
}

export type PaymentGateway = "sslcommerz" | "bkash" | "cod";

export interface GatewayStatusResponse {
  bkash: { configured: boolean; sandbox: boolean; mode: "sandbox" | "live" | "disabled" };
  sslcommerz: { configured: boolean; sandbox: boolean; mode: "sandbox" | "live" | "disabled" };
  manual: { configured: boolean };
}

export interface PaymentInitRequest {
  invoiceId?: string;
  paymentRequestId?: string;
  amount: number;
  gateway: PaymentGateway;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

export interface PaymentInitResponse {
  success: boolean;
  transactionId: string;
  redirectUrl?: string; // SSLCommerz & bKash redirect
  message?: string;
}

export interface PaymentStatusResponse {
  transactionId: string;
  invoiceId: string;
  amount: number;
  gateway: PaymentGateway;
  status: "pending" | "success" | "failed" | "cancelled";
  paidAt?: string;
}

export const paymentGatewayApi = {
  /** Which online gateways are configured on the server */
  gatewayStatus: () => request<GatewayStatusResponse>("/payments/gateway-status"),

  /** Initiate payment — returns redirect URL for SSLCommerz/bKash, or confirms COD */
  initiate: (data: PaymentInitRequest) =>
    request<PaymentInitResponse>("/payments/initiate", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** Check payment status by transaction ID */
  status: (transactionId: string) =>
    request<PaymentStatusResponse>(`/payments/status/${encodeURIComponent(transactionId)}`),

  /** Validate IPN/callback (called from callback page) */
  validateCallback: (gateway: PaymentGateway, params: Record<string, string>) =>
    request<PaymentStatusResponse>(`/payments/callback/${gateway}`, {
      method: "POST",
      body: JSON.stringify(params),
    }),
};
