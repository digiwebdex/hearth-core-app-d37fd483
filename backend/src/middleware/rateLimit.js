const rateLimit = require("express-rate-limit");

function createLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message },
    skip: () => process.env.RATE_LIMIT_DISABLED === "true",
  });
}

const authLimiter = createLimiter({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 60_000),
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 10),
  message: "Too many authentication attempts. Please try again later.",
});

const portalAuthLimiter = createLimiter({
  windowMs: Number(process.env.PORTAL_AUTH_RATE_LIMIT_WINDOW_MS || 60_000),
  max: Number(process.env.PORTAL_AUTH_RATE_LIMIT_MAX || 10),
  message: "Too many portal sign-in attempts. Please try again later.",
});

// Only credential/abuse-prone endpoints share the strict auth budget.
// Session reads like GET /me fire on every page load and must never be
// throttled by failed-login counting, or one busy office IP locks out the app.
const CREDENTIAL_PATHS = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/resend-verification",
  "/check-email",
  "/whatsapp-otp/send",
  "/whatsapp-otp/verify",
]);

function credentialAuthLimiter(req, res, next) {
  if (CREDENTIAL_PATHS.has(req.path)) return authLimiter(req, res, next);
  return next();
}

module.exports = { authLimiter, portalAuthLimiter, credentialAuthLimiter };
