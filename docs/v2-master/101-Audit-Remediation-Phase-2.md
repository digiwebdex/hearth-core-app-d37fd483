# 101 — Production Audit Remediation · Phase 2

**Date:** 2026-07-06
**Scope:** Classify **every remaining MEDIUM** finding from [99-Production-Audit.md](99-Production-Audit.md) §4, then implement **only the P1 (Release-Candidate-blocking) subset**. P2/P3 are deliberately NOT implemented.
**Constraints honored:** backward compatible · no UI redesign · no new features · no package install · no breaking DB change · no unrelated refactoring.
**Result:** ✅ Classified 12 Medium issues → 2 P1, 6 P2, 5 P3 (M10 splits across P1/P2). Implemented the 2 P1 items. TypeScript, ESLint, backend (598), frontend (25) all pass.

---

## 1. Classification methodology

Each remaining Medium was scored against five questions, then bucketed:

| Question | Meaning |
|---|---|
| Q1 Production blocker? | Broken/unsafe to have in *any* externally-reachable build |
| Q2 Security risk? | Exploitable weakness (auth, injection, data exposure) |
| Q3 Performance risk? | Degrades under real load/data volume |
| Q4 Technical debt? | Maintainability / correctness-robustness / cleanliness |
| Q5 Safe to wait until after v1 launch? | Can defer without material harm |

**Priority bands**
- **P1 — Must fix before Release Candidate.** Exploitable security holes that are cheap *and* safe to close. (Deliberately kept small.)
- **P2 — Should fix before first customer.** Real risks whose safe remediation needs deliberate design/tuning, or that only bite at data/traffic scale.
- **P3 — Can wait until after launch.** Debt, cosmetic duplication, feature gaps, or fixes blocked by the "no breaking DB change" rule.

---

## 2. Priority Matrix (all 12 Medium issues)

| ID | Issue | Q1 Blocker | Q2 Security | Q3 Perf | Q4 Debt | Q5 Can wait | **Priority** |
|----|-------|:---:|:---:|:---:|:---:|:---:|:---:|
| **M2** | Hajj module missing permission gates | **Yes** | **Yes** | No | No | **No** | **P1 ✅** |
| **M10a** | Public `/book` email HTML/link injection | **Yes** | **Yes** | No | No | **No** | **P1 ✅** |
| M1 | No global/API rate limiting | No | Yes | Yes | Partly | Partly | P2 |
| M3 | Systemic mass-assignment on writes | No | Yes | No | Yes | Partly | P2 |
| M5 | ~19 tables + FK scalars missing indexes | No | No | Yes | Yes | Yes | P2 |
| M6 | Non-atomic ledger write | No | No | No | Yes | Partly | P2 |
| M10b | Public writes unthrottled (spam/flood) | No | Yes | No | No | Partly | P2 |
| M12 | Unpaginated list endpoints | No | No | Yes | Yes | Yes | P2 |
| M4 | Admin route shadowing / double-mount | No | No | No | Yes | Yes | P3 |
| M7 | Dual "current plan" source of truth | No | No | No | Yes | Yes | P3 |
| M8 | String vs DateTime date fields | No | No | Minor | Yes | Yes | P3 † |
| M9 | Fragile tenant hard-delete / orphan satellites | No | No | No | Yes | Yes | P3 |
| M11 | No global search | No | No | No | No | Yes | P3 |

† **M8 is also blocked by the "no breaking DB change" rule** — converting `String` date columns to `DateTime` is a destructive migration and cannot be done in this constrained remediation regardless of priority.

**Summary:** P1 = {M2, M10a} · P2 = {M1, M3, M5, M6, M10b, M12} · P3 = {M4, M7, M8, M9, M11}.

