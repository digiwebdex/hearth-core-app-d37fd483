// Financial statements derived ENTIRELY from double-entry journal entries
// (never from stored running balances) — Trial Balance, Profit & Loss, Balance
// Sheet, and a per-account General Ledger. Pure aggregation; the caller supplies
// the posted JournalLines (with their account + entry) already tenant-scoped.

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Collapse posted lines into per-account debit/credit totals + a signed balance. */
function aggregateByAccount(lines) {
  const map = new Map();
  for (const l of lines) {
    const a = l.account;
    if (!a) continue;
    let e = map.get(a.id);
    if (!e) {
      e = { id: a.id, code: a.code, name: a.name, type: a.type, subtype: a.subtype, normalBalance: a.normalBalance, debit: 0, credit: 0 };
      map.set(a.id, e);
    }
    e.debit += l.debit;
    e.credit += l.credit;
  }
  const rows = [...map.values()].map((e) => {
    const debit = round2(e.debit);
    const credit = round2(e.credit);
    // Balance expressed on the account's normal side (positive = normal).
    const balance = round2(e.normalBalance === "debit" ? debit - credit : credit - debit);
    return { ...e, debit, credit, balance };
  });
  rows.sort((a, b) => a.code.localeCompare(b.code));
  return rows;
}

/** Trial Balance — every account's ending balance in its debit or credit column; the two columns must match. */
function buildTrialBalance(lines) {
  const accounts = aggregateByAccount(lines);
  const rows = [];
  let totalDebit = 0;
  let totalCredit = 0;
  for (const a of accounts) {
    const net = round2(a.debit - a.credit); // >0 → net debit
    if (Math.abs(net) < 0.005) continue; // omit zero-balance accounts (standard trial balance)
    const debit = net >= 0 ? net : 0;
    const credit = net < 0 ? -net : 0;
    totalDebit += debit;
    totalCredit += credit;
    rows.push({ code: a.code, name: a.name, type: a.type, debit: round2(debit), credit: round2(credit) });
  }
  totalDebit = round2(totalDebit);
  totalCredit = round2(totalCredit);
  return { rows, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 };
}

/** Profit & Loss — income vs expenses, with gross profit (income − COGS) and net profit. */
function buildProfitAndLoss(lines) {
  const accounts = aggregateByAccount(lines);
  const income = accounts.filter((a) => a.type === "income" && (a.debit || a.credit));
  const expenses = accounts.filter((a) => a.type === "expense" && (a.debit || a.credit));

  const totalIncome = round2(income.reduce((s, a) => s + a.balance, 0));
  const cogs = round2(expenses.filter((a) => a.subtype === "cogs").reduce((s, a) => s + a.balance, 0));
  const operatingExpense = round2(expenses.filter((a) => a.subtype !== "cogs").reduce((s, a) => s + a.balance, 0));
  const totalExpense = round2(cogs + operatingExpense);
  const grossProfit = round2(totalIncome - cogs);
  const netProfit = round2(totalIncome - totalExpense);

  const fmt = (a) => ({ code: a.code, name: a.name, subtype: a.subtype, amount: a.balance });
  return {
    income: income.map(fmt),
    expenses: expenses.map(fmt),
    totalIncome,
    cogs,
    operatingExpense,
    totalExpense,
    grossProfit,
    netProfit,
  };
}

/** Balance Sheet as-of — assets = liabilities + equity (+ current-year earnings folded into equity). */
function buildBalanceSheet(lines) {
  const accounts = aggregateByAccount(lines);
  const fmt = (a) => ({ code: a.code, name: a.name, subtype: a.subtype, amount: a.balance });

  const assets = accounts.filter((a) => a.type === "asset" && (a.debit || a.credit));
  const liabilities = accounts.filter((a) => a.type === "liability" && (a.debit || a.credit));
  const equity = accounts.filter((a) => a.type === "equity" && (a.debit || a.credit));

  const totalAssets = round2(assets.reduce((s, a) => s + a.balance, 0));
  const totalLiabilities = round2(liabilities.reduce((s, a) => s + a.balance, 0));
  const equityBooked = round2(equity.reduce((s, a) => s + a.balance, 0));

  // Current-year earnings = income − expense to date, folded into equity so the sheet balances.
  const totalIncome = round2(accounts.filter((a) => a.type === "income").reduce((s, a) => s + a.balance, 0));
  const totalExpense = round2(accounts.filter((a) => a.type === "expense").reduce((s, a) => s + a.balance, 0));
  const currentEarnings = round2(totalIncome - totalExpense);
  const totalEquity = round2(equityBooked + currentEarnings);

  return {
    assets: assets.map(fmt),
    liabilities: liabilities.map(fmt),
    equity: equity.map(fmt),
    currentEarnings,
    totalAssets,
    totalLiabilities,
    totalEquity,
    balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
  };
}

module.exports = {
  round2,
  aggregateByAccount,
  buildTrialBalance,
  buildProfitAndLoss,
  buildBalanceSheet,
};
