import { API_BASE_URL } from "@/lib/apiConfig";
const BASE_URL = API_BASE_URL;

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
