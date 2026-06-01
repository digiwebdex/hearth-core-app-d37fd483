const router = require("express").Router();
const { authenticate, requirePermission, prisma } = require("../middleware/auth");

router.use(authenticate);

async function getTenantVendor(vendorId, tenantId) {
  return prisma.vendor.findFirst({ where: { id: vendorId, tenantId } });
}

async function hydrateVendorBills(bills = []) {
  const bookingIds = [...new Set(bills.map((bill) => bill.bookingId).filter(Boolean))];
  const bookings = bookingIds.length
    ? await prisma.booking.findMany({ where: { id: { in: bookingIds } }, select: { id: true, title: true, destination: true } })
    : [];
  const bookingMap = new Map(bookings.map((booking) => [booking.id, booking]));

  return bills.map((bill) => ({
    ...bill,
    vendorName: bill.vendor?.name || bill.vendorName || "",
    bookingTitle: bill.bookingTitle || bookingMap.get(bill.bookingId)?.title || bookingMap.get(bill.bookingId)?.destination || "",
  }));
}

async function syncVendorBillPaymentTransaction({ tenantId, payment, bill }) {
  const description = `Vendor payment to ${bill.vendor?.name || "vendor"} for ${bill.description}`;
  const existing = await prisma.transaction.findFirst({
    where: { tenantId, referenceType: "vendor_bill_payment", referenceId: payment.id },
  });

  const payload = {
    type: "expense",
    category: "vendor_payment",
    description,
    amount: payment.amount,
    referenceId: payment.id,
    referenceType: "vendor_bill_payment",
    vendorId: bill.vendorId,
    bookingId: bill.bookingId || null,
    paymentMethod: payment.method,
    status: "completed",
    date: payment.date,
    tenantId,
  };

  if (existing) {
    await prisma.transaction.update({ where: { id: existing.id }, data: payload }).catch(() => {});
  } else {
    await prisma.transaction.create({ data: payload }).catch(() => {});
  }
}

// CRUD
router.get("/", requirePermission("vendors", "view"), async (req, res) => {
  try { res.json(await prisma.vendor.findMany({ where: { tenantId: req.tenantId }, orderBy: { createdAt: "desc" } })); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
router.get("/reports/payables", requirePermission("vendors", "view"), async (req, res) => {
  try {
    const bills = await prisma.vendorBill.findMany({
      where: { tenantId: req.tenantId, status: { in: ["unpaid", "partial", "overdue"] } },
      include: { vendor: { select: { id: true, name: true } }, payments: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(await hydrateVendorBills(bills));
  }
  catch (err) { res.status(500).json({ message: err.message }); }
});
router.get("/:id", requirePermission("vendors", "view"), async (req, res) => {
  try {
    const v = await getTenantVendor(req.params.id, req.tenantId);
    if (!v) return res.status(404).json({ message: "Not found" });
    res.json(v);
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.post("/", requirePermission("vendors", "create"), async (req, res) => {
  try { res.status(201).json(await prisma.vendor.create({ data: { ...req.body, tenantId: req.tenantId } })); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
router.patch("/:id", requirePermission("vendors", "edit"), async (req, res) => {
  try {
    const result = await prisma.vendor.updateMany({ where: { id: req.params.id, tenantId: req.tenantId }, data: req.body });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json(await prisma.vendor.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } }));
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.delete("/:id", requirePermission("vendors", "delete"), async (req, res) => {
  try {
    const result = await prisma.vendor.deleteMany({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  }
  catch (err) { res.status(500).json({ message: err.message }); }
});

// Bills
router.get("/:id/bills", requirePermission("vendors", "view"), async (req, res) => {
  try {
    const vendor = await getTenantVendor(req.params.id, req.tenantId);
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });
    const bills = await prisma.vendorBill.findMany({
      where: { vendorId: req.params.id, tenantId: req.tenantId },
      include: { payments: true, vendor: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(await hydrateVendorBills(bills));
  }
  catch (err) { res.status(500).json({ message: err.message }); }
});
router.post("/:id/bills", requirePermission("vendors", "create"), async (req, res) => {
  try {
    const vendor = await getTenantVendor(req.params.id, req.tenantId);
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });
    const bill = await prisma.vendorBill.create({ data: { ...req.body, vendorId: req.params.id, tenantId: req.tenantId } });
    const hydrated = await prisma.vendorBill.findFirst({ where: { id: bill.id, tenantId: req.tenantId }, include: { payments: true, vendor: { select: { id: true, name: true } } } });
    res.status(201).json((await hydrateVendorBills([hydrated]))[0]);
  }
  catch (err) { res.status(500).json({ message: err.message }); }
});
router.patch("/:id/bills/:billId", requirePermission("vendors", "edit"), async (req, res) => {
  try {
    const vendor = await getTenantVendor(req.params.id, req.tenantId);
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });
    const result = await prisma.vendorBill.updateMany({ where: { id: req.params.billId, vendorId: req.params.id, tenantId: req.tenantId }, data: req.body });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    const bill = await prisma.vendorBill.findFirst({ where: { id: req.params.billId, tenantId: req.tenantId }, include: { payments: true, vendor: { select: { id: true, name: true } } } });
    res.json((await hydrateVendorBills([bill]))[0]);
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.delete("/:id/bills/:billId", requirePermission("vendors", "delete"), async (req, res) => {
  try {
    const result = await prisma.vendorBill.deleteMany({ where: { id: req.params.billId, vendorId: req.params.id, tenantId: req.tenantId } });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  }
  catch (err) { res.status(500).json({ message: err.message }); }
});
router.post("/:id/bills/:billId/payments", requirePermission("vendors", "edit"), async (req, res) => {
  try {
    const bill = await prisma.vendorBill.findFirst({
      where: { id: req.params.billId, vendorId: req.params.id, tenantId: req.tenantId },
      include: { payments: true, vendor: { select: { id: true, name: true } } },
    });
    if (!bill) return res.status(404).json({ message: "Bill not found" });

    const payment = await prisma.vendorBillPayment.create({ data: { ...req.body, billId: req.params.billId, paidBy: req.userId } });
    const paid = [...bill.payments, payment].reduce((s, p) => s + p.amount, 0);
    await prisma.vendorBill.update({ where: { id: req.params.billId }, data: { paidAmount: paid, dueAmount: bill.totalAmount - paid, status: paid >= bill.totalAmount ? "paid" : paid > 0 ? "partial" : "unpaid" } });
    await syncVendorBillPaymentTransaction({ tenantId: req.tenantId, payment, bill });
    res.status(201).json(payment);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Notes
router.get("/:id/notes", requirePermission("vendors", "view"), async (req, res) => {
  try {
    const vendor = await getTenantVendor(req.params.id, req.tenantId);
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });
    res.json(await prisma.vendorNote.findMany({ where: { vendorId: req.params.id }, orderBy: { createdAt: "desc" } }));
  }
  catch (err) { res.status(500).json({ message: err.message }); }
});
router.post("/:id/notes", requirePermission("vendors", "edit"), async (req, res) => {
  try {
    const vendor = await getTenantVendor(req.params.id, req.tenantId);
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });
    res.status(201).json(await prisma.vendorNote.create({ data: { ...req.body, vendorId: req.params.id, createdBy: req.userId } }));
  }
  catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;