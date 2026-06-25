const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export async function fetchPlatformHealth() {
  const res = await fetch(`${BASE_URL}/health`);
  if (!res.ok) throw new Error("Health check failed");
  return res.json() as Promise<{
    status: string;
    paymentGateways?: {
      bkash: { configured: boolean; mode: string };
      sslcommerz: { configured: boolean; mode: string };
      manual: { configured: boolean };
    };
  }>;
}
