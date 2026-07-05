# 10 — Development Rules

> 🧊 **ARCHITECTURE FREEZE (v2) — 2026-07-05.** Authoritative frozen design: [11-Architecture-Freeze](11-Architecture-Freeze.md).
> - Frozen mandates now in force: **Single Plan Engine**, **Central Status Engine**, **Module Registry**, **Generic Booking Engine**, **unified Leads pipeline**, **full B2B Agent Portal**.
> - **Moved to Future Roadmap (not v2 blockers):** Row-Level Security, double-entry accounting, multi-currency, public Developer API, OpenAPI, API marketplace.

> Non-negotiable engineering rules for working in this repo. These protect the architecture described in the rest of `docs/v2-master/`. Also see the repo-root `CLAUDE.md` and `AGENTS.md`.

## 1. Tenant isolation is the #1 invariant

Every tenant-scoped DB access **must** be filtered by `req.tenantId`.

- **Reads:** `where: { tenantId: req.tenantId, … }`.
- **Updates/deletes:** use `updateMany`/`deleteMany` with `{ id, tenantId }`, then treat a zero-count result as **404** — never `update({ where: { id } })` alone.
- **Creates:** always set `tenantId: req.tenantId` on the row.
- `req.tenantId` / `req.userId` / `req.userRole` come from `authenticate` (post-JWT). Never trust a `tenantId` from the request body.

A missing tenant filter is a **cross-tenant data leak**, not a style nit. The generic CRUD factory (`backend/src/routes/crud.js`) is the reference pattern — copy it.

## 2. Keep the paired sources of truth in sync

Several concerns are **duplicated** frontend↔backend by design. Changing one without the other creates silent UI/API disagreement. When you touch one, touch its pair **in the same change**:

| Concern | Frontend | Backend |
|--------|----------|---------|
| RBAC permission matrix | `src/lib/permissions.ts` | `backend/src/middleware/auth.js` (`ROLE_PERMISSIONS`) |
| Plan limits & feature flags | `src/lib/plans.ts`, `src/lib/features.ts` | `backend/src/lib/planFeatures.js` |
| Advanced module bundles | `src/lib/moduleAccess.ts` | `backend/src/lib/moduleAccess.js` |
| Service types | `src/lib/serviceTypes.ts` | `backend/src/constants/serviceTypes.js` |
| Catalog subcategory ids (135) | `src/lib/serviceCatalog.ts` | `backend/src/constants/serviceCatalogIds.js` |

⚠️ **Known drift already exists** in the plan/feature configs — see [08-Plan-Feature-Matrix](08-Plan-Feature-Matrix.md). Backend wins on enforcement. A v2 goal is to reconcile these; do not add new drift.

## 3. Enforce on the server; the UI is cosmetic

Hiding a menu item or button is **never** access control. Every protected action needs a backend guard:

- `authenticate` → `requirePermission(module, action)` (RBAC) — [07](07-Permission-Matrix.md)
- `checkPlanLimit(resource)` — resource caps — [08](08-Plan-Feature-Matrix.md)
- `requireFeature(flag)` — feature flags — [08](08-Plan-Feature-Matrix.md)
- `requireSuperAdmin` for `/api/admin/*`
- The app-level `subscriptionAccessGate` (402) already covers expiry — [02](02-Business-Architecture.md)

All plan/subscription checks **fail closed** (403/503 on validation error) — keep it that way; never fail open.

## 4. Validate status values in application code

There are **no DB enums** — status/type columns are free `String`s, and most `PATCH …/status` routes currently store the body value **verbatim** ([05](05-Workflow-Book.md), [06](06-Database-Blueprint.md)). For v2:

- Validate against the allowed set before writing (whitelist the state machine).
- Preserve the documented transitions and their side effects (timeline events, audit logs, automations, money roll-ups).
- Don't invent new status strings without updating [05-Workflow-Book](05-Workflow-Book.md) and the frontend types in `src/lib/api.ts`.

## 5. Money & the ledger

- Money is `Float` today — **round deliberately**; don't compare floats for equality. (Consider `Decimal` in v2.)
- The **only** two ledger sources are invoice payments (income, idempotent) and approved expenses (expense). Don't post ad-hoc transactions outside these paths without matching the idempotency pattern (`referenceType`+`referenceId`).
- Preserve the payment cascade in `POST /invoices/:id/payments` (invoice → booking roll-up → ledger → installments → audit → automation). If you add a money mutation, **also reverse it** on delete/refund — the current payment-delete gap ([05 §4](05-Workflow-Book.md)) is a bug to fix, not a pattern to copy.

## 6. Code conventions

- **Backend is CommonJS** (`require`/`module.exports`); **frontend is ESM + TypeScript**. Don't mix module systems.
- Frontend imports use the **`@/` alias**.
- New backend endpoints: mirror the existing route-file structure under `backend/src/routes/`, mount in `backend/src/app.js`, and add the typed client + interface in `src/lib/api.ts`.
- Reuse the shared libs (`accountLedger`, `invoiceInstallments`, `planFeatures`, `moduleAccess`, `phoneNormalize`, notification automation) — don't reimplement.
- Frontend: use the standard state components and gates ([09-UI-UX-Standards](09-UI-UX-Standards.md)); all user copy is bilingual (EN/BN).

## 7. Environments & running

- Frontend dev **:8080** (`npm run dev`); backend dev **:4000** (`cd backend && npm run dev`), prod **:3027**.
- Backend and frontend are **separate npm packages** — separate `npm install`, **no backend lockfile**. Backend first-time: `npm run setup`.
- DB schema: **standardize on migrations** (`prisma migrate dev` / `deploy`) — a `migrations/` folder already exists; the legacy `npm run setup` `db push` path is being retired for v2.
- Optional integrations (SMTP, SMS, WhatsApp, bKash, SSLCommerz) degrade to console logging when env is unset — don't hard-depend on them locally.
- Health: `GET /api/health`.

## 8. Testing & verification

- Frontend: `npm test` (Vitest/jsdom); single: `npx vitest run -t "name"`.
- Backend: `cd backend && npm test` (node --test + Supertest); single: `node --test test/<name>.test.js`.
- Lint: `npm run lint` (pre-existing `no-explicit-any` noise — don't add more).
- For behavior changes, exercise the actual flow (the `verify`/`run` skills), not just types.

## 9. ⚠️ The auto-deploy Stop hook (know before you commit)

`.claude/settings.json` defines a **`Stop` hook** that, on the **production VPS** (`/var/www/hearth-core-app`), auto-commits, **pushes to `origin/main`**, rebuilds, and `pm2 restart hearth-api`. On dev machines the `cd` fails → it's a no-op. Consequences:

- Ending a session **on prod triggers a deploy to `main`**. The `chore: auto-deploy …` commits in history come from this.
- Do work on a branch (this docs series lives on `v2-master-blueprint`) and be deliberate about what lands on `main`.
- Never bypass hooks/signing unless explicitly asked.

## 10. Git & deploy hygiene

- Branch off `main`; don't commit/push unless asked.
- Deploy is **manual**: `bash scripts/vps-pm2-deploy.sh` (PM2) — auto-deploy workflow was removed (see recent history).
- Migration path (Coolify/Docker) is in progress — keep PM2 `hearth-api` working until that stack is green ([02 §7](02-Business-Architecture.md)).

---
*See also: [02-Business-Architecture](02-Business-Architecture.md) · repo-root `CLAUDE.md` · `AGENTS.md`*
