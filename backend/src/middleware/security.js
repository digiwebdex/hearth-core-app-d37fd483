/**
 * Security headers middleware — applied globally to all API responses.
 * Keeps this list minimal and non-breaking: only headers that are safe
 * for a JSON API behind nginx/Coolify with CORS already handled.
 */
function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  // Remove fingerprinting header
  res.removeHeader("X-Powered-By");
  next();
}

/**
 * Global error handler — catches any unhandled errors thrown in route handlers.
 * Must be registered AFTER all routes with 4 parameters.
 */
function globalErrorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const isDev = process.env.NODE_ENV !== "production";

  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} — ${err.message}`);
  if (isDev) console.error(err.stack);

  res.status(status).json({
    message: status < 500 ? err.message : "Internal server error",
    ...(isDev && status >= 500 ? { stack: err.stack } : {}),
  });
}

/**
 * 404 handler — catches requests that didn't match any route.
 * Register after all routes but before globalErrorHandler.
 */
function notFoundHandler(req, res) {
  res.status(404).json({ message: `Route ${req.method} ${req.path} not found` });
}

module.exports = { securityHeaders, globalErrorHandler, notFoundHandler };
