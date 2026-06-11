/**
 * JWT secret resolution and production boot enforcement.
 * Production requires JWT_SECRET (min 32 chars).
 * Development may use ALLOW_DEV_JWT=true with the dev fallback.
 */

const DEV_FALLBACK = "dev-secret";

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

  if (process.env.ALLOW_DEV_JWT === "true") {
    console.warn("[JWT] Using development fallback secret (ALLOW_DEV_JWT=true).");
    return;
  }

  console.warn(
    "[JWT] JWT_SECRET is not set. Set JWT_SECRET or ALLOW_DEV_JWT=true for local development."
  );
}

function getJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is required in production");
  }
  if (process.env.ALLOW_DEV_JWT === "true") return DEV_FALLBACK;
  return DEV_FALLBACK;
}

module.exports = { assertJwtSecretAtBoot, getJwtSecret, DEV_FALLBACK };
