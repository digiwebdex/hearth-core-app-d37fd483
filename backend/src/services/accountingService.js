// Double-Entry Accounting posting service.
//
// The SINGLE place that turns business events into balanced journal entries — no
// parallel posting logic lives in the route handlers; they call these functions.
// Every entry is tenant-scoped, idempotent (keyed on source + referenceId), and
// balanced (sum debits === sum credits). Deletions/refunds post a REVERSING entry
// rather than mutating history. Coexists with the legacy single-entry Transaction
// ledger (unchanged) for backward compatibility.

const { prisma } = require("../middleware/auth");
const {
  DEFAULT_CHART, ACCT, normalBalanceForType, accountForMethod, accountForExpenseCategory,
} = require("../lib/chartOfAccounts");

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// ── Chart of Accounts ────────────────────────────────────────────────────────
/** Seed the default Chart of Accounts for a tenant if it has none. Idempotent & race-safe. */
async function ensureChartOfAccounts(tenantId) {
  await prisma.chartOfAccount.createMany({
    data: DEFAULT_CHART.map((a) => ({
      tenantId,
      code: a.code,
      name: a.name,
      type: a.type,
      subtype: a.subtype || null,
      normalBalance: normalBalanceForType(a.type),
      isSystem: true,
    })),
    skipDuplicates: true,
  });
  // Link parents (second pass; skipped rows already exist).
  const rows = await prisma.chartOfAccount.findMany({ where: { tenantId } });
  const byCode = new Map(rows.map((r) => [r.code, r]));
  for (const a of DEFAULT_CHART) {
    if (!a.parent) continue;
    const self = byCode.get(a.code);
    const parent = byCode.get(a.parent);
    if (self && parent && self.parentId !== parent.id) {
      await prisma.chartOfAccount.update({ where: { id: self.id }, data: { parentId: parent.id } });
    }
  }
  return byCode;
}

/** code -> ChartOfAccount row (seeds defaults first). */
async function getAccountMap(tenantId) {
  const existing = await prisma.chartOfAccount.findMany({ where: { tenantId } });
  if (!existing.length) return ensureChartOfAccounts(tenantId);
  return new Map(existing.map((r) => [r.code, r]));
}

// ── Fiscal periods ───────────────────────────────────────────────────────────
/** Resolve (or lazily create) the monthly fiscal period for a date. Throws if closed. */
async function resolveFiscalPeriod(tenantId, date) {
  const d = new Date(date);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const name = `${y}-${String(m + 1).padStart(2, "0")}`;
  let period = await prisma.fiscalPeriod.findFirst({ where: { tenantId, name } });
  if (period && period.status === "closed") {
    const err = new Error(`Fiscal period ${name} is closed`);
    err.code = "PERIOD_CLOSED";
    throw err;
  }
  if (!period) {
    const startDate = new Date(Date.UTC(y, m, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59));
    try {
      period = await prisma.fiscalPeriod.create({ data: { tenantId, name, startDate, endDate, status: "open" } });
    } catch {
      period = await prisma.fiscalPeriod.findFirst({ where: { tenantId, name } }); // race: created concurrently
    }
  }
  return period;
}

async function generateEntryNumber(tenantId, date) {
  const y = new Date(date).getUTCFullYear();
  const count = await prisma.journalEntry.count({ where: { tenantId } });
  return `JE-${y}-${String(count + 1).padStart(5, "0")}`;
}

// ── Core posting ─────────────────────────────────────────────────────────────
/**
 * Post a balanced journal entry. Idempotent on (tenantId, source, referenceId) —
 * a second call for the same business event returns the existing entry.
 * @param lines [{ accountId, debit, credit, description? }]
 */
