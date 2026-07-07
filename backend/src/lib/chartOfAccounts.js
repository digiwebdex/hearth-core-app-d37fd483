// Default Chart of Accounts for a Bangladesh travel agency + account resolution
// helpers used by the double-entry accounting posting service.
//
// Code ranges: 1xxx assets · 2xxx liabilities · 3xxx equity · 4xxx income · 5xxx expenses.
// Normal balance is derived from the account type (assets/expenses = debit;
// liabilities/equity/income = credit). "group" subtype rows are non-postable parents.

const NORMAL_BALANCE_BY_TYPE = {
  asset: "debit",
  expense: "debit",
  liability: "credit",
  equity: "credit",
  income: "credit",
};

function normalBalanceForType(type) {
  return NORMAL_BALANCE_BY_TYPE[String(type).toLowerCase()] || "debit";
}

// Stable account codes referenced by the posting service.
const ACCT = {
  CASH: "1010",
  BANK: "1020",
  MFS: "1030",
  AR: "1100",
  ADVANCE_SUPPLIER: "1200",
  AP: "2100",
  TAX_PAYABLE: "2200",
  ADVANCE_CUSTOMER: "2300",
  CAPITAL: "3100",
  RETAINED_EARNINGS: "3200",
  SERVICE_SALES: "4100",
  COMMISSION_INCOME: "4200",
  OTHER_INCOME: "4300",
  COGS: "5100",
  SALARIES: "5200",
  RENT: "5300",
  UTILITIES: "5400",
  MARKETING: "5500",
  OFFICE: "5600",
  BANK_CHARGES: "5700",
  REFUNDS: "5800",
  OTHER_EXPENSE: "5900",
};

// name = English default; the frontend localizes by code where needed.
const DEFAULT_CHART = [
  // Assets
  { code: "1000", name: "Assets", type: "asset", subtype: "group" },
  { code: "1010", name: "Cash in Hand", type: "asset", subtype: "cash", parent: "1000" },
  { code: "1020", name: "Bank Accounts", type: "asset", subtype: "bank", parent: "1000" },
  { code: "1030", name: "Mobile Banking (bKash/Nagad)", type: "asset", subtype: "mobile_banking", parent: "1000" },
  { code: "1100", name: "Accounts Receivable", type: "asset", subtype: "receivable", parent: "1000" },
  { code: "1200", name: "Advance to Suppliers", type: "asset", subtype: "current_asset", parent: "1000" },
  // Liabilities
  { code: "2000", name: "Liabilities", type: "liability", subtype: "group" },
  { code: "2100", name: "Accounts Payable", type: "liability", subtype: "payable", parent: "2000" },
  { code: "2200", name: "VAT / Tax Payable", type: "liability", subtype: "tax", parent: "2000" },
  { code: "2300", name: "Advance from Customers", type: "liability", subtype: "current_liability", parent: "2000" },
  // Equity
  { code: "3000", name: "Equity", type: "equity", subtype: "group" },
  { code: "3100", name: "Owner's Capital", type: "equity", subtype: "capital", parent: "3000" },
  { code: "3200", name: "Retained Earnings", type: "equity", subtype: "retained_earnings", parent: "3000" },
  // Income
  { code: "4000", name: "Income", type: "income", subtype: "group" },
  { code: "4100", name: "Service Sales", type: "income", subtype: "sales", parent: "4000" },
  { code: "4200", name: "Commission Income", type: "income", subtype: "sales", parent: "4000" },
  { code: "4300", name: "Other Income", type: "income", subtype: "other_income", parent: "4000" },
  // Expenses
  { code: "5000", name: "Expenses", type: "expense", subtype: "group" },
  { code: "5100", name: "Cost of Services", type: "expense", subtype: "cogs", parent: "5000" },
  { code: "5200", name: "Salaries & Wages", type: "expense", subtype: "operating_expense", parent: "5000" },
  { code: "5300", name: "Rent", type: "expense", subtype: "operating_expense", parent: "5000" },
  { code: "5400", name: "Utilities", type: "expense", subtype: "operating_expense", parent: "5000" },
  { code: "5500", name: "Marketing & Advertising", type: "expense", subtype: "operating_expense", parent: "5000" },
  { code: "5600", name: "Office & Administrative", type: "expense", subtype: "operating_expense", parent: "5000" },
  { code: "5700", name: "Bank Charges", type: "expense", subtype: "operating_expense", parent: "5000" },
  { code: "5800", name: "Sales Returns & Refunds", type: "expense", subtype: "contra_income", parent: "5000" },
  { code: "5900", name: "Other Expenses", type: "expense", subtype: "operating_expense", parent: "5000" },
];

/** Map a payment method string to the right cash/bank/MFS asset account code. */
function accountForMethod(method) {
  const m = String(method || "").toLowerCase();
  if (/bkash|nagad|rocket|upay|mobile[_\s-]*bank|mfs/.test(m)) return ACCT.MFS;
  if (/cash/.test(m)) return ACCT.CASH;
  return ACCT.BANK; // bank / card / cheque / transfer / online / other
}

/** Map an expense category string to the right expense account code. */
function accountForExpenseCategory(category) {
  const c = String(category || "").toLowerCase();
  if (/salar|wage|payroll|staff/.test(c)) return ACCT.SALARIES;
  if (/rent|lease/.test(c)) return ACCT.RENT;
  if (/utilit|electric|internet|phone|water|gas/.test(c)) return ACCT.UTILITIES;
  if (/market|advertis|promo|campaign/.test(c)) return ACCT.MARKETING;
  if (/office|admin|stationer|supply|supplies/.test(c)) return ACCT.OFFICE;
  if (/bank|charge|\bfee\b/.test(c)) return ACCT.BANK_CHARGES;
  if (/cost of|cogs|supplier|ticket cost|service cost/.test(c)) return ACCT.COGS;
  return ACCT.OTHER_EXPENSE;
}

module.exports = {
  DEFAULT_CHART,
  ACCT,
  NORMAL_BALANCE_BY_TYPE,
  normalBalanceForType,
  accountForMethod,
  accountForExpenseCategory,
};
