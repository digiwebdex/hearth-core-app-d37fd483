// Navigation API — Phase 1, Milestone 6
// (docs/v2-master/11-Architecture-Freeze.md §6, docs/v2-master/12-Implementation-Sequence.md Phase 1).
//
// Read-only. No write endpoint exists. GET /api/registry (Milestone 1)
// already serves the raw, unfiltered Module Registry — this route is
// deliberately not repeated here; the one new thing this milestone adds is
// the fully-resolved, per-user Final Sidebar Context.

const router = require("express").Router();
const { authenticate, prisma } = require("../middleware/auth");
const { resolveNavigationContext } = require("../lib/sidebarEngine");

router.use(authenticate);

/** The calling user's own Final Sidebar Context — visible nav groups/items, role, plan, flags. */
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

    const context = await resolveNavigationContext({
      role: req.userRole,
      tenantId: req.tenantId,
      plan: tenant?.subscriptionPlan,
      enabledModules: tenant?.enabledModules,
      enabledServiceTypes: tenant?.enabledServiceTypes,
      enabledSubcategories: tenant?.enabledSubcategories,
    });
    res.json(context);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to resolve navigation context" });
  }
});

module.exports = router;
