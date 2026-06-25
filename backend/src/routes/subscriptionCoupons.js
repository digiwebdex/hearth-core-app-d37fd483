const router = require("express").Router();
const { authenticate, requireSuperAdmin, requireRole, prisma } = require("../middleware/auth");
const { validateSubscriptionCoupon } = require("../services/subscriptionCouponService");

router.use(authenticate);

router.post("/validate", requireRole("tenant_owner"), async (req, res) => {
  try {
    const code = String(req.body.code || "").trim();
    const plan = req.body.plan || req.body.requestedPlan;
    const billingCycle = req.body.billingCycle || "monthly";
    if (!code) return res.status(400).json({ message: "Coupon code is required" });
    if (!plan) return res.status(400).json({ message: "plan is required" });

    const result = await validateSubscriptionCoupon({ code, plan, billingCycle });
    if (!result.valid) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/", requireSuperAdmin, async (_req, res) => {
  try {
    const items = await prisma.subscriptionCoupon.findMany({ orderBy: { createdAt: "desc" } });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", requireSuperAdmin, async (req, res) => {
  try {
    const code = String(req.body.code || "").trim().toUpperCase();
    const discountValue = Number(req.body.discountValue);
    if (!code) return res.status(400).json({ message: "code is required" });
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      return res.status(400).json({ message: "discountValue must be positive" });
    }

    const item = await prisma.subscriptionCoupon.create({
      data: {
        code,
        description: req.body.description ? String(req.body.description).trim() : null,
        discountType: req.body.discountType === "fixed" ? "fixed" : "percent",
        discountValue,
        maxUses: req.body.maxUses != null ? Number(req.body.maxUses) : null,
        validFrom: req.body.validFrom ? new Date(req.body.validFrom) : null,
        validUntil: req.body.validUntil ? new Date(req.body.validUntil) : null,
        applicablePlans: Array.isArray(req.body.applicablePlans)
          ? req.body.applicablePlans.map((p) => String(p).toLowerCase())
          : [],
        isActive: req.body.isActive !== false,
      },
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/:id", requireSuperAdmin, async (req, res) => {
  try {
    const existing = await prisma.subscriptionCoupon.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: "Not found" });

    const data = {};
    if (req.body.description !== undefined) data.description = req.body.description ? String(req.body.description).trim() : null;
    if (req.body.discountType !== undefined) data.discountType = req.body.discountType === "fixed" ? "fixed" : "percent";
    if (req.body.discountValue !== undefined) data.discountValue = Number(req.body.discountValue);
    if (req.body.maxUses !== undefined) data.maxUses = req.body.maxUses != null ? Number(req.body.maxUses) : null;
    if (req.body.validFrom !== undefined) data.validFrom = req.body.validFrom ? new Date(req.body.validFrom) : null;
    if (req.body.validUntil !== undefined) data.validUntil = req.body.validUntil ? new Date(req.body.validUntil) : null;
    if (req.body.applicablePlans !== undefined) {
      data.applicablePlans = Array.isArray(req.body.applicablePlans)
        ? req.body.applicablePlans.map((p) => String(p).toLowerCase())
        : [];
    }
    if (req.body.isActive !== undefined) data.isActive = Boolean(req.body.isActive);

    const item = await prisma.subscriptionCoupon.update({ where: { id: existing.id }, data });
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", requireSuperAdmin, async (req, res) => {
  try {
    const result = await prisma.subscriptionCoupon.deleteMany({ where: { id: req.params.id } });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
