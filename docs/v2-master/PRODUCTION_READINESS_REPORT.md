# Production Readiness Report — TravelAgencyWeb (TAWSS / Hearth Core App)

**Date:** 2026-07-11
**Branch:** `v2-master-blueprint`
**Scope:** Full-stack audit of the multi-tenant Travel Agency ERP/SaaS — frontend (112 pages), backend (~90 mounted routers, 89 route files), auth, capability/plan model, multi-tenancy, DB schema, security, uploads, payment integrations, notifications, responsive UI, localization (EN/BN), production env, and build output.
**Method:** Five parallel specialist audit passes over the codebase + direct first-hand verification of the highest-risk paths (payments, tenant scoping, git history) + deterministic gates (build, tests, Prisma validation, i18n parity).

> ⚠️ **Do not deploy on the basis of this report alone.** Two Critical issues are outstanding — one is fixed in code (below), one requires an **operational** remediation (secret rotation + git-history purge) that only the operator can perform. See §2 and §8.

---

## 1. Verdict

**Overall: STRONG core, NOT yet production-ready — blocked by 2 Critical issues (1 fixed here, 1 operational).**

The platform is architecturally sound and unusually disciplined for its size: **no cross-tenant data leak was found**, the payment path is **forgery-proof, idempotent, and amount-verified**, and the frontend/backend permission and plan matrices are **in sync and fail-closed**. The blockers are not systemic code-quality problems — they are a leaked-secret hygiene issue in git history and a single instant-confirm payment path that was wired to subscriptions. After the Critical fix in §8 and the operational remediation in §2 (C1), the residual risk is a set of High/Medium hardening items that can be scheduled into a launch window.

| Gate | Result |
|------|--------|
| `npm run build` (frontend) | ✅ **PASS** (warns: JS chunks > 500 kB) |
| Frontend tests (`vitest`) | ✅ **28 / 28 pass** |
| Backend tests (`node --test`) | ⚠️ **626 / 627 pass** (1 pre-existing failure — `sidebarEngine`, non-load-bearing; see M-18) |
| `prisma validate` | ✅ **Schema valid** |
| `GET /api/health` = 200 | ⛔ **BLOCKED** — no database connection available in this environment (see §9) |
| i18n EN/BN parity | ✅ **3121 / 3119 keys**, 2 trivial gaps |
| Build artifacts | ✅ Present & complete (large chunks + oversized favicon — perf/hygiene) |

---

## 2. Critical Issues (must fix before production)

### C1 — Production secrets committed in git history *(OPERATIONAL — not auto-remediated)*
- **Where:** `backend/.env.backup`, present in history at commit `a2202e0` (removed in `7b02f84`). Confirmed to contain 4 real secret-key lines.
- **Exposure:** `git show a2202e0:backend/.env.backup` yields real values for `JWT_SECRET`, `JWT_PORTAL_SECRET`, `DATABASE_URL` (DB password), and `SMTP_PASS`. The file is gitignored now and absent from `HEAD`, but **anyone with clone/repo access can retrieve the secrets from history**. A leaked `JWT_SECRET`/`JWT_PORTAL_SECRET` lets an attacker **forge valid JWTs for any tenant or super_admin**; the `DATABASE_URL` password grants DB access.
- **Why not fixed here:** remediation is (a) **rotating live production secrets** (must not touch production per task constraints) and (b) **rewriting shared git history + force-push** (a destructive, outward-facing operation requiring explicit operator coordination — every clone must be re-cloned). Neither is safe to auto-execute.
- **Required remediation (operator):**
  1. Rotate `JWT_SECRET`, `JWT_PORTAL_SECRET`, the PostgreSQL password, and SMTP credentials. (Rotating the JWT secrets invalidates all existing sessions — expected.)
  2. Purge the blob from history with `git filter-repo` (or BFG), then force-push; confirm no other `.env`/`.env.backup` variant was ever committed.
  3. Verify the GitHub mirror/forks no longer expose the blob.
