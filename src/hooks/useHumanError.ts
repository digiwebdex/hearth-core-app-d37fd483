import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { humanErrorTitle, humanizeError } from "@/lib/humanErrors";

export function useHumanError() {
  const { t } = useTranslation();

  const formatError = useCallback((raw: unknown) => humanizeError(raw, t), [t]);
  const errorTitle = useCallback(() => humanErrorTitle(t), [t]);

  return { formatError, errorTitle };
}
