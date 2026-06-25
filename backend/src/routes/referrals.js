const router = require("express").Router();
const { authenticate, requirePermission, requireRole, prisma } = require("../middleware/auth");

router.use(authenticate);

function generateCode(prefix = "REF") {
  return `${prefix}-${Math.random().toString(36).toUpperCase().slice(2, 8)}`;
}

// GET /api/referrals — list all referral codes for tenant
router.get("/", requirePermission("agents", "view"), async (req, res) => {
  try {
    const codes = await prisma.referralCode.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { conversions: true } } },
    });
    res.json(codes);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/referrals — generate a new referral code
router.post("/", requirePermission("agents", "create"), async (req, res) => {
  try {
    const { ownerType, ownerId, commissionRate } = req.body;
    if (!ownerId) return res.status(400).json({ message: "ownerId is required" });

    // Prevent duplicate active codes for same owner
    const existing = await prisma.referralCode.findFirst({
      where: { tenantId: req.tenantId, ownerId, isActive: true },
    });
    if (existing) return res.json(existing);

    const prefix = ownerType === "client" ? "CLI" : "AGT";
    let code = generateCode(prefix);
    // Ensure uniqueness
    let attempts = 0;
    while (await prisma.referralCode.findFirst({ where: { tenantId: req.tenantId, code } }) && attempts < 5) {
      code = generateCode(prefix);
      attempts++;
    }

    const referral = await prisma.referralCode.create({
      data: {
        tenantId: req.tenantId,
        code,
        ownerType: ownerType || "agent",
        ownerId,
        commissionRate: parseFloat(commissionRate) || 5,
        isActive: true,
      },
    });
    res.status(201).json(referral);
  } catch (e) {
    console.error("POST /referrals error", e);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/referrals/owner/:ownerId — get codes for a specific owner
router.get("/owner/:ownerId", requirePermission("agents", "view"), async (req, res) => {
  try {
    const codes = await prisma.referralCode.findMany({
      where: { tenantId: req.tenantId, ownerId: req.params.ownerId },
      include: {
        conversions: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        _count: { select: { conversions: true } },
      },
    });
    res.json(codes);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/referrals/convert — record a referral conversion on booking
router.post("/convert", requirePermission("bookings", "create"), async (req, res) => {
  try {
    const { code, referredClientId, bookingId, commissionEarned } = req.body;
    if (!code) return res.status(400).json({ message: "code is required" });

    const referral = await prisma.referralCode.findFirst({
      where: { tenantId: req.tenantId, code, isActive: true },
    });
    if (!referral) return res.status(404).json({ message: "Referral code not found or inactive" });

    // Check for duplicate conversion on same booking
    if (bookingId) {
      const dup = await prisma.referralConversion.findFirst({ where: { referralCodeId: referral.id, bookingId } });
      if (dup) return res.json(dup);
    }

    const earned = commissionEarned !== undefined ? parseFloat(commissionEarned) : 0;

    const [conversion] = await prisma.$transaction([
      prisma.referralConversion.create({
        data: {
          referralCodeId: referral.id,
          tenantId: req.tenantId,
          referredClientId: referredClientId || null,
          bookingId: bookingId || null,
          commissionEarned: earned,
          status: "pending",
        },
      }),
      prisma.referralCode.update({
        where: { id: referral.id },
        data: { usageCount: { increment: 1 } },
      }),
    ]);

    res.status(201).json(conversion);
  } catch (e) {
    console.error("POST /referrals/convert error", e);
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH /api/referrals/conversions/:id/pay — mark conversion commission as paid
router.patch("/conversions/:id/pay", requireRole("tenant_owner", "manager"), async (req, res) => {
  try {
    const conv = await prisma.referralConversion.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!conv) return res.status(404).json({ message: "Not found" });

    const updated = await prisma.referralConversion.update({
      where: { id: req.params.id },
      data: { status: "paid", paidAt: new Date() },
    });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/referrals/summary — top referrers summary
router.get("/summary", requirePermission("agents", "view"), async (req, res) => {
  try {
    const codes = await prisma.referralCode.findMany({
      where: { tenantId: req.tenantId },
      include: {
        conversions: { select: { commissionEarned: true, status: true } },
        _count: { select: { conversions: true } },
      },
    });

    const summary = codes.map((c) => ({
      id: c.id,
      code: c.code,
      ownerType: c.ownerType,
      ownerId: c.ownerId,
      usageCount: c.usageCount,
      totalEarned: c.conversions.reduce((s, cv) => s + cv.commissionEarned, 0),
      paidEarned: c.conversions.filter((cv) => cv.status === "paid").reduce((s, cv) => s + cv.commissionEarned, 0),
      pendingEarned: c.conversions.filter((cv) => cv.status === "pending").reduce((s, cv) => s + cv.commissionEarned, 0),
      isActive: c.isActive,
    }));

    res.json(summary);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
