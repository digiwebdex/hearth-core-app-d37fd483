# 102 — Release Candidate (RC1) Verification

**Date:** 2026-07-06
**Premise:** Treat the platform as if it deploys **tomorrow**. Whole-application verification.
**Type:** Read-only. No code, schema, packages, or commits were changed.
**Builds on:** [99-Production-Audit.md](99-Production-Audit.md) (full audit), [100](100-Audit-Remediation-Phase-1.md) + [101](101-Audit-Remediation-Phase-2.md) (remediation Phases 1–2). This pass **re-verifies** the fixes in HEAD, runs the full build/test gate, and adds fresh **deployment-readiness** checks that a "deploy tomorrow" lens demands.

---

## 0. Headline

**Production Readiness Score: 78 / 100 — "Strong build, NOT deploy-ready tomorrow *as-is*. Clear a short release-blocker checklist first (mostly ops/config, < 1 day, no deep code changes)."**

**Launch recommendation: CONDITIONAL GO.** Do not push to production tomorrow until the 3 Release Blockers in §11 are cleared. None require application rework — they are migration authoring, secret rotation, and production env configuration. After those, a **controlled/limited launch** is reasonable, with the P2 hardening items (rate limiting, ledger atomicity, mass-assignment) scheduled in the launch window.

---

## 1. Build & test gate (run fresh this pass)

| Gate | Command | Result |
|---|---|---|
| Frontend production build | `vite build` | ✅ **built in 33.8s** (exit 0) — ⚠️ 2.5 MB main chunk (see §8) |
| Backend tests | `node --test` | ✅ **598 / 598** (139 suites) |
| Frontend tests | `vitest run` | ✅ **25 / 25** (8 files) |
| TypeScript | `tsc --noEmit` | ✅ clean |
| ESLint | `eslint` | ✅ clean |
| App boot | `createApp()` | ✅ loads |
| Test integrity | `.only(` count | ✅ 0 (no silently-skipped tests) |
| Log hygiene | `console.log` in routes | ✅ 0 |

## 2. Remediation fixes — confirmed present in HEAD

| Fix | Evidence | Status |
|---|---|---|
| C1 db-backup → super admin | `dataExport.js:244,278` `requireSuperAdmin` | ✅ |
| H1 secret file untracked | `git ls-files backend/.env*` → only `.env.example` | ✅ (rotation pending — §11) |
| H2 export authz | `dataExport.js:35,142` `requirePermission("reports","export")` | ✅ |
| H3 accounts IDOR | `accounts.js:115` re-fetch scoped by `tenantId` | ✅ |
| H4 hot-table indexes | `@@index([tenantId, createdAt])` on `AuditLog` + `Transaction` | ✅ in schema (not yet in prod — §11) |
| M2 hajj authz | `hajj.js` gates on all 15 routes | ✅ |
| M10a email injection | `public.js` `esc()` on all visitor values | ✅ |

All audit **CRITICAL + HIGH + the two P1 Mediums are fixed and hold in HEAD.**

---

## 3. Core workflow chain — Customer → … → Agent Portal

Verdict: **✅ WORKS end-to-end** (one reliability caveat at the Ledger step).

| Stage | Verdict | Evidence / note |
|---|---|---|
| Customer (Client) | ✅ | Tenant-scoped CRUD; `checkPlanLimit("clients")` on create. |
| ↓ Lead | ✅ | Lead CRUD + web-inquiry intake (`public.js /book`, now injection-safe); notification automation fires on lead-create. |
| ↓ Booking | ✅ | One generic `Booking`; `checkPlanLimit("bookings")`; 5 type modules (see §4). |
| ↓ Invoice | ✅ | `Invoice.bookingId` links to booking; tenant-scoped. |
| ↓ Customer Payment | ✅ | `Payment` → recomputes invoice `paidAmount`/`dueAmount`/`status`; rolls up to booking via scoped `updateMany`. |
| ↓ Supplier Payment | ✅ | `VendorBillPayment` / expense paths write to the **same** `Transaction` ledger (`vendors.js:48`, `expenses.js:41`). |
| ↓ Ledger | ⚠️ works, non-atomic | `ensureLedgerIncomeTransaction` writes an idempotent income `Transaction` (`invoices.js:118`). **M6:** the write is `.catch(()=>null)` and not wrapped in `prisma.$transaction` — a rare partial failure drifts ledger vs payments. |
| ↓ Reports | ✅ | `reportingCenter` reads the same ledger (`buildBookLedger`/`buildAging`) — no divergent computation. |
| ↓ Customer Portal | ✅ | Separate JWT audience + email-ownership + output sanitizers; customer sees only own data. |
| ↓ Agent Portal | ✅ | Agent sees only own customers/bookings; cross-role `403`. |

