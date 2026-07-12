import { useCallback, useState } from "react";

/**
 * Minimal multi-step wizard state. Keeps step data in the caller's own form
 * object (matching the app's useState form convention) — this only owns the
 * step index + navigation. Per-step validation is supplied by the caller via
 * `canProceed` when calling `next()`.
 */
export function useWizard(stepCount: number, initial = 0) {
  const [step, setStep] = useState(initial);

  const isFirst = step === 0;
  const isLast = step >= stepCount - 1;

  const goTo = useCallback(
    (i: number) => setStep(() => Math.max(0, Math.min(i, stepCount - 1))),
    [stepCount],
  );
  const next = useCallback(
    (canProceed = true) => {
      if (!canProceed) return false;
      setStep((s) => Math.min(s + 1, stepCount - 1));
      return true;
    },
    [stepCount],
  );
  const back = useCallback(() => setStep((s) => Math.max(s - 1, 0)), []);
  const reset = useCallback(() => setStep(initial), [initial]);

  return { step, isFirst, isLast, stepCount, goTo, next, back, reset };
}
