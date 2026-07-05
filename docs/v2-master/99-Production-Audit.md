# 99 — Full Platform Integration & Production Audit

**Project:** TravelAgencyWeb (TAWSS / "Hearth Core App") — multi-tenant travel-agency SaaS
**Audit date:** 2026-07-06
**Audit type:** Read-only static audit. No code, schema, packages, or data were modified.
**Scope:** Entire system — backend (Express 4 + Prisma 5 + PostgreSQL 16, 84 route files, 100 models, 44 libs, 16 services, 29 test files) and frontend (React 18 + Vite 5 + TS, 108 pages, 151 components, 53 libs).
**Explicitly out of scope (per instruction):** Website CMS, Student Consultancy, Overseas Manpower, AI, Mobile App.

---

## 0. How to read this document

Findings carry an ID (`C#`/`H#`/`M#`/`L#`), a **severity**, a **file:line** anchor, and an **INTENTIONAL vs DEBT** tag. "Intentional" means a documented, deliberate architectural choice (still may be improvable); "Debt" means an unplanned gap. Every finding is grounded in a real read of the code — nothing is asserted without evidence.

### Method & confidence

| Area | Depth | How verified |
|---|---|---|
| Security & multi-tenancy | **Deep** | Full-subsystem agent sweep of all route handlers + middleware |
| Database & schema | **Deep** | Full-subsystem agent sweep of all 100 models, cross-checked against backend + frontend usage |
| Booking → Invoice → Payment → Ledger → Reports | **Deep** | Direct code trace of the exact write path |
| Plan / Subscription / Permission / Portal enforcement | **Deep** | Direct grep of every enforcement call-site |
| Duplication / dead code / circular deps | **Medium** | Direct verification of the highest-value leads (agents were interrupted mid-run) |
| Frontend / UI | **Structural** | Routing, guards, gating components, structure — not a per-screen visual/UX review |
| Performance (N+1 / pagination) | **Sampled** | Hot loops sampled and confirmed; not a full query-plan profiling |

> **Transparency note.** Two subsystem sweeps (Security, Database) completed in full. Three further sweeps (duplication, booking-chain, and the planned enforcement/frontend/performance sweeps) were curtailed by an API session limit; I completed their highest-value checks directly. Frontend UX depth and query-plan profiling are therefore the two areas with the lightest coverage — flagged here so the reader calibrates accordingly. None of the CRITICAL/HIGH findings depend on the lightly-covered areas.

---

## 1. Executive summary

**The architecture is strong and the multi-tenant discipline is, with a small number of specific exceptions, excellent and remarkably consistent.** The engine-composition strategy (Plan Engine, Finance Core, Reporting Center, the five booking modules, the portals) is real — the "engine" libs genuinely wrap existing systems rather than duplicating logic, and they are pure leaf modules with no dependency cycles. The core money chain (Booking → Invoice → Payment → Ledger → Reports) is wired correctly end-to-end. Authentication, the portal JWT-audience separation, plan gating, and the subscription-expiry gate are well-built and fail closed.

**The platform is NOT yet production-ready** — but the blockers are targeted and small, not structural:

- **1 CRITICAL**: a full-database `pg_dump` export endpoint reachable by any agency owner (self-service signup → total multi-tenant data exfiltration, including all password hashes).
- **4 HIGH**: a git-tracked `.env.backup` containing real secrets; two data-export endpoints missing role gates; one cross-tenant read-back (IDOR); and missing indexes on the two fastest-growing tenant tables.
- A moderate body of **MEDIUM/LOW debt**: no global rate limiting, systemic mass-assignment, ~19 tables missing a `tenantId` index, route shadowing between two admin routers, String-vs-DateTime date drift, a non-atomic ledger write, two dead `Bsp*` tables, and an unwired Feature-Flag Engine.

Remediation of the CRITICAL + the four HIGH items is estimated at a few focused days and touches a handful of files — the underlying design does not need rework.

**Overall Production Readiness Score: 7.0 / 10 — "Conditionally ready; ship-blocked on 1 CRITICAL + 4 HIGH, all targeted."** (Full scorecard in §12.)

---

## 2. CRITICAL issues (ship-blockers)

