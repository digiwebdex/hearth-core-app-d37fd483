const router = require("express").Router();
const { authenticate, requirePermission, checkPlanLimit, prisma } = require("../middleware/auth");
const { enrichQuotationFromPackage } = require("../services/packageLinkage");

router.use(authenticate);

router.get("/", requirePermission("quotations", "view"), async (req, res) => {
  try { res.json(await prisma.quotation.findMany({ where: { tenantId: req.tenantId }, orderBy: { createdAt: "desc" } })); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
router.get("/:id", requirePermission("quotations", "view"), async (req, res) => {
  try {
    const q = await prisma.quotation.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!q) return res.status(404).json({ message: "Not found" });
    res.json(q);
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.post("/", requirePermission("quotations", "create"), checkPlanLimit("quotations"), async (req, res) => {
  try {
    const data = await enrichQuotationFromPackage(req.body, req.tenantId);
    res.status(201).json(await prisma.quotation.create({ data: { ...data, createdBy: req.userId, tenantId: req.tenantId } }));
  }
  catch (err) { res.status(400).json({ message: err.message }); }
});
router.patch("/:id", requirePermission("quotations", "edit"), async (req, res) => {
  try {
    const result = await prisma.quotation.updateMany({ where: { id: req.params.id, tenantId: req.tenantId }, data: req.body });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json(await prisma.quotation.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } }));
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.delete("/:id", requirePermission("quotations", "delete"), async (req, res) => {
  try {
    const result = await prisma.quotation.deleteMany({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  }
  catch (err) { res.status(500).json({ message: err.message }); }
});
router.patch("/:id/status", requirePermission("quotations", "edit"), async (req, res) => {
  try {
    const result = await prisma.quotation.updateMany({ where: { id: req.params.id, tenantId: req.tenantId }, data: { status: req.body.status } });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json(await prisma.quotation.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } }));
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.get("/:id/versions", requirePermission("quotations", "view"), async (req, res) => {
  try {
    const quotation = await prisma.quotation.findFirst({ where: { id: req.params.id, tenantId: req.tenantId }, select: { id: true } });
    if (!quotation) return res.status(404).json({ message: "Not found" });
    res.json(await prisma.quotationVersion.findMany({ where: { quotationId: req.params.id }, orderBy: { versionNumber: "desc" } }));
  }
  catch (err) { res.status(500).json({ message: err.message }); }
});
router.post("/:id/duplicate", requirePermission("quotations", "create"), async (req, res) => {
  try {
    const orig = await prisma.quotation.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!orig) return res.status(404).json({ message: "Not found" });
    const { id, createdAt, updatedAt, ...data } = orig;
    const dup = await prisma.quotation.create({ data: { ...data, title: `${data.title} (Copy)`, status: "draft", version: 1, createdBy: req.userId, tenantId: req.tenantId } });
    res.status(201).json(dup);
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.post("/:id/convert-to-booking", requirePermission("quotations", "approve"), async (req, res) => {
  try {
    const q = await prisma.quotation.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!q) return res.status(404).json({ message: "Not found" });
    if (!q.clientId) return res.status(400).json({ message: "Client is required before converting quotation to booking" });
    const booking = await prisma.booking.create({
      data: {
        title: q.title,
        clientId: q.clientId,
        quotationId: q.id,
        packageId: q.packageId || undefined,
        serviceType: q.serviceType || undefined,
        packageTitleSnapshot: q.packageTitleSnapshot || undefined,
        packageCodeSnapshot: q.packageCodeSnapshot || undefined,
        destination: q.destination,
        travelDateFrom: q.travelDateFrom,
        travelDateTo: q.travelDateTo,
        travelerCount: q.travelerCount,
        amount: q.grandTotal,
        cost: q.totalCost,
        profit: q.totalProfit,
        paidAmount: 0,
        dueAmount: q.grandTotal,
        paymentStatus: "unpaid",
        status: "pending",
        tenantId: req.tenantId,
      },
    });
    await prisma.quotation.update({ where: { id: q.id }, data: { status: "approved" } });
    res.status(201).json(booking);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
