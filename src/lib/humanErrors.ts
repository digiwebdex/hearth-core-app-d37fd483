import type { TFunction } from "i18next";

type MatchRule = {
  test: (msg: string) => boolean;
  key: string;
};

const RULES: MatchRule[] = [
  { test: (m) => /failed to fetch|network|networkerror/i.test(m), key: "humanErrors.network" },
  { test: (m) => /unauthorized|401|invalid token|jwt/i.test(m), key: "humanErrors.unauthorized" },
  { test: (m) => /forbidden|403|permission/i.test(m), key: "humanErrors.forbidden" },
  { test: (m) => /not found|404/i.test(m), key: "humanErrors.notFound" },
  { test: (m) => /email already registered/i.test(m), key: "humanErrors.emailExists" },
  { test: (m) => /no changes provided/i.test(m), key: "humanErrors.noChanges" },
  { test: (m) => /validation|invalid|required/i.test(m), key: "humanErrors.validation" },
  { test: (m) => /rate limit|too many/i.test(m), key: "humanErrors.rateLimit" },
  { test: (m) => /subscription|expired|trial/i.test(m), key: "humanErrors.subscription" },
  { test: (m) => /upload|file is required/i.test(m), key: "humanErrors.upload" },
];

/** Turn raw API/JS errors into friendly copy (EN/BN via i18n). */
export function humanizeError(raw: unknown, t: TFunction): string {
  const message = String(raw instanceof Error ? raw.message : raw || "").trim();
  if (!message) return t("humanErrors.generic");

  const lower = message.toLowerCase();
  for (const rule of RULES) {
    if (rule.test(lower)) return t(rule.key);
  }

  // Short technical messages — wrap in generic friendly text
  if (message.length < 120 && !message.includes("<")) return message;
  return t("humanErrors.generic");
}

export function humanErrorTitle(t: TFunction): string {
  return t("humanErrors.title");
}
