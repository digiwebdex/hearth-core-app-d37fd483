// Plan API — Phase 1, Milestone 3
// (docs/v2-master/11-Architecture-Freeze.md §9, docs/v2-master/12-Implementation-Sequence.md Phase 1).
//
// Read-only. Nothing here modifies a plan or a tenant's subscription — that
// remains the job of the existing admin/subscription routes. Route order
// matters: /me must be declared before the generic /:plan.

const router = require("express").Router();
const { authenticate, prisma } = require("../middleware/auth");
const { getPlanRegistry, resolvePlan, resolveTenantPlanContext } = require("../lib/planEngine");

router.use(authenticate);

/** The full static Plan Registry — every tier's name, price, features, limits, module access. */
router.get("/", (_req, res) => {
  res.json({ plans: getPlanRegistry() });
});

/** The calling user's own tenant, fully resolved through the Tenant Plan Resolver chain. */
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
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });

    const context = await resolveTenantPlanContext({
      plan: tenant.subscriptionPlan,
      enabledModules: tenant.enabledModules,
      enabledServiceTypes: tenant.enabledServiceTypes,
      enabledSubcategories: tenant.enabledSubcategories,
      tenantId: req.tenantId,
    });
    res.json(context);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to resolve plan context" });
  }
});

/** One plan tier's static definition (accepts legacy aliases like "free"/"unlimited"). */
router.get("/:plan", (req, res) => {
  res.json(resolvePlan(req.params.plan));
});

module.exports = router;
