/** Bangladesh mobile + email validation for signup forms. */

export function normalizePhone(input: string): string | null {
  let digits = String(input || "").replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("880") && digits.length >= 13) {
    digits = digits.slice(0, 13);
  } else if (digits.startsWith("0") && digits.length === 11) {
    digits = `880${digits.slice(1)}`;
  } else if (digits.length === 10 && digits.startsWith("1")) {
    digits = `880${digits}`;
  } else {
    return null;
  }

  if (!/^8801[3-9]\d{8}$/.test(digits)) return null;
  return `+${digits}`;
}

export function validatePhone(input: string): { ok: true; phone: string } | { ok: false; message: string } {
  if (!input.trim()) {
    return { ok: false, message: "Phone number is required" };
  }
  const phone = normalizePhone(input);
  if (!phone) {
    return { ok: false, message: "Enter a valid Bangladesh mobile number (e.g. 017XXXXXXXX)" };
  }
  return { ok: true, phone };
}

export function validateEmail(input: string): { ok: true; email: string } | { ok: false; message: string } {
  const email = input.trim().toLowerCase();
  if (!email) return { ok: false, message: "Email is required" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: "Enter a valid email address" };
  }
  return { ok: true, email };
}

/** Display-friendly local format: 01XXXXXXXXX */
export function formatPhoneLocal(normalized: string): string {
  const digits = normalized.replace(/\D/g, "");
  if (digits.startsWith("880") && digits.length === 13) {
    return `0${digits.slice(3)}`;
  }
  return normalized;
}
