import { useEffect, useState } from "react";
import { DEFAULT_TRIAL_DAYS, fetchConfiguredTrialDays } from "@/lib/trialConfig";

/** Configured signup trial length from API health (falls back to DEFAULT_TRIAL_DAYS). */
export function useConfiguredTrialDays() {
  const [days, setDays] = useState(DEFAULT_TRIAL_DAYS);

  useEffect(() => {
    let cancelled = false;
    fetchConfiguredTrialDays().then((d) => {
      if (!cancelled) setDays(d);
    });
    return () => { cancelled = true; };
  }, []);

  return days;
}
