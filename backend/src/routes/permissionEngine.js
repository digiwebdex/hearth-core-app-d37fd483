// Permission API — Phase 1, Milestone 4
// (docs/v2-master/11-Architecture-Freeze.md §8, docs/v2-master/12-Implementation-Sequence.md Phase 1).
//
// Read-only. Nothing here modifies a permission or a role — that remains
// requirePermission()/requireRole() in auth.js, unchanged. There is no
// permission-management UI or write endpoint in this milestone. Route order
// matters: /me and /roles must be declared before the generic /roles/:role.

const router = require("express").Router();
const { authenticate, prisma } = require("../middleware/auth");
const {
  ROLE_REGISTRY,
  MODULES,
  ACTIONS,
  resolveRole,
  getPermissionSet,
  resolveUserPermissionContext,
} = require("../lib/permissionEngine");

router.use(authenticate);

/** The full Permission Registry: known modules, actions, and named roles. */
router.get("/", (_req, res) => {
  res.json({ modules: MODULES, actions: ACTIONS, roles: ROLE_REGISTRY });
});

/** The calling user's own Final Permission Context (role -> permissions -> module access -> plan/flags). */
router.get("/me", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: {
        subscriptionPlan: true,
        enabledModules: true,
        enabledServiceTypes: true,
        enabledSubcategories: true,
      },
    });

    const context = await resolveUserPermissionContext({
      role: req.userRole,
      tenantId: req.tenantId,
      plan: tenant?.subscriptionPlan,
      enabledModules: tenant?.enabledModules,
      enabledServiceTypes: tenant?.enabledServiceTypes,
      enabledSubcategories: tenant?.enabledSubcategories,
    });
    res.json(context);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to resolve permission context" });
  }
});

/** One role's resolved descriptor + its permission set (accepts canonical, legacy, or named role keys). */
router.get("/roles/:role", (req, res) => {
  const resolved = resolveRole(req.params.role);
  res.json({
    ...resolved,
    permissions: resolved.canonicalRole ? getPermissionSet(resolved.canonicalRole) : {},
  });
});

module.exports = router;
