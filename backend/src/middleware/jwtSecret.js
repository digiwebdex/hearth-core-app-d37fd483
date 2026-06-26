/**
 * JWT secret resolution and production boot enforcement.
 * Production requires JWT_SECRET (min 32 chars).
 * Development may use ALLOW_DEV_JWT=true with the dev fallback.
 */

// Never export or log this value — it is a last-resort local-dev fallback only
const _DEV_FALLBACK = "hearth-dev-only-not-for-production-use-change-me";

function assertJwtSecretAtBoot() {
  const secret = process.env.JWT_SECRET;
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    if (!secret || secret.length < 32) {
      console.error("FATAL: JWT_SECRET must be set and at least 32 characters in production.");
      process.exit(1);
    }
    return;
  }

  if (secret) return;

  // Block dev fallback if ALLOW_DEV_JWT is not explicitly enabled
  if (process.env.ALLOW_DEV_JWT !== "true") {
    console.error("FATAL: JWT_SECRET is not set. Set JWT_SECRET or ALLOW_DEV_JWT=true for local development only.");
    process.exit(1);
  }

  console.warn("[JWT] WARNING: Using development-only fallback JWT secret. Never use in production.");
}

function getJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  // Dev fallback — only permitted when explicitly enabled AND not in production
  if (process.env.ALLOW_DEV_JWT === "true" && process.env.NODE_ENV !== "production") {
    return _DEV_FALLBACK;
  }
  throw new Error("JWT_SECRET is required. Set JWT_SECRET in your environment.");
}

module.exports = { assertJwtSecretAtBoot, getJwtSecret };
