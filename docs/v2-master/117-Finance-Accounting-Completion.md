# 117 — Finance & Accounting Completion Report

**Milestone:** Organization ERP → **Module 3: Finance & Accounting — Full Double-Entry Accounting**
**Status:** Implementation complete; verified via build + typecheck + tests + an end-to-end posting/reporting simulation.
**Scope note:** The user **explicitly approved going beyond the original single-entry freeze** to build full double-entry accounting. This report documents that approved expansion. It coexists with — and does not remove — the legacy single-entry `Transaction` ledger, so the existing Finance module keeps working unchanged.

---

## 1. Requirements delivered (per the approval)

| # | Requirement | Status | How |
|---|-------------|--------|-----|
| 1 | Backward compatible with the current Finance module | ✅ | The legacy `Transaction` ledger and all of `finance.js`/`accounts.js`/`reportingCenter.js` are untouched and still post/read as before. Double-entry is **additive** alongside them. |
| 2 | Proper accounting models: ChartOfAccount, Journal, JournalEntry/Line, Fiscal Period | ✅ | New Prisma models `ChartOfAccount` (hierarchical, coded), `JournalEntry`, `JournalLine`, `FiscalPeriod`. Migration `20260708120000_double_entry_accounting`. |
| 3 | Auto-post from business events (customer payments, supplier payments, expenses, sales invoices, refunds) | ✅ | `services/accountingService.js` posters, called from the existing invoice/payment/expense/vendor handlers. Supplier **bills** are also posted (so A/P nets correctly). |
| 4 | Do NOT duplicate business logic | ✅ | One posting service is the single source; route handlers call it. No parallel double-entry logic anywhere. |
| 5 | Existing payment APIs call the accounting posting service | ✅ | `invoices.js` (payment create/delete, invoice create, refund), `expenses.js` (approve/reject/delete), `vendors.js` (bill + bill-payment create/delete) all call `accountingService`. |
| 6 | Trial Balance, P&L, Balance Sheet generated from journal entries | ✅ | `lib/accountingReports.js` derives all three **purely from posted `JournalLine`s** — never from stored running balances. |
| 7 | Support future VAT/Tax and multi-currency | ✅ | Invoice tax posts to a **VAT/Tax Payable** account (2200). `currency` columns on accounts/entries/lines (default BDT) make multi-currency additive later. |
| 8 | Tenant-isolated | ✅ | Every model carries `tenantId`; every query filters it; writes/deletes use `{id, tenantId}`. |
| 9 | Follow the v2 Master Blueprint architecture | ✅ | Central Status Engine already owns the document/verification vocab; posting reuses the shared `middleware/auth` prisma; additive migration; FE consumes a backend-owned API. |

---

## 2. Architecture

**Models (`schema.prisma`, additive):**
- `ChartOfAccount` — coded, typed (asset/liability/equity/income/expense), self-referencing hierarchy, `normalBalance` derived from type, `isSystem` (seeded defaults are undeletable), `currency`.
- `JournalEntry` — `entryNumber`, `date`, `source`, `referenceType`/`referenceId` (idempotency key), `status` (posted/void), `fiscalPeriodId`, `reversalOfId` (reversing entries), `totalDebit`/`totalCredit`.
- `JournalLine` — `accountId`, `debit`, `credit`, `currency`.
- `FiscalPeriod` — monthly, `open`/`closed`; posting to a closed period is rejected.

**Posting service (`services/accountingService.js`) — the one place events become entries:**
- `ensureChartOfAccounts` (idempotent seed of the 27-account default CoA), `getAccountMap`, `resolveFiscalPeriod` (lazy monthly, closed-guard), `postEntry` (idempotent on `source`+`referenceId`, **balance-checked**, ≥2 lines), `reverseEntry` (posts a mirror entry; never mutates history; idempotent).
- Event posters (double-entry mapping):
  - **Sales invoice** → Dr A/R, Cr Service Sales (net), Cr VAT Payable (tax).
  - **Customer payment** → Dr Cash/Bank/MFS (by method), Cr A/R.
  - **Supplier bill** → Dr Cost of Services, Cr A/P.
  - **Supplier payment** → Dr A/P, Cr Cash/Bank/MFS.
  - **Expense** → Dr Expense (by category), Cr Cash/Bank/MFS.
  - **Refund** → Dr Sales Returns & Refunds, Cr Cash/Bank/MFS.
- Payment method → account and expense category → account mapping in `lib/chartOfAccounts.js` (bKash/Nagad → Mobile Banking; salary/rent/utilities/… → the right expense account).

