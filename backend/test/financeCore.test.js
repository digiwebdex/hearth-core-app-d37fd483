require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-at-least-32-characters-long";
process.env.RATE_LIMIT_DISABLED = "true";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createApp } = require("../src/app");
const {
  BOOKS,
  JOURNAL_TYPES,
  classifyLedgerMethod,
  buildCustomerLedger,
  buildSupplierLedger,
  buildBookLedger,
  summarizeDailyClosing,
  buildAging,
  validateJournalEntry,
} = require("../src/lib/financeCore");

describe("financeCore — classifyLedgerMethod (pure, no database)", () => {
  it("routes each method to its book", () => {
    assert.equal(classifyLedgerMethod("cash"), "cash");
    assert.equal(classifyLedgerMethod("bkash"), "bkash");
    assert.equal(classifyLedgerMethod("nagad"), "nagad");
    assert.equal(classifyLedgerMethod("bank"), "bank");
    assert.equal(classifyLedgerMethod("bank_transfer"), "bank");
    assert.equal(classifyLedgerMethod("cheque"), "bank");
    assert.equal(classifyLedgerMethod("card"), "bank");
  });

  it("sends an unqualified mobile_banking / online / unknown method to 'other', not silently to a provider book", () => {
    assert.equal(classifyLedgerMethod("mobile_banking"), "other");
    assert.equal(classifyLedgerMethod("online"), "other");
    assert.equal(classifyLedgerMethod("rocket"), "other");
    assert.equal(classifyLedgerMethod(""), "other");
    assert.equal(classifyLedgerMethod(null), "other");
  });

  it("is case-insensitive", () => {
    assert.equal(classifyLedgerMethod("BKASH"), "bkash");
    assert.equal(classifyLedgerMethod("Cash"), "cash");
  });
});

describe("financeCore — buildCustomerLedger (pure, no database)", () => {
  it("orders charges and receipts by date, running the balance and computing outstanding", () => {
    const result = buildCustomerLedger(
      [{ date: "2026-01-01", reference: "INV-1", amount: 1000 }, { date: "2026-01-10", reference: "INV-2", amount: 500 }],
      [{ date: "2026-01-05", reference: "PAY-1", amount: 400, method: "bkash" }],
    );
    assert.equal(result.lines.length, 3);
    assert.deepEqual(result.lines.map((l) => l.balance), [1000, 600, 1100]);
    assert.equal(result.totalCharged, 1500);
    assert.equal(result.totalReceived, 400);
    assert.equal(result.outstanding, 1100);
  });

  it("handles a fully-paid customer (outstanding 0)", () => {
    const result = buildCustomerLedger(
      [{ date: "2026-01-01", reference: "INV-1", amount: 1000 }],
      [{ date: "2026-01-02", reference: "PAY-1", amount: 1000 }],
    );
    assert.equal(result.outstanding, 0);
  });

  it("handles an empty ledger", () => {
    assert.deepEqual(buildCustomerLedger([], []), { lines: [], totalCharged: 0, totalReceived: 0, outstanding: 0 });
  });
});

describe("financeCore — buildSupplierLedger (pure, no database)", () => {
  it("runs the payable balance: bills increase it, payments reduce it", () => {
    const result = buildSupplierLedger(
      [{ date: "2026-01-01", reference: "BILL-1", amount: 2000 }],
      [{ date: "2026-01-03", reference: "VP-1", amount: 800, method: "bank" }],
    );
    assert.deepEqual(result.lines.map((l) => l.balance), [2000, 1200]);
    assert.equal(result.totalBilled, 2000);
    assert.equal(result.totalPaid, 800);
    assert.equal(result.outstanding, 1200);
  });
});

describe("financeCore — buildBookLedger (pure, no database)", () => {
  const entries = [
    { date: "2026-01-01", type: "income", amount: 1000, method: "cash", description: "sale" },
    { date: "2026-01-02", type: "expense", amount: 300, method: "cash", description: "office" },
    { date: "2026-01-02", type: "income", amount: 500, method: "bkash", description: "bkash sale" },
    { date: "2026-01-03", type: "income", amount: 200, method: "bank", description: "bank sale" },
  ];

  it("filters to one book and derives its running balance (income adds, expense subtracts)", () => {
    const cash = buildBookLedger(entries, "cash");
    assert.equal(cash.lines.length, 2);
    assert.equal(cash.totalIn, 1000);
    assert.equal(cash.totalOut, 300);
    assert.equal(cash.balance, 700);
  });

  it("keeps each book independent", () => {
    assert.equal(buildBookLedger(entries, "bkash").balance, 500);
    assert.equal(buildBookLedger(entries, "bank").balance, 200);
    assert.equal(buildBookLedger(entries, "nagad").balance, 0);
  });
});

