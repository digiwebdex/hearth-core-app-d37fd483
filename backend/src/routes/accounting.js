// Double-Entry Accounting API — Chart of Accounts, Journal, fiscal periods,
// and the journal-derived financial statements (Trial Balance, P&L, Balance
// Sheet). All tenant-scoped; RBAC on the `accounts` module. Posting from
// business events lives in services/accountingService.js (not here).

const router = require("express").Router();
const { authenticate, requirePermission, prisma } = require("../middleware/auth");
const acc = require("../services/accountingService");
const reports = require("../lib/accountingReports");
const { normalBalanceForType } = require("../lib/chartOfAccounts");

router.use(authenticate);

// Parse a date range from query (?from&to), defaulting to all-time.
function range(req) {
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(0);
  const to = req.query.to ? new Date(String(req.query.to) + "T23:59:59") : new Date();
  return { from, to };
}

async function fetchPostedLines(tenantId, { from, to }) {
  return prisma.journalLine.findMany({
    where: { tenantId, journalEntry: { status: "posted", date: { gte: from, lte: to } } },
    include: { account: true },
  });
}

// ── Chart of Accounts ────────────────────────────────────────────────────────
router.get("/chart-of-accounts", requirePermission("accounts", "view"), async (req, res) => {
  try {
    const map = await acc.getAccountMap(req.tenantId); // seeds defaults on first hit
    const accounts = [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
    res.json(accounts);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/chart-of-accounts/seed", requirePermission("accounts", "create"), async (req, res) => {
  try {
    await acc.ensureChartOfAccounts(req.tenantId);
    const map = await acc.getAccountMap(req.tenantId);
    res.status(201).json({ seeded: true, count: map.size });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/chart-of-accounts", requirePermission("accounts", "create"), async (req, res) => {
  try {
    const { code, name, type, subtype, parentId, description } = req.body;
    if (!code || !name || !type) return res.status(400).json({ message: "code, name and type are required" });
    if (!["asset", "liability", "equity", "income", "expense"].includes(String(type))) {
      return res.status(400).json({ message: "type must be asset | liability | equity | income | expense" });
    }
    const created = await prisma.chartOfAccount.create({
      data: {
        tenantId: req.tenantId,
        code: String(code).trim(),
        name: String(name).trim(),
        type: String(type),
        subtype: subtype ? String(subtype) : null,
        parentId: parentId || null,
        normalBalance: normalBalanceForType(type),
        description: description ? String(description) : null,
        isSystem: false,
      },
    });
    res.status(201).json(created);
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ message: "An account with this code already exists" });
    res.status(500).json({ message: err.message });
  }
});

router.patch("/chart-of-accounts/:id", requirePermission("accounts", "edit"), async (req, res) => {
  try {
    const data = {};
    if (req.body.name !== undefined) data.name = String(req.body.name).trim();
    if (req.body.subtype !== undefined) data.subtype = req.body.subtype ? String(req.body.subtype) : null;
    if (req.body.description !== undefined) data.description = req.body.description ? String(req.body.description) : null;
    if (req.body.isActive !== undefined) data.isActive = !!req.body.isActive;
    if (req.body.parentId !== undefined) data.parentId = req.body.parentId || null;
    const result = await prisma.chartOfAccount.updateMany({ where: { id: req.params.id, tenantId: req.tenantId }, data });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json(await prisma.chartOfAccount.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } }));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete("/chart-of-accounts/:id", requirePermission("accounts", "delete"), async (req, res) => {
  try {
    const account = await prisma.chartOfAccount.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!account) return res.status(404).json({ message: "Not found" });
    if (account.isSystem) return res.status(400).json({ message: "System accounts cannot be deleted" });
    const used = await prisma.journalLine.count({ where: { tenantId: req.tenantId, accountId: req.params.id } });
    if (used) return res.status(400).json({ message: "Account has journal entries and cannot be deleted; deactivate it instead" });
    await prisma.chartOfAccount.deleteMany({ where: { id: req.params.id, tenantId: req.tenantId } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Journal ──────────────────────────────────────────────────────────────────
router.get("/journal", requirePermission("accounts", "view"), async (req, res) => {
  try {
    const where = { tenantId: req.tenantId };
    if (req.query.source) where.source = String(req.query.source);
    if (req.query.status) where.status = String(req.query.status);
    if (req.query.from || req.query.to) {
      const { from, to } = range(req);
      where.date = { gte: from, lte: to };
    }
    const entries = await prisma.journalEntry.findMany({
      where,
      include: { lines: { include: { account: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: Math.min(Number(req.query.limit) || 200, 500),
    });
    res.json(entries);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/journal/:id", requirePermission("accounts", "view"), async (req, res) => {
  try {
    const entry = await prisma.journalEntry.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: { lines: { include: { account: true } } },
    });
    if (!entry) return res.status(404).json({ message: "Not found" });
    res.json(entry);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Manual journal entry. Lines accept accountId OR account code.
router.post("/journal", requirePermission("accounts", "create"), async (req, res) => {
  try {
    const { date, memo, lines } = req.body;
    if (!Array.isArray(lines) || lines.length < 2) return res.status(400).json({ message: "At least two lines are required" });
    const map = await acc.getAccountMap(req.tenantId);
    const byId = new Map([...map.values()].map((a) => [a.id, a]));
    const resolved = [];
    for (const l of lines) {
      const account = l.accountId ? byId.get(l.accountId) : (l.code ? map.get(String(l.code)) : null);
      if (!account) return res.status(400).json({ message: `Unknown account: ${l.accountId || l.code}` });
      resolved.push({ accountId: account.id, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, description: l.description });
    }
    const entry = await acc.postEntry(req.tenantId, {
      date: date || new Date(), memo, source: "manual", createdBy: req.userId, lines: resolved,
    });
    const full = await prisma.journalEntry.findFirst({ where: { id: entry.id, tenantId: req.tenantId }, include: { lines: { include: { account: true } } } });
    res.status(201).json(full);
  } catch (err) {
    if (err.code === "PERIOD_CLOSED") return res.status(400).json({ message: err.message, code: err.code });
    res.status(400).json({ message: err.message });
  }
});

router.post("/journal/:id/reverse", requirePermission("accounts", "edit"), async (req, res) => {
  try {
    const entry = await prisma.journalEntry.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!entry) return res.status(404).json({ message: "Not found" });
    if (entry.reversalOfId) return res.status(400).json({ message: "Cannot reverse a reversal entry" });
    const reversal = await acc.reverseEntry(req.tenantId, entry.source, entry.referenceId, { createdBy: req.userId, memo: req.body.memo });
    if (!reversal) return res.status(400).json({ message: "Entry could not be reversed (already reversed or not found)" });
    res.status(201).json(reversal);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Financial statements (from journal entries) ──────────────────────────────
router.get("/reports/trial-balance", requirePermission("accounts", "view"), async (req, res) => {
  try {
    await acc.getAccountMap(req.tenantId);
    const lines = await fetchPostedLines(req.tenantId, range(req));
    const tb = reports.buildTrialBalance(lines);
    res.json({ ...tb, range: range(req) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/reports/profit-loss", requirePermission("accounts", "view"), async (req, res) => {
  try {
    await acc.getAccountMap(req.tenantId);
    const lines = await fetchPostedLines(req.tenantId, range(req));
    res.json({ ...reports.buildProfitAndLoss(lines), range: range(req) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/reports/balance-sheet", requirePermission("accounts", "view"), async (req, res) => {
  try {
    await acc.getAccountMap(req.tenantId);
    const to = req.query.asOf ? new Date(String(req.query.asOf) + "T23:59:59") : new Date();
    const lines = await fetchPostedLines(req.tenantId, { from: new Date(0), to });
    res.json({ ...reports.buildBalanceSheet(lines), asOf: to });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Per-account general ledger (running balance).
router.get("/reports/general-ledger", requirePermission("accounts", "view"), async (req, res) => {
  try {
    const accountId = String(req.query.accountId || "");
    if (!accountId) return res.status(400).json({ message: "accountId is required" });
    const account = await prisma.chartOfAccount.findFirst({ where: { id: accountId, tenantId: req.tenantId } });
    if (!account) return res.status(404).json({ message: "Account not found" });
    const { from, to } = range(req);
    const lines = await prisma.journalLine.findMany({
      where: { tenantId: req.tenantId, accountId, journalEntry: { status: "posted", date: { gte: from, lte: to } } },
      include: { journalEntry: { select: { id: true, entryNumber: true, date: true, memo: true, source: true } } },
      orderBy: { journalEntry: { date: "asc" } },
    });
    let running = 0;
    const sign = account.normalBalance === "debit" ? 1 : -1;
    const rows = lines.map((l) => {
      running = reports.round2(running + sign * (l.debit - l.credit));
      return {
        entryId: l.journalEntry.id, entryNumber: l.journalEntry.entryNumber, date: l.journalEntry.date,
        memo: l.journalEntry.memo, source: l.journalEntry.source,
        debit: l.debit, credit: l.credit, balance: running, description: l.description,
      };
    });
    res.json({ account, rows, closingBalance: running });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Fiscal periods ───────────────────────────────────────────────────────────
router.get("/fiscal-periods", requirePermission("accounts", "view"), async (req, res) => {
  try {
    res.json(await prisma.fiscalPeriod.findMany({ where: { tenantId: req.tenantId }, orderBy: { startDate: "desc" } }));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/fiscal-periods/:id/close", requirePermission("accounts", "approve"), async (req, res) => {
  try {
    const result = await prisma.fiscalPeriod.updateMany({
      where: { id: req.params.id, tenantId: req.tenantId },
      data: { status: "closed", closedBy: req.userId, closedAt: new Date() },
    });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json(await prisma.fiscalPeriod.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } }));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/fiscal-periods/:id/reopen", requirePermission("accounts", "approve"), async (req, res) => {
  try {
    const result = await prisma.fiscalPeriod.updateMany({
      where: { id: req.params.id, tenantId: req.tenantId },
      data: { status: "open", closedBy: null, closedAt: null },
    });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json(await prisma.fiscalPeriod.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } }));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Resync — backfill journal entries from existing business records (idempotent) ──
router.post("/resync", requirePermission("accounts", "edit"), async (req, res) => {
  try {
    await acc.ensureChartOfAccounts(req.tenantId);
    const t = req.tenantId;
    let posted = 0;
    const safe = async (fn) => { try { const e = await fn(); if (e) posted += 1; } catch (err) { console.error("[accounting resync]", err.message); } };

    const invoices = await prisma.invoice.findMany({ where: { tenantId: t } });
    for (const inv of invoices) await safe(() => acc.postSalesInvoice(t, inv));

    const payments = await prisma.payment.findMany({ where: { tenantId: t } });
    for (const p of payments) await safe(() => acc.postCustomerPayment(t, p));

    const expenses = await prisma.expense.findMany({ where: { tenantId: t, status: { in: ["approved", "paid"] } } });
    for (const e of expenses) await safe(() => acc.postExpense(t, e));

    const bills = await prisma.vendorBill.findMany({ where: { tenantId: t } });
    for (const b of bills) await safe(() => acc.postSupplierBill(t, b));
    const billIds = bills.map((b) => b.id);
    if (billIds.length) {
      const billPayments = await prisma.vendorBillPayment.findMany({ where: { billId: { in: billIds } } });
      for (const bp of billPayments) await safe(() => acc.postSupplierPayment(t, bp));
    }

    const invoiceIds = invoices.map((i) => i.id);
    if (invoiceIds.length) {
      const refunds = await prisma.invoiceRefund.findMany({ where: { invoiceId: { in: invoiceIds } } });
      for (const r of refunds) await safe(() => acc.postRefund(t, r));
    }

    const total = await prisma.journalEntry.count({ where: { tenantId: t } });
    res.json({ resynced: true, newlyPosted: posted, totalEntries: total });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