## 4. Booking types

All five are type-scoped views over the one `Booking` model + shared spine (pricing/identity/registry/serviceDetails), delegating persistence to `bookings.js`, tenant-scoped, `checkPlanLimit` on create.

| Type | Verdict | Note |
|---|---|---|
| Air Ticket | ✅ | Reference implementation; full per-type validation. |
| Visa | ✅ | + `VisaApplication` tracking. |
| Hotel | ✅ | + reservation/voucher/room/check-in-out workflow. |
| Hajj & Umrah | ✅ | Sale layer composes `/api/hajj` desk; the ops desk `hajj.js` is **now permission-gated** (M2 fixed). |
| Tour | ✅ | Domestic + international unified. |

## 5. Platform controls

| Control | Verdict | Note |
|---|---|---|
| Authentication | ✅ Strong | ≥32-char JWT secret enforced (`process.exit(1)` otherwise), bcrypt, no user enumeration, TOTP 2FA for super-admin, portal audience separation. |
| Authorization | ✅ (post-fix) | Three-layer model applied consistently; the hajj gap (M2) closed. |
| Role Permission | ✅ In sync | One `ROLE_PERMISSIONS` matrix mirrored backend↔frontend (5 roles). |
| Plan Locking | ✅ | `checkPlanLimit` (11 routes) + `requireFeature` (5), fail-closed. |
| Subscription | ✅ | Expiry gate returns `402`, lazy expiry, `/billing` exempt so tenants can renew; super-admin bypass. |
| Usage Limits | ✅ base plan | Counts vs `RESOURCE_MODEL_MAP`. ⚠️ Purchased add-ons don't yet extend the live `checkPlanLimit` path (documented). |
| Feature Flags | ⚠️ split | *Plan-feature* gating (`requireFeature`) works. The engineering *Feature-Flag Engine* is read-only/unwired (no consumers). |
| Multi-Tenant Isolation | ✅ Strong | Discipline excellent; the 3 audit holes (db-backup, export authz, accounts IDOR) all fixed. |

## 6. Subsystems

| Subsystem | Verdict | Note |
|---|---|---|
| Dashboard | ✅ | Tenant-scoped KPI aggregation via batch-fetch + in-memory (not N+1). |
| Reporting | ✅ | 17 reports; reuses Finance Core builders (no duplicate math). |
| Analytics | ✅ | Top-entities / trends; tenant-scoped. |
| Notifications | ✅ | in-app + SMS + WhatsApp + email; automation + delivery log; degrades to console when unconfigured. |
| Documents | ⚠️ transitional | New `Document` engine + legacy `ClientDocument`/`BookingDocument` dual-store; **engine table has no migration** (§10). |
| Audit Log | ✅ (+index) | Written on mutations; `@@index([tenantId, createdAt])` added (H4) — must reach prod (§11). |
| Search | ❌ none (global) | Per-module filtering only; no unified cross-entity search (M11 — P3). |
| Export | ✅ (+authz) | CSV/Excel now gated `reports:export`; db-backup super-admin only. |

## 7. Health & operability

`GET /api/health` is solid — reports DB connectivity (`SELECT 1`), payment-gateway config, trial days, uptime, environment. `notFoundHandler` + `globalErrorHandler` are wired. Good for load-balancer probes and monitoring.

---

## 8. Performance & large-dataset readiness

