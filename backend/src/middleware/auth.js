const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const { getJwtSecret } = require("./jwtSecret");
const prisma = new PrismaClient();

const SECRET = getJwtSecret();

async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: "No token provided" });
  const token = header.replace("Bearer ", "");
  try {
    const decoded = jwt.verify(token, SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, tenantId: true, role: true, status: true },
    });
    if (!user) return res.status(401).json({ message: "Invalid token" });

    if (user.status === "pending") {
      return res.status(403).json({
        message: "Your account is pending admin approval.",
        code: "PENDING_APPROVAL",
      });
    }
    if (user.status === "rejected") {
      return res.status(403).json({
        message: "Your account has been rejected.",
        code: "REJECTED",
      });
    }
    if (user.status !== "active") {
      return res.status(403).json({ message: "Account is not active", code: "INACTIVE" });
    }

    req.userId = user.id;
    req.tenantId = user.tenantId;
    req.userRole = user.role;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

function requireSuperAdmin(req, res, next) {
  if (req.userRole !== "super_admin") return res.status(403).json({ message: "Forbidden" });
  next();
}

// ── Role-based middleware ──
// Usage: router.post("/", requireRole("tenant_owner", "manager"), handler)
function requireRole(...roles) {
  return (req, res, next) => {
    // super_admin always passes
    if (req.userRole === "super_admin") return next();
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({ message: `Forbidden: requires role ${roles.join(" or ")}` });
    }
    next();
  };
}

// ── Permission-based middleware ──
// Maps roles → module → actions (mirrors frontend permissions.ts)
const ROLE_PERMISSIONS = {
  tenant_owner: {
    dashboard: ["view", "create", "edit", "delete", "approve", "export"],
    clients: ["view", "create", "edit", "delete", "approve", "export"],
    agents: ["view", "create", "edit", "delete", "approve", "export"],
    vendors: ["view", "create", "edit", "delete", "approve", "export"],
    leads: ["view", "create", "edit", "delete", "approve", "export"],
    tasks: ["view", "create", "edit", "delete", "approve", "export"],
    quotations: ["view", "create", "edit", "delete", "approve", "export"],
    packages: ["view", "create", "edit", "delete", "approve", "export"],
    bookings: ["view", "create", "edit", "delete", "approve", "export"],
    invoices: ["view", "create", "edit", "delete", "approve", "export"],
    accounts: ["view", "create", "edit", "delete", "approve", "export"],
    reports: ["view", "create", "edit", "delete", "approve", "export"],
    hajj_umrah: ["view", "create", "edit", "delete", "approve", "export"],
    subscription: ["view", "create", "edit", "delete", "approve", "export"],
    team: ["view", "create", "edit", "delete", "approve", "export"],
    branches: ["view", "create", "edit", "delete", "approve", "export"],
    organization: ["view", "create", "edit", "delete", "approve", "export"],
    settings: ["view", "create", "edit", "delete", "approve", "export"],
    website: ["view", "create", "edit", "delete", "approve", "export"],
  },
  manager: {
    dashboard: ["view", "export"],
    clients: ["view", "create", "edit", "delete", "approve", "export"],
    agents: ["view", "create", "edit", "delete", "approve", "export"],
    vendors: ["view", "create", "edit", "delete", "approve", "export"],
    leads: ["view", "create", "edit", "delete", "approve", "export"],
    tasks: ["view", "create", "edit", "delete", "approve", "export"],
    quotations: ["view", "create", "edit", "delete", "approve", "export"],
    packages: ["view", "create", "edit", "delete", "approve", "export"],
    bookings: ["view", "create", "edit", "delete", "approve", "export"],
    invoices: ["view", "create", "edit", "approve", "export"],
    accounts: ["view", "create", "edit", "export"],
    reports: ["view", "export"],
    hajj_umrah: ["view", "create", "edit", "delete", "approve", "export"],
    subscription: ["view"],
    team: ["view"],
    branches: ["view", "create", "edit", "delete", "export"],
    organization: ["view"],
    website: ["view", "edit"],
  },
  sales_agent: {
    dashboard: ["view"],
    clients: ["view", "create", "edit"],
    agents: ["view"],
    vendors: ["view"],
    leads: ["view", "create", "edit", "delete"],
    tasks: ["view", "create", "edit"],
    quotations: ["view", "create", "edit", "export"],
    packages: ["view", "create", "edit"],
    bookings: ["view", "create", "edit"],
    invoices: ["view"],
    hajj_umrah: ["view", "create"],
    branches: ["view"],
  },
  accountant: {
    dashboard: ["view", "export"],
    clients: ["view"],
    agents: ["view"],
    vendors: ["view"],
    tasks: ["view"],
    quotations: ["view", "export"],
    packages: ["view"],
    bookings: ["view"],
    invoices: ["view", "create", "edit", "approve", "export"],
    accounts: ["view", "create", "edit", "export"],
    reports: ["view", "export"],
    hajj_umrah: ["view", "export"],
    subscription: ["view"],
    branches: ["view"],
  },
  operations: {
    dashboard: ["view"],
    clients: ["view"],
    agents: ["view"],
    vendors: ["view", "create", "edit"],
    tasks: ["view", "create", "edit"],
    quotations: ["view"],
    packages: ["view", "create", "edit"],
    bookings: ["view", "create", "edit", "export"],
    invoices: ["view"],
    reports: ["view"],
    hajj_umrah: ["view", "create", "edit", "export"],
    branches: ["view"],
  },
};

