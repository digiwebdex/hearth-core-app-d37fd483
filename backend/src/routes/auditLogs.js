const router = require("express").Router();
const { authenticate, prisma } = require("../middleware/auth");

router.use(authenticate);

const AUDIT_VIEW_ROLES = new Set(["super_admin", "tenant_owner", "owner", "manager"]);

function requireAuditViewer(req, res, next) {
  if (AUDIT_VIEW_ROLES.has(req.userRole)) return next();
  return res.status(403).json({ message: "Forbidden: activity log requires admin access" });
}

// Tenant-scoped audit logs (owners/managers) or all logs (super admin)
router.get("/", requireAuditViewer, async (req, res) => {
  try {
    const where = req.userRole === "super_admin" ? {} : { tenantId: req.tenantId };
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create audit log entry (authenticated users — tenant-scoped)
router.post("/", async (req, res) => {
  try {
    const { module, action, targetType, targetId, targetLabel, oldValue, newValue, metadata } = req.body;
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { name: true, email: true, role: true },
    });
    const tenant = req.tenantId
      ? await prisma.tenant.findUnique({ where: { id: req.tenantId }, select: { name: true } })
      : null;

    const log = await prisma.auditLog.create({
      data: {
        actorId: req.userId,
        actorName: user?.name || "Unknown",
        actorEmail: user?.email || "",
        actorRole: user?.role || req.userRole || "",
        tenantId: req.tenantId || null,
        tenantName: tenant?.name || null,
        module,
        action,
        targetType,
        targetId,
        targetLabel,
        oldValue,
        newValue,
        metadata: metadata || null,
        ipAddress: req.headers["x-forwarded-for"]?.toString()?.split(",")[0] || req.ip || null,
      },
    });
    res.status(201).json(log);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
