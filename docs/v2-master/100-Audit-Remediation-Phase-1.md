# 100 — Production Audit Remediation · Phase 1

**Date:** 2026-07-06
**Scope:** Fix ONLY the CRITICAL and HIGH findings from [99-Production-Audit.md](99-Production-Audit.md). Medium/Low are explicitly deferred.
**Constraints honored:** backward compatible · no UI redesign · no new features · no DB-breaking change (indexes are additive) · no package install · no unrelated refactoring.
**Result:** ✅ 1 CRITICAL + 4 HIGH fixed. TypeScript, ESLint, backend (598), and frontend (25) all pass.

---

## Summary table

| ID | Severity | Issue | Status |
|----|----------|-------|--------|
| C1 | CRITICAL | Full-DB `pg_dump` export reachable by tenant owner | ✅ Fixed |
| H1 | HIGH | Secrets committed in tracked `.env.backup` | ✅ Fixed (untracked + ignored); ⚠️ rotation is an operational follow-up |
| H2 | HIGH | Bulk export endpoints missing authorization | ✅ Fixed |
| H3 | HIGH | Accounts cross-tenant read-back (IDOR) | ✅ Fixed |
| H4 | HIGH | Missing indexes on `AuditLog` + `Transaction` | ✅ Fixed in schema; ⚠️ needs `prisma migrate deploy`/`db push` to apply on the live DB |

---

## C1 — Full-database dump reachable by any tenant owner (CRITICAL)

**Issue.** `POST /api/export/db-backup` ran `pg_dump` of the entire multi-tenant database and was gated by `requireRole("tenant_owner", "super_admin")`. Because signup auto-creates an active `tenant_owner`, any member of the public could sign up and download every tenant's data plus all bcrypt password hashes.

**Root cause.** The endpoint's authorization included `tenant_owner`. A full-database backup is a platform-operator action, not a tenant action — the role list was too broad. The adjacent `GET /api/export/backup-info` (which lists server-side backup files from `/var/backups/hearth-core`) shared the same over-broad gate.

**Fix.** Both endpoints now require `requireSuperAdmin`. The `requireRole` import was replaced with `requireSuperAdmin` (and `requirePermission`, used by H2). The stale `// tenant_owner only` comment was corrected to document the super-admin-only contract.

**Files changed.**
- `backend/src/routes/dataExport.js` — import line; `POST /db-backup` → `requireSuperAdmin`; `GET /backup-info` → `requireSuperAdmin`.

**Verification.** App boots; a tenant_owner token now receives `403 Forbidden` from both endpoints (only `super_admin` passes `requireSuperAdmin`). Backend suite green.

---

## H1 — Secrets committed in a tracked backup env file (HIGH)

**Issue.** `backend/.env.backup` was tracked by git and contained real secret values. `.gitignore` covered `.env` but not `.env.backup`.

**Root cause.** The ignore rules only matched the exact filename `.env`, so a hand-made backup copy (`.env.backup`) fell outside the pattern and was committed.