| Area | Verdict | Note |
|---|---|---|
| N+1 queries | ✅ (sampled) | Hot loops are batch-fetch + in-memory, not N+1. |
| Indexes | ⚠️ partial | H4 added `AuditLog`/`Transaction` indexes **but they are not yet on the prod DB** (§11). M5 (~19 tables + FK scalars) still unindexed → seq scans grow with data. |
| Pagination | ⚠️ | Core list endpoints use unbounded `findMany` (M12) — fine at launch volume, risk as tenants grow. |
| Caching | ⚠️ minimal | Only the custom-domain CORS lookup is cached (~60s). Dashboard/reports recompute per request — acceptable at launch, a candidate for caching at scale. |
| Frontend bundle | ⚠️ heavy | Main chunk **2.5 MB (648 KB gzip)** despite lazy routes — slow first load, notably on mobile / Bangladesh networks. Code-split / `manualChunks` recommended. |
| Large-dataset readiness | ⚠️ | Adequate for launch (small per-tenant data); **not yet** tuned for high-volume tenants (indexes + pagination + caching). |

## 9. Engineering quality

| Aspect | Verdict | Note |
|---|---|---|
| API consistency | ✅ mostly | Uniform `res.status().json({message})`, 404-on-cross-tenant, 402 subscription, 403 authz. Blemish: admin route shadowing (M4 — P3); response envelopes vary (array vs object). |
| Folder structure | ✅ | Clean routes/lib/services/middleware split; frontend pages/components/portal/marketing. |
| Naming | ⚠️ minor | camelCase consistent; date `String` vs `DateTime` drift (M8 — P3, breaking migration). |
| Reusable components | ✅ | Engine-composition (Plan/Finance/Reporting/Booking/Portal) is real and DRY; frontend gates (`FeatureGate`/`PermissionGate`/`SubscriptionGate`). |
| Error handling | ✅ | Consistent try/catch + global error handler; fail-closed on plan/permission checks. |
| Validation | ⚠️ | Booking modules have real per-type validation; but systemic mass-assignment (M3) and unvalidated public writes remain (P2). |

---

## 10. Deploy-tomorrow findings (new this pass)

### 10.1 Migration drift (most important)
The deploy script runs **`prisma migrate deploy`** (`scripts/vps-pm2-deploy.sh:91`), but several tables/indexes exist **only in `schema.prisma`** (applied via `db push` in dev) with **no migration**:
- `SubscriptionAddon` (Subscription & Billing Engine) — **no migration**.
- `SystemFlag` (Feature-Flag Engine) — **no migration**.
- `Document` (Document Engine) — **no migration**.
- `@@index` on `AuditLog` + `Transaction` (Phase-1 H4) — **no migration**.

A loose, non-standard `migrations/manual_add_email_verification.sql` confirms the team has already hand-patched around drift. **Consequence of a clean `migrate deploy`:** the new-engine tables would be absent (features degrade — add-on/flag/document endpoints guard or fail rather than serve) and the H4 performance indexes would never be created. The migration history is not a faithful source of truth for the schema.

### 10.2 Frontend API base falls back to localhost
`src/lib/api.ts:2` — `const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api"`. If the production build does **not** set `VITE_API_URL`, the deployed app calls `localhost:4000` and every request fails. (Three more inlined `fetch()` calls repeat the same fallback — a consistency smell tied to the `api.ts` monolith.)

### 10.3 Rate-limit kill switch
`RATE_LIMIT_DISABLED=true` disables even the auth limiter. It must be **unset** in production, or brute-force protection on login is off.

---

## 11. Release Blockers (must clear before deploying tomorrow)

1. **Author the missing migrations / reconcile schema drift.** Create a migration for `SubscriptionAddon`, `SystemFlag`, `Document`, and the `AuditLog`/`Transaction` indexes (e.g. `prisma migrate dev --name rc1_engines_and_indexes`), fold in `manual_add_email_verification.sql`, and verify `migrate deploy` yields a schema matching `schema.prisma` (`prisma migrate status` clean). Otherwise new engines are silently non-functional and the H4 perf fix is absent in prod.
2. **Rotate the exposed secrets (Phase-1 H1 carry-over).** The former `.env.backup` values remain in git history — rotate at least `JWT_SECRET` (forces re-login) and `DATABASE_URL`, plus gateway/SMTP creds. Untracking did not undo history exposure.
3. **Set production environment configuration.** Set `VITE_API_URL` for the frontend build; **unset** `RATE_LIMIT_DISABLED`; confirm `JWT_SECRET` (≥32 chars), `DATABASE_URL`, `CORS_ORIGIN`, `CRON_SECRET`, and gateway keys are present for the prod target.

