/** Normalize BD/international phone for display and comparison. */
export function normalizePhoneInput(value?: string | null): string {
  const raw = String(value || "").trim().replace(/[\s-]/g, "");
  if (!raw) return "";
  if (raw.startsWith("+")) return raw;
  if (raw.startsWith("880")) return `+${raw}`;
  if (raw.startsWith("0")) return `+88${raw}`;
  return raw;
}

export function phonesEquivalent(a?: string | null, b?: string | null): boolean {
  return normalizePhoneInput(a) === normalizePhoneInput(b);
}
