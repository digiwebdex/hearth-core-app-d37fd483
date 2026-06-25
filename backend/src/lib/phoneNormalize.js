/** Normalize BD/international phone for storage and comparison. */
function normalizePhoneOptional(value) {
  const raw = String(value || "").trim().replace(/[\s-]/g, "");
  if (!raw) return null;
  if (raw.startsWith("+")) return raw;
  if (raw.startsWith("880")) return `+${raw}`;
  if (raw.startsWith("0")) return `+88${raw}`;
  return raw;
}

function phonesEquivalent(a, b) {
  const na = normalizePhoneOptional(a);
  const nb = normalizePhoneOptional(b);
  return na === nb;
}

module.exports = { normalizePhoneOptional, phonesEquivalent };