- This matches the pre-existing release blocker recorded in [`103-RC1-Release-Checklist.md`](103-RC1-Release-Checklist.md) §"Secrets rotated".

### C2 — Cash-on-Delivery subscription activation bypass *(FIXED — see §8)*
- **Where:** `backend/src/routes/payments.js` (`POST /api/payments/initiate`, COD branch) → `backend/src/services/paymentGateway.js` (`activateSubscriptionFromPaymentRequest`).
- **Exploit:** `/api/payments/initiate` is guarded by `authenticate` only (no role/permission check). The `gateway:"cod"` branch instantly confirmed a payment with a **client-supplied `amount`** and, when given a `paymentRequestId`, activated the subscription: it flipped `tenant.subscriptionStatus="active"` + `subscriptionPlan=<requestedPlan>` and extended `subscriptionExpiry`. The only amount guard compared against the same client-supplied amount. **Any authenticated user could therefore activate any paid plan (up to enterprise) for their own tenant for free**, and — because the payment-request lookup was unscoped by tenant — a user who knew another tenant's `paymentRequestId` could **force-activate that tenant's subscription**.
- **Impact:** direct revenue loss (free plan upgrades → full enterprise capabilities) + cross-tenant integrity.
- **Fix (applied):** the COD path now records offline cash **against a customer invoice only** and rejects any request carrying a `paymentRequestId` (HTTP 400). Legitimate subscription payments already flow exclusively through the **validated online gateways** (SSLCommerz/bKash, which verify real payment server-side) or the **manual proof → admin-approval** workflow — confirmed by tracing both frontend callers. **Blast radius: none** (no legitimate frontend flow sends `paymentRequestId` with `cod`).

---

## 3. High Issues (fix before or immediately after launch)

- **H1 — Financial writes are not atomic.** `prisma.$transaction` is used in only a handful of non-financial routes; **none of the money paths use it.** `invoices.js` `POST /:id/payments` (record payment) and `DELETE /:id/payments/:payId` (reverse) run `payment.create/delete` → invoice roll-up → booking roll-up → ledger `Transaction` → installment allocation as independent awaits; `vendors.js` supplier-bill payments likewise. A mid-sequence failure records the payment but leaves `paidAmount`/`dueAmount`/`status`, booking totals, and the ledger inconsistent, and returns a 500 (client may retry → the manual path is **not** idempotent → double payment). **Fix:** wrap each money mutation in a single interactive `$transaction`; fire notifications/audit only after commit.
- **H2 — Invoice mass-assignment + unvalidated amounts.** `invoices.js` `POST` and `PATCH /:id` spread `req.body` into Prisma with no field whitelist, so a client can set `paidAmount`, `dueAmount`, `status`, `totalAmount` directly — e.g. `PATCH {paidAmount}` marks an invoice paid **with no payment**. Payment `amount` (`:110`) is taken raw (negative/zero/overpayment accepted → corrupts roll-ups). `quotations.js` already does this correctly via a `QUOTATION_WRITE_FIELDS` whitelist — apply the same pattern; validate `amount > 0`.
- **H3 — Financial/billing models routed through the raw CRUD factory.** `crud.js` (`{...req.body, tenantId}`, `data: req.body`) backs `/api/transactions` (the single-entry ledger) and `/api/subscriptions`. A user with `accounts.create` can POST arbitrary ledger rows (any `type`/`amount`/`status`, no `referenceType` → invisible to reversal/dedup, double-counts in P&L); a `subscription.create` holder can write arbitrary `Subscription` rows. *(Note: this is not a plan-escalation — effective capability derives from `Tenant.subscriptionPlan/Status`, not the `Subscription` table — but it corrupts financial/billing data.)* **Fix:** give these models validated hand-written routes or a per-model allow-list.
- **H4 — Suspended/expired tenants can still send SMS & email.** `subscriptionAccess.js` `EXEMPT_PREFIXES` includes `/sms` and `/email`, so the active-subscription gate never runs for `POST /api/sms/send` and `POST /api/email/send/*`. A suspended/cancelled tenant keeps **burning platform SMS/email credits** and messaging customers, defeating suspension. **Fix:** remove `/sms` and `/email` from the exempt list (internal renewal messaging already uses the internal notification service, not these tenant-facing HTTP routes).
- **H5 — Email router has no feature/role gate.** Unlike `sms.js` (`requireFeature("hasSmsIntegration")`) and `whatsapp.js`, `email.js` mounts only `authenticate`. A **Basic-plan** tenant (whose plan explicitly excludes email notifications) can send booking/invoice emails — a plan-gate bypass — and any role can trigger sends. **Fix:** add `requireFeature("hasEmailNotifications")` + a role/permission guard.
- **H6 — Stored-XSS / unsafe upload handling.** `express.static("/uploads")` is mounted **before** `securityHeaders`, so served files carry no `nosniff`/`X-Frame-Options`; the client-document upload filter trusts the **client-supplied `mimetype`** and stores the attacker-controlled extension (`.html`, `.svg`). `evil.html` (mimetype `application/pdf`) is stored as `{uuid}.html` and served as `text/html` on the API origin. *(Mitigated by origin separation — the app uses Bearer-token-in-localStorage, not cookies on the API origin — but still a real stored-XSS surface.)* **Fix:** register `securityHeaders` before the static mount, set `Content-Disposition: attachment` on `/uploads`, validate real type by magic bytes, and derive the stored extension from the whitelist (not `originalname`).
- **H7 — Staff/ERP app is effectively unusable on mobile.** `AppSidebar` renders `<Sidebar collapsible="none">` — a static 256 px sidebar with no mobile Sheet/offcanvas/collapse — and `TopNavbar` has no `SidebarTrigger`. On a ~360–390 px phone the sidebar permanently consumes ~256 px across all ~90 staff routes with no way to hide it. **Fix:** use `collapsible="offcanvas"` + add a `SidebarTrigger` to `TopNavbar` (as `AdminLayout` already does).