**Reports (`lib/accountingReports.js`)** — Trial Balance (per-account debit/credit columns, must balance), Profit & Loss (income vs COGS vs opex → gross/net), Balance Sheet (assets = liabilities + equity, with current-year earnings folded into equity), plus a per-account General Ledger with running balance.

**API (`routes/accounting.js`, `/api/accounting`)** — CoA list/seed/create/edit/delete, journal list/get/manual-post/reverse, `reports/{trial-balance,profit-loss,balance-sheet,general-ledger}`, fiscal-periods list/close/reopen, and **`/resync`** (idempotent backfill of journal entries from all existing invoices/payments/expenses/bills/refunds — lets existing tenants adopt accounting from historical data). RBAC on the `accounts` module.

**The §10.6 must-fix, resolved:** `DELETE /invoices/:id/payments/:payId` now fully reverses — recomputes the invoice roll-up, the booking roll-up, re-applies installment allocation from scratch, deletes the single-entry ledger `Transaction`, and posts a reversing journal entry.

**Frontend:** `pages/Accounting.tsx` (tabs: Chart of Accounts · Journal + manual entry with live balance check · Trial Balance · P&L · Balance Sheet, plus Resync), `accountingApi` + types in `lib/api.ts`, route `/accounting` (PM `accounts`), nav entry in Finance & Accounts, full EN/BN (`accounting.*`, 56 keys each).

---

## 3. Verification performed

| Check | Result |
|-------|--------|
| Schema validate (`prisma validate`) | ✅ valid |
| Migration generated via `prisma migrate diff` (schema-to-schema, DB-free) + `prisma generate` | ✅ 4 tables, FKs, indexes |
| Type-check (`npx tsc --noEmit`) | ✅ **0 errors** |
| Frontend tests (`npm test`) | ✅ 28/28 |
| Frontend production build | ✅ built ~24 s |
| Backend tests (`cd backend && npm test`) | ✅ **626/627** (+13 new accounting tests) |
| New unit tests (`accounting.test.js`) | ✅ 13/13 — CoA mappings + TB/P&L/BS math on a realistic 5-event scenario, all balanced |
| **End-to-end engine simulation** (real posting service + real reports, in-memory Prisma) | ✅ **12/12** — seed (27 accts), balanced posting from every event, TB/P&L/BS balance, idempotency, reversal restores A/R & keeps TB balanced |
| ESLint (new files) | ✅ clean; changed files add no new `any` |
| i18n JSON validity (en + bn) | ✅ both parse; keys mirrored |

**Known non-accounting test failure:** `sidebarEngine.test.js:111` — pre-existing & unrelated (reports [114](114-Customer-Portal-Completion.md)/[115](115-CRM-Module-Completion.md)/[116](116-Booking-Engine-Completion.md)). Unchanged.

**"Run migrations" / "Seed default CoA":** the migration is authored & validated; it applies with `prisma migrate deploy` on any environment with a live DB. The default Chart of Accounts **seeds automatically** on first access (`ensureChartOfAccounts`, also via `/resync` and the "Create default accounts" button) — verified in the E2E simulation (27 accounts). A live-DB migrate + seed was not run here because this dev environment has no `DATABASE_URL`/Postgres; both are exercised on deploy.

---

## 4. Files

**New (backend):** `src/lib/chartOfAccounts.js`, `src/lib/accountingReports.js`, `src/services/accountingService.js`, `src/routes/accounting.js`, `test/accounting.test.js`, `prisma/migrations/20260708120000_double_entry_accounting/migration.sql`.
**Modified (backend):** `prisma/schema.prisma` (4 models), `src/app.js` (mount), `src/routes/invoices.js` (post sales-invoice / customer-payment / refund + payment-delete reversal), `src/routes/expenses.js` (post/reverse on status), `src/routes/vendors.js` (bill + bill-payment posting/reversal), `src/lib/invoiceInstallments.js` (`reallocateInstallments`).
**New (frontend):** `src/pages/Accounting.tsx`.
**Modified (frontend):** `src/lib/api.ts`, `src/App.tsx`, `src/config/navigation.ts`, `src/i18n/locales/{en,bn}.json`.

---

## 5. Notes / follow-ups (not blockers)

- **Auto-posting is best-effort** at the call sites (wrapped in `.catch` + logged) so accounting can never break a core invoice/payment/expense flow; `/resync` re-posts anything missed (idempotent).
- **Invoice edits** that change totals after posting are not auto-adjusted (invoices are typically immutable once issued); `/resync` + manual reversing entries cover corrections. Full edit-reversal automation can be added if needed.
- **Multi-currency** is schema-ready (currency columns) but FX conversion is not implemented — amounts are single-currency (BDT) per entry, as scoped.