> **Why P1 is intentionally small.** P1 is reserved for *exploitable* security holes that are cheap and low-risk to close. Everything in P2 is either (a) a control/perf gap that only bites at scale (M1, M5, M12), (b) a robustness fix on a critical path that deserves deliberate testing rather than a rushed batch (M6, and M3's whitelist design), or (c) requires an already-authorized internal actor (M3). Rushing those into an RC would add regression risk without closing an active external exploit.

---

## 3. Issues Fixed (P1)

### M2 — Hajj module missing permission gates (P1)

**Issue.** `backend/src/routes/hajj.js` applied `authenticate` only — **none** of its 15 routes (packages, groups, pilgrims, pilgrim payments) had a `requirePermission` gate, unlike every other resource. Any authenticated tenant user — including roles the matrix grants only view/export — could create/edit/**delete** Hajj packages, groups, and pilgrims, and record pilgrim payments (intra-tenant privilege escalation).

**Root cause.** The router was written before the fine-grained permission layer was standard and never retrofitted with `requirePermission`.

**Fix.** Every route now enforces the existing shared `hajj_umrah` permission matrix (`auth.js` `ROLE_PERMISSIONS`), using the standard action mapping:
- `GET` (packages/groups/pilgrims/payments) → `view`
- `POST` (create + record payment) → `create`
- `PATCH` → `edit`
- `DELETE` → `delete`

This is **backward compatible for legitimate roles**: `tenant_owner`/`manager` keep full access; `sales_agent` retains view/create; `operations` retains view/create/edit; `accountant` retains view/export. It closes the escalation the audit flagged — e.g. an `accountant` (matrix: `hajj_umrah` view/export) can no longer create/edit/delete Hajj records, and only `tenant_owner`/`manager` can `DELETE`. `super_admin` bypasses via `requirePermission`. No change to the permission matrix itself (backend and frontend stay in sync), so this only enforces what the UI already implies.

**Files changed.** `backend/src/routes/hajj.js` — added `requirePermission` import; four gate constants (`canView`/`canCreate`/`canEdit`/`canDelete`); applied to all 15 routes.

**Verification.** App boots; ESLint clean; backend suite green. Gates resolve against the same matrix used everywhere else.

### M10a — Public `/book` email HTML/link injection (P1)

**Issue.** `POST /api/public/book` is unauthenticated (a public website booking form). The agency-owner notification email interpolated visitor-supplied values (`name`, `phone`, `email`, `packageName`, `packageType`, `travelDate`, `travelDateTo`, `travelers`, `message`) **raw** into the email HTML body (public.js ~546-561). A visitor could inject arbitrary HTML/links into the owner's inbox (phishing / content-spoofing), and the raw values were a stored-XSS risk if rendered unescaped elsewhere.

**Root cause.** Output encoding was missing at the email-render boundary — untrusted input was placed directly into an HTML template.

**Fix.** Added a local `esc()` HTML-escaper (`& < > "`) and applied it to every visitor-supplied value interpolated into the notification email HTML. The email still sends identically for legitimate input (plain text renders the same) — only markup metacharacters are now neutralised. This is output-encoding at the render point; stored data (`lead.notes`, `leadActivity.content`) is intentionally left unmodified (the correct layer is output encoding, and the dashboard renders via React which auto-escapes).

**Files changed.** `backend/src/routes/public.js` — `esc()` helper in the notify block; escaped all interpolated visitor values in the email HTML.

**Verification.** App boots; ESLint clean; backend suite green. Malicious markup in a submission is now rendered as inert text in the owner email.

> **Note on M10b (the spam/throttle half of M10):** the audit's M10 also flagged that public write endpoints have no rate limit/CAPTCHA. That sub-issue is a control gap (denial-of-service class), not an active injection, and is classified **P2** alongside M1 (global rate limiting). It is not fixed here.

---

## 4. Verification (full gate)

| Check | Command | Result |
|-------|---------|--------|
| TypeScript | `npx tsc --noEmit` | ✅ clean (exit 0) |
| ESLint | `npx eslint <changed files>` | ✅ clean (exit 0) |
| Backend tests | `node --test` (backend) | ✅ **598 / 598 pass** (139 suites) |
| Frontend tests | `npx vitest run` | ✅ **25 / 25 pass** (8 files) |
| App boot | `createApp()` | ✅ loads |

**Files changed (complete list):**
- `backend/src/routes/hajj.js` — M2 (permission gates on all 15 routes).
- `backend/src/routes/public.js` — M10a (HTML-escape visitor input in notification email).

No behavior change for any legitimate happy path. The only intentional access changes are the security tightenings (unauthorized roles now correctly `403` on Hajj writes; injected markup is neutralised in owner emails).

---

## 5. Remaining Issues (NOT fixed — by design)

### P2 — Should fix before first customer (deferred)
- **M1** No global/API rate limiting — enable a conservative global limiter (reuse the already-installed `express-rate-limit`; honour `RATE_LIMIT_DISABLED`). Deferred because it needs tuning to avoid over-throttling legitimate clients.
- **M10b** Unthrottled public writes (`/book`, `/contact`) — spam/flood control; pairs with M1.
- **M3** Systemic mass-assignment — per-route input whitelisting; deferred because the safe fix must be designed per route and verified against the frontend contract (backward-compat sensitive), and it requires an already-authorized internal actor to exploit.
- **M6** Non-atomic ledger write — wrap the payment + ledger writes in `prisma.$transaction` and stop swallowing the ledger error. Deferred because it restructures the most critical (payment) path and deserves dedicated testing, not a rushed batch. **High-priority P2 — do early, before real transactions.**
- **M5** ~19 tables + FK-scalar indexes — additive/safe, but only bites at data volume; the two hottest (`AuditLog`, `Transaction`) were already done in Phase 1 (H4).
- **M12** Unpaginated list endpoints — add `take`/`skip`; needs care so existing clients still receive expected data.

### P3 — Can wait until after launch (deferred)
- **M4** Admin route shadowing / double-mount — dead-code cleanup; super_admin-only, no functional impact.
- **M7** Dual "current plan" source of truth — document `Tenant.*` as canonical; low active risk.
- **M8** String vs DateTime dates — **blocked by the "no breaking DB change" rule** (destructive column migration); revisit in a dedicated migration window.
- **M9** Fragile tenant hard-delete / orphan satellite tables — replace the manual cascade with explicit `onDelete` (schema migration); admin-only, rare operation.
- **M11** No global search — a new feature (out of scope by the "no new features" rule).

### Carried over from Phase 1 (operational)
- **H1 secret rotation** and **H4 index application** (`prisma migrate deploy` / `db:push`) remain required operational follow-ups — see [100-Audit-Remediation-Phase-1.md](100-Audit-Remediation-Phase-1.md).

Full evidence and the P1/P2 remediation roadmap remain in [99-Production-Audit.md](99-Production-Audit.md) §13–§14.

---

*Phase 2 complete. Awaiting approval.*
