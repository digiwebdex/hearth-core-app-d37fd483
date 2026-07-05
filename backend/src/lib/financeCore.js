// Finance Core — shared, pure accounting composition helpers.
// (docs/v2-master/11-Architecture-Freeze.md §5/§10/§11, docs/v2-master/12-Implementation-Sequence.md Phase 5).
//
// CRITICAL ARCHITECTURAL CONTEXT (read before extending):
//   - The frozen architecture keeps a SINGLE-ENTRY ledger for v2; SAP-style
//     double-entry accounting is explicitly postponed to the Future Roadmap
//     (docs/v2-master/11-Architecture-Freeze.md §11). Nothing here is a
//     double-entry journal — "Journal Entry" below is the single-entry
//     Transaction ledger presented as journal lines, plus a manual
//     single-entry adjustment.
//   - "No duplicate accounting logic": the money mutations already exist and
//     are NOT re-implemented here. Invoice payments post income Transactions
//     (backend/src/lib/invoiceInstallments.js ensureLedgerIncomeTransaction),
//     approved expenses post expense Transactions (routes/expenses.js
//     syncExpenseTransaction), and vendor bill payments update payables
//     (routes/vendors.js). Finance Core READS and COMPOSES what those flows
//     already produce — every transaction still originates from a Booking /
//     Invoice / Payment, never from here.
//   - Balances are DERIVED from the ledger, not a mutated stored field. The
//     existing adjustAccountBalance() primitive (backend/src/lib/accountLedger.js)
//     is intentionally NOT invoked: deriving cash/bank/bKash/Nagad book
//     balances from the Transaction ledger keeps a single source of truth,
//     can never drift, and is inherently reversible (delete a transaction →
//     every derived balance updates) — matching the freeze's "reversible
//     mutations" rule far better than mutating a second stored total would.
//
// This file is PURE: no database access, no side effects, no requires from
// elsewhere in the repo. The route (routes/financeCore.js) fetches the rows
// and passes them in.

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

// The four cash "books" the business asked for, plus an "other" bucket for
// anything that can't be attributed to one of them.
const BOOKS = ["cash", "bank", "bkash", "nagad"];
const JOURNAL_TYPES = ["income", "expense", "transfer", "adjustment"];

/**
 * Routes a payment method string to one of the four books (or "other").
 * bKash/Nagad are detected by the method name — the schema has no dedicated
 * account type for them (both are "mobile_banking"), so an unqualified
 * "mobile_banking"/"online" method lands in "other", not silently in a
 * specific provider's book. Pure.
 */
function classifyLedgerMethod(method) {
  const m = String(method || "").trim().toLowerCase();
  if (m === "cash") return "cash";
  if (m === "bkash") return "bkash";
  if (m === "nagad") return "nagad";
  if (["bank", "bank_transfer", "cheque", "card"].includes(m)) return "bank";
  return "other";
}

/**
 * Customer Ledger — a running statement. Charges (invoices) increase what the
 * customer owes; receipts (payments) reduce it. A positive closing balance is
 * an amount receivable from the customer. Pure.
 *   charges:  [{ date, reference, amount }]
 *   receipts: [{ date, reference, amount, method }]
 */
function buildCustomerLedger(charges = [], receipts = []) {
  const events = [
    ...charges.map((c) => ({ date: c.date, type: "invoice", reference: c.reference || null, debit: round2(c.amount), credit: 0 })),
    ...receipts.map((r) => ({ date: r.date, type: "payment", reference: r.reference || null, method: r.method || null, debit: 0, credit: round2(r.amount) })),
  ].sort((a, b) => String(a.date).localeCompare(String(b.date)));

  let balance = 0;
  const lines = events.map((e) => {
    balance = round2(balance + e.debit - e.credit);
    return { ...e, balance };
  });

  const totalCharged = round2(charges.reduce((s, c) => s + Number(c.amount || 0), 0));
  const totalReceived = round2(receipts.reduce((s, r) => s + Number(r.amount || 0), 0));
  return { lines, totalCharged, totalReceived, outstanding: round2(totalCharged - totalReceived) };
}

/**
 * Supplier Ledger — the payable mirror of the customer ledger. Bills increase
 * what we owe the supplier; payments reduce it. A positive closing balance is
 * an amount payable to the supplier. Pure.
 *   bills:    [{ date, reference, amount }]
 *   payments: [{ date, reference, amount, method }]
 */
