require("dotenv").config();
const { assertJwtSecretAtBoot } = require("./middleware/jwtSecret");
assertJwtSecretAtBoot();

const express = require("express");
const cors = require("cors");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const app = express();
const PORT = process.env.PORT || 4000;
const prismaHealth = new PrismaClient();

// Middleware
const normalizeOrigin = (value) => value?.trim().replace(/\/$/, "");
const defaultOrigins = [
  "https://travelagencyweb.com",
  "https://www.travelagencyweb.com",
  "https://app.travelagencyweb.com",
  "https://portal.travelagencyweb.com",
  "http://localhost:5173",
];
const allowedOrigins = (process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",")
  : defaultOrigins
).map(normalizeOrigin);

const customDomainPlans = new Set(["pro", "business", "enterprise", "unlimited"]);
const activeSubscriptionStatuses = new Set(["active", "trial"]);
const customDomainCacheTtlMs = Number(process.env.CUSTOM_DOMAIN_CORS_CACHE_MS || 60000);
let customDomainOriginCache = { expiresAt: 0, origins: new Set() };

function addDomainOrigins(origins, domain) {
  if (!domain) return;
  const host = String(domain).toLowerCase().replace(/^www\./, "");
  for (const protocol of ["https", "http"]) {
    origins.add(`${protocol}://${host}`);
    origins.add(`${protocol}://www.${host}`);
  }
}

async function getAllowedCustomDomainOrigins() {
  const now = Date.now();
  if (customDomainOriginCache.expiresAt > now) return customDomainOriginCache.origins;

  const origins = new Set();
  const domains = await prismaHealth.tenantDomain.findMany({
    where: { status: "active", verificationStatus: "verified" },
    include: { tenant: { select: { subscriptionPlan: true, subscriptionStatus: true } } },
  });

  for (const domain of domains) {
    const plan = String(domain.tenant?.subscriptionPlan || "").toLowerCase();
    const status = String(domain.tenant?.subscriptionStatus || "").toLowerCase();
    if (customDomainPlans.has(plan) && activeSubscriptionStatuses.has(status)) {
      addDomainOrigins(origins, domain.domain);
    }
  }

  customDomainOriginCache = { expiresAt: now + customDomainCacheTtlMs, origins };
  return origins;
}

const isAllowedRootDomain = (origin) => {
  try {
    const { protocol, hostname } = new URL(origin);
    if (protocol !== "https:") return false;
    return hostname === "travelagencyweb.com" || hostname.endsWith(".travelagencyweb.com");
  } catch {
    return false;
  }
};

const isAllowedCustomDomain = async (origin) => {
  try {
    const url = new URL(origin);
    if (!["https:", "http:"].includes(url.protocol)) return false;
    const origins = await getAllowedCustomDomainOrigins();
    return origins.has(`${url.protocol}//${url.hostname.toLowerCase()}`);
  } catch {
    return false;
  }
};

app.use(cors({
  origin: (origin, callback) => {
    const requestOrigin = normalizeOrigin(origin);
    if (!requestOrigin || allowedOrigins.includes("*") || allowedOrigins.includes(requestOrigin) || isAllowedRootDomain(requestOrigin)) {
      return callback(null, true);
    }

    isAllowedCustomDomain(requestOrigin)
      .then((allowed) => callback(null, allowed))
      .catch((error) => {
        console.error("CORS custom domain check failed:", error.message);
        callback(null, false);
      });
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json({ limit: "12mb" }));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/tenants", require("./routes/tenants"));
app.use("/api/tenant-domains", require("./routes/tenantDomains"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/clients", require("./routes/clients"));
app.use("/api/documents", require("./routes/documents"));
app.use("/api/agents", require("./routes/agents"));
app.use("/api/vendors", require("./routes/vendors"));
app.use("/api/leads", require("./routes/leads"));
app.use("/api/tasks", require("./routes/crud")("task"));
app.use("/api/bookings", require("./routes/bookings"));
app.use("/api/invoices", require("./routes/invoices"));
app.use("/api/payments", require("./routes/payments"));
app.use("/api/quotations", require("./routes/quotations"));
app.use("/api/travel-packages", require("./routes/crud")("travelPackage"));
app.use("/api/accounts", require("./routes/accounts"));
app.use("/api/transactions", require("./routes/crud")("transaction"));
app.use("/api/expenses", require("./routes/expenses"));
app.use("/api/hajj", require("./routes/hajj"));
app.use("/api/subscriptions", require("./routes/crud")("subscription"));
app.use("/api/payment-requests", require("./routes/paymentRequests"));
app.use("/api/audit-logs", require("./routes/auditLogs"));
app.use("/api/website", require("./routes/website"));

// Admin routes
app.use("/api/admin", require("./routes/adminSubscriptionWorkflow"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/admin/domains", require("./routes/domains"));
app.use("/api/admin/subscription-workflow", require("./routes/adminSubscriptionWorkflow"));

// Public form routes (no auth)
app.use("/api/contact", require("./routes/contact"));
app.use("/api/demo-requests", require("./routes/demo"));
app.use("/api/public", require("./routes/public"));

// Customer / Supplier portal (separate JWT audience)
app.use("/api/portal", require("./routes/portal"));

// Email routes (authenticated)
app.use("/api/email", require("./routes/email"));

// SMS & notifications (authenticated)
app.use("/api/sms", require("./routes/sms"));
app.use("/api/notifications", require("./routes/notifications"));

// Cron routes (protected by CRON_SECRET, not JWT)
app.use("/api/cron", require("./routes/cron"));

// Health check
app.get("/api/health", async (_req, res) => {
  let dbStatus = "disconnected";
  try {
    await prismaHealth.$queryRaw`SELECT 1`;
    dbStatus = "connected";
  } catch (e) {
    dbStatus = `error: ${e.code || e.message}`;
  }
  res.json({
    status: dbStatus === "connected" ? "ok" : "degraded",
    service: "travelagencyweb-api",
    database: dbStatus,
    environment: process.env.NODE_ENV || "development",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => console.log(`✅ TAWSS API running on port ${PORT}`));
