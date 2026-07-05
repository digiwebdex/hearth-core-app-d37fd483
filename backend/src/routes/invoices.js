const router = require("express").Router();
const { dispatchTenantAutomation } = require("../services/tenantAutomationService");
const multer = require("multer");
const path = require("path");
const { authenticate, requirePermission, prisma } = require("../middleware/auth");
const {
  allocatePaymentToInstallments,
  ensureLedgerIncomeTransaction,
  installmentStatus,
} = require("../lib/invoiceInstallments");

const upload = multer({ dest: process.env.UPLOAD_DIR || path.join(__dirname, "../../uploads") });
router.use(authenticate);

async function getTenantInvoice(invoiceId, tenantId, include = undefined) {
  return prisma.invoice.findFirst({ where: { id: invoiceId, tenantId }, include });
}

// Only these Invoice columns are client-settable. The create/edit forms also send
// display-only fields (e.g. bookingCost, bookingProfit) that are NOT Invoice
// columns; forwarding them to Prisma throws "Unknown argument". Whitelist instead.
const INVOICE_WRITABLE_FIELDS = [
  "bookingId", "clientId", "clientName", "bookingTitle",
  "totalAmount", "paidAmount", "dueAmount", "refundedAmount",
  "status", "dueDate", "issuedDate", "notes", "cancelReason",
  "taxRuleId", "taxRate", "taxAmount", "subTotal",
];
function pickInvoiceFields(body = {}) {
  const out = {};
  for (const key of INVOICE_WRITABLE_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

async function getNextInvoiceNumber(tenantId) {
  const invoices = await prisma.invoice.findMany({
    where: { tenantId },
    select: { invoiceNumber: true },
  });
  const maxSequence = invoices.reduce((max, invoice) => {
    const match = String(invoice.invoiceNumber || "").match(/INV-(\d+)/);
    const current = match ? Number(match[1]) : 0;
    return Math.max(max, current);
  }, 0);
  return `INV-${String(maxSequence + 1).padStart(5, "0")}`;
}

router.get("/", requirePermission("invoices", "view"), async (req, res) => {
  try { res.json(await prisma.invoice.findMany({ where: { tenantId: req.tenantId }, orderBy: { createdAt: "desc" } })); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
router.get("/:id", requirePermission("invoices", "view"), async (req, res) => {
  try {
    const inv = await getTenantInvoice(req.params.id, req.tenantId);
    if (!inv) return res.status(404).json({ message: "Not found" });
    res.json(inv);
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.post("/", requirePermission("invoices", "create"), async (req, res) => {
  try {
    const invoiceNumber = await getNextInvoiceNumber(req.tenantId);
    const invoice = await prisma.invoice.create({ data: { ...pickInvoiceFields(req.body), invoiceNumber, createdBy: req.userId, tenantId: req.tenantId } });

    // Audit log — invoice create
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true, email: true, role: true } });
    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId }, select: { name: true } });
    await prisma.auditLog.create({
      data: {
        actorId: req.userId, actorName: user?.name || "", actorEmail: user?.email || "", actorRole: user?.role || "",
        tenantId: req.tenantId, tenantName: tenant?.name || null,
        module: "invoice", action: "created",
        targetType: "invoice", targetId: invoice.id, targetLabel: invoiceNumber,
        newValue: JSON.stringify({ totalAmount: invoice.totalAmount, clientId: invoice.clientId }),
      },
    }).catch(() => {});

    res.status(201).json(invoice);
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.patch("/:id", requirePermission("invoices", "edit"), async (req, res) => {
  try {
    const data = pickInvoiceFields(req.body);
    if (Object.keys(data).length === 0) return res.status(400).json({ message: "No valid invoice fields to update" });
    const result = await prisma.invoice.updateMany({ where: { id: req.params.id, tenantId: req.tenantId }, data });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json(await prisma.invoice.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } }));
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.delete("/:id", requirePermission("invoices", "delete"), async (req, res) => {
  try {
    const result = await prisma.invoice.deleteMany({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  }
  catch (err) { res.status(500).json({ message: err.message }); }
});
router.patch("/:id/status", requirePermission("invoices", "edit"), async (req, res) => {
  try {
    const old = await getTenantInvoice(req.params.id, req.tenantId);
    if (!old) return res.status(404).json({ message: "Not found" });
    await prisma.invoice.updateMany({ where: { id: req.params.id, tenantId: req.tenantId }, data: { status: req.body.status, ...(req.body.status === "cancelled" ? { cancelReason: req.body.cancelReason } : {}) } });
    await prisma.invoiceAuditEvent.create({ data: { invoiceId: req.params.id, type: "status_change", content: `Status: ${old.status} → ${req.body.status}`, oldStatus: old.status, newStatus: req.body.status, createdBy: req.userId } });
    res.json(await prisma.invoice.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } }));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Payments — with auto-create Transaction
router.get("/:id/payments", requirePermission("invoices", "view"), async (req, res) => {
  try {
    const invoice = await getTenantInvoice(req.params.id, req.tenantId);
    if (!invoice) return res.status(404).json({ message: "Not found" });
    res.json(await prisma.payment.findMany({ where: { tenantId: req.tenantId, invoiceId: req.params.id }, orderBy: { createdAt: "desc" } }));
  }
  catch (err) { res.status(500).json({ message: err.message }); }
});
router.post("/:id/payments", requirePermission("invoices", "create"), async (req, res) => {
  try {
    const inv = await getTenantInvoice(req.params.id, req.tenantId, { payments: true });
    if (!inv) return res.status(404).json({ message: "Not found" });

    const bookingId = req.body.bookingId || inv.bookingId;
    const payment = await prisma.payment.create({ data: { ...req.body, bookingId, invoiceId: req.params.id, receivedBy: req.userId, tenantId: req.tenantId } });
    const refreshedInvoice = await prisma.invoice.findUnique({ where: { id: req.params.id }, include: { payments: true } });
    const paid = refreshedInvoice.payments.reduce((s, p) => s + p.amount, 0);
    const newStatus = paid >= refreshedInvoice.totalAmount ? "paid" : paid > 0 ? "partial" : "unpaid";
    await prisma.invoice.update({ where: { id: req.params.id }, data: { paidAmount: paid, dueAmount: refreshedInvoice.totalAmount - paid, status: newStatus } });

    if (bookingId) {
      const bInvoices = await prisma.invoice.findMany({ where: { bookingId, tenantId: req.tenantId } });
      const bPaid = bInvoices.reduce((s, i) => s + i.paidAmount, 0);
      const bTotal = bInvoices.reduce((s, i) => s + i.totalAmount, 0);
      await prisma.booking.updateMany({ where: { id: bookingId, tenantId: req.tenantId }, data: { paidAmount: bPaid, dueAmount: bTotal - bPaid, paymentStatus: bPaid >= bTotal ? "paid" : bPaid > 0 ? "partial" : "unpaid" } });
    }

    // Auto-create Transaction record in ledger (idempotent)
    await ensureLedgerIncomeTransaction(prisma, {
      payment,
      invoice: refreshedInvoice,
      tenantId: req.tenantId,
      bookingId,
    });

    await allocatePaymentToInstallments(prisma, req.params.id, req.tenantId, payment.amount);

    await prisma.invoiceAuditEvent.create({ data: { invoiceId: req.params.id, type: "payment", content: `Payment of ${payment.amount} received via ${payment.method}`, amount: payment.amount, createdBy: req.userId } });

    // Audit log — invoice payment
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true, email: true, role: true } });
    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId }, select: { name: true } });
    await prisma.auditLog.create({
      data: {
        actorId: req.userId, actorName: user?.name || "", actorEmail: user?.email || "", actorRole: user?.role || "",
        tenantId: req.tenantId, tenantName: tenant?.name || null,
        module: "invoice", action: "payment_received",
        targetType: "invoice", targetId: req.params.id, targetLabel: refreshedInvoice.invoiceNumber || req.params.id,
        newValue: JSON.stringify({ amount: payment.amount, method: payment.method, paymentId: payment.id }),
      },
    }).catch(() => {});

    const client = await prisma.client.findFirst({
      where: { id: refreshedInvoice.clientId, tenantId: req.tenantId },
      select: { name: true, phone: true },
    }).catch(() => null);

    dispatchTenantAutomation("payment_received", {
      tenantId: req.tenantId,
      actorUserId: req.userId,
      payload: {
        relatedType: "payment",
        relatedId: payment.id,
        invoiceId: refreshedInvoice.id,
        invoiceNumber: refreshedInvoice.invoiceNumber,
        amount: payment.amount,
        paymentMethod: payment.method,
        balance: Math.max(0, refreshedInvoice.totalAmount - paid),
        clientName: client?.name || refreshedInvoice.clientName || "",
        clientPhone: client?.phone || "",
        tenantName: tenant?.name || "",
      },
    }).catch((err) => console.error("[automation] payment_received:", err.message));

    res.status(201).json(payment);
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.delete("/:id/payments/:payId", requirePermission("invoices", "delete"), async (req, res) => {
  try {
    const result = await prisma.payment.deleteMany({ where: { id: req.params.payId, invoiceId: req.params.id, tenantId: req.tenantId } });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  }
  catch (err) { res.status(500).json({ message: err.message }); }
});
router.post("/:id/payments/:payId/proof", requirePermission("invoices", "edit"), upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "File is required" });
    const result = await prisma.payment.updateMany({ where: { id: req.params.payId, invoiceId: req.params.id, tenantId: req.tenantId }, data: { proofUrl: `/uploads/${req.file.filename}` } });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json({ url: `/uploads/${req.file.filename}` });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Refunds
router.get("/:id/refunds", requirePermission("invoices", "view"), async (req, res) => {
  try {
    const invoice = await getTenantInvoice(req.params.id, req.tenantId);
    if (!invoice) return res.status(404).json({ message: "Not found" });
    res.json(await prisma.invoiceRefund.findMany({ where: { invoiceId: req.params.id }, orderBy: { createdAt: "desc" } }));
  }
  catch (err) { res.status(500).json({ message: err.message }); }
});
router.post("/:id/refunds", requirePermission("invoices", "approve"), async (req, res) => {
  try {
    const inv = await getTenantInvoice(req.params.id, req.tenantId, { refunds: true });
    if (!inv) return res.status(404).json({ message: "Not found" });
    const refund = await prisma.invoiceRefund.create({ data: { ...req.body, invoiceId: req.params.id, processedBy: req.userId } });
    const refunded = [...inv.refunds, refund].reduce((s, r) => s + r.amount, 0);
    await prisma.invoice.update({ where: { id: req.params.id }, data: { refundedAmount: refunded, status: refunded >= inv.totalAmount ? "refunded" : inv.status } });
    res.status(201).json(refund);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Installments
router.get("/:id/installments", requirePermission("invoices", "view"), async (req, res) => {
  try {
    const invoice = await getTenantInvoice(req.params.id, req.tenantId);
    if (!invoice) return res.status(404).json({ message: "Not found" });
    const rows = await prisma.invoiceInstallment.findMany({
      where: { invoiceId: req.params.id, tenantId: req.tenantId },
      orderBy: [{ sortOrder: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }],
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/:id/installments", requirePermission("invoices", "edit"), async (req, res) => {
  try {
    const invoice = await getTenantInvoice(req.params.id, req.tenantId);
    if (!invoice) return res.status(404).json({ message: "Not found" });

    const amount = Number(req.body.amount) || 0;
    const label = String(req.body.label || "Installment").trim();
    const dueDate = req.body.dueDate || null;
    const sortOrder = Number(req.body.sortOrder) || 0;

    const row = await prisma.invoiceInstallment.create({
      data: {
        invoiceId: req.params.id,
        label,
        amount,
        dueDate,
        sortOrder,
        paidAmount: 0,
        status: "pending",
        tenantId: req.tenantId,
      },
    });

    await prisma.invoiceAuditEvent.create({
      data: {
        invoiceId: req.params.id,
        type: "note",
        content: `Installment added: ${label} — ৳${amount}`,
        createdBy: req.userId,
      },
    }).catch(() => {});

    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/:id/installments/:instId", requirePermission("invoices", "edit"), async (req, res) => {
  try {
    const invoice = await getTenantInvoice(req.params.id, req.tenantId);
    if (!invoice) return res.status(404).json({ message: "Not found" });

    const existing = await prisma.invoiceInstallment.findFirst({
      where: { id: req.params.instId, invoiceId: req.params.id, tenantId: req.tenantId },
    });
    if (!existing) return res.status(404).json({ message: "Installment not found" });

    const amount = req.body.amount !== undefined ? Number(req.body.amount) : existing.amount;
    const paidAmount = req.body.paidAmount !== undefined ? Number(req.body.paidAmount) : existing.paidAmount;

    const row = await prisma.invoiceInstallment.update({
      where: { id: req.params.instId },
      data: {
        label: req.body.label !== undefined ? String(req.body.label) : existing.label,
        amount,
        dueDate: req.body.dueDate !== undefined ? req.body.dueDate : existing.dueDate,
        sortOrder: req.body.sortOrder !== undefined ? Number(req.body.sortOrder) : existing.sortOrder,
        paidAmount,
        status: installmentStatus(amount, paidAmount),
      },
    });
    res.json(row);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id/installments/:instId", requirePermission("invoices", "edit"), async (req, res) => {
  try {
    const result = await prisma.invoiceInstallment.deleteMany({
      where: { id: req.params.instId, invoiceId: req.params.id, tenantId: req.tenantId },
    });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Audit
router.get("/:id/audit", requirePermission("invoices", "view"), async (req, res) => {
  try {
    const invoice = await getTenantInvoice(req.params.id, req.tenantId);
    if (!invoice) return res.status(404).json({ message: "Not found" });
    res.json(await prisma.invoiceAuditEvent.findMany({ where: { invoiceId: req.params.id }, orderBy: { createdAt: "desc" } }));
  }
  catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;