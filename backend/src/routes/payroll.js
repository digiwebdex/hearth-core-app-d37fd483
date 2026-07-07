const router = require("express").Router();
const { authenticate, requirePermission, requireRole, requireFeature, prisma } = require("../middleware/auth");

router.use(authenticate);
// Payroll is a Business-tier platform capability (moduleAccess floor). Active trials pass.
router.use(requireFeature("hasHrPayroll"));

// GET /api/payroll/salary-structures — list all salary structures for tenant
router.get("/salary-structures", requirePermission("team", "view"), async (req, res) => {
  try {
    const structures = await prisma.salaryStructure.findMany({
      where: { tenantId: req.tenantId },
      include: { staffProfile: { include: { user: { select: { id: true, name: true, email: true } } } } },
    });
    res.json(structures);
  } catch (e) {
    console.error("GET /payroll/salary-structures error", e);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/payroll/salary-structures/:staffProfileId
router.get("/salary-structures/:staffProfileId", requirePermission("team", "view"), async (req, res) => {
  try {
    const structure = await prisma.salaryStructure.findFirst({
      where: { staffProfileId: req.params.staffProfileId, tenantId: req.tenantId },
    });
    res.json(structure || null);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/payroll/salary-structures/:staffProfileId — upsert salary structure
router.put("/salary-structures/:staffProfileId", requireRole("tenant_owner", "manager"), async (req, res) => {
  try {
    const { staffProfileId } = req.params;
    const { basicSalary, houseAllowance, transportAllowance, medicalAllowance, otherAllowance,
      taxDeduction, providentFund, otherDeduction, currency, effectiveFrom, notes } = req.body;

    const staff = await prisma.staffProfile.findFirst({
      where: { id: staffProfileId, tenantId: req.tenantId },
    });
    if (!staff) return res.status(404).json({ message: "Staff profile not found" });

    const structure = await prisma.salaryStructure.upsert({
      where: { staffProfileId },
      update: {
        basicSalary: parseFloat(basicSalary) || 0,
        houseAllowance: parseFloat(houseAllowance) || 0,
        transportAllowance: parseFloat(transportAllowance) || 0,
        medicalAllowance: parseFloat(medicalAllowance) || 0,
        otherAllowance: parseFloat(otherAllowance) || 0,
        taxDeduction: parseFloat(taxDeduction) || 0,
        providentFund: parseFloat(providentFund) || 0,
        otherDeduction: parseFloat(otherDeduction) || 0,
        currency: currency || "BDT",
        effectiveFrom: effectiveFrom || null,
        notes: notes || null,
      },
      create: {
        staffProfileId,
        tenantId: req.tenantId,
        basicSalary: parseFloat(basicSalary) || 0,
        houseAllowance: parseFloat(houseAllowance) || 0,
        transportAllowance: parseFloat(transportAllowance) || 0,
        medicalAllowance: parseFloat(medicalAllowance) || 0,
        otherAllowance: parseFloat(otherAllowance) || 0,
        taxDeduction: parseFloat(taxDeduction) || 0,
        providentFund: parseFloat(providentFund) || 0,
        otherDeduction: parseFloat(otherDeduction) || 0,
        currency: currency || "BDT",
        effectiveFrom: effectiveFrom || null,
        notes: notes || null,
      },
    });
    res.json(structure);
  } catch (e) {
    console.error("PUT /payroll/salary-structures/:id error", e);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/payroll/runs — list payroll runs
router.get("/runs", requirePermission("team", "view"), async (req, res) => {
  try {
    const runs = await prisma.payrollRun.findMany({
      where: { tenantId: req.tenantId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      include: { _count: { select: { payslips: true } } },
    });
    res.json(runs);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/payroll/runs — generate payroll for a month
router.post("/runs", requireRole("tenant_owner", "manager"), async (req, res) => {
  try {
    const { month, year, notes } = req.body;
    if (!month || !year) return res.status(400).json({ message: "month and year are required" });
    // PayrollRun.month is a String column; coerce to a zero-padded string so a numeric
    // month from an API client doesn't trip a Prisma type error (500), and so the
    // @@unique([tenantId, month, year]) dedup below matches the stored format.
    const monthStr = String(month).padStart(2, "0");

    const existing = await prisma.payrollRun.findFirst({
      where: { tenantId: req.tenantId, month: monthStr, year: parseInt(year) },
    });
    if (existing) return res.status(409).json({ message: "Payroll run already exists for this month/year" });

    // Fetch all active staff with salary structures
    const staffProfiles = await prisma.staffProfile.findMany({
      where: { tenantId: req.tenantId },
      include: {
        user: { select: { id: true, name: true, status: true } },
        salaryStructure: true,
      },
    });

    const activeStaff = staffProfiles.filter(
      (s) => s.user.status === "active" && s.salaryStructure,
    );

    if (activeStaff.length === 0) {
      return res.status(400).json({ message: "No active staff with salary structures found" });
    }

    // Get attendance for the month
    const attendanceRecords = await prisma.staffAttendance.findMany({
      where: {
        tenantId: req.tenantId,
        date: { startsWith: `${year}-${String(month).padStart(2, "0")}` },
      },
    });

    const attendanceByUser = attendanceRecords.reduce((acc, a) => {
      if (!acc[a.userId]) acc[a.userId] = { present: 0, absent: 0, leave: 0 };
      if (a.status === "present") acc[a.userId].present++;
      else if (a.status === "absent") acc[a.userId].absent++;
      else if (a.status === "leave") acc[a.userId].leave++;
      return acc;
    }, {});

    // Build payslip entries
    let totalAmount = 0;
    const payslipData = activeStaff.map((staff) => {
      const sal = staff.salaryStructure;
      const att = attendanceByUser[staff.userId] || { present: 0, absent: 0, leave: 0 };

      const grossSalary = sal.basicSalary + sal.houseAllowance + sal.transportAllowance +
        sal.medicalAllowance + sal.otherAllowance;
      const totalDeductions = sal.taxDeduction + sal.providentFund + sal.otherDeduction;
      const netSalary = grossSalary - totalDeductions;

      totalAmount += netSalary;

      return {
        staffProfileId: staff.id,
        tenantId: req.tenantId,
        staffName: staff.user.name,
        basicSalary: sal.basicSalary,
        houseAllowance: sal.houseAllowance,
        transportAllowance: sal.transportAllowance,
        medicalAllowance: sal.medicalAllowance,
        otherAllowance: sal.otherAllowance,
        grossSalary,
        taxDeduction: sal.taxDeduction,
        providentFund: sal.providentFund,
        otherDeduction: sal.otherDeduction,
        totalDeductions,
        netSalary,
        presentDays: att.present,
        absentDays: att.absent,
        leaveDays: att.leave,
        status: "pending",
      };
    });

    const run = await prisma.payrollRun.create({
      data: {
        tenantId: req.tenantId,
        month: monthStr,
        year: parseInt(year),
        status: "draft",
        totalAmount,
        notes: notes || null,
        payslips: { create: payslipData },
      },
      include: { payslips: true },
    });

    res.status(201).json(run);
  } catch (e) {
    console.error("POST /payroll/runs error", e);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/payroll/runs/:id — get payroll run with payslips
router.get("/runs/:id", requirePermission("team", "view"), async (req, res) => {
  try {
    const run = await prisma.payrollRun.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        payslips: {
          include: { staffProfile: { include: { user: { select: { name: true, email: true } } } } },
          orderBy: { staffName: "asc" },
        },
      },
    });
    if (!run) return res.status(404).json({ message: "Payroll run not found" });
    res.json(run);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH /api/payroll/runs/:id — approve or finalize
router.patch("/runs/:id", requireRole("tenant_owner", "manager"), async (req, res) => {
  try {
    const { status } = req.body;
    const run = await prisma.payrollRun.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!run) return res.status(404).json({ message: "Payroll run not found" });

    const updated = await prisma.payrollRun.update({
      where: { id: req.params.id },
      data: {
        status,
        ...(status === "approved" ? { processedBy: req.userId, processedAt: new Date() } : {}),
      },
    });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH /api/payroll/payslips/:id/pay — mark individual payslip as paid
router.patch("/payslips/:id/pay", requireRole("tenant_owner", "manager"), async (req, res) => {
  try {
    const { paymentMethod, paymentReference } = req.body;
    const payslip = await prisma.payslipEntry.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!payslip) return res.status(404).json({ message: "Payslip not found" });

    const updated = await prisma.payslipEntry.update({
      where: { id: req.params.id },
      data: { status: "paid", paidAt: new Date(), paymentMethod, paymentReference },
    });

    // Update paidCount on run
    const paidCount = await prisma.payslipEntry.count({
      where: { payrollRunId: payslip.payrollRunId, status: "paid" },
    });
    await prisma.payrollRun.update({
      where: { id: payslip.payrollRunId },
      data: { paidCount },
    });

    res.json(updated);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
