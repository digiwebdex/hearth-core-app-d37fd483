# 02 — Business Architecture

> 🧊 **ARCHITECTURE FREEZE (v2) — 2026-07-05.** Authoritative frozen design: [11-Architecture-Freeze](11-Architecture-Freeze.md).
> - **Postponed to Future Roadmap (NOT v2):** PostgreSQL Row-Level Security, SAP-style double-entry accounting, advanced multi-currency, public Developer API, OpenAPI docs, API marketplace. v2 stays focused on the Bangladesh travel-agency market. See [11 §Future Roadmap](11-Architecture-Freeze.md).

> How the product works as a **multi-tenant SaaS business** and as a **running system**. Technical build rules live in [10-Development-Rules](10-Development-Rules.md); this doc is the architecture the rules protect.

## 1. The SaaS business model

**Platform (us) → Agencies (tenants) → their staff and customers.**

```
Super Admin / Platform
  ├── manages: Tenants, Subscriptions & Plans, Payment Requests, Coupons,
  │            SMS/WhatsApp templates & logs, Master Data, Audit, Tenant health
  └── Agency (Tenant)                     ← one row in `Tenant`, has a slug + optional custom domain
        ├── Owner → Manager → Sales / Operations / Accountant staff  (see 03-Organogram)
        ├── runs CRM · Sales · Ops · Finance · HRM internally
        ├── publishes a public website  →  feeds leads back into its own CRM
        └── exposes a read-only Portal   →  its customers / suppliers / B2B agents
```

Each agency is a **tenant**: an isolated dataset keyed by `tenantId`. Agencies subscribe to a plan; the platform earns recurring subscription revenue.

## 2. Subscription & revenue flow

- **Trial:** new signups get a **7-day trial** (env-configurable 0–90 days, default 7) with Pro-level access. See [08-Plan-Feature-Matrix](08-Plan-Feature-Matrix.md).
- **Tiers:** `basic → pro → business → enterprise` (BDT pricing, yearly = 10× monthly). `free`/`unlimited` are legacy aliases.
- **Activation / renewal (manual-first):** agency selects bKash / SSLCommerz / bank-with-proof → creates a **`PaymentRequest` (pending)** → **Super Admin approves** → tenant goes `active` with extended `subscriptionExpiry`. Coupons can discount the request.
- **Expiry enforcement:** the `subscriptionAccessGate` middleware blocks expired/suspended/cancelled tenants with **HTTP 402 `SUBSCRIPTION_INACTIVE`** on all `/api` routes except an exempt list (auth, admin, portal, public, cron, payment-requests, health, and `GET /tenants/me`). The tenant UI locks to `/subscription` for renewal. `super_admin` always bypasses.
- **Reminders:** auto-expire plus SMS/WhatsApp/email renewal nudges.

Growth-phase commercial levers: drip marketing on trial day 1/2/last, WhatsApp renewal templates, subscription coupons, tenant health scoring.

## 3. Multi-service signup as the onboarding engine

At register **Step 2**, an agency picks from **14 categories / 135 sub-services / 6 presets**. The selection is persisted as `enabledServiceTypes` + `enabledSubcategories` on the tenant and **drives which menus, booking types, and website sections switch on**. This is both the UX simplifier and a monetization surface (advanced bundles gate on plan). Full detail in [04-Service-Modules](04-Service-Modules.md).

## 4. System architecture

```
                    ┌───────────────────────────── Browser ─────────────────────────────┐
                    │  app.domain (ERP)   portal.domain (portal)   {slug}.domain / custom │
                    └───────────────┬───────────────────┬────────────────────┬───────────┘
                                    │  React 18 + Vite + TS + shadcn/Tailwind │
                                    │  domainResolver picks the surface       │
                                    ▼                                         ▼
        VITE_API_URL ────────────────────────▶  Express 4 API  (/api, port 4000 dev / 3027 prod)
                                                    │  authenticate → subscriptionAccessGate
                                                    │  → requirePermission / checkPlanLimit / requireFeature
                                                    ▼
                                                Prisma 5  ─────▶  PostgreSQL 16  (multi-tenant, tenantId)
                                                    │
                                    integrations: SMTP · SMS (BulkSMSBD) · WhatsApp · bKash · SSLCommerz
                                    file storage: local bind mounts (backend/uploads)
```

