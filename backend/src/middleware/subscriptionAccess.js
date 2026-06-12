const jwt = require("jsonwebtoken");
const { prisma, SECRET } = require("./auth");

const EXEMPT_PREFIXES = [
  "/auth",
  "/payment-requests",
  "/admin",
  "/cron",
  "/public",
  "/portal",
  "/contact",
  "/demo-requests",
  "/health",
  "/email",
  "/sms",
];

function isExemptPath(relativePath) {
  return EXEMPT_PREFIXES.some(
    (prefix) => relativePath === prefix || relativePath.startsWith(`${prefix}/`)
  );
}

function tenantIsBlocked(tenant) {
  if (!tenant) return false;
  const plan = String(tenant.subscriptionPlan || "free").toLowerCase();
  const status = String(tenant.subscriptionStatus || "").toLowerCase();
  if (status === "suspended" || status === "cancelled") return true;
  const pastExpiry = tenant.subscriptionExpiry && new Date(tenant.subscriptionExpiry) < new Date();
  if (status === "trial" && pastExpiry) return true;
  if (status === "expired") return true;
  if (plan !== "free" && pastExpiry) return true;
  return false;
}

/**
 * Blocks expired/suspended tenants from API usage except subscription renewal routes.
 * Mount at app level: app.use("/api", subscriptionAccessGate)
 */
async function subscriptionAccessGate(req, res, next) {
  const relativePath = req.path || "";
  if (isExemptPath(relativePath)) return next();

  // Allow tenant profile read for renewal UI
  if (relativePath === "/tenants/me" && req.method === "GET") return next();

  const header = req.headers.authorization;
  if (!header) return next();

  try {
    const token = header.replace("Bearer ", "");
    const decoded = jwt.verify(token, SECRET);
    if (decoded.role === "super_admin") return next();

    const tenant = await prisma.tenant.findUnique({
      where: { id: decoded.tenantId },
      select: { subscriptionPlan: true, subscriptionStatus: true, subscriptionExpiry: true },
    });

    if (!tenantIsBlocked(tenant)) return next();

    return res.status(402).json({
      message: "Subscription inactive. Renew your plan to continue.",
      code: "SUBSCRIPTION_INACTIVE",
      subscriptionStatus: tenant?.subscriptionStatus,
      subscriptionExpiry: tenant?.subscriptionExpiry,
    });
  } catch {
    return next();
  }
}

module.exports = { subscriptionAccessGate, tenantIsBlocked };