## 12. Major Risks (fix in the launch window)
- **No global API rate limiting (M1).** Only auth/portal login are throttled; all other endpoints are open to scraping/abuse. Reuse the already-installed `express-rate-limit`.
- **Non-atomic ledger write (M6).** Wrap payment + ledger writes in `prisma.$transaction`; stop swallowing the ledger error. Financial integrity on partial failure. **Do before real money volume.**
- **Mass-assignment on writes (M3).** Authorized internal users can set unintended financial fields (`walletBalance`, `profit`, …). Whitelist per route.

## 13. Minor Risks (post-launch)
- Unpaginated lists (M12), remaining missing indexes (M5) — scale.
- Admin route shadowing (M4), dual plan-state (M7), String dates (M8), fragile tenant-delete/orphan satellites (M9) — debt.
- Feature-Flag Engine unwired (L1); add-ons not in live `checkPlanLimit` enforcement.
- `api.ts` monolith + inlined `fetch` fallbacks (§10.2).
- Public-write spam/CAPTCHA gap (M10b).

## 14. Performance Risks
- **H4 indexes not yet on prod DB** (blocked by §11.1) — hot tables seq-scan until applied.
- **2.5 MB frontend bundle** — slow first load; code-split.
- M5 indexes + M12 pagination + minimal caching — degrade as per-tenant data grows.

## 15. Security Risks
- **Secret rotation pending** (blocker §11.2).
- **No global rate limiting** + `RATE_LIMIT_DISABLED` must be unset (major/blocker-config).
- **Mass-assignment** (major, M3).
- Public-write throttle/CAPTCHA absent (minor, M10b).
- ✅ Positive: every audit **CRITICAL + HIGH** is fixed; tenant isolation, auth, and portal separation verified strong.

## 16. Recommended Fixes — pre-deploy checklist (ordered)
1. Author + apply the reconciling migration; `prisma migrate status` clean on a staging DB (Blocker).
2. Rotate all secrets exposed via git history (Blocker).
3. Set `VITE_API_URL`; unset `RATE_LIMIT_DISABLED`; verify all required env (Blocker).
4. Smoke-test on staging with a fresh `migrate deploy`: login, create client→lead→booking→invoice→payment→report, both portals, one export, `/api/health` green.
5. (Launch window) enable a conservative global rate limiter; wrap the payment/ledger write in a transaction; whitelist write fields on financial routes.
6. (Fast-follow) apply M5 indexes; add list pagination; code-split the frontend bundle.

---

## 17. Production Readiness Scorecard

| Dimension | Weight | Score /100 | Notes |
|---|---:|---:|---|
| Architecture & code quality | 15% | 90 | Real composition, DRY, no cycles. |
| Build / test / quality gates | 10% | 95 | All green; clean smells. |
| Multi-tenant isolation | 15% | 92 | Excellent; 3 holes fixed. |
| Authentication & authorization | 12% | 88 | Strong; hajj gap closed. |
| Security posture | 12% | 76 | CRITICAL/HIGH fixed; rate-limit + mass-assignment + secret-rotation pending. |
| Finance correctness | 10% | 80 | Chain works; ledger atomicity (M6) pending. |
| Data & migrations / deployment | 12% | 58 | **Migration drift is the main drag.** |
| Performance & scale | 8% | 66 | Indexes not yet applied to prod; bundle; pagination. |
| Feature completeness (in-scope) | 6% | 85 | Core complete; search + add-on enforcement gaps. |
| **Weighted total** | 100% | **≈ 78** | |

### **Overall: 78 / 100.**

**A fundamentally strong, well-tested platform held back from a same-day deploy by a short, mostly-operational release-blocker list — not by code quality.** Clear §11 (migrations, secret rotation, prod config), smoke-test on staging, and it is ready for a controlled launch; schedule the §12 majors in the launch window.

---

*RC1 verification complete. No code, schema, packages, or data were modified. Awaiting approval.*
