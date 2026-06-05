const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const SECRET = process.env.JWT_SECRET || "dev-secret";

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: "No token provided" });
  const token = header.replace("Bearer ", "");
  try {
    const decoded = jwt.verify(token, SECRET);
    req.userId = decoded.userId;
    req.tenantId = decoded.tenantId;
    req.userRole = decoded.role;
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
// PLAN_LIMITS mirrors src/lib/plans.ts
const PLAN_LIMITS = {
  free:       { clients: 50,  bookings: 50,  users: 1,  domains: 0, leads: 50,  quotations: 20 },
  basic:      { clients: -1,  bookings: -1,  users: 5,  domains: 0, leads: -1,  quotations: -1 },
  pro:        { clients: -1,  bookings: -1,  users: 20, domains: 1, leads: -1,  quotations: -1 },
  business:   { clients: -1,  bookings: -1,  users: -1, domains: -1, leads: -1, quotations: -1 },
  enterprise: { clients: -1,  bookings: -1,  users: -1, domains: -1, leads: -1, quotations: -1 },
};

const RESOURCE_MODEL_MAP = {
  clients: "client",
  bookings: "booking",
  users: "user",
  domains: "tenantDomain",
  leads: "lead",
  quotations: "quotation",
};

// Usage: router.post("/", checkPlanLimit("clients"), handler)
function checkPlanLimit(resource) {
  return async (req, res, next) => {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: req.tenantId },
        select: { subscriptionPlan: true },
      });
      if (!tenant) return res.status(404).json({ message: "Tenant not found" });

      const plan = tenant.subscriptionPlan || "free";
      const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
      const limit = limits[resource];

      // -1 = unlimited
      if (limit === -1) return next();
      // 0 = not allowed
      if (limit === 0) return res.status(403).json({ message: `Your ${plan} plan does not include ${resource}` });

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
      // Don't block on limit check errors — log and continue
      console.error("Plan limit check error:", err.message);
      next();
    }
  };
}

module.exports = { authenticate, requireSuperAdmin, requireRole, requirePermission, checkPlanLimit, prisma, SECRET };