describe("financeCore — summarizeDailyClosing (pure, no database)", () => {
  it("splits a day's entries into receipts, payments, and net, broken down by book", () => {
    const entries = [
      { date: "2026-02-01", type: "income", amount: 1000, method: "cash" },
      { date: "2026-02-01", type: "expense", amount: 250, method: "cash" },
      { date: "2026-02-01", type: "income", amount: 500, method: "bkash" },
      { date: "2026-02-02", type: "income", amount: 9999, method: "cash" }, // different day, excluded
    ];
    const closing = summarizeDailyClosing(entries, "2026-02-01");
    assert.equal(closing.date, "2026-02-01");
    assert.equal(closing.receipts, 1500);
    assert.equal(closing.payments, 250);
    assert.equal(closing.net, 1250);
    assert.equal(closing.entryCount, 3);
    assert.deepEqual(closing.byBook.cash, { receipts: 1000, payments: 250 });
    assert.deepEqual(closing.byBook.bkash, { receipts: 500, payments: 0 });
  });
});

describe("financeCore — buildAging (pure, no database)", () => {
  const asOf = "2026-03-31";
  it("buckets outstanding items by how overdue they are", () => {
    const result = buildAging(
      [
        { amount: 100, dueDate: "2026-04-15" }, // future -> current
        { amount: 200, dueDate: null }, // no due date -> current
        { amount: 300, dueDate: "2026-03-20" }, // 11 days -> d1_30
        { amount: 400, dueDate: "2026-02-15" }, // ~44 days -> d31_60
        { amount: 500, dueDate: "2026-01-20" }, // ~70 days -> d61_90
        { amount: 600, dueDate: "2025-11-01" }, // >90 days -> d90_plus
      ],
      asOf,
    );
    assert.equal(result.total, 2100);
    assert.equal(result.count, 6);
    assert.equal(result.buckets.current, 300);
    assert.equal(result.buckets.d1_30, 300);
    assert.equal(result.buckets.d31_60, 400);
    assert.equal(result.buckets.d61_90, 500);
    assert.equal(result.buckets.d90_plus, 600);
  });

  it("ignores non-positive amounts", () => {
    const result = buildAging([{ amount: 0, dueDate: "2026-01-01" }, { amount: -50, dueDate: "2026-01-01" }], asOf);
    assert.equal(result.total, 0);
    assert.equal(result.count, 0);
  });
});

describe("financeCore — validateJournalEntry (pure, no database)", () => {
  const VALID = { type: "income", amount: 500, description: "opening balance", date: "2026-01-01" };

  it("accepts a valid manual entry", () => {
    assert.deepEqual(validateJournalEntry(VALID), { valid: true, errors: [] });
  });

  it("requires a known type", () => {
    assert.equal(validateJournalEntry({ ...VALID, type: "weird" }).valid, false);
    for (const type of JOURNAL_TYPES) assert.equal(validateJournalEntry({ ...VALID, type }).valid, true);
  });

  it("requires a positive amount", () => {
    assert.equal(validateJournalEntry({ ...VALID, amount: 0 }).valid, false);
    assert.equal(validateJournalEntry({ ...VALID, amount: -100 }).valid, false);
    assert.equal(validateJournalEntry({ ...VALID, amount: "not-a-number" }).valid, false);
  });

  it("requires a description", () => {
    assert.equal(validateJournalEntry({ ...VALID, description: "" }).valid, false);
  });

  it("rejects an invalid date but allows the date to be omitted (route defaults it)", () => {
    assert.equal(validateJournalEntry({ ...VALID, date: "not-a-date" }).valid, false);
    const { date, ...noDate } = VALID;
    assert.equal(validateJournalEntry(noDate).valid, true);
  });

  it("collects every violated rule at once", () => {
    const { valid, errors } = validateJournalEntry({ type: "weird", amount: -1, description: "" });
    assert.equal(valid, false);
    assert.ok(errors.length >= 3);
  });
});

describe("financeCore — constants", () => {
  it("exposes exactly the four cash books", () => {
    assert.deepEqual([...BOOKS].sort(), ["bank", "bkash", "cash", "nagad"]);
  });
});

describe("GET/POST/DELETE /api/finance-core — all routes require authentication", () => {
  const app = createApp();

  const cases = [
    ["get", "/api/finance-core/customer-payments"],
    ["get", "/api/finance-core/supplier-payments"],
    ["get", "/api/finance-core/customer-ledger/some-client-id"],
    ["get", "/api/finance-core/supplier-ledger/some-vendor-id"],
    ["get", "/api/finance-core/cash-book"],
    ["get", "/api/finance-core/bank-book"],
    ["get", "/api/finance-core/bkash-book"],
    ["get", "/api/finance-core/nagad-book"],
    ["get", "/api/finance-core/journal"],
    ["post", "/api/finance-core/journal"],
    ["delete", "/api/finance-core/journal/some-transaction-id"],
    ["get", "/api/finance-core/daily-closing"],
    ["get", "/api/finance-core/receivable"],
    ["get", "/api/finance-core/payable"],
  ];

  for (const [method, path] of cases) {
    it(`requires authentication on ${method.toUpperCase()} ${path} (401 without a token)`, async () => {
      const res = await request(app)[method](path);
      assert.equal(res.status, 401);
      assert.match(res.body.message, /token/i);
    });
  }
});
