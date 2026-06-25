const router = require("express").Router();
const { authenticate, requirePermission, requireRole, prisma } = require("../middleware/auth");

router.use(authenticate);

// ── Loyalty Rules (one per tenant) ──

router.get("/rules", requirePermission("settings", "view"), async (req, res) => {
  try {
    const rule = await prisma.loyaltyRule.findUnique({ where: { tenantId: req.tenantId } });
    res.json(rule || null);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/rules", requireRole("tenant_owner", "manager"), async (req, res) => {
  try {
    const { pointsPerUnit, unitAmount, redemptionValue, expiryDays,
      silverThreshold, goldThreshold, platinumThreshold, isActive } = req.body;

    const rule = await prisma.loyaltyRule.upsert({
      where: { tenantId: req.tenantId },
      update: {
        pointsPerUnit: parseFloat(pointsPerUnit) || 1,
        unitAmount: parseFloat(unitAmount) || 100,
        redemptionValue: parseFloat(redemptionValue) || 1,
        expiryDays: parseInt(expiryDays) || 365,
        silverThreshold: parseInt(silverThreshold) || 1000,
        goldThreshold: parseInt(goldThreshold) || 5000,
        platinumThreshold: parseInt(platinumThreshold) || 15000,
        isActive: isActive !== false,
      },
      create: {
        tenantId: req.tenantId,
        pointsPerUnit: parseFloat(pointsPerUnit) || 1,
        unitAmount: parseFloat(unitAmount) || 100,
        redemptionValue: parseFloat(redemptionValue) || 1,
        expiryDays: parseInt(expiryDays) || 365,
        silverThreshold: parseInt(silverThreshold) || 1000,
        goldThreshold: parseInt(goldThreshold) || 5000,
        platinumThreshold: parseInt(platinumThreshold) || 15000,
        isActive: isActive !== false,
      },
    });
    res.json(rule);
  } catch (e) {
    console.error("PUT /loyalty/rules error", e);
    res.status(500).json({ message: "Server error" });
  }
});

// ── Loyalty Account for a client ──

async function getOrCreateAccount(clientId, tenantId) {
  let account = await prisma.loyaltyAccount.findUnique({ where: { clientId } });
  if (!account) {
    account = await prisma.loyaltyAccount.create({
      data: { clientId, tenantId, totalPoints: 0, usedPoints: 0, expiredPoints: 0, tier: "standard" },
    });
  }
  return account;
}

function computeTier(totalPoints, rule) {
  if (!rule) return "standard";
  if (totalPoints >= rule.platinumThreshold) return "platinum";
  if (totalPoints >= rule.goldThreshold) return "gold";
  if (totalPoints >= rule.silverThreshold) return "silver";
  return "standard";
}

router.get("/accounts/:clientId", requirePermission("clients", "view"), async (req, res) => {
  try {
    const client = await prisma.client.findFirst({ where: { id: req.params.clientId, tenantId: req.tenantId } });
    if (!client) return res.status(404).json({ message: "Client not found" });

    const account = await getOrCreateAccount(req.params.clientId, req.tenantId);
    const transactions = await prisma.loyaltyTransaction.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const rule = await prisma.loyaltyRule.findUnique({ where: { tenantId: req.tenantId } });
    const availablePoints = account.totalPoints - account.usedPoints;

    res.json({ ...account, availablePoints, transactions, rule });
  } catch (e) {
    console.error("GET /loyalty/accounts/:clientId error", e);
    res.status(500).json({ message: "Server error" });
  }
});

// Award points manually
router.post("/accounts/:clientId/award", requireRole("tenant_owner", "manager"), async (req, res) => {
  try {
    const { points, description, referenceId, referenceType } = req.body;
    if (!points || points <= 0) return res.status(400).json({ message: "points must be positive" });

    const client = await prisma.client.findFirst({ where: { id: req.params.clientId, tenantId: req.tenantId } });
    if (!client) return res.status(404).json({ message: "Client not found" });

    const account = await getOrCreateAccount(req.params.clientId, req.tenantId);
    const rule = await prisma.loyaltyRule.findUnique({ where: { tenantId: req.tenantId } });

    const expiresAt = rule ? new Date(Date.now() + rule.expiryDays * 86400000) : null;

    await prisma.$transaction([
      prisma.loyaltyTransaction.create({
        data: {
          accountId: account.id,
          tenantId: req.tenantId,
          type: "earned",
          points,
          description: description || "Manual award",
          referenceId: referenceId || null,
          referenceType: referenceType || null,
          expiresAt,
        },
      }),
      prisma.loyaltyAccount.update({
        where: { id: account.id },
        data: {
          totalPoints: { increment: points },
          tier: computeTier(account.totalPoints + points, rule),
        },
      }),
    ]);

    res.json({ success: true, pointsAwarded: points });
  } catch (e) {
    console.error("POST /loyalty/accounts/:clientId/award error", e);
    res.status(500).json({ message: "Server error" });
  }
});

// Redeem points (apply as invoice discount)
router.post("/accounts/:clientId/redeem", requireRole("tenant_owner", "manager"), async (req, res) => {
  try {
    const { points, invoiceId } = req.body;
    if (!points || points <= 0) return res.status(400).json({ message: "points must be positive" });

    const client = await prisma.client.findFirst({ where: { id: req.params.clientId, tenantId: req.tenantId } });
    if (!client) return res.status(404).json({ message: "Client not found" });

    const account = await getOrCreateAccount(req.params.clientId, req.tenantId);
    const available = account.totalPoints - account.usedPoints;
    if (points > available) return res.status(400).json({ message: `Only ${available} points available` });

    const rule = await prisma.loyaltyRule.findUnique({ where: { tenantId: req.tenantId } });
    const discountAmount = rule ? points * rule.redemptionValue : points;

    await prisma.$transaction([
      prisma.loyaltyTransaction.create({
        data: {
          accountId: account.id,
          tenantId: req.tenantId,
          type: "redeemed",
          points: -points,
          description: `Redeemed for invoice discount`,
          referenceId: invoiceId || null,
          referenceType: invoiceId ? "invoice" : null,
        },
      }),
      prisma.loyaltyAccount.update({
        where: { id: account.id },
        data: { usedPoints: { increment: points } },
      }),
    ]);

    res.json({ success: true, pointsRedeemed: points, discountAmount });
  } catch (e) {
    console.error("POST /loyalty/accounts/:clientId/redeem error", e);
    res.status(500).json({ message: "Server error" });
  }
});

// Auto-award on payment (called internally from invoice payment endpoint)
router.post("/award-on-payment", requirePermission("invoices", "edit"), async (req, res) => {
  try {
    const { clientId, paymentAmount, invoiceId } = req.body;
    if (!clientId || !paymentAmount) return res.status(400).json({ message: "clientId and paymentAmount required" });

    const rule = await prisma.loyaltyRule.findUnique({ where: { tenantId: req.tenantId } });
    if (!rule || !rule.isActive) return res.json({ skipped: true, reason: "loyalty program not active" });

    const points = Math.floor((paymentAmount / rule.unitAmount) * rule.pointsPerUnit);
    if (points <= 0) return res.json({ skipped: true, reason: "payment too small to earn points" });

    const client = await prisma.client.findFirst({ where: { id: clientId, tenantId: req.tenantId } });
    if (!client) return res.status(404).json({ message: "Client not found" });

    const account = await getOrCreateAccount(clientId, req.tenantId);
    const expiresAt = new Date(Date.now() + rule.expiryDays * 86400000);

    await prisma.$transaction([
      prisma.loyaltyTransaction.create({
        data: {
          accountId: account.id,
          tenantId: req.tenantId,
          type: "earned",
          points,
          description: `Earned from payment of ৳${paymentAmount}`,
          referenceId: invoiceId || null,
          referenceType: "invoice",
          expiresAt,
        },
      }),
      prisma.loyaltyAccount.update({
        where: { id: account.id },
        data: {
          totalPoints: { increment: points },
          tier: computeTier(account.totalPoints + points, rule),
        },
      }),
    ]);

    res.json({ success: true, pointsAwarded: points });
  } catch (e) {
    console.error("POST /loyalty/award-on-payment error", e);
    res.status(500).json({ message: "Server error" });
  }
});

// Leaderboard — top loyal clients
router.get("/leaderboard", requirePermission("clients", "view"), async (req, res) => {
  try {
    const accounts = await prisma.loyaltyAccount.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { totalPoints: "desc" },
      take: 20,
      include: { client: { select: { id: true, name: true, phone: true, email: true } } },
    });
    res.json(accounts);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
