const express = require("express");
const cors = require("cors");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { credentialAuthLimiter } = require("./middleware/rateLimit");
const { getTrialDays } = require("./lib/trialConfig");
const { getGatewayStatus } = require("./lib/paymentGatewayConfig");

const prismaHealth = new PrismaClient();

function createApp() {
  const app = express();

  // Behind nginx/Coolify — required for express-rate-limit with X-Forwarded-For
  if (process.env.TRUST_PROXY !== "false") {
    app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS || 1));
  }

  const normalizeOrigin = (value) => value?.trim().replace(/\/$/, "");
  const defaultOrigins = [
    "https://travelagencyweb.com",
    "https://www.travelagencyweb.com",
    "https://app.travelagencyweb.com",
    "https://portal.travelagencyweb.com",
    "http://localhost:5173",
    "http://localhost:8080",
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

  const { securityHeaders } = require("./middleware/security");
  app.use(securityHeaders);

  const { subscriptionAccessGate } = require("./middleware/subscriptionAccess");
  app.use("/api", subscriptionAccessGate);

  app.use("/api/auth", credentialAuthLimiter, require("./routes/auth"));
  app.use("/api/tenants", require("./routes/tenants"));
  app.use("/api/master-data", require("./routes/masterData"));
  app.use("/api/tenant-domains", require("./routes/tenantDomains"));
  app.use("/api/dashboard", require("./routes/dashboard"));
  app.use("/api/clients", require("./routes/clients"));
  app.use("/api/documents", require("./routes/documents"));
  app.use("/api/agents", require("./routes/agents"));
  app.use("/api/vendors", require("./routes/vendors"));
  app.use("/api/leads", require("./routes/leads"));
  app.use("/api/complaints", require("./routes/complaints"));
  app.use("/api/campaigns", require("./routes/campaigns"));
  app.use("/api/crm-analytics", require("./routes/crmAnalytics"));
  app.use("/api/crm-settings", require("./routes/crmSettings"));
  app.use("/api/tasks", require("./routes/crud")("task"));
  app.use("/api/support-tickets", require("./routes/supportTickets"));
  app.use("/api/hrm", require("./routes/hrm"));
  app.use("/api/blogs", require("./routes/blogs"));
  app.use("/api/bookings", require("./routes/bookings"));
  app.use("/api/invoices", require("./routes/invoices"));
  app.use("/api/finance", require("./routes/finance"));
  app.use("/api/payments", require("./routes/payments"));
  app.use("/api/quotations", require("./routes/quotations"));
  app.use("/api/travel-packages", require("./routes/crud")("travelPackage"));
  app.use("/api/accounts", require("./routes/accounts"));
  app.use("/api/transactions", require("./routes/crud")("transaction"));
  app.use("/api/expenses", require("./routes/expenses"));
  app.use("/api/tax-rules", require("./routes/taxRules"));
  app.use("/api/payroll", require("./routes/payroll"));
  app.use("/api/loyalty", require("./routes/loyalty"));
  app.use("/api/referrals", require("./routes/referrals"));
  app.use("/api/group-tours", require("./routes/groupTours"));
  app.use("/api/mice", require("./routes/mice"));
  app.use("/api/travel-policy", require("./routes/travelPolicy"));
  app.use("/api/visa", require("./routes/visa"));
  app.use("/api/visa-stock", require("./routes/visaStock"));
  app.use("/api/inventory", require("./routes/inventory"));
  app.use("/api/recruitment", require("./routes/recruitment"));
  app.use("/api/ticket-refunds", require("./routes/ticketRefunds"));
  app.use("/api/ticket-voids", require("./routes/ticketVoids"));
  app.use("/api/ticket-reissues", require("./routes/ticketReissues"));
  app.use("/api/flight-reminders", require("./routes/flightReminders"));
  app.use("/api/hajj", require("./routes/hajj"));
  app.use("/api/subscriptions", require("./routes/crud")("subscription"));
  app.use("/api/payment-requests", require("./routes/paymentRequests"));
  app.use("/api/audit-logs", require("./routes/auditLogs"));
  app.use("/api/website", require("./routes/website"));

  app.use("/api/admin", require("./routes/adminSubscriptionWorkflow"));
  app.use("/api/admin/platform-staff", require("./routes/adminPlatformStaff"));
  app.use("/api/admin", require("./routes/admin"));
  app.use("/api/admin/master-data", require("./routes/adminMasterData"));
  const domainsRouter = require("./routes/domains");
  app.use("/api/admin/domains", domainsRouter);
  // Legacy path used by older frontend builds before domainApi pointed at /admin/domains
  app.use("/api/domains", domainsRouter);
  app.use("/api/admin/notifications", require("./routes/adminNotifications"));
  app.use("/api/admin/subscription-workflow", require("./routes/adminSubscriptionWorkflow"));

  app.use("/api/contact", require("./routes/contact"));
  app.use("/api/demo-requests", require("./routes/demo"));
  app.use("/api/public", require("./routes/public"));

  app.use("/api/portal", require("./routes/portal"));

  app.use("/api/email", require("./routes/email"));
  app.use("/api/sms", require("./routes/sms"));
  app.use("/api/whatsapp", require("./routes/whatsapp"));
  app.use("/api/subscription-coupons", require("./routes/subscriptionCoupons"));
  app.use("/api/notifications", require("./routes/notifications"));
  app.use("/api/cron", require("./routes/cron"));
  app.use("/api/export", require("./routes/dataExport"));
  app.use("/api/landing-cms", require("./routes/landingCms"));

  // Phase 1 (v2 Architecture Freeze) — Module Registry read endpoint. Additive,
  // nothing else in the app consumes it yet. See docs/v2-master/11-Architecture-Freeze.md §6.
  app.use("/api/registry", require("./routes/registry"));
  // Phase 1 Milestone 2 — Feature Flag Engine. Additive, all flags default
  // OFF, nothing else in the app consumes them yet. See docs/v2-master/11-Architecture-Freeze.md §12.
  app.use("/api/feature-flags", require("./routes/featureFlags"));
  // Phase 1 Milestone 3 — Plan Engine. Read-only, additive. Wraps
  // planFeatures.js/planPricing.js/moduleAccess.js (backend is the single
  // source of truth) — no plan data is redefined. See docs/v2-master/11-Architecture-Freeze.md §9.
  app.use("/api/plan-engine", require("./routes/planEngine"));
  // Phase 1 Milestone 4 — Permission Engine. Read-only, additive. Wraps
  // auth.js's ROLE_PERMISSIONS (backend is the single source of truth) — no
  // permission data is redefined, and requirePermission()/requireRole()
  // enforcement is completely unchanged. See docs/v2-master/11-Architecture-Freeze.md §8.
  app.use("/api/permission-engine", require("./routes/permissionEngine"));
  // Phase 1 Milestone 5 — Status Engine. Read-only, additive. Documents
  // status values and transitions; enforces nothing and validates nothing —
  // every existing route keeps writing status strings exactly as before.
  // See docs/v2-master/11-Architecture-Freeze.md §10.
  app.use("/api/status-engine", require("./routes/statusEngine"));
  // Phase 1 Milestone 6 — Sidebar Engine (Phase 1 capstone). Read-only,
  // additive. Composes Module Registry + Plan Engine + Permission Engine +
  // Feature Flag Engine into one resolved navigation context. The live
  // sidebar (src/config/navigation.ts, AppSidebarNav.tsx) is unchanged and
  // keeps rendering exactly as before. See docs/v2-master/11-Architecture-Freeze.md §6.
  app.use("/api/sidebar-engine", require("./routes/sidebarEngine"));
  // Phase 2 — CRM Foundation. Read-only, additive. Wraps Client/Lead/
  // Agent/Vendor/Tenant with composed, per-record read contexts. Existing
  // /api/clients, /api/leads, /api/crm-analytics, /api/crm-settings,
  // /api/tenants routes are unchanged.
  app.use("/api/crm-engine", require("./routes/crmEngine"));
  // Booking Registry — shared booking metadata layer ahead of Booking
  // Foundation. Read-only, additive. Defines/resolves booking types only —
  // no booking operations, no booking creation. Existing /api/bookings and
  // every per-service route are unchanged. See docs/v2-master/11-Architecture-Freeze.md §5.
  app.use("/api/booking-registry", require("./routes/bookingRegistry"));

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
      trialDays: getTrialDays(),
      paymentGateways: getGatewayStatus(),
    });
  });

  const { notFoundHandler, globalErrorHandler } = require("./middleware/security");
  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
}

module.exports = { createApp };