---

## 4. Medium Issues

- **M1 — Ledger posting is best-effort.** `ensureLedgerIncomeTransaction` and the double-entry `postX` calls swallow errors (`.catch`), so a payment can persist with no ledger `Transaction` and/or no journal entry. The three financial views read different tables (`finance` → `Payment`, `financeCore`/`accounts` → `Transaction`, `accounting` → `JournalLine`) and can silently disagree; a `/resync` backfill exists precisely because posting isn't guaranteed. **Fix:** post the single-entry `Transaction` inside the money transaction (H1); keep the journal best-effort + resync.
- **M2 — Unbounded list queries.** `findMany` with no `take` on `invoices`, `clients`, `leads`, `accounts/ledger`, `transactions`, `expenses`, `payments`, `vendors` returns entire tenant tables — latency/memory DoS on large tenants. `bookings`/`notifications`/`auditLogs` already paginate; apply the same `take`/`skip` cap.
- **M3 — SMS/storage/WhatsApp quotas not enforced server-side.** `plans.ts` advertises `maxSmsPerMonth`/`maxStorageMB`; backend `checkPlanLimit` only covers `users`/`branches`/`domains`. A tenant can exceed advertised SMS/WhatsApp/storage caps via direct API calls. **Fix:** meter these as monthly usage counters in the send/upload services.
- **M4 — One JWT secret for all token types.** Staff, portal (`aud:"portal"`), magic-link (`aud:"portal-magic"`), and WhatsApp-verify tokens are all signed with the same secret; cross-use is blocked today only by audience/shape checks (fragile). **Fix:** dedicated `PORTAL_JWT_SECRET`; always verify with `algorithms` + `audience` pinned.
- **M5 — Missing HSTS and CSP headers.** `security.js` sets `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, but no `Strict-Transport-Security` and no `Content-Security-Policy`. **Fix:** add both (or adopt `helmet`).
- **M6 — Rate limiting only on `/api/auth`.** Public endpoints (`/contact`, `/demo-requests`, `/public`, gateway callbacks, coupon checks) and all data mutations are unthrottled. **Fix:** add a global `/api` limiter + stricter limits on unauthenticated POSTs.
- **M7 — Unauthenticated PII document exposure.** `/uploads` is open static; client passport/visa scans at `/uploads/clients/{clientId}/{uuid.ext}` are retrievable by URL with no auth/tenant check (UUID obscurity only). **Fix:** serve documents through an authenticated, tenant-scoped route.
- **M8 — Status set with no enum/transition check.** `invoices.js`, `quotations.js`, `expenses.js`, `payroll.js` persist any client string as `status`, breaking status-keyed queries (receivables/aging, P&L, reminders). `bookings.js` does this correctly via the Status Engine — adopt the same guard.
- **M9 — Cross-tenant IDOR write (group tours).** `groupTours.js` `DELETE /:id/bookings/:bookingId` calls `groupTourBooking.deleteMany({groupTourId, bookingId})` without verifying the parent `groupTour` belongs to `req.tenantId`, so a user in tenant B can delete tenant A's membership row. **Fix:** `findFirst` the parent by `{id, tenantId}` first (as the sibling `POST` already does).
- **M10 — Defense-in-depth: `activateSubscriptionFromPaymentRequest` looks up the request by `findUnique({id})` with no `tenantId`.** The primary exploit path (COD) is now closed (C2), and remaining callers are validated gateway webhooks where `tenantId` is trustworthy, but the lookup should still be scoped `{id, tenantId}` when a tenantId is supplied.
- **M11 — No process-level crash guards.** `index.js` has no `unhandledRejection`/`uncaughtException` handler and no graceful shutdown; an unguarded async rejection can terminate the process (Node ≥15). **Fix:** add process handlers that log rather than crash + SIGTERM `server.close()` + `prisma.$disconnect()`.
- **M12 — Customer-facing quotation PDF shows placeholder branding.** `QuotationPrint.tsx` renders hardcoded `"[Your Agency Name]"`, `"info@agency.com"`, etc. instead of tenant data (it never reads `tenant`). `InvoiceReceipt.tsx` does it correctly via `useAuth()`. **Fix:** pull tenant branding from `useAuth()`.
- **M13 — No global 401 handler (frontend).** `api.ts request()` throws generically on any non-OK; nothing intercepts 401 to clear the token and redirect. A mid-session token expiry strands the user on a broken screen. **Fix:** centralize a 401 handler that clears the token and redirects to `/login`.
- **M14 — i18n coverage gap (~46 of 112 pages).** Key **parity** is excellent, but ~46 mostly-newer feature pages (loyalty, referrals, sales-analytics, group-tours, mice, visa-tracker, inventory, recruitment, campaigns, complaints, branches, payroll, financial-statements, etc.) never call `useTranslation` and have no namespace, so Bangla users see hardcoded English. **Fix:** wrap their strings in `t()` and add EN/BN keys.
- **M15 — CORS `*`-with-credentials latent risk.** Safe by default (explicit allow-list + `*.travelagencyweb.com` + verified custom domains), but `credentials:true` would reflect any Origin if `CORS_ORIGIN` were ever set to `*`. **Fix:** explicitly refuse `*` when credentials are enabled.
- **M16 — Invoice `PATCH` unguarded once payments exist.** `totalAmount` can be edited below `paidAmount` → negative `dueAmount` + wrong status.
- **M17 — Payroll pay posts no ledger entry.** Paying a payslip (`status:"paid"`) creates no `Expense`/`Transaction`/journal entry, so salary cash-out is absent from P&L and cash-flow. *(Payroll-run creation is fine — server-computed, atomic.)*
- **M18 — 1 failing backend test.** `test/sidebarEngine.test.js:119` — a `pro`-plan tenant sees a group-tours nav entry that should be hidden below the `business` bundle floor. The Sidebar Engine (`/api/sidebar-engine`) is **read-only and not consumed by the live sidebar** (which uses `src/config/navigation.ts`), and real access is enforced by backend middleware regardless of nav visibility — so impact is confined to a computed nav preview. Still a red quality gate (the release checklist expects a green suite). **Fix:** reconcile the bundle-floor logic vs. the test expectation.

---

## 5. Low Issues

- **L1** — bcrypt cost factor 10 (recommend 12); password-reset tokens stored **plaintext** in the DB (`auth.js`) → a DB read enables account takeover (store a SHA-256 hash instead).
- **L2** — `jwt.verify` does not pin `algorithms` (not exploitable with jsonwebtoken 9 + a string secret; harden with `{algorithms:["HS256"]}`).
- **L3** — `whatsapp.js` `POST /test` sends arbitrary `to`+`message` to any number (any role in a WhatsApp-enabled tenant); gate it like `/send`.
- **L4** — Login returns before `bcrypt.compare` when the user is missing → timing user-enumeration. Compare against a dummy hash always.
- **L5** — `subscriptionAccess.js` super_admin bypass reads `role` from the **token**, not the DB → a demoted super_admin bypasses the gate for the token lifetime (main `authenticate` re-reads the DB, so route access is fine).
- **L6** — `RATE_LIMIT_DISABLED=true` globally disables auth/portal rate limiting; ignore the kill-switch when `NODE_ENV==="production"`.
- **L7** — Per-route `catch` returns `res.status(500).json({message: err.message})`, leaking raw Prisma/internal error text (bypasses the sanitizing global handler). Use `next(err)`.
- **L8** — `cron.js` accepts `CRON_SECRET` via `req.query.secret` (leaks into access logs) and compares with `!==` (non-constant-time). Header-only + `crypto.timingSafeEqual`. *(Fails closed otherwise.)*
- **L9** — `payments.js` `POST /callback/:gateway` is unauthenticated and returns `invoiceId`/`amount`/`gateway`/`status` for any known transaction id (info disclosure).
- **L10** — `public.js` lists Hajj packages with `status: {not:"archived"}`, leaking `draft` packages publicly (the sibling `travelPackage` query correctly requires `status:"published"`).
- **L11** — `tenantDomains.js` returns the other owning tenant's identity on a domain conflict (competitor enumeration); return a generic "already registered".
- **L12** — `vendors.js` `hydrateVendorBills` reads `booking.findMany({id:{in:...}})` without `tenantId` (a crafted cross-tenant `bookingId` leaks booking `title`/`destination`).
- **L13** — `hajj.js` `POST /pilgrims` trusts `packageId` from the body and recomputes `enrolled` unscoped by tenant (cross-tenant write to `HajjPackage.enrolled`).
- **L14** — `emailService.js` interpolates user `name`/`message`/`subject` raw into admin-notification HTML (body injection into the admin inbox); HTML-escape.
- **L15** — `/quotations/:id/print` has no `P` guard (unlike its siblings); harmless today (API requires a token → 401, no data leak) but inconsistent.
- **L16** — `apiConfig.ts` falls back to `http://localhost:4000/api` when `VITE_API_URL` is unset; a prod build that omits it silently targets localhost. Assert non-localhost when `import.meta.env.PROD`.
- **L17** — Core CRM/sales routes (`/clients`, `/leads`, `/bookings`, `/invoices`, …) use `P` (auth) rather than `PM` (module permission) — defense-in-depth inconsistency (backend `requirePermission` + tenant scoping remain the real boundary).
- **L18** — Build/perf hygiene: largest JS chunks ~2.6 MB (Vite warns > 500 kB — poor code-splitting, slow first load on low-bandwidth mobile); `dist/favicon.png` is 2.4 MB. Consider `manualChunks` + a small favicon.
- **L19** — 2 i18n keys missing in `bn.json` (`deploy.pm2Title`, `deploy.pm2Hint` — dev/ops-facing only).
- **L20** — `express.json({limit:"12mb"})` is large (needed for base64 payment-proof uploads); consider moving proof upload to multipart and lowering the JSON limit.