**Fix.**
1. `backend/.gitignore` now ignores `.env.*` with an explicit `!.env.example` allow-rule, so `.env.example` remains the only tracked env file (satisfying "use `.env.example` only") while every other `.env.*` variant is ignored.
2. `git rm --cached backend/.env.backup` removes the file from version control **going forward**. The local file was intentionally left on disk (the developer's working secrets are not destroyed) — it is now untracked and ignored, confirmed via `git check-ignore`.

**Files changed.**
- `backend/.gitignore` — added `.env.*` and `!.env.example`.
- `backend/.env.backup` — removed from git tracking (local copy retained, now ignored).

**Verification.** `git check-ignore backend/.env.backup` confirms it is ignored; `git status` shows it staged for deletion from the index; the local file still exists on disk.

> ⚠️ **Operational follow-up required (NOT done here — cannot be done from code).** The secrets that were in `.env.backup` remain in prior git **history**. Untracking does not undo past exposure. Before/at deploy you must:
> 1. **Rotate** every secret that was in the file (at minimum `JWT_SECRET` and `DATABASE_URL`, plus any gateway/SMTP credentials). Rotating `JWT_SECRET` invalidates existing tokens — plan for a re-login.
> 2. Optionally **purge** the file from git history (`git filter-repo`/BFG) — this is destructive history rewriting and was deliberately not performed without explicit instruction.

---

## H2 — Bulk export endpoints missing authorization (HIGH)

**Issue.** `GET /api/export/csv` and `GET /api/export/workbook` required only `authenticate` — no permission gate. Any authenticated user, including the lowest roles (`sales_agent`, `operations`), could export the tenant's entire client PII list, all bookings, invoices, payments, and leads — data those roles cannot see through the permission matrix.

**Root cause.** The two handlers relied solely on the router-level `authenticate` and never applied a `requirePermission`, unlike the rest of the resource routes.

**Fix.** Both handlers now require `requirePermission("reports", "export")` — the same fine-grained gate the audit recommended. Effect: `tenant_owner`, `manager`, and `accountant` (who hold `reports:export`) retain access; `sales_agent` and `operations` are now correctly denied. Both endpoints were already strictly `tenantId`-scoped, so there was never a cross-tenant leak — this closes the intra-tenant least-privilege bypass.

**Files changed.**
- `backend/src/routes/dataExport.js` — added `requirePermission("reports", "export")` to `GET /csv` and `GET /workbook`.

**Verification.** App boots; ESLint clean; the export handlers now sit behind the reports-export permission. Backward compatible for the roles that legitimately export (owner/manager/accountant).

---

## H3 — Accounts cross-tenant read-back / IDOR (HIGH)

**Issue.** `PATCH /api/accounts/:id` correctly used a tenant-scoped `updateMany`, but then re-fetched the record with `findFirst({ where: { id } })` — **without** `tenantId` — and returned it. Passing another tenant's account id returned that account's name/type/balance/number in the response body.

**Root cause.** The re-fetch after the update omitted the `tenantId` filter (the only such omission in the codebase; every other route scopes the read-back).

**Fix.** The re-fetch is now scoped by `tenantId`, and the handler checks the `updateMany` result count: if `count === 0` (foreign or non-existent id) it returns `404 Not found`, matching the sibling `GET /:id` handler. The happy path (a tenant editing its own account) is unchanged — it still returns the updated account.

**Files changed.**
- `backend/src/routes/accounts.js` — `PATCH /:id`: capture `updateMany` result, `404` on `count === 0`, scope the re-fetch by `tenantId`.

**Verification.** tsc/eslint clean; backend suite green. A cross-tenant/non-existent id now yields `404` with no body leak; a legitimate self-edit is unaffected (backward compatible).

---

## H4 — Missing indexes on the two fastest-growing tenant tables (HIGH)

**Issue.** `AuditLog` (written on nearly every mutation, all tenants) had **no indexes at all**, and `Transaction` (the finance ledger) had no index on `tenantId`. Every tenant-scoped read of these tables was a sequential scan — the most likely first production performance failure at scale.

**Root cause.** Neither model declared a `tenantId` index; Postgres does not auto-index by tenant.

**Fix.** Added `@@index([tenantId, createdAt])` to both `AuditLog` and `Transaction` — exactly the composite the audit prescribed for H4 (the broader ~19-table index set is M5/MEDIUM and intentionally deferred). This is an **additive, non-breaking** schema change: no column/type/relation changes, no query-semantics change — only a performance index. `prisma generate` validated the schema and regenerated the client successfully.

**Files changed.**
- `backend/prisma/schema.prisma` — `@@index([tenantId, createdAt])` on `Transaction` (model @ line ~785) and `AuditLog` (model @ line ~1151).

**Verification.** `npx prisma generate` succeeds (schema valid). Backend suite green.

> ⚠️ **Deployment note.** Adding `@@index` to the schema does not create the index on a running database by itself. To apply it: `prisma migrate deploy` (production) or `npm run db:push` (dev). No database was available in this environment, so the index is defined-and-validated in the schema but must be applied to the live DB at deploy time. Index creation on existing tables is online/non-locking-enough for these table sizes but should be run in the standard deploy window.

---

## Verification (full gate)

| Check | Command | Result |
|-------|---------|--------|
| TypeScript | `npx tsc --noEmit` | ✅ clean (exit 0) |
| ESLint | `npx eslint <changed files>` + repo lint | ✅ clean (exit 0) |
| Backend tests | `node --test` (backend) | ✅ **598 / 598 pass** (139 suites) |
| Frontend tests | `npx vitest run` | ✅ **25 / 25 pass** (8 files) |
| Prisma schema | `npx prisma generate` | ✅ valid, client regenerated |
| App boot | `createApp()` | ✅ loads |

No behavior change for legitimate users on any happy path. The only intentional access changes are the security tightenings (db-backup/backup-info → super-admin; csv/workbook → reports:export; accounts cross-tenant patch → 404 instead of leak).

### Files changed (complete list)
- `backend/src/routes/dataExport.js` — C1 + H2 (import swap, two gate additions, two gates tightened to super-admin, comment).
- `backend/src/routes/accounts.js` — H3.
- `backend/prisma/schema.prisma` — H4 (two `@@index` lines).
- `backend/.gitignore` — H1 (`.env.*` + `!.env.example`).
- `backend/.env.backup` — H1 (removed from git tracking; local copy retained/ignored).

---

## Remaining issues (NOT addressed in Phase 1 — by design)

**Operational follow-ups tied to this phase (require action outside the codebase):**
- **H1 secret rotation** — rotate `JWT_SECRET`, `DATABASE_URL`, and any gateway/SMTP creds that were in `.env.backup`; optionally purge git history. Mandatory before/at deploy.
- **H4 index application** — run `prisma migrate deploy` / `db:push` so the two new indexes exist on the live DB.

**Deferred to later phases (MEDIUM / LOW from the audit — explicitly out of Phase-1 scope):**
- M1 No global/API rate limiting · M2 Hajj module missing permission gates · M3 Systemic mass-assignment · M4 Admin route shadowing / double-mount · M5 ~19 remaining tables + FK-scalar indexes · M6 Non-atomic ledger write · M7 Dual plan-state source of truth · M8 String-vs-DateTime dates · M9 Fragile tenant hard-delete / orphan satellite tables · M10 Unthrottled public writes + email HTML injection · M11 No global search · M12 Unpaginated list endpoints.
- L1 Feature-Flag Engine unwired · L2 Upload-before-ownership-check · L3 Cron secret in query · L4 `Bsp*` orphan tables · L5 `adjustAccountBalance` dead code · L6 Portal profile shared-email update · L7 Unauthenticated payment-status disclosure · L8 Missing HSTS/CSP · L9 Document dual-store / SMS-WhatsApp pairs · L10 Money-as-Float · plus the add-ons-not-in-live-enforcement gap and the `api.ts` monolith.

These are catalogued with IDs, evidence, and a prioritized P1/P2 plan in [99-Production-Audit.md](99-Production-Audit.md) §13–§14.

---

*Phase 1 complete. Awaiting approval.*