function buildSupplierLedger(bills = [], payments = []) {
  const events = [
    ...bills.map((b) => ({ date: b.date, type: "bill", reference: b.reference || null, credit: round2(b.amount), debit: 0 })),
    ...payments.map((p) => ({ date: p.date, type: "payment", reference: p.reference || null, method: p.method || null, credit: 0, debit: round2(p.amount) })),
  ].sort((a, b) => String(a.date).localeCompare(String(b.date)));

  let balance = 0;
  const lines = events.map((e) => {
    balance = round2(balance + e.credit - e.debit);
    return { ...e, balance };
  });

  const totalBilled = round2(bills.reduce((s, b) => s + Number(b.amount || 0), 0));
  const totalPaid = round2(payments.reduce((s, p) => s + Number(p.amount || 0), 0));
  return { lines, totalBilled, totalPaid, outstanding: round2(totalBilled - totalPaid) };
}

/**
 * Cash/Bank/bKash/Nagad Book — the ledger filtered to one book, with a derived
 * running balance. income adds, expense/refund subtract, transfer subtracts
 * (money leaving this book). Pure.
 *   entries: [{ date, type, amount, method, description, reference }]
 */
function buildBookLedger(entries = [], book) {
  const filtered = entries
    .filter((e) => classifyLedgerMethod(e.method) === book)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  let balance = 0;
  let totalIn = 0;
  let totalOut = 0;
  const lines = filtered.map((e) => {
    const amount = round2(e.amount);
    const isInflow = e.type === "income";
    if (isInflow) { balance = round2(balance + amount); totalIn = round2(totalIn + amount); }
    else { balance = round2(balance - amount); totalOut = round2(totalOut + amount); }
    return { date: e.date, type: e.type, description: e.description || null, reference: e.reference || null, inflow: isInflow ? amount : 0, outflow: isInflow ? 0 : amount, balance };
  });

  return { book, lines, totalIn, totalOut, balance };
}

/**
 * Daily Closing — receipts, payments, and net for a single day, broken down
 * by book. income = receipt; expense/refund/transfer = payment. Pure.
 *   entries: [{ date, type, amount, method }]
 */
function summarizeDailyClosing(entries = [], dateIso) {
  const forDay = entries.filter((e) => String(e.date).slice(0, 10) === String(dateIso).slice(0, 10));

  const byBook = Object.fromEntries([...BOOKS, "other"].map((b) => [b, { receipts: 0, payments: 0 }]));
  let receipts = 0;
  let payments = 0;

  for (const e of forDay) {
    const amount = round2(e.amount);
    const book = classifyLedgerMethod(e.method);
    if (e.type === "income") { receipts = round2(receipts + amount); byBook[book].receipts = round2(byBook[book].receipts + amount); }
    else { payments = round2(payments + amount); byBook[book].payments = round2(byBook[book].payments + amount); }
  }

  return { date: String(dateIso).slice(0, 10), receipts, payments, net: round2(receipts - payments), entryCount: forDay.length, byBook };
}

/**
 * Aging — buckets outstanding items (invoices for receivable, bills for
 * payable) by how overdue each is relative to asOf. Items with no due date or
 * a future due date are "current". Pure.
 *   items: [{ amount, dueDate }]  (amount = the still-outstanding amount)
 */
function buildAging(items = [], asOfIso) {
  const asOf = new Date(String(asOfIso).slice(0, 10)).getTime();
  const buckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 };
  let total = 0;

  for (const item of items) {
    const amount = round2(item.amount);
    if (amount <= 0) continue;
    total = round2(total + amount);
    if (!item.dueDate) { buckets.current = round2(buckets.current + amount); continue; }
    const due = new Date(String(item.dueDate).slice(0, 10)).getTime();
    const daysOverdue = Math.floor((asOf - due) / (24 * 60 * 60 * 1000));
    if (daysOverdue <= 0) buckets.current = round2(buckets.current + amount);
    else if (daysOverdue <= 30) buckets.d1_30 = round2(buckets.d1_30 + amount);
    else if (daysOverdue <= 60) buckets.d31_60 = round2(buckets.d31_60 + amount);
    else if (daysOverdue <= 90) buckets.d61_90 = round2(buckets.d61_90 + amount);
    else buckets.d90_plus = round2(buckets.d90_plus + amount);
  }

  return { total, count: items.filter((i) => round2(i.amount) > 0).length, buckets };
}

/** validateJournalEntry — validation for a MANUAL single-entry adjustment. Pure; {valid, errors}, never throws. */
function validateJournalEntry(input = {}) {
  const errors = [];

  if (!JOURNAL_TYPES.includes(input.type)) {
    errors.push(`type must be one of ${JOURNAL_TYPES.join(", ")}`);
  }
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) errors.push("amount must be a positive number");
  if (!String(input.description ?? "").trim()) errors.push("description is required");
  if (input.date !== undefined && input.date !== "" && Number.isNaN(new Date(input.date).getTime())) {
    errors.push("date must be a valid date");
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  BOOKS,
  JOURNAL_TYPES,
  classifyLedgerMethod,
  buildCustomerLedger,
  buildSupplierLedger,
  buildBookLedger,
  summarizeDailyClosing,
  buildAging,
  validateJournalEntry,
};
