// Finance Core API — a read/composition layer over the existing single-entry
// accounting models, plus one legitimate write (manual journal adjustment).
// (docs/v2-master/11-Architecture-Freeze.md §5/§10/§11, docs/v2-master/12-Implementation-Sequence.md Phase 5).
//
// Mounted at /api/finance-core. Additive — the existing /api/accounts,
// /api/finance, /api/expenses, /api/invoices, /api/vendors routes are all
// unchanged, and every money mutation still originates there (invoice
// payments, expenses, vendor bill payments). This route does NOT create a
// second way to record a customer or supplier payment; those views are
// read-only and reflect what the existing flows already posted. The only
// write here is a MANUAL single-entry journal adjustment (opening balances,
// corrections) — a genuine gap the automated flows don't cover.
//
// Reuse (no duplicated logic):
//   - CRM Customer Engine / Supplier Engine for the ledger headers.
//   - accountLedger.js hydrateLedgerTransactions for name enrichment.
//   - financeCore.js pure helpers for every calculation.
//   - Status Engine for invoice status context on receivables.
//   - Permission Engine via requirePermission("accounts", ...).
// Booking Pricing Library and Booking Identity are intentionally not used
// here: they operate at booking-creation time, upstream of the ledger;
// Finance Core reads already-posted amounts, so invoking them would be
// contrived, not reuse.

const router = require("express").Router();
const { authenticate, requirePermission, prisma } = require("../middleware/auth");
const { hydrateLedgerTransactions } = require("../lib/accountLedger");
const { resolveCustomerContext } = require("../lib/customerEngine");
const { resolveSupplierContext } = require("../lib/supplierEngine");
const { resolveStatus } = require("../lib/statusEngine");
const {
  BOOKS,
  classifyLedgerMethod,
  buildCustomerLedger,
  buildSupplierLedger,
  buildBookLedger,
  summarizeDailyClosing,
  buildAging,
  validateJournalEntry,
} = require("../lib/financeCore");

router.use(authenticate);

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function toIsoDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

async function fetchLedgerEntries(tenantId) {
  const transactions = await prisma.transaction.findMany({
    where: { tenantId, status: "completed" },
    orderBy: { date: "asc" },
  });
  return transactions.map((t) => ({
    id: t.id,
    date: toIsoDate(t.date) || toIsoDate(t.createdAt),
    type: t.type,
    category: t.category,
    amount: t.amount,
    method: t.paymentMethod,
    description: t.description,
    reference: t.referenceId,
    referenceType: t.referenceType,
  }));
}

