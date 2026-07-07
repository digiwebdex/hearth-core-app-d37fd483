require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-at-least-32-characters-long";
process.env.RATE_LIMIT_DISABLED = "true";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createApp } = require("../src/app");
const { normalBalanceForType, accountForMethod, accountForExpenseCategory, ACCT } = require("../src/lib/chartOfAccounts");
const { buildTrialBalance, buildProfitAndLoss, buildBalanceSheet } = require("../src/lib/accountingReports");

// ── Chart of Accounts helpers ────────────────────────────────────────────────
describe("chartOfAccounts — normal balances & mappings", () => {
  it("derives the normal balance from account type", () => {
    assert.equal(normalBalanceForType("asset"), "debit");
    assert.equal(normalBalanceForType("expense"), "debit");
    assert.equal(normalBalanceForType("liability"), "credit");
    assert.equal(normalBalanceForType("equity"), "credit");
    assert.equal(normalBalanceForType("income"), "credit");
  });

  it("routes payment methods to the right cash/bank/MFS account", () => {
    assert.equal(accountForMethod("cash"), ACCT.CASH);
    assert.equal(accountForMethod("bkash"), ACCT.MFS);
    assert.equal(accountForMethod("Nagad"), ACCT.MFS);
    assert.equal(accountForMethod("mobile_banking"), ACCT.MFS);
    assert.equal(accountForMethod("bank_transfer"), ACCT.BANK);
    assert.equal(accountForMethod("card"), ACCT.BANK);
  });

  it("routes expense categories to the right expense account", () => {
    assert.equal(accountForExpenseCategory("Office Rent"), ACCT.RENT);
    assert.equal(accountForExpenseCategory("Staff Salary"), ACCT.SALARIES);
    assert.equal(accountForExpenseCategory("Electricity bill"), ACCT.UTILITIES);
    assert.equal(accountForExpenseCategory("Facebook marketing"), ACCT.MARKETING);
    assert.equal(accountForExpenseCategory("misc"), ACCT.OTHER_EXPENSE);
  });
});

// ── Financial statements derived from journal lines ──────────────────────────
// Realistic scenario: invoice 1000 -> payment 700 -> supplier bill 400 ->
// supplier payment 400 -> rent expense 100. Verifies TB/P&L/BS all balance.
function acct(code, name, type, subtype) {
  return { id: code, code, name, type, subtype: subtype || null, normalBalance: normalBalanceForType(type) };
}
const A = {
  cash: acct("1010", "Cash", "asset", "cash"),
  ar: acct("1100", "A/R", "asset", "receivable"),
  ap: acct("2100", "A/P", "liability", "payable"),
  sales: acct("4100", "Sales", "income", "sales"),
  cogs: acct("5100", "Cost of Services", "expense", "cogs"),
  rent: acct("5300", "Rent", "expense", "operating_expense"),
};
const L = (account, debit, credit) => ({ account, debit, credit });
const SCENARIO = [
  L(A.ar, 1000, 0), L(A.sales, 0, 1000),      // sales invoice
  L(A.cash, 700, 0), L(A.ar, 0, 700),         // customer payment
  L(A.cogs, 400, 0), L(A.ap, 0, 400),         // supplier bill
  L(A.ap, 400, 0), L(A.cash, 0, 400),         // supplier payment
  L(A.rent, 100, 0), L(A.cash, 0, 100),       // rent expense
];

describe("accountingReports — Trial Balance", () => {
  it("balances (total debits === total credits)", () => {
    const tb = buildTrialBalance(SCENARIO);
    assert.equal(tb.balanced, true);
    assert.equal(tb.totalDebit, 1000);
    assert.equal(tb.totalCredit, 1000);
  });
  it("places each account balance on its correct column", () => {
    const tb = buildTrialBalance(SCENARIO);
    const cash = tb.rows.find((r) => r.code === "1010");
    const sales = tb.rows.find((r) => r.code === "4100");
    assert.equal(cash.debit, 200); // 700 - 400 - 100
    assert.equal(sales.credit, 1000);
    // A/P nets to zero and drops out.
    assert.equal(tb.rows.find((r) => r.code === "2100"), undefined);
  });
});

describe("accountingReports — Profit & Loss", () => {
  it("computes gross and net profit from journal entries", () => {
    const pl = buildProfitAndLoss(SCENARIO);
    assert.equal(pl.totalIncome, 1000);
    assert.equal(pl.cogs, 400);
    assert.equal(pl.operatingExpense, 100);
    assert.equal(pl.totalExpense, 500);
    assert.equal(pl.grossProfit, 600);
    assert.equal(pl.netProfit, 500);
  });
});

describe("accountingReports — Balance Sheet", () => {
  it("balances: assets === liabilities + equity (with current earnings)", () => {
    const bs = buildBalanceSheet(SCENARIO);
    assert.equal(bs.totalAssets, 500);       // cash 200 + A/R 300
    assert.equal(bs.totalLiabilities, 0);    // A/P settled
    assert.equal(bs.currentEarnings, 500);   // income 1000 - expense 500
    assert.equal(bs.totalEquity, 500);
    assert.equal(bs.balanced, true);
  });
});

// ── Route auth gates ─────────────────────────────────────────────────────────
describe("GET /api/accounting — auth gates", () => {
  const app = createApp();
  const paths = [
    "/api/accounting/chart-of-accounts",
    "/api/accounting/journal",
    "/api/accounting/reports/trial-balance",
    "/api/accounting/reports/profit-loss",
    "/api/accounting/reports/balance-sheet",
    "/api/accounting/fiscal-periods",
  ];
  for (const p of paths) {
    it(`requires authentication on ${p} (401 without a token)`, async () => {
      const res = await request(app).get(p);
      assert.equal(res.status, 401);
      assert.match(res.body.message, /token/i);
    });
  }
});
