const router = require("express").Router();
const { authenticate, requirePermission, prisma } = require("../middleware/auth");

router.use(authenticate);

// GET /api/travel-policy/policies
router.get("/policies", requirePermission("settings", "view"), async (req, res) => {
  try {
    const policies = await prisma.travelPolicy.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { createdAt: "desc" },
    });
    res.json(policies);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/travel-policy/policies
router.post("/policies", requirePermission("settings", "edit"), async (req, res) => {
  try {
    const { name, maxFlightBudget, maxHotelPerNight, maxMealPerDay, requiresApproval, approverRole, advanceNoticeDays, allowedClasses, isActive, notes } = req.body;
    if (!name) return res.status(400).json({ message: "name is required" });

    const policy = await prisma.travelPolicy.create({
      data: {
        tenantId: req.tenantId,
        name,
        maxFlightBudget: maxFlightBudget ? parseFloat(maxFlightBudget) : null,
        maxHotelPerNight: maxHotelPerNight ? parseFloat(maxHotelPerNight) : null,
        maxMealPerDay: maxMealPerDay ? parseFloat(maxMealPerDay) : null,
        requiresApproval: requiresApproval !== false,
        approverRole: approverRole || "manager",
        advanceNoticeDays: parseInt(advanceNoticeDays) || 3,
        allowedClasses: Array.isArray(allowedClasses) ? allowedClasses : [],
        isActive: isActive !== false,
        notes: notes || null,
      },
    });
    res.status(201).json(policy);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH /api/travel-policy/policies/:id
router.patch("/policies/:id", requirePermission("settings", "edit"), async (req, res) => {
  try {
    const existing = await prisma.travelPolicy.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ message: "Not found" });

    const data = {};
    const fields = ["name", "approverRole", "notes"];
    fields.forEach((f) => { if (req.body[f] !== undefined) data[f] = req.body[f]; });
    ["maxFlightBudget", "maxHotelPerNight", "maxMealPerDay"].forEach((f) => {
      if (req.body[f] !== undefined) data[f] = req.body[f] ? parseFloat(req.body[f]) : null;
    });
    if (req.body.requiresApproval !== undefined) data.requiresApproval = req.body.requiresApproval;
    if (req.body.isActive !== undefined) data.isActive = req.body.isActive;
    if (req.body.advanceNoticeDays !== undefined) data.advanceNoticeDays = parseInt(req.body.advanceNoticeDays);
    if (req.body.allowedClasses !== undefined) data.allowedClasses = req.body.allowedClasses;

    const updated = await prisma.travelPolicy.update({ where: { id: req.params.id }, data });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/travel-policy/policies/:id
router.delete("/policies/:id", requirePermission("settings", "edit"), async (req, res) => {
  try {
    const existing = await prisma.travelPolicy.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ message: "Not found" });
    await prisma.travelPolicy.delete({ where: { id: req.params.id } });
    res.json({ message: "Deleted" });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// ─── Approval Requests ────────────────────────────────────────────────────────

// GET /api/travel-policy/approvals
router.get("/approvals", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const { status } = req.query;
    const where = { tenantId: req.tenantId };
    if (status) where.status = status;

    const approvals = await prisma.travelApprovalRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { policy: { select: { id: true, name: true } } },
    });
    res.json(approvals);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/travel-policy/approvals
router.post("/approvals", requirePermission("bookings", "create"), async (req, res) => {
  try {
    const { policyId, destination, travelDate, returnDate, purpose, estimatedCost, bookingId } = req.body;

    const approval = await prisma.travelApprovalRequest.create({
      data: {
        tenantId: req.tenantId,
        requestedBy: req.userId,
        policyId: policyId || null,
        destination: destination || null,
        travelDate: travelDate ? new Date(travelDate) : null,
        returnDate: returnDate ? new Date(returnDate) : null,
        purpose: purpose || null,
        estimatedCost: estimatedCost ? parseFloat(estimatedCost) : null,
        bookingId: bookingId || null,
      },
    });
    res.status(201).json(approval);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH /api/travel-policy/approvals/:id — approve or reject
router.patch("/approvals/:id", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const existing = await prisma.travelApprovalRequest.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ message: "Not found" });

    const { status, rejectionNote } = req.body;
    const data = {};
    if (status) {
      data.status = status;
      if (status === "approved" || status === "rejected") data.approvedBy = req.userId;
    }
    if (rejectionNote !== undefined) data.rejectionNote = rejectionNote;

    const updated = await prisma.travelApprovalRequest.update({ where: { id: req.params.id }, data });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