async function postEntry(tenantId, { date, memo, source = "manual", referenceType = null, referenceId = null, lines = [], createdBy = null, currency = "BDT" }) {
  if (referenceId) {
    const existing = await prisma.journalEntry.findFirst({
      where: { tenantId, source, referenceId, status: "posted", reversalOfId: null },
    });
    if (existing) return existing;
  }

  const norm = lines
    .map((l) => ({
      accountId: l.accountId,
      debit: round2(l.debit),
      credit: round2(l.credit),
      description: l.description || null,
      currency,
    }))
    .filter((l) => l.accountId && (l.debit > 0 || l.credit > 0));

  if (norm.length < 2) throw new Error("A journal entry requires at least two lines");
  const totalDebit = round2(norm.reduce((s, l) => s + l.debit, 0));
  const totalCredit = round2(norm.reduce((s, l) => s + l.credit, 0));
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Unbalanced journal entry: debit ${totalDebit} != credit ${totalCredit}`);
  }

  const period = await resolveFiscalPeriod(tenantId, date);
  const entryNumber = await generateEntryNumber(tenantId, date);

  return prisma.journalEntry.create({
    data: {
      tenantId,
      entryNumber,
      date: new Date(date),
      memo: memo || null,
      source,
      referenceType,
      referenceId,
      status: "posted",
      currency,
      fiscalPeriodId: period ? period.id : null,
      totalDebit,
      totalCredit,
      createdBy,
      lines: { create: norm.map((l) => ({ tenantId, accountId: l.accountId, debit: l.debit, credit: l.credit, description: l.description, currency: l.currency })) },
    },
    include: { lines: true },
  });
}

/** Reverse a previously-posted entry (creates a mirror entry; never mutates history). No-op if not found or already reversed. */
async function reverseEntry(tenantId, source, referenceId, { date = new Date(), createdBy = null, memo } = {}) {
  const original = await prisma.journalEntry.findFirst({
    where: { tenantId, source, referenceId, status: "posted", reversalOfId: null },
    include: { lines: true },
  });
  if (!original) return null;
  const existingReversal = await prisma.journalEntry.findFirst({ where: { tenantId, reversalOfId: original.id } });
  if (existingReversal) return existingReversal;

  const period = await resolveFiscalPeriod(tenantId, date);
  const entryNumber = await generateEntryNumber(tenantId, date);

  return prisma.journalEntry.create({
    data: {
      tenantId,
      entryNumber,
      date: new Date(date),
      memo: memo || `Reversal of ${original.entryNumber}`,
      source: original.source,
      referenceType: original.referenceType,
      referenceId: `${original.referenceId}:reversal`,
      status: "posted",
      currency: original.currency,
      fiscalPeriodId: period ? period.id : null,
      reversalOfId: original.id,
      totalDebit: original.totalCredit,
      totalCredit: original.totalDebit,
      createdBy,
      lines: { create: original.lines.map((l) => ({ tenantId, accountId: l.accountId, debit: round2(l.credit), credit: round2(l.debit), description: `Reversal: ${l.description || ""}`.trim(), currency: l.currency })) },
    },
    include: { lines: true },
  });
}

// ── Event posters (called from route handlers) ───────────────────────────────
async function line(map, code, debit, credit, description) {
  const acct = map.get(code);
  if (!acct) throw new Error(`Chart of Accounts missing account ${code}`);
  return { accountId: acct.id, debit, credit, description };
}

/** Sales invoice issued (accrual): Dr A/R, Cr Service Sales (net), Cr Tax Payable (VAT). */
async function postSalesInvoice(tenantId, invoice, { createdBy } = {}) {
  const total = round2(invoice.totalAmount);
  if (total <= 0) return null;
  const tax = round2(invoice.taxAmount || 0);
  const net = round2(total - tax);
  const map = await getAccountMap(tenantId);
  const lines = [await line(map, ACCT.AR, total, 0, `Invoice ${invoice.invoiceNumber || invoice.id}`)];
  lines.push(await line(map, ACCT.SERVICE_SALES, 0, net, "Service sales"));
  if (tax > 0) lines.push(await line(map, ACCT.TAX_PAYABLE, 0, tax, "VAT / tax payable"));
  return postEntry(tenantId, {
    date: invoice.issuedDate || invoice.createdAt || new Date(),
    memo: `Sales invoice ${invoice.invoiceNumber || invoice.id}`,
    source: "sales_invoice", referenceType: "invoice", referenceId: invoice.id, createdBy, lines,
  });
}

/** Customer payment received: Dr Cash/Bank/MFS, Cr A/R. */
async function postCustomerPayment(tenantId, payment, { createdBy } = {}) {
  const amount = round2(payment.amount);
  if (amount <= 0) return null;
  const map = await getAccountMap(tenantId);
  const cashCode = accountForMethod(payment.method);
  const lines = [
    await line(map, cashCode, amount, 0, `Payment ${payment.transactionRef || payment.id}`),
    await line(map, ACCT.AR, 0, amount, "Settle receivable"),
  ];
  return postEntry(tenantId, {
    date: payment.date || payment.createdAt || new Date(),
    memo: `Customer payment ${payment.transactionRef || payment.id}`,
    source: "customer_payment", referenceType: "payment", referenceId: payment.id, createdBy, lines,
  });
}

/** Supplier bill recorded: Dr Cost of Services, Cr A/P. */
async function postSupplierBill(tenantId, bill, { createdBy } = {}) {
  const amount = round2(bill.totalAmount);
  if (amount <= 0) return null;
  const map = await getAccountMap(tenantId);
  const lines = [
    await line(map, ACCT.COGS, amount, 0, bill.description || "Supplier bill"),
    await line(map, ACCT.AP, 0, amount, "Payable to supplier"),
  ];
  return postEntry(tenantId, {
    date: bill.createdAt || new Date(),
    memo: `Supplier bill ${bill.invoiceRef || bill.id}`,
    source: "supplier_bill", referenceType: "vendorBill", referenceId: bill.id, createdBy, lines,
  });
}

/** Supplier payment made: Dr A/P, Cr Cash/Bank/MFS. */
async function postSupplierPayment(tenantId, billPayment, { createdBy } = {}) {
  const amount = round2(billPayment.amount);
  if (amount <= 0) return null;
  const map = await getAccountMap(tenantId);
  const cashCode = accountForMethod(billPayment.method);
  const lines = [
    await line(map, ACCT.AP, amount, 0, "Settle payable"),
    await line(map, cashCode, 0, amount, `Supplier payment ${billPayment.reference || billPayment.id}`),
  ];
  return postEntry(tenantId, {
    date: billPayment.date || billPayment.createdAt || new Date(),
    memo: `Supplier payment ${billPayment.reference || billPayment.id}`,
    source: "supplier_payment", referenceType: "vendorBillPayment", referenceId: billPayment.id, createdBy, lines,
  });
}

/** Expense: Dr Expense (by category), Cr Cash/Bank/MFS. */
async function postExpense(tenantId, expense, { createdBy } = {}) {
  const amount = round2(expense.amount);
  if (amount <= 0) return null;
  const map = await getAccountMap(tenantId);
  const expenseCode = accountForExpenseCategory(expense.category);
  const cashCode = accountForMethod(expense.paymentMethod);
  const lines = [
    await line(map, expenseCode, amount, 0, expense.description || expense.category || "Expense"),
    await line(map, cashCode, 0, amount, `Paid by ${expense.paymentMethod || "cash"}`),
  ];
  return postEntry(tenantId, {
    date: expense.date || expense.createdAt || new Date(),
    memo: `Expense ${expense.description || expense.category || expense.id}`,
    source: "expense", referenceType: "expense", referenceId: expense.id, createdBy, lines,
  });
}

/** Customer refund paid out: Dr Sales Returns & Refunds, Cr Cash/Bank/MFS. */
async function postRefund(tenantId, refund, { createdBy } = {}) {
  const amount = round2(refund.amount);
  if (amount <= 0) return null;
  const map = await getAccountMap(tenantId);
  const cashCode = accountForMethod(refund.method);
  const lines = [
    await line(map, ACCT.REFUNDS, amount, 0, refund.reason || "Refund"),
    await line(map, cashCode, 0, amount, `Refund paid by ${refund.method || "cash"}`),
  ];
  return postEntry(tenantId, {
    date: refund.createdAt || new Date(),
    memo: `Refund ${refund.id}`,
    source: "refund", referenceType: "invoiceRefund", referenceId: refund.id, createdBy, lines,
  });
}

module.exports = {
  round2,
  ensureChartOfAccounts,
  getAccountMap,
  resolveFiscalPeriod,
  postEntry,
  reverseEntry,
  postSalesInvoice,
  postCustomerPayment,
  postSupplierBill,
  postSupplierPayment,
  postExpense,
  postRefund,
};
