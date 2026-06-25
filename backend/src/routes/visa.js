const router = require("express").Router();
const { authenticate, requirePermission, prisma } = require("../middleware/auth");

router.use(authenticate);

// GET /api/visa
router.get("/", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const { status, search } = req.query;
    const where = { tenantId: req.tenantId };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { applicantName: { contains: search, mode: "insensitive" } },
        { passportNumber: { contains: search, mode: "insensitive" } },
        { destination: { contains: search, mode: "insensitive" } },
      ];
    }

    const visas = await prisma.visaApplication.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        booking: { select: { id: true, bookingNumber: true } },
      },
    });
    res.json(visas);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/visa
router.post("/", requirePermission("bookings", "create"), async (req, res) => {
  try {
    const {
      clientId, bookingId, applicantName, passportNumber, nationality,
      visaType, destination, appliedDate, appointmentDate, decisionDate,
      expiryDate, status, referenceNo, embassyFee, serviceFee, notes,
    } = req.body;

    if (!applicantName) return res.status(400).json({ message: "applicantName is required" });

    const visa = await prisma.visaApplication.create({
      data: {
        tenantId: req.tenantId,
        clientId: clientId || null,
        bookingId: bookingId || null,
        applicantName,
        passportNumber: passportNumber || null,
        nationality: nationality || null,
        visaType: visaType || null,
        destination: destination || null,
        appliedDate: appliedDate ? new Date(appliedDate) : null,
        appointmentDate: appointmentDate ? new Date(appointmentDate) : null,
        decisionDate: decisionDate ? new Date(decisionDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        status: status || "not_applied",
        referenceNo: referenceNo || null,
        embassyFee: embassyFee ? parseFloat(embassyFee) : null,
        serviceFee: serviceFee ? parseFloat(serviceFee) : null,
        notes: notes || null,
        createdBy: req.userId,
      },
    });
    res.status(201).json(visa);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/visa/:id
router.get("/:id", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const visa = await prisma.visaApplication.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        client: { select: { id: true, name: true, phone: true, email: true } },
        booking: { select: { id: true, bookingNumber: true } },
      },
    });
    if (!visa) return res.status(404).json({ message: "Not found" });
    res.json(visa);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH /api/visa/:id
router.patch("/:id", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const existing = await prisma.visaApplication.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ message: "Not found" });

    const dateFields = ["appliedDate", "appointmentDate", "decisionDate", "expiryDate"];
    const stringFields = ["applicantName", "passportNumber", "nationality", "visaType", "destination", "status", "referenceNo", "notes", "clientId", "bookingId"];
    const floatFields = ["embassyFee", "serviceFee"];

    const data = {};
    stringFields.forEach((f) => { if (req.body[f] !== undefined) data[f] = req.body[f] || null; });
    floatFields.forEach((f) => { if (req.body[f] !== undefined) data[f] = req.body[f] ? parseFloat(req.body[f]) : null; });
    dateFields.forEach((f) => { if (req.body[f] !== undefined) data[f] = req.body[f] ? new Date(req.body[f]) : null; });

    const updated = await prisma.visaApplication.update({ where: { id: req.params.id }, data });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/visa/:id
router.delete("/:id", requirePermission("bookings", "delete"), async (req, res) => {
  try {
    const existing = await prisma.visaApplication.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ message: "Not found" });
    await prisma.visaApplication.delete({ where: { id: req.params.id } });
    res.json({ message: "Deleted" });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/visa/stats/summary
router.get("/stats/summary", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const statuses = ["not_applied", "applied", "in_progress", "approved", "rejected", "collected"];
    const counts = await Promise.all(
      statuses.map((s) => prisma.visaApplication.count({ where: { tenantId: req.tenantId, status: s } }))
    );
    const result = {};
    statuses.forEach((s, i) => { result[s] = counts[i]; });
    res.json(result);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