// Usage: router.delete(":id", requirePermission("bookings", "delete"), handler)
function requirePermission(module, action) {
  return (req, res, next) => {
    if (req.userRole === "super_admin") return next();
    const perms = ROLE_PERMISSIONS[req.userRole]?.[module];
    if (!perms || !perms.includes(action)) {
      return res.status(403).json({ message: `Forbidden: ${req.userRole} cannot ${action} ${module}` });
    }
    next();
  };
}

// ── Plan limit enforcement middleware ──
// Single backend plan config (limits + features) lives in lib/planFeatures.js.
const { RESOURCE_MODEL_MAP, getPlanLimit } = require("../lib/planFeatures");

// Effective plan used for capability gating. A tenant on an ACTIVE Free Trial gets
// full evaluation access (enterprise capabilities); the subscriptionAccessGate has
// already blocked EXPIRED trials before any of these gates run.
function effectiveGatingPlan(tenant) {
  if (String(tenant?.subscriptionStatus || "").toLowerCase() === "trial") return "enterprise";
  return tenant?.subscriptionPlan || "basic";
}

// Usage: router.post("/", checkPlanLimit("users"), handler)
function checkPlanLimit(resource) {
  return async (req, res, next) => {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: req.tenantId },
        select: { subscriptionPlan: true, subscriptionStatus: true },
      });
      if (!tenant) return res.status(404).json({ message: "Tenant not found" });

      const plan = effectiveGatingPlan(tenant);
      // getPlanLimit normalizes aliases (unlimited→enterprise, free→basic).
      let limit = getPlanLimit(plan, resource);

      // undefined = unknown resource → skip; -1 = unlimited
      if (limit === undefined || limit === -1) return next();
      // 0 = not allowed
      if (limit === 0) return res.status(403).json({ message: `Your ${plan} plan does not include ${resource}` });

      // Active paid add-ons raise the ENFORCED limit (not just the display).
      // additional_users → users, additional_branch → branches.
      const ADDON_RESOURCE = { additional_users: "users", additional_branch: "branches" };
      try {
        const addons = await prisma.subscriptionAddon.findMany({
          where: { tenantId: req.tenantId, status: "active" },
          select: { type: true, quantity: true },
        });
        const extra = addons.reduce((s, a) => s + (ADDON_RESOURCE[a.type] === resource ? (Number(a.quantity) || 0) : 0), 0);
        limit += extra;
      } catch { /* add-on table unavailable → enforce base plan limit */ }

      const model = RESOURCE_MODEL_MAP[resource];
      if (!model) return next(); // unknown resource, skip check

      const count = await prisma[model].count({ where: { tenantId: req.tenantId } });
      if (count >= limit) {
        return res.status(403).json({
          message: `${resource} limit reached (${limit}). Upgrade your plan.`,
          limit,
          current: count,
        });
      }
      next();
    } catch (err) {
      // Fail closed: if we cannot validate limits reliably, block creates.
      console.error("Plan limit check error:", err?.message || err);
      return res.status(503).json({ message: "Plan limit validation unavailable. Please try again." });
    }
  };
}

// Gate a route by a subscription FEATURE flag (e.g. hasWebsiteTemplates).
// Must run after `authenticate` (needs req.tenantId). super_admin bypasses.
// Usage: router.use(requireFeature("hasSmsIntegration"))
const { planHasFeature } = require("../lib/planFeatures");
function requireFeature(flag) {
  return async (req, res, next) => {
    try {
      if (req.userRole === "super_admin") return next();
      const tenant = await prisma.tenant.findUnique({
        where: { id: req.tenantId },
        select: { subscriptionPlan: true, subscriptionStatus: true },
      });
      if (!tenant) return res.status(404).json({ message: "Tenant not found" });
      if (planHasFeature(effectiveGatingPlan(tenant), flag)) return next();
      return res.status(403).json({
        message: "This feature is not included in your current plan. Please upgrade.",
        code: "FEATURE_NOT_IN_PLAN",
        feature: flag,
      });
    } catch (err) {
      console.error("Feature gate error:", err?.message || err);
      return res.status(503).json({ message: "Feature validation unavailable. Please try again." });
    }
  };
}

module.exports = { authenticate, requireSuperAdmin, requireRole, requirePermission, checkPlanLimit, requireFeature, prisma, SECRET, ROLE_PERMISSIONS };
