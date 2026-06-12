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

module.exports = { authLimiter, portalAuthLimiter };
