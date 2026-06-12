import { describe, expect, it } from "vitest";
import { normalizePhone, validateEmail, validatePhone } from "@/lib/contactValidation";

describe("contactValidation", () => {
  it("normalizes BD mobile numbers", () => {
    expect(normalizePhone("01712345678")).toBe("+8801712345678");
    expect(normalizePhone("+880 1712-345678")).toBe("+8801712345678");
  });

  it("rejects invalid phone", () => {
    expect(validatePhone("123").ok).toBe(false);
    expect(validatePhone("").ok).toBe(false);
  });

  it("validates email", () => {
    expect(validateEmail("owner@agency.com").ok).toBe(true);
    expect(validateEmail("bad-email").ok).toBe(false);
    expect(validateEmail("").ok).toBe(false);
  });
});