### C1 — Full-database dump reachable by any tenant owner
- **File:** `backend/src/routes/dataExport.js:242` (`POST /api/export/db-backup`)
- **Severity:** CRITICAL · **DEBT**
- **What:** The endpoint shells out to `pg_dump` of the **entire** PostgreSQL database and streams it to the caller. It is gated only by `requireRole("tenant_owner", "super_admin")`.
- **Why it's critical:** `POST /api/auth/register` auto-creates an **active** `tenant_owner` on free-trial signup. So any member of the public can sign up and immediately download **every tenant's** clients, bookings, invoices, financials **and every user's bcrypt password hash** — no id-guessing, no other tenant's credentials. This single endpoint defeats the entire tenant-isolation model.
- **Fix direction:** restrict to `requireSuperAdmin` (the rest of the admin surface already is). One-line change.

---

## 3. HIGH priority issues

### H1 — `.env.backup` is committed to git with real secrets
- **File:** `backend/.env.backup` (33 lines; **2 non-empty sensitive keys** detected without printing values). `.gitignore` ignores `.env` / `.env.production` / `.env.local` but **not** `.env.backup`.
- **Severity:** HIGH (→ CRITICAL if the remote is public or if `JWT_SECRET` is among the values) · **DEBT**
- **Why:** Secrets committed to a repo live in history forever. If `JWT_SECRET` is one of the two values, anyone with repo read access can forge a JWT for any user of any tenant → full cross-tenant compromise, bypassing every other control.
- **Fix direction:** purge the file, add `.env*` (except `.env.example`) to `.gitignore`, and **rotate** every secret that was in it (JWT secret, DB URL, gateway keys, SMTP). Rotation is mandatory — deletion alone does not undo exposure.

### H2 — Bulk data-export endpoints missing authorization
- **File:** `backend/src/routes/dataExport.js:35` (`GET /api/export/csv`), `:142` (`GET /api/export/workbook`)
- **Severity:** HIGH · **DEBT**
- **What:** Both require only `authenticate` — no role/permission gate. They are correctly `tenantId`-scoped (no cross-tenant leak), but any authenticated user of the lowest roles (`sales_agent`, `operations`) can export the tenant's **entire** client PII list, all bookings, invoices, and payments — data those roles cannot otherwise see through the permission matrix. Least-privilege bypass for wholesale intra-tenant exfiltration.
- **Fix direction:** add `requirePermission("reports","export")` (or equivalent) to both.

### H3 — Cross-tenant read-back after scoped update (IDOR)
- **File:** `backend/src/routes/accounts.js:114`
- **Severity:** HIGH · **DEBT**
- **What:** `PATCH /api/accounts/:id` correctly uses a tenant-scoped `updateMany` (writes 0 rows for a foreign id — good), but then **re-fetches with `findFirst({ where: { id } })` with no `tenantId` filter** and returns it. Sending another tenant's account id returns that account's name/type/balance/number in the response body. This is the **only** read-back-without-tenant instance in the codebase (all other routes scope the re-fetch). Exploitability is limited by unguessable cuid ids, but it is a genuine authorization defect that violates the repo's own stated invariant.
- **Fix direction:** add `tenantId: req.tenantId` to the re-fetch — a one-word change matching every other route.

### H4 — Missing indexes on the two fastest-growing tenant tables
- **File:** `backend/prisma/schema.prisma` — `AuditLog` (line 1151, **no indexes at all**), `Transaction` (line 785, ledger — no index on `tenantId` or FK scalars).
- **Severity:** HIGH · **DEBT**
- **Why:** `AuditLog` is written on nearly every mutation across all tenants and queried by `tenantId`/`actorId`/`module` + `orderBy createdAt`; `Transaction` is the finance ledger and grows per payment/expense. Both do sequential scans today. Fine at seed scale, sharply degrading under real multi-tenant load — this is the most likely first production performance failure.
- **Fix direction:** `@@index([tenantId, createdAt])` on both (and see M5 for the rest).

---

## 4. MEDIUM priority issues

### M1 — No global/API rate limiting
- `backend/src/middleware/rateLimit.js`, mounted `app.js:117`. Only `/api/auth` (10/min) and portal login are throttled; every other authenticated and public endpoint is unthrottled. Additionally all limiters are globally disabled by `RATE_LIMIT_DISABLED=true`. Enables data-scraping, enumeration, and abuse of expensive report/export endpoints. · **DEBT**

