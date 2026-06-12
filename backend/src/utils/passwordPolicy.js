/**
 * Shared password rules for register, reset, and admin-created accounts.
 */

const MIN_LENGTH = 10;

function validatePassword(password) {
  if (typeof password !== "string" || !password.trim()) {
    return { ok: false, message: "Password is required" };
  }
  if (password.length < MIN_LENGTH) {
    return { ok: false, message: `Password must be at least ${MIN_LENGTH} characters` };
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { ok: false, message: "Password must include at least one letter" };
  }
  if (!/[0-9]/.test(password)) {
    return { ok: false, message: "Password must include at least one number" };
  }
  return { ok: true };
}

module.exports = { validatePassword, MIN_LENGTH };