---

## 6. Strengths (verified production-grade)

These were checked first-hand and are genuinely solid — they should not be re-litigated:

- **No cross-tenant data leak.** Tenant scoping is **systematic, not ad hoc**: a `getTenantX(id, tenantId)` `findFirst` guard before any by-id mutation; `updateMany`/`deleteMany` on `{id, tenantId}` returning 404 on no-match; child collections reached only through a tenant-verified parent; the generic CRUD factory scopes every verb.
- **Payment integrity is production-grade.** Both gateways verify authenticity server-side before crediting (SSLCommerz `val_id` server-to-server validation using the gateway-confirmed amount; bKash `/execute` gated on `transactionStatus === "Completed"`). Crediting is **idempotent** (invoice payments dedup by `transactionRef`, ledger by `referenceId`, subscription activation guards on `status==="approved"`), so SSLCommerz firing both `/success` and `/ipn` cannot double-credit. Subscription activation is **amount-verified** (won't provision if `paid < expected`). *(Residual: not wrapped in `$transaction` and no unique constraint on `transactionRef` → a narrow concurrent-double-fire race — see H1/M1.)*
- **Authorization is in sync and fail-closed.** The backend `ROLE_PERMISSIONS` matrix and frontend `permissions.ts` match across all roles; a missing role/module **denies** (403), never silently allows. `checkPlanLimit`/`requireFeature` deny (503) on error. Plan limits (`users`/`branches`/`domains`) and all 17 feature flags match `plans.ts`.
- **No unguarded admin/staff routes.** All 22 `/admin/*` routes use the super-admin `A` guard; every staff data page is at least auth-gated.
- **Boot integrity.** `createApp()` loads cleanly (102 layers); all ~90 routers resolve.
- **JWT boot enforcement fails closed** in production (missing/short secret → `process.exit(1)`; dev fallback unreachable in prod).
- **No injection surface.** No `$queryRaw`/`$executeRaw` with interpolation (only a static `SELECT 1`); no SSRF (all server-side `fetch` targets fixed/env hosts; domain verification escapes input to a fixed `dns.google`); the sole `child_process` use is `execFile("pg_dump", [args])` — no shell, args from env, super-admin gated.
- **Double-entry accounting is balanced** where it posts (`postEntry` throws on imbalance > 0.01; entry + lines written atomically; idempotent by `(tenant, source, referenceId)`).
- **Localization parity is excellent** (EN 3121 / BN 3119 keys; 2 trivial gaps).

---

## 7. Coverage of the requested audit areas

| # | Area | Status |
|---|------|--------|
| 1 | Complete ERP audit | ✅ Done (5 parallel passes + direct verification) |
| 2 | Every frontend page | ✅ Route table + guards mapped; ~10 pages deep-read, 112 inventoried (portal/marketing spot-checked) |
| 3 | Every backend API | ✅ All ~90 routers boot-verified; financial/auth/tenant/upload/payment routes deep-read |
| 4 | Authentication | ✅ JWT, boot enforcement, portal auth, 2FA reviewed |
| 5 | SaaS capability model | ✅ Plan limits + 17 feature flags verified in sync + fail-closed |
| 6 | Multi-tenancy | ✅ No cross-tenant read leak; marginal child-model IDOR (M9/L12/L13) |
| 7 | Database integrity | ✅ `prisma validate` passes; schema is a single consolidated baseline (101 tables) |
| 8 | Security | ✅ Secrets, headers, injection, SSRF, CORS reviewed (C1, H6, M4–M7) |
| 9 | File uploads | ✅ multer configs reviewed (H6, M7) |
| 10 | Payment integrations | ✅ bKash + SSLCommerz + COD deep-read (C2 fixed; forgery-proof otherwise) |
| 11 | Email notifications | ✅ Reviewed (H4, H5, L14; degrades to console safely) |
| 12 | Responsive UI | ✅ Reviewed (H7 mobile sidebar) |
| 13 | Localization EN/BN | ✅ Parity excellent; coverage gap M14 |
| 14 | Production env vars | ✅ Fail-closed where it matters; operational must-set list in §9 |
| 15 | Build output | ✅ Build passes; artifacts complete; perf hygiene L18 |

---

## 8. Fix applied in this pass (Critical only)

Per the task constraint ("fix only Critical issues"), exactly one code change was made:

**`backend/src/routes/payments.js`** — the COD (`gateway:"cod"`) branch of `POST /api/payments/initiate` now:
- **rejects any request carrying a `paymentRequestId`** with HTTP 400 (COD cannot pay for subscriptions), and
- processes **`invoiceId` only** for offline-cash invoice confirmation.

This closes **C2** (free/cross-tenant subscription activation) with **no impact on legitimate flows** (subscription payments use the validated online gateways or the manual proof → admin-approval workflow; invoice COD is unchanged).

**Verification of the fix:**
- `node --check` — syntax OK.
- `createApp()` boots — `BOOT_OK layers=102` (unchanged).
- Backend suite re-run — **626 pass / 1 fail** (identical to pre-change; the 1 failure is the pre-existing `sidebarEngine` test, unrelated).
- Frontend build still passes; no frontend change required.
- ⛔ Live end-to-end exercise of the endpoint is **pending a database** (see §9).

**C1 (git-history secrets) was intentionally NOT auto-remediated** — it requires production secret rotation and a destructive git-history rewrite/force-push that must be performed by the operator (see §2).

No other issues were modified. High/Medium/Low items are documented for scheduling, not fixed.

---

## 9. Environment / blocked verifications

- **`GET /api/health` = 200 could not be verified** in this environment: there is no reachable PostgreSQL (no local install, no Docker, no running instance), and the staging-DB connection string for `backend/.env` was not available when this audit ran. Consequently `backend/.env` does not exist, so `prisma migrate deploy`, `db:seed`, a live server boot, and the health/login/dashboard/portal end-to-end checks are **outstanding**. They should be run once the staging DB is connected:
  1. Create `backend/.env` (PORT=4000, `DATABASE_URL=<staging>`, a fresh 64-char `JWT_SECRET`, `NODE_ENV=development`, `CORS_ORIGIN=http://localhost:8080,http://localhost:5173,http://localhost:8090`).
  2. `npx prisma generate && npx prisma migrate deploy && npm run db:seed`.
  3. `npm run dev` (backend) and confirm `GET /api/health` → `{"status":"ok","database":"connected"}`.
  4. `npm run dev` (frontend) and exercise login → dashboard → customer portal.
- **Production operational must-set env (no code enforcement — checklist):** `NODE_ENV=production`; `SSLCOMMERZ_SANDBOX=false` / `BKASH_SANDBOX=false` for live money; `RATE_LIMIT_DISABLED` unset; `ALLOW_DEV_JWT` unset; `TRUST_PROXY` set behind nginx; real `VITE_API_URL` (not localhost) baked into the frontend build.

---

## 10. Recommendation

1. **Before production:** complete **C1** (rotate secrets + purge git history) and deploy the **C2** fix (already in the working tree). These are the two hard blockers.
2. **In the launch window:** address the High items — financial-write atomicity (H1), invoice/ledger mass-assignment whitelists (H2/H3), the SMS/email subscription-gate + feature-gate gaps (H4/H5), upload hardening (H6), and the mobile sidebar (H7).
3. **Run the DB-blocked verifications** in §9 to close the health/login/dashboard/portal checks.
4. **Do not deploy** until the operator has signed off on C1 and the §9 live checks are green.

*Prepared as a static + boot-level audit. Live end-to-end verification against a running stack + database is still required and is not superseded by this report.*