### M2 — Hajj module has no permission gates
- `backend/src/routes/hajj.js:4` applies `authenticate` only — no `requirePermission` on any route, unlike every other resource. An `accountant` (matrix: `hajj_umrah` view/export only) or any authenticated user can create/edit/**delete** Hajj packages/groups/pilgrims and record pilgrim payments (`hajj.js:29,53,82,101`). Tenant scoping is intact (no data leak) — this is intra-tenant privilege escalation. · **DEBT**

### M3 — Systemic mass-assignment on writes
- `data: { ...req.body, tenantId: req.tenantId }` with no field whitelist across `clients.js:176`, `leads.js:88`, `accounts.js:108`, `vendors.js:76`, `expenses.js:58`, `crud.js:248`, and the invoice-payment handler `invoices.js:104`. `tenantId` is safely set last (no cross-tenant override — good), but callers can set unintended scalar columns (e.g. a client `walletBalance`, a booking `profit`). `quotations.js` (`QUOTATION_WRITE_FIELDS`) and `tenants.js` (`ALLOWED_TENANT_FIELDS`) show the correct whitelisting pattern the rest omit. Impact is intra-tenant data/financial integrity. · **DEBT**

### M4 — Route shadowing / duplicate admin endpoints
- `backend/src/app.js:165` mounts `adminSubscriptionWorkflow` at `/api/admin` **and** `:174` mounts it again at `/api/admin/subscription-workflow`. Because it loads before `admin.js` (`:167`), its `/payment-requests` handler **shadows** `admin.js:356` (GET) and `admin.js:365` (PATCH), which are now **dead**. Two routers own the same path; the same functionality is reachable at three URLs. · **DEBT** — collapse to one mount and remove the shadowed handlers.

### M5 — ~19 tenant-owned tables + child FK scalars lack indexes
- Beyond H4: `Quotation` (720), `User` (106), `PaymentRequest` (1029), `VendorBill` (353), `Expense` (808), `Agent` (258), `Account` (768), `Vendor` (331), `Subscription` (1013), `InvoiceInstallment` (660), `HajjPilgrim` (959), `HajjPackage` (908), `HajjGroup` (941), `SubscriptionHistory` (1069), `Task` (440), `TenantDomain` (per-tenant list), `AgentTransaction` (tenantId). Plus unindexed FK scalars on hot child tables: `BookingSegment/Traveler/ChecklistItem/TimelineEvent/Document.bookingId`, `InvoiceRefund/AuditEvent.invoiceId`, `ClientDocument.clientId`, `LeadActivity.leadId`, `QuotationVersion.quotationId`, `HajjPilgrimPayment.pilgrimId`, `TravelPackage*.packageId`. Postgres does not auto-index FKs. · **DEBT**

### M6 — Ledger write is non-atomic with the payment
- `backend/src/routes/invoices.js:98-125`. The payment handler creates the `Payment`, updates the invoice totals, rolls up the booking, then writes the ledger `Transaction` via `ensureLedgerIncomeTransaction` — which ends in `.catch(() => null)` (`invoiceInstallments.js:36`). None of it is wrapped in `prisma.$transaction`. If the ledger write fails, the payment still succeeds silently and the ledger (and therefore Reports) **understates cash** versus the invoices. The function is idempotent (dedupes on `referenceType:"payment"` + `referenceId`), which is good, but a failed write is swallowed. · **DEBT** — wrap the payment + ledger writes in one DB transaction, and stop swallowing the ledger error.

### M7 — Two sources of truth for "current plan"
- The runtime gate (`subscriptionAccess.js:28-31`) reads the **denormalized** `Tenant.subscriptionPlan/Status/Expiry` (schema 22-24), while the `Subscription` table (1013) is a separate historical store. The denormalization is intentional (fast gating) but undocumented as canonical, so the two can drift. · **MEDIUM / part INTENTIONAL** — document `Tenant.*` as the authoritative gate fields and treat `Subscription` as history.

### M8 — Date fields stored as `String` vs `DateTime` inconsistently
- Widespread. Financial dates are all `String` (`Payment.date` 685, `Transaction.date` 801, `Expense.date` 813, `VendorBillPayment.date` 381, `HajjPilgrimPayment.date` 1006); `Subscription.startDate/endDate` are `String` (1018-1019) while the sibling `SubscriptionAddon.startDate/endDate` and `SubscriptionHistory.*Date` are `DateTime`; even within `Booking`, `travelDateFrom/To` are `String` (516-517) but `followUpDate` is `DateTime` (532). String dates block range operators, carry no timezone, and sort fragilely. · **DEBT**

### M9 — Fragile tenant hard-delete; satellite tables orphan on delete
- Tenant hard-delete (`admin.js:321`) only works via a manual, order-sensitive "best-effort cascade" (`admin.js:308-316`, whose own comment says *"delete dependent rows that may not have ON DELETE CASCADE"*). `Booking.client` (506) and `Invoice.booking` (627) lack explicit `onDelete` (default `Restrict`). Separately, the plain-scalar-`tenantId` satellite tables with no Tenant FK — `SmsTemplate`, `WhatsAppTemplate`, `WhatsAppLog`, `NotificationAutomation`, `NotificationDelivery`, `SubscriptionAddon`, `SystemFlag`, `Document` — are **not** in the manual cleanup list, so their rows are **orphaned** after a tenant is deleted (unbounded dangling-`tenantId` growth). Not an isolation leak (new tenants get fresh UUIDs), but a hygiene/robustness gap. · **DEBT**

### M10 — Unauthenticated public writes + HTML injection into owner email
- `public.js:469` (`/api/public/book` → creates `Lead`) and `contact.js:6` (`/api/contact` → creates `ContactSubmission`) have no rate limit or CAPTCHA → spam/storage-flood by tenant slug. `/book` also interpolates unescaped `name`/`message`/`packageName` into the owner-notification email HTML (`public.js:551-557`) → HTML/link injection into the owner's inbox, and stored-XSS risk if the dashboard renders `lead.notes` as HTML. · **DEBT**

### M11 — No global search
- The user's "Search" review area: grep finds only per-module query filtering (`adminMasterData`, `agents`, `inventory`, `masterData`, `mice`, `visa`, …) and **no** unified cross-entity search (no global search route, no command palette / `GlobalSearch` component on the frontend). This is a product-completeness gap, not a bug. · **DEBT (feature gap)**

### M12 — List endpoints largely unpaginated
- Core list handlers use `findMany` with `where`/`orderBy` but **no `take`/`skip`** (e.g. `clients.js:112`, `invoices.js:111`, booking lists). Result sets are unbounded; at thousands of rows per tenant this is a latency/memory risk and compounds M5's missing indexes. · **DEBT**

---

## 5. LOW priority issues

- **L1 — Feature-Flag Engine is unwired.** `routes/featureFlags.js` + `lib/featureFlags.js` + `SystemFlag` model exist and are readable at `/api/feature-flags`, but a grep for consumers finds **zero** enforcement sites — nothing in the app changes behavior based on a flag. This is the documented Milestone-2 state ("all flags default OFF, nothing else consumes them yet") — **INTENTIONAL scaffolding**, but incomplete/dead until wired. (Distinct from *plan* feature gating via `requireFeature`, which **is** enforced — see §9.)
- **L2 — Upload before ownership check.** `clients.js:291-300` runs multer (writes up to 10×5 MB under `uploads/clients/<req.params.id>/`) **before** verifying the client belongs to the tenant. Orphan-file / storage-exhaustion; path is a single segment so traversal is constrained. · DEBT
- **L3 — Cron secret in URL query + non-constant-time compare.** `cron.js:16` accepts `?secret=` (leaks into proxy logs) and compares with `!==`. Fails closed if unset/short (good). · DEBT
- **L4 — Orphan tables `BspUpload` / `BspRecord`** (schema 1866-1904): defined, zero `prisma.bspUpload/bspRecord` anywhere, no route, no UI. Dead BSP-settlement feature. · DEBT
- **L5 — `adjustAccountBalance` dead code** (`accountLedger.js:21`, exported line 99): referenced only in a *comment* (`financeCore.js:20`). Balances are derived, not mutated — **INTENTIONAL** per the single-entry-ledger design; still, exported-but-uncalled.
- **L6 — Portal profile update spans tenants on shared email.** `portalFoundation.js:172` `updateMany({ where: { email } })` writes the portal user's own (whitelisted) contact fields across all tenants where that email is a Client. Minor; arguably **INTENTIONAL** given the email-identity model.
- **L7 — Unauthenticated payment-status disclosure.** `payments.js:156` gateway callback looks up an `auditLog` by `transactionId` with no tenant scope and returns `invoiceId`/`amount`/`status`. Requires knowing a tx id. · Gateway callback (INTENTIONAL) but under-scoped.
- **L8 — Missing HSTS / CSP** (`security.js`): sets `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, strips `X-Powered-By` (good) — no `Strict-Transport-Security`/`Content-Security-Policy`. Acceptable for a JSON API behind nginx. · Mostly INTENTIONAL.
- **L9 — Transitional model duplication.** `ClientDocument` + `BookingDocument` + `Document` dual-store (schema comment 2050-2062 says the new `Document` engine supersedes the two legacy tables "kept for backward compatibility" — both still read/written); `SmsTemplate/SmsLog` vs `WhatsAppTemplate/WhatsAppLog` near-identical per-channel pairs. · Documented / INTENTIONAL, unfinished migration.
- **L10 — Money as `Float`.** Uniform across all money fields (no `Decimal`). Documented single-entry-ledger choice; standing rounding risk on repeated add/subtract of running totals (`paidAmount`/`dueAmount`/`balance`). · INTENTIONAL, known.

---

## 6. Subsystem-by-subsystem review

| Subsystem | Verdict | Notes |
|---|---|---|
| **Architecture** | ✅ Strong | Additive engine-composition is real; pure leaf libs; no cycles. Clean separation (routes → libs → prisma). |
| **Database** | ⚠️ Sound w/ debt | No isolation/integrity defects; but missing indexes (H4/M5), date drift (M8), 2 orphan tables (L4), fragile cascade (M9). |
| **API** | ⚠️ Mostly consistent | Uniform `res.status().json({message})`, 404-on-cross-tenant, 402 subscription, 403 authz. Blemish: route shadowing (M4); response envelopes vary (raw array vs object). |
| **Authentication** | ✅ Strong | `jwtSecret.js` forces ≥32-char secret in prod (`process.exit(1)` else), dev fallback behind `ALLOW_DEV_JWT`; bcrypt(10); generic errors / no user enumeration; hashed+expiring reset tokens; TOTP 2FA for super_admin. Undermined only by H1 (secret in repo). |
| **Authorization** | ⚠️ Strong w/ gaps | Three-layer model (`requireRole` / `requirePermission` / plan gates) applied consistently — except C1, H2 (export), M2 (hajj). |
| **Permissions** | ✅ In sync | Backend `ROLE_PERMISSIONS` (auth.js) and frontend `permissions.ts` share the same 5 roles; single mirrored matrix. (Module/action-level diff not exhaustively compared — partial confidence.) |
| **Plan Engine** | ✅ Solid | Single source of truth (`planFeatures.js`), wrapped once by `planEngine.js`; normalizes aliases in one place to avoid drift. |
| **Subscription Engine** | ✅ Works | Lifecycle via payment-request approval; expiry gate fails closed; billing engine composes cleanly. Caveat M7 (dual plan state). |
| **CRM** | ✅ Functional | Clients/Leads/Agents/Vendors tenant-scoped; `crmEngine` read-composition over them. |
| **Finance** | ✅ Works w/ caveat | Derived-balance ledger; single origination point. Caveat M6 (non-atomic ledger write). |
| **Booking** | ✅ Consistent | One generic `Booking` + 5 type modules on a shared spine (see §7). |
| **Documents** | ⚠️ Transitional | New `Document` engine + 2 legacy tables in parallel (L9). |
| **Customer Portal** | ✅ Strong isolation | Separate JWT audience + email-ownership + output sanitizers. |
| **Agent Portal** | ✅ Strong isolation | Agent sees only own customers/bookings; role-gated `403` cross-role. |
| **Reporting** | ✅ Sound | Reuses Finance Core builders (no duplicate math); reads same ledger as the money chain. |
| **Dashboard** | ✅ OK | Tenant-scoped KPI aggregation via batch-fetch + in-memory (not N+1). |
| **Notification** | ✅ Functional | in-app + SMS + WhatsApp + email; automation + delivery log; degrades to console when unconfigured. |
| **Search** | ❌ Absent (global) | Per-module filtering only; no unified search (M11). |
| **Performance** | ⚠️ Needs indexes | No confirmed N+1 in sampled hot paths (batch patterns are correct); real risks are missing indexes (H4/M5) + unpaginated lists (M12). |
| **Security** | ⚠️ Blocked | Excellent tenant discipline undercut by C1 + H1–H3. See §2–§3. |

---

## 7. Booking modules review (Air Ticket · Visa · Hotel · Hajj/Umrah · Tour)

All five are type-scoped views over the one generic `Booking` model and a shared spine (`bookingPricing`, `bookingIdentityEngine`, `bookingRegistry`, `bookingServiceDetails`), delegating shared persistence to `bookings.js`. All five apply `checkPlanLimit("bookings")` on create and are tenant-scoped. Architecture is uniform across the five — no module re-implements the shared persistence.

| Module | Status | Notes |
|---|---|---|
| **Air Ticket** | ✅ Reference impl | Full per-type validation (`airTicketBookingValidation`), identity, pricing, status. |
| **Visa** | ✅ Consistent | Same spine + integrates `VisaApplication` for visa tracking. |
| **Hotel** | ✅ Consistent | Same spine + reservation/voucher/room/check-in-out workflow + Document engine. |
| **Hajj & Umrah** | ✅ Consistent | Sale layer composes the existing `/api/hajj` desk (`HajjPackage`/`HajjGroup`) + pilgrim manifest + mahram map. ⚠️ Note the *operations desk* `hajj.js` lacks permission gates (M2) — separate from the booking module. |
| **Tour** | ✅ Consistent | One module for domestic + international; itinerary/destinations/allocation via serviceDetails; travellers via `BookingTraveler`. |

**Consistency verdict:** ✅ The five modules are genuinely uniform and DRY over the shared spine. `serviceDetails` JSON is per-type validated. No duplication of booking persistence.

---

## 8. Money chain confirmation — Booking → Invoice → Payment → Ledger → Reports

**Verdict: ✅ WORKS end-to-end (one reliability caveat).**

Traced path (`invoices.js:98-125`, `invoiceInstallments.js`, `reportingCenter.js`):

1. **Booking → Invoice** — `Invoice.bookingId` links invoice to booking (`invoices.js:103`); tenant-scoped.
2. **Invoice → Payment** — `Payment` row created, tenant-scoped, linked to `invoiceId`+`bookingId`; invoice `paidAmount`/`dueAmount`/`status` recomputed from the sum of all payments (`:104-108`, no double-count).
3. **Booking rollup** — booking `paidAmount`/`dueAmount`/`paymentStatus` updated via tenant-scoped `updateMany` (`:110-114`).
4. **Payment → Ledger** — `ensureLedgerIncomeTransaction` writes a `Transaction` (`type:"income"`, `category:"invoice_payment"`, `referenceType:"payment"`), **idempotent** by `referenceId` (`:117-123`; `invoiceInstallments.js:36`).
5. **Installments** — payment allocated across installments oldest-first (`:125`).
6. **Ledger → Reports** — `reportingCenter.js` reuses Finance Core's `buildBookLedger`/`buildAging` over the same `Transaction` rows — reported cash/revenue/receivable derive from the identical source the ledger uses (no divergent computation).

**Caveat (M6):** steps 2–4 are separate awaits, not one `prisma.$transaction`, and the ledger write swallows errors (`.catch(()=>null)`). A failed Transaction write leaves the invoice paid but the ledger short → Reports understate. Recommend wrapping in a DB transaction.

---

## 9. Enforcement confirmation — Plan Locking · Feature Flags · Usage Limits · Subscription Expiry · Portal Access

| Control | Verdict | Evidence |
|---|---|---|
| **Plan Locking** | ✅ Enforced | `checkPlanLimit` gates creation in 11 route files (clients, leads, quotations, bookings + all 5 booking modules, tenants, billing); `requireFeature` gates 5 (blogs, campaigns, sms, website, whatsapp). Both **fail closed** (503/403). |
| **Feature Flags** | ⚠️ Split | **Plan-feature** gating (`requireFeature`, e.g. `hasWhatsApp`) **works**. The **engineering Feature-Flag Engine** (`SystemFlag` / `/api/feature-flags`) is **read-only, unwired** — zero enforcement consumers (L1). Intentional scaffolding, not yet a functioning gate. |
| **Usage Limits** | ✅ Enforced (base plan) | `checkPlanLimit` counts tenant rows via `RESOURCE_MODEL_MAP` vs plan limit; `/api/billing/usage` surfaces effective limits. ⚠️ **Known gap (documented in the billing commit):** live enforcement reads *base* plan limits — purchased **add-ons do not yet extend the live `checkPlanLimit` path**; the billing engine computes effective limits but that isn't wired into enforcement. |
| **Subscription Expiry** | ✅ Enforced | `subscriptionAccessGate` returns `402 SUBSCRIPTION_INACTIVE` for expired/suspended/cancelled tenants, with lazy `expireTenantIfNeeded`; exempt list (incl. `/billing`, `/payment-requests`, `/auth`, `/admin`) lets tenants reach renewal. `super_admin` bypasses. |
| **Portal Access** | ✅ Enforced | Separate `portal` JWT audience (agency tokens rejected), email-ownership filtering, per-role `403` cross-role, output sanitizers strip internal fields. |

---

## 10. The 12 integrity checks

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | No duplicate logic | ⚠️ Mostly | Engine composition verified genuine (no re-implementation); `normalizePlan` centralized to avoid drift. **But** M4 route shadowing. |
| 2 | No duplicate models | ⚠️ Mostly | Refund/commission/notification clusters are legitimately distinct; documents dual-store + SMS/WhatsApp pairs are documented transitional debt (L9). |
| 3 | No duplicate APIs | ❌ Minor | M4: `/payment-requests` defined in two routers, one shadowed. |
| 4 | No duplicate permissions | ✅ Pass | One matrix, mirrored backend↔frontend; roles in sync. |
| 5 | No dead code | ⚠️ Some | `adjustAccountBalance` (intentional), `Bsp*` tables (L4), shadowed admin handlers (M4), unwired Feature-Flag Engine (L1). |
| 6 | No orphan tables | ❌ Minor | `BspUpload` / `BspRecord` (L4). |
| 7 | No circular dependencies | ✅ Pass | Engine libs are pure leaf modules (verified zero-require on Finance Core / Reporting Center); no require cycles found. |
| 8 | No inconsistent naming | ⚠️ Some | Date `String` vs `DateTime` (M8); `note` vs `notes`; path style mixed (`/hajj` vs `/air-ticket-bookings` vs `/crm-engine`). |
| 9 | No missing validation | ⚠️ Some | Booking modules have real per-type validation; but mass-assignment (M3) + unvalidated public writes (M10). |
| 10 | No missing indexes | ❌ Fail | H4 + M5: ~19 tables + hot FK scalars unindexed. |
| 11 | No N+1 queries | ✅ Pass (sampled) | Sampled hot loops are batch-fetch + in-memory, not N+1; scale risk is unpaginated lists (M12), not N+1. |
| 12 | No tenant data leakage | ⚠️ Mostly | Discipline excellent & consistent **except** C1 (db-backup), H2 (export authz), H3 (accounts read-back). Core CRUD scoping is strong. |

---

## 11. Frontend / UI review (structural)

- **Routing & guards** (`src/App.tsx`, 344 lines): composable guards — `ProtectedRoute` (auth), `PermissionRoute` (module), `AdminRoute` (super-admin), plus `SubscriptionRoute`/gates. Heavy pages `lazy()`-loaded. Structure is clean and consistent. All pages are reachable (spot-checked: `Subscriptions.tsx` routes via `SubscriptionRoute`, not a direct App.tsx import — **not** orphaned).
- **Gating components** present and used: `FeatureGate`, `PermissionGate`, `SubscriptionGate`, `HajjModuleGate`, `BdModuleGate` — client mirrors the server's plan/permission model.
- **API client** (`src/lib/api.ts`, 1529 lines): single `request()` helper injects the bearer token; one typed API object + interface per resource. It is large and monolithic — a **maintainability** concern (consider splitting per-domain), not a correctness one.
- **Scale**: 108 pages / 151 components / 53 libs — substantial but organized (`pages/`, `pages/admin/`, `pages/site/`, `pages/marketing/`, `portal/`).
- **Depth caveat:** this pass reviewed routing/guards/structure, **not** per-form validation parity, table virtualization, or responsive breakpoints. A dedicated UX pass is recommended before launch. No blocking UI issue surfaced structurally.

---

## 12. Production Readiness Scorecard

| Dimension | Score /10 | Rationale |
|---|---|---|
| Architecture & modularity | 9.0 | Real composition, no cycles, DRY engines. |
| Multi-tenant isolation (design) | 9.0 | Excellent, consistent discipline. |
| Multi-tenant isolation (holes) | 5.0 | C1 + H2 + H3 drag this hard. |
| Authentication | 8.5 | Strong; −1.5 for H1 secret-in-repo. |
| Authorization / permissions | 7.0 | Consistent except C1/H2/M2. |
| Database schema | 7.0 | Sound; indexes + date drift + cascade debt. |
| Performance / scalability | 6.0 | Index + pagination debt; no N+1 though. |
| Finance correctness | 7.5 | Chain works; −atomicity (M6), Float. |
| Security posture | 5.5 | 1 CRITICAL + 3 HIGH; strong foundation. |
| Code quality / debt | 7.5 | Low genuine duplication; small dead-code/orphan set. |
| Feature completeness (in-scope) | 8.0 | Core modules complete; global search + add-on enforcement gaps. |
| Test coverage | 7.0 | 29 backend suites (598 tests) + 25 frontend — strong on pure logic/auth; light on live-DB E2E. |

### **Overall: 7.0 / 10 — Conditionally production-ready.**

**Not shippable until fixed:** C1 (db-backup authz), H1 (rotate + purge `.env.backup`), H2 (export authz), H3 (accounts read-back). All four are small, targeted changes.
**Fix within first sprint post-launch:** H4/M5 (indexes), M1 (rate limiting), M2 (hajj gates), M6 (atomic ledger), M3 (mass-assignment).
**The architecture itself needs no rework** — this is a strong platform with a short, specific blocker list.

---

## 13. Recommended improvements (prioritized)

**P0 — before launch**
1. Gate `POST /api/export/db-backup` to `super_admin` (C1).
2. Purge `.env.backup`, extend `.gitignore` to `.env*`, **rotate all leaked secrets** (H1).
3. Add role gates to `/api/export/csv` + `/workbook` (H2); add `tenantId` to `accounts.js:114` re-fetch (H3).
4. Add `@@index([tenantId, createdAt])` to `AuditLog` + `Transaction` (H4).

**P1 — first sprint**
5. Backfill the ~19 missing `tenantId` indexes + hot FK-scalar indexes (M5).
6. Enable global API rate limiting; unset `RATE_LIMIT_DISABLED` in prod (M1).
7. Add `requirePermission` across `hajj.js` (M2).
8. Wrap payment + ledger writes in `prisma.$transaction`; stop swallowing the ledger error (M6).
9. Whitelist write fields on the mass-assignment routes (M3); throttle/validate public writes + escape email HTML (M10).
10. Collapse the `adminSubscriptionWorkflow` double-mount and delete shadowed `admin.js` handlers (M4).

**P2 — technical-debt paydown**
11. Wire purchased add-ons into live `checkPlanLimit` enforcement (§9 gap).
12. Wire or remove the Feature-Flag Engine (L1); drop the dead `Bsp*` tables (L4).
13. Converge String date fields to `DateTime` (M8); document `Tenant.*` as canonical plan state (M7).
14. Replace the manual tenant-delete cascade with explicit `onDelete` + cover satellite tables (M9).
15. Add pagination to list endpoints (M12); add a global search (M11); split `api.ts` per-domain (§11).
16. Finish the Document-engine migration off `ClientDocument`/`BookingDocument` (L9).

---

## 14. Technical-debt register (summary)

| Item | Type | Severity | Ref |
|---|---|---|---|
| Full-DB export authz | Security | CRITICAL | C1 |
| Secrets in git (`.env.backup`) | Security | HIGH | H1 |
| Export endpoints unauthorized | Security | HIGH | H2 |
| Accounts cross-tenant read-back | Security | HIGH | H3 |
| Missing indexes (AuditLog/Transaction) | Perf | HIGH | H4 |
| No global rate limiting | Security | MEDIUM | M1 |
| Hajj module ungated | Authz | MEDIUM | M2 |
| Systemic mass-assignment | Security | MEDIUM | M3 |
| Route shadowing / double-mount | Duplication | MEDIUM | M4 |
| ~19 tables missing tenantId index | Perf | MEDIUM | M5 |
| Non-atomic ledger write | Finance | MEDIUM | M6 |
| Dual plan-state source of truth | Data | MEDIUM | M7 |
| String vs DateTime dates | Schema | MEDIUM | M8 |
| Fragile tenant-delete + orphan satellites | Data | MEDIUM | M9 |
| Unthrottled public writes + email HTML injection | Security | MEDIUM | M10 |
| No global search | Feature | MEDIUM | M11 |
| Unpaginated lists | Perf | MEDIUM | M12 |
| Feature-Flag Engine unwired | Completeness | LOW | L1 |
| Add-ons not in live enforcement | Completeness | LOW | §9 |
| `Bsp*` orphan tables | Dead code | LOW | L4 |
| `adjustAccountBalance` unused | Dead code | LOW | L5 |
| Document dual-store / SMS-WhatsApp pairs | Duplication | LOW | L9 |
| Money as Float | Precision | LOW | L10 |
| `api.ts` monolith | Maintainability | LOW | §11 |

---

*End of audit. No code, schema, packages, or data were modified in producing this document. Awaiting approval before any remediation.*
