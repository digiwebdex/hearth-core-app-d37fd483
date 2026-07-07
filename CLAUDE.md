# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**TravelAgencyWeb (TAWSS / "Hearth Core App")** — a multi-tenant travel-agency SaaS. Monorepo with two apps that run and deploy independently:

- **Frontend** — Vite + React 18 + TypeScript + shadcn/ui (Radix) + Tailwind. Repo root. Dev server on **http://localhost:8080** (not 5173).
- **Backend API** — Express 4 + Prisma 5 + PostgreSQL 16. Lives in `backend/`. Dev server on **http://localhost:4000**, all routes under `/api`.

The two are separate npm packages with separate `node_modules` and separate lint/test/build. There is **no root workspace/monorepo tool** — install and run each side on its own.

## Commands

### Frontend (repo root)
| Task | Command |
|------|---------|
| Install | `npm install` |
| Dev server (port 8080) | `npm run dev` |
| Build | `npm run build` (dev-mode build: `npm run build:dev`) |
| Lint | `npm run lint` (ESLint flat config; repo has many pre-existing `@typescript-eslint/no-explicit-any` warnings — don't treat as new) |
| Test (all) | `npm test` (Vitest, jsdom, no live API) |
| Test (watch) | `npm run test:watch` |
| Single test file | `npx vitest run src/path/to/file.test.ts` |
| Single test by name | `npx vitest run -t "test name substring"` |

### Backend (`backend/`)
| Task | Command |
|------|---------|
| First-time setup | `npm run setup` (= install + `prisma generate` + `migrate deploy` + seed) |
| Dev server (nodemon, port 4000) | `npm run dev` |
| Test (all) | `npm test` (Node built-in test runner + Supertest) |
| Single test file | `node --test test/<name>.test.js` |
| Regenerate Prisma client | `npx prisma generate` |
| Apply migrations to DB | `npm run db:migrate` (= `prisma migrate deploy`) |
| Author a new migration (dev) | `npm run db:migrate:dev` (= `prisma migrate dev`) |
| Reset DB + reseed | `npm run db:reset` (destructive; `migrate reset` + seed) |
| Reseed only | `npm run db:seed` |

`backend/` has **no lockfile** — `npm install` there is separate from the root install. **The DB is migration-driven (no `db push`):** the entire schema is a single consolidated baseline (`prisma/migrations/00000000000000_init`) that recreates all 101 tables on an empty PostgreSQL. Author schema changes with `db:migrate:dev`, deploy with `db:migrate`. See [docs/v2-master/113-Production-Deployment.md](docs/v2-master/113-Production-Deployment.md).

### Local full-stack bring-up
1. PostgreSQL 16 on `localhost:5432` (see `AGENTS.md` for the `CREATE USER` / `CREATE DATABASE` bootstrap).
2. `cp backend/.env.example backend/.env`, set at least `DATABASE_URL`, `JWT_SECRET`, `PORT=4000`, `CORS_ORIGIN=http://localhost:8080,http://localhost:5173`.
3. `cd backend && npm run setup && npm run dev`
4. `npm install && npm run dev` (root)
5. Health check: `curl http://localhost:4000/api/health` (reports DB status, trial days, payment-gateway config).

The frontend defaults its API base to `http://localhost:4000/api` with no frontend `.env` needed (`VITE_API_URL` overrides). Seeded login accounts are configured via `SEED_*` env vars; passwords are not printed by the seed script.

## Architecture — the big picture

### Multi-tenancy is the central invariant
Every tenant-owned row carries a `tenantId`. **Every backend query must be scoped by `tenantId`** — reads use `where: { tenantId: req.tenantId }`, and writes/deletes use `updateMany`/`deleteMany` with `{ id, tenantId }` so a missing match returns 404 instead of touching another tenant's data. `req.tenantId` / `req.userId` / `req.userRole` are set by the `authenticate` middleware ([backend/src/middleware/auth.js](backend/src/middleware/auth.js)) after JWT verification. Breaking tenant scoping is a data-leak bug, not a style issue.

### Request pipeline (backend)
Wired in [backend/src/app.js](backend/src/app.js) (`createApp()`), server bootstrap in [backend/src/index.js](backend/src/index.js):
1. **CORS** — dynamic: static allow-list + any `*.travelagencyweb.com` + verified tenant **custom domains** looked up from `tenantDomain` (cached ~60s). Custom domains only allowed for active `pro`/`business`/`enterprise`/`unlimited` plans.
2. **securityHeaders** ([middleware/security.js](backend/src/middleware/security.js)).
3. **`subscriptionAccessGate`** on `/api` ([middleware/subscriptionAccess.js](backend/src/middleware/subscriptionAccess.js)) — blocks expired/suspended/cancelled tenants with **HTTP 402 `SUBSCRIPTION_INACTIVE`**, except an `EXEMPT_PREFIXES` list (`/auth`, `/admin`, `/portal`, `/public`, `/cron`, `/payment-requests`, `/health`, …) and `GET /tenants/me`. `super_admin` always bypasses.
4. **Per-route** `authenticate` → authorization middleware → handler.

### Authorization has three distinct layers (all in `middleware/auth.js`)
- **`requireRole(...roles)`** — coarse role check; `super_admin` always passes.
- **`requirePermission(module, action)`** — fine-grained matrix `ROLE_PERMISSIONS[role][module] = [actions]`. This matrix **mirrors the frontend** [src/lib/permissions.ts](src/lib/permissions.ts) — **keep the two in sync** when changing permissions.
- **`checkPlanLimit(resource)`** and **`requireFeature(flag)`** — subscription plan enforcement. Both read plan config from the single source of truth [backend/src/lib/planFeatures.js](backend/src/lib/planFeatures.js) (limits + feature flags; `-1` = unlimited, `0` = not allowed). These **fail closed** (503/403) when validation can't run.

Roles: `super_admin`, `tenant_owner`, `manager`, `sales_agent`, `accountant`, `operations` (plus legacy aliases `owner`/`admin`/`member` mapped via `mapLegacyRole`).

### Generic CRUD factory
[backend/src/routes/crud.js](backend/src/routes/crud.js) exports `createCrudRouter(modelKey)` — full tenant-scoped CRUD with permission checks for simple resources (`tasks`, `travel-packages`, `transactions`, `subscriptions`, …), mounted in `app.js`. `travelPackage` is special-cased with nested child collections (days/inclusions/pricing/media). The frontend mirrors this with `createCrudApi<T>(resource)` in [src/lib/api.ts](src/lib/api.ts). Rich resources (bookings, invoices, clients, leads, finance…) have their own hand-written route files under `backend/src/routes/`.

### Frontend structure
- **`src/lib/api.ts`** — the single API client. One `request()` helper injects the `Bearer` token from `localStorage`, plus a typed API object + TypeScript interface per resource. This file is the canonical map of backend endpoints and data shapes. (Large — grep it rather than reading whole.)
- **`src/pages/`** — route-level screens; **`src/pages/admin/`** — super-admin console; **`src/pages/site/`** & **`src/pages/marketing/`** — public tenant websites and the SaaS marketing site; **`src/portal/`** — customer/supplier self-service portal.
- **`src/App.tsx`** — all routing. Route guards compose: `P` = `ProtectedRoute` (auth), `PM` = protected + `PermissionRoute` (module permission), `A` = `AdminRoute` (super admin). Heavier pages are `lazy()`-loaded.
- **`src/contexts/AuthContext.tsx`** — holds `user`/`tenant`, derives `currentPlan`, `appRole`, trial state, and `isSubscriptionBlocked`; `WebsiteContext` provides the public-site tenant theme.
- State/data: TanStack Query. Forms: react-hook-form + zod. i18n: i18next (`src/i18n/`). Module/feature gating on the client: `FeatureGate`, `PermissionGate`, `SubscriptionGate`, `HajjModuleGate`, `BdModuleGate`.

### Hostname-based tenant resolution (frontend)
[src/lib/domainResolver.ts](src/lib/domainResolver.ts) `resolveHostname()` maps the browser host to one of: `main-app` (root domain / `app.` / `admin.` / localhost — the staff+admin app), `portal` (`portal.` subdomain), `slug` (`{tenant}.appdomain.com` wildcard DNS), or `custom-domain` (agency's own domain, looked up via public API). Reserved subdomains: `app`, `portal`, `api`, `www`, `admin`. `App.tsx` switches public routes between the marketing `Index` and a tenant's `WebsiteProvider`-wrapped site based on this. Driven by `VITE_APP_DOMAIN` (empty in local dev → always `main-app`).

### Domain model
Prisma schema is `backend/prisma/schema.prisma` (~2000 lines, ~single-DB multi-tenant). Core entities: `Tenant`, `User`, `Client`, `Agent`, `Vendor`, `Lead`, `Booking` (+ segments/travelers/checklist/timeline/documents), `Quotation`, `Invoice` (+ payments/refunds/installments), `TravelPackage`, `Account`/`Transaction`/`Expense`, plus subscription/billing (`Subscription`, `PaymentRequest`, `SubscriptionCoupon`), HRM/payroll, Hajj/Umrah, loyalty/referrals, `TenantDomain`, CMS/blog, and notification logs.

### Integrations (all optional, degrade to console logging when env unset)
Payment gateways **bKash** and **SSLCommerz** (+ manual/offline methods); **SMTP** email; **SMS** and **WhatsApp** providers. Gateway status is surfaced at `/api/health` and the admin gateway panel. Server-side notification automation fires on lead-create, booking-create, and invoice-payment events (channels: `in_app` + `sms`); delivery log at `/notifications` in the app.

## Deployment & the auto-commit Stop hook

⚠️ **[.claude/settings.json](.claude/settings.json) defines a `Stop` hook that auto-commits, pushes to `origin/main`, rebuilds, and `pm2 restart hearth-api`** — but it `cd`s into `/var/www/hearth-core-app`, so it only does anything on the production VPS. On a dev machine those `cd`s fail and it's a no-op. Be aware that in the prod environment, ending a session triggers a deploy. Recent git history shows `chore: auto-deploy …` commits from this hook.

Production runs primarily via **PM2** (`hearth-api` process) at `/var/www/hearth-core-app`; manual deploy is `bash scripts/vps-pm2-deploy.sh`. A Docker Compose stack (`app/docker-compose.yml`) is the alternative path. See `AGENTS.md` for VPS/GitHub-Actions secrets and both deploy modes.

## Conventions & gotchas
- **Backend is CommonJS** (`require`/`module.exports`); **frontend is ESM + TS**. Don't mix.
- Import frontend modules via the **`@/` alias** → `src/` (configured in `vite.config.ts` and `tsconfig`).
- When adding a permission-guarded feature, update **both** `backend/src/middleware/auth.js` `ROLE_PERMISSIONS` **and** `src/lib/permissions.ts`.
- Plan limits/features live **only** in `backend/src/lib/planFeatures.js` (backend) and `src/lib/plans.ts` (frontend) — don't scatter plan logic into route handlers.
- New tenant-scoped route handlers must scope every query by `req.tenantId` (see CRUD factory for the pattern).
- Vite HMR error overlay is disabled (`hmr.overlay: false`) — watch the terminal for build errors.
- `AGENTS.md` is the fuller operational runbook (DB bootstrap, seeded credentials, VPS deploy). `docs/` holds architecture, deployment, and product blueprint docs. `.lovable/` is a Lovable.dev memory/plan store, not application code.