// ── Customer Payment (read view — payments originate from /api/invoices/:id/payments) ──
router.get("/customer-payments", requirePermission("accounts", "view"), async (req, res) => {
  try {
    const rows = await prisma.transaction.findMany({
      where: { tenantId: req.tenantId, type: "income", status: "completed" },
      orderBy: { date: "desc" },
      take: 500,
    });
    res.json(await hydrateLedgerTransactions(prisma, req.tenantId, rows));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Supplier Payment (read view — payments originate from /api/vendors/:id/bills/:billId/payments) ──
router.get("/supplier-payments", requirePermission("accounts", "view"), async (req, res) => {
  try {
    const bills = await prisma.vendorBill.findMany({
      where: { tenantId: req.tenantId },
      include: { payments: true, vendor: { select: { id: true, name: true } } },
    });
    const payments = bills.flatMap((bill) =>
      (bill.payments || []).map((p) => ({
        id: p.id,
        billId: bill.id,
        vendorId: bill.vendorId,
        vendorName: bill.vendor?.name || "",
        description: bill.description,
        amount: p.amount,
        method: p.method,
        reference: p.reference || null,
        date: toIsoDate(p.date) || toIsoDate(p.createdAt),
      })),
    ).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    res.json(payments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Customer Ledger (composes CRM Customer Engine) ──
router.get("/customer-ledger/:clientId", requirePermission("accounts", "view"), async (req, res) => {
  try {
    const customer = await resolveCustomerContext(req.params.clientId, req.tenantId);
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    const invoices = await prisma.invoice.findMany({ where: { tenantId: req.tenantId, clientId: req.params.clientId } });
    const invoiceIds = invoices.map((i) => i.id);
    const payments = invoiceIds.length
      ? await prisma.payment.findMany({ where: { tenantId: req.tenantId, invoiceId: { in: invoiceIds } } })
      : [];

    const charges = invoices.map((i) => ({ date: toIsoDate(i.issuedDate) || toIsoDate(i.createdAt), reference: i.invoiceNumber, amount: i.totalAmount }));
    const receipts = payments.map((p) => ({ date: toIsoDate(p.date) || toIsoDate(p.createdAt), reference: p.transactionRef || null, amount: p.amount, method: p.method }));

    res.json({
      customer: { id: customer.id, name: customer.name, phone: customer.phone, email: customer.email, clientType: customer.clientType },
      ledger: buildCustomerLedger(charges, receipts),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Supplier Ledger (composes CRM Supplier Engine — reuses its already-computed payables) ──
router.get("/supplier-ledger/:vendorId", requirePermission("accounts", "view"), async (req, res) => {
  try {
    const supplier = await resolveSupplierContext(req.params.vendorId, req.tenantId);
    if (!supplier) return res.status(404).json({ message: "Supplier not found" });

    const charges = (supplier.payables || []).map((b) => ({ date: toIsoDate(b.dueDate), reference: b.invoiceRef || b.description, amount: b.totalAmount }));
    const payments = (supplier.payables || []).flatMap((b) =>
      (b.payments || []).map((p) => ({ date: toIsoDate(p.date), reference: p.method, amount: p.amount, method: p.method })),
    );

    res.json({
      supplier: { id: supplier.id, name: supplier.name, category: supplier.category, categoryLabel: supplier.categoryLabel, outstandingBalance: supplier.outstandingBalance },
      ledger: buildSupplierLedger(charges, payments),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Cash / Bank / bKash / Nagad Books (ledger-derived balances) ──
function registerBookRoute(book) {
  router.get(`/${book}-book`, requirePermission("accounts", "view"), async (req, res) => {
    try {
      const entries = await fetchLedgerEntries(req.tenantId);
      res.json(buildBookLedger(entries, book));
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });
}
BOOKS.forEach(registerBookRoute); // -> /cash-book, /bank-book, /bkash-book, /nagad-book

// ── Journal Entry (single-entry ledger view + manual adjustment) ──
router.get("/journal", requirePermission("accounts", "view"), async (req, res) => {
  try {
    const limitRaw = parseInt(String(req.query.limit || "500"), 10);
    const take = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 1000) : 500;
    const rows = await prisma.transaction.findMany({ where: { tenantId: req.tenantId }, orderBy: { date: "desc" }, take });
    res.json(rows.map((t) => ({
      id: t.id,
      date: toIsoDate(t.date),
      type: t.type,
      category: t.category,
      description: t.description,
      amount: t.amount,
      method: t.paymentMethod,
      book: classifyLedgerMethod(t.paymentMethod),
      referenceType: t.referenceType,
      referenceId: t.referenceId,
      status: t.status,
      isManual: t.referenceType === "manual_journal",
    })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/journal", requirePermission("accounts", "create"), async (req, res) => {
  try {
    const validation = validateJournalEntry(req.body);
    if (!validation.valid) return res.status(400).json({ message: "Validation failed", errors: validation.errors });

    const transaction = await prisma.transaction.create({
      data: {
        type: req.body.type,
        category: String(req.body.category || "manual_journal"),
        description: String(req.body.description).trim(),
        amount: Number(req.body.amount),
        paymentMethod: req.body.method || null,
        accountId: req.body.accountId || null,
        referenceType: "manual_journal",
        status: "completed",
        date: toIsoDate(req.body.date) || todayIso(),
        tenantId: req.tenantId,
        createdBy: req.userId,
      },
    });
    res.status(201).json(transaction);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Reversible: because every Finance Core balance is DERIVED from the ledger,
// deleting the manual transaction automatically reverses its effect on every
// book, ledger, and closing view — no separate balance reversal needed. Only
// manual entries can be deleted here; auto-posted transactions (invoice
// payments, expenses, vendor payments) are protected by the referenceType
// filter and must be reversed through their own originating flow.
router.delete("/journal/:transactionId", requirePermission("accounts", "delete"), async (req, res) => {
  try {
    const result = await prisma.transaction.deleteMany({
      where: { id: req.params.transactionId, tenantId: req.tenantId, referenceType: "manual_journal" },
    });
    if (!result.count) return res.status(404).json({ message: "Manual journal entry not found (auto-posted transactions cannot be deleted here)" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Daily Closing ──
router.get("/daily-closing", requirePermission("accounts", "view"), async (req, res) => {
  try {
    const date = toIsoDate(req.query.date) || todayIso();
    const rows = await prisma.transaction.findMany({ where: { tenantId: req.tenantId, status: "completed", date } });
    const entries = rows.map((t) => ({ date: toIsoDate(t.date), type: t.type, amount: t.amount, method: t.paymentMethod }));
    res.json(summarizeDailyClosing(entries, date));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Receivable (per-invoice aging, composes Status Engine) ──
router.get("/receivable", requirePermission("accounts", "view"), async (req, res) => {
  try {
    const asOf = todayIso();
    const invoices = await prisma.invoice.findMany({
      where: { tenantId: req.tenantId, dueAmount: { gt: 0 } },
      orderBy: { dueDate: "asc" },
    });
    const aging = buildAging(invoices.map((i) => ({ amount: i.dueAmount, dueDate: toIsoDate(i.dueDate) })), asOf);
    res.json({
      asOf,
      aging,
      invoices: invoices.map((i) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        clientName: i.clientName,
        totalAmount: i.totalAmount,
        paidAmount: i.paidAmount,
        dueAmount: i.dueAmount,
        dueDate: toIsoDate(i.dueDate),
        statusContext: resolveStatus("invoiceStatus", i.status),
      })),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Payable (per-bill aging) ──
router.get("/payable", requirePermission("accounts", "view"), async (req, res) => {
  try {
    const asOf = todayIso();
    const bills = await prisma.vendorBill.findMany({
      where: { tenantId: req.tenantId, dueAmount: { gt: 0 } },
      include: { vendor: { select: { id: true, name: true } } },
      orderBy: { dueDate: "asc" },
    });
    const aging = buildAging(bills.map((b) => ({ amount: b.dueAmount, dueDate: toIsoDate(b.dueDate) })), asOf);
    res.json({
      asOf,
      aging,
      bills: bills.map((b) => ({
        id: b.id,
        vendorName: b.vendor?.name || "",
        description: b.description,
        totalAmount: b.totalAmount,
        paidAmount: b.paidAmount,
        dueAmount: b.dueAmount,
        dueDate: toIsoDate(b.dueDate),
        statusContext: resolveStatus("invoiceStatus", b.status),
      })),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
