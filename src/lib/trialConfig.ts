import { API_BASE_URL } from "@/lib/apiConfig";
/** Default trial length when API config is unavailable */
export const DEFAULT_TRIAL_DAYS = 7;

const API_BASE = API_BASE_URL;

let cachedTrialDays: number | null = null;

export async function fetchConfiguredTrialDays(): Promise<number> {
  if (cachedTrialDays != null) return cachedTrialDays;
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (res.ok) {
      const data = await res.json();
      const days = Number(data.trialDays);
      if (Number.isFinite(days) && days > 0) {
        cachedTrialDays = days;
        return days;
      }
    }
  } catch {
    /* use default */
  }
  return DEFAULT_TRIAL_DAYS;
}

/** Elapsed trial progress (0–100) from tenant dates */
export function trialProgressPercent(
  trialDaysLeft: number,
  subscriptionExpiry?: string,
  createdAt?: string,
  configuredDays = DEFAULT_TRIAL_DAYS,
): number {
  if (subscriptionExpiry && createdAt) {
    const total = Math.ceil(
      (new Date(subscriptionExpiry).getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24),
    );
    if (total > 0) return Math.min(100, Math.max(0, ((total - trialDaysLeft) / total) * 100));
  }
  const total = configuredDays;
  return Math.min(100, Math.max(0, ((total - trialDaysLeft) / total) * 100));
}