- **Frontend:** React + TypeScript + Vite + Tailwind + shadcn/ui. Dev **:8080**, built to `dist/`, served by Nginx. Only build-time env it reads is `VITE_API_URL`.
- **Backend:** Node + Express + Prisma (CommonJS). Dev **:4000**, prod **:3027**. All routes under `/api`. Services: email, SMS, payment gateways, tenant automation, notifications.
- **Database:** PostgreSQL 16. **78 Prisma models, tenant rows keyed by `tenantId`, `onDelete: Cascade` from `Tenant`.** No DB-level enums (status values enforced in app code); money stored as `Float` (default currency BDT). See [06-Database-Blueprint](06-Database-Blueprint.md).
- **File storage:** local bind mounts — no external object store.

## 5. The three tenant-facing surfaces

Resolved from hostname by `src/lib/domainResolver.ts` (frontend) with backend lookups in `routes/domains.js` + `routes/public.js`:

| Surface | Host | Audience | Auth | Backend |
|---------|------|----------|------|---------|
| **Main app (ERP)** | `app.` / root / `admin.` / localhost | Agency staff + Super Admin | JWT (audience default) | `/api/*` |
| **Public tenant website** | `{slug}.domain`, custom domain, `/site/:slug` | The agency's prospects | none (public) | `/api/public/*` |
| **Portal** | `portal.` subdomain | Customers / suppliers / B2B agents | passwordless magic-link JWT (audience `portal`) | `/api/portal/*` (read-only) |

Reserved subdomains: `app`, `portal`, `api`, `www`, `admin`. Wildcard DNS (`*.domain`) maps any other subdomain to a tenant slug. Custom domains are allowed only for active `pro`/`business`/`enterprise` plans and CORS-checked dynamically (cached ~60s).

## 6. Security & isolation boundaries

- **Tenant isolation:** every tenant-scoped query filters by `req.tenantId` (set post-JWT by `authenticate`). Writes use `updateMany`/`deleteMany` with `{ id, tenantId }` so cross-tenant access returns 404, not another tenant's row. **This is the #1 invariant** — see [10-Development-Rules](10-Development-Rules.md).
- **Platform boundary:** `super_admin` + `/api/admin/*` (guarded by `requireSuperAdmin`) sit above tenants. `PlatformStaff` and platform notifications are global (no `tenantId`).
- **Portal boundary:** portal JWTs (audience `portal`) cannot call agency endpoints; portal responses strip internal `cost`/`profit` and filter timelines to customer-safe events.
- **Three enforcement axes** stack on each request: **RBAC** ([07](07-Permission-Matrix.md)) · **plan limits/features** ([08](08-Plan-Feature-Matrix.md)) · **subscription status** (this doc). All fail closed.

## 7. Deployment topology

- **Current/legacy:** VPS + **PM2** process `hearth-api` (prod port 3027) behind Nginx, at `/var/www/hearth-core-app`. Manual deploy: `bash scripts/vps-pm2-deploy.sh`.
- **Target migration:** Coolify + Traefik with three containers — `travelagencyweb-postgres` (internal), `travelagencyweb-api` (Node 20, internal :3027, public via `api.travelagencyweb.com`), `travelagencyweb-frontend` (nginx:alpine). DB/API never published directly; only Traefik:443. Let's Encrypt SSL.
- ⚠️ A `.claude/settings.json` **Stop hook auto-commits + pushes `main` + PM2-restarts on the prod VPS.** See [10-Development-Rules](10-Development-Rules.md).

---
*See also: [01-Vision](01-Vision.md) · [03-Master-Organogram](03-Master-Organogram.md) · [06-Database-Blueprint](06-Database-Blueprint.md)*
