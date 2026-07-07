# 109 — Local Acceptance Testing Guide (Phase 5)

**Date:** 2026-07-06
**Purpose:** Test the complete SaaS locally, end-to-end, before VPS deployment.
**Type:** Guide only — no code, schema, or config was changed to produce it.
**Grounded in:** `backend/prisma/seed.js`, `auth.js`, `tenants.js`, `portal.js`, `domainResolver.ts`, `vite.config.ts`, and the v2 blueprints (03/04/07/08).

---

## 0. Prerequisites — get the local stack running first

Testing cannot start until the app talks to a **local** backend + database. Do this once:

1. **PostgreSQL 16** running on `localhost:5432` (native, or Docker):
   ```bash
   docker run --name tawss-pg -e POSTGRES_USER=tawss -e POSTGRES_PASSWORD=tawss \
     -e POSTGRES_DB=travelagencyweb_db -p 5432:5432 -d postgres:16-alpine
   ```
2. **Frontend → local API.** Root `.env` must be:
   ```
   VITE_API_URL=http://localhost:4000/api
   ```
   (If you want to test the Portal locally, also add `VITE_APP_DOMAIN=localhost` — see §7.)
3. **`backend/.env`** (`cp backend/.env.example backend/.env`, then set):
   ```
   DATABASE_URL="postgresql://tawss:tawss@localhost:5432/travelagencyweb_db?schema=public"
   JWT_SECRET="local-dev-secret-at-least-32-characters-long"
   PORT=4000
   NODE_ENV=development
   CORS_ORIGIN="http://localhost:8080,http://localhost:5173"
   ```
   ⚠️ The example ships `NODE_ENV=production` + `PORT=3027` — both **must** change, or the seed refuses demo passwords and the port won't match the frontend.
4. **Create schema + seed accounts, then run both servers:**
   ```bash
   cd backend && npm run setup        # install + prisma generate + db push + db:seed
   cd backend && npm run dev          # API → http://localhost:4000
   # in a second terminal, at repo root:
   npm run dev                        # app → http://localhost:8080
   ```
5. **Sanity check:** `curl http://localhost:4000/api/health` → `"database":"connected"`. In browser DevTools → Network, login must hit `localhost:4000`, **not** `api.travelagencyweb.com`.

> Restart the Vite dev server after any `.env` change — env is baked at startup.

---

## 1. Local URLs

| Surface | URL | Notes |
|---|---|---|
| **Public Website** | http://localhost:8080/ | Marketing landing (localhost = "main-app") |
| **App** (staff + super admin) | http://localhost:8080/login | Same origin; → `/dashboard` (staff) or `/admin` (super admin) |
| **API** | http://localhost:4000/api | Health: `/api/health` |
| **Portal** (customer/agent/supplier) | http://portal.localhost:8080 | ⚠️ Only if `VITE_APP_DOMAIN=localhost` is set (§7). Not reachable on plain `localhost`. |
| PostgreSQL | localhost:5432 | via `DATABASE_URL` |

Reserved subdomains: `app`, `portal`, `api`, `www`, `admin`.

---

## 2. Login accounts

### Seeded automatically by `npm run db:seed` ([seed.js](../../backend/prisma/seed.js))

| Account | Email | Password | Role | Login URL |
|---|---|---|---|---|
| **Super Admin** | `digiwebdex@gmail.com` | `DevAdmin123!local` | `super_admin` | http://localhost:8080/login → `/admin` |
| **Tenant Owner** | `user@demo.com` | `demo123` | `tenant_owner` | http://localhost:8080/login → `/dashboard` |

Tenant Owner belongs to the seeded demo tenant **"Al-Safa Travel Agency"** (Professional/pro plan, active). Super Admin belongs to "TAWSS Platform".
> Passwords are the **dev fallbacks** used only when `SEED_*_PASSWORD` env vars are empty and `NODE_ENV` ≠ production. If you set those env vars, use your values instead.

### Staff — NOT seeded; create as the Tenant Owner

Manager / Sales Agent / Accountant / Operations don't exist by default. Create them via the app ([tenants.js `/me/members`](../../backend/src/routes/tenants.js#L80) — owner-only, `checkPlanLimit("users")`, created `active`):

1. Log in as `user@demo.com`.
2. Sidebar → **HR & Payroll → Team** (`/team`).
3. **Add Member** → set Name, Email, Password, and Role, then save. The user is **active immediately** and can log in at `/login`.

Suggested test staff:
| Role | Email (example) | Password (you set) |
|---|---|---|
| `manager` | `manager@alsafa.test` | `Manager123!` |
| `sales_agent` | `sales@alsafa.test` | `Sales123!` |
| `accountant` | `accounts@alsafa.test` | `Accounts123!` |

(pro plan allows 10 users — plenty.) Role capabilities: [07-Permission-Matrix](07-Permission-Matrix.md).

### Portal users — passwordless (magic-link), seeded emails

The portal has **no passwords** ([portal.js `/auth/request-link`](../../backend/src/routes/portal.js#L59)). Log in with an email that matches a seeded `Client` / `Agent` / `Vendor`:

| Portal role | Email (seeded) | Matched to |
|---|---|---|
| **Customer** | `ahmed@example.com` (or `fatima@example.com`) | `Client` |
| **Agent** (B2B) | `karim@alsafa.com` | `Agent` |
| **Supplier** | `bookings@royalwings.sa` (or `reservations@makkahgrand.sa`) | `Vendor` |

Flow: Portal `/login` → enter email → a magic link is generated. It's **emailed**; with SMTP unset in dev the email **degrades to the backend console**, so copy the link/token from the **backend terminal**, open it → 15-min token exchanged for a 7-day session.

---

## 3. Recommended test order

1. Public Website → 2. Registration → 3. Login → 4. Dashboard → 5. CRM → 6. Booking → 7. Finance → 8. Reports → 9. Subscription → 10. Customer Portal → 11. Agent Portal → 12. Settings → 13. Logout.

Fastest path: use the **seeded** Super Admin + Tenant Owner (skip Registration for most tests; test Registration separately in §4.2).

---

## 4. Test cases (step-by-step · expected · ✅/❌)

### 4.1 Public Website
| # | Steps | Expected | ✅/❌ |
|---|---|---|---|
| 1 | Open `http://localhost:8080/` | Marketing landing renders (hero, features) | ☐ |
| 2 | Go to `/pricing` | 4 plan cards labelled **Starter / Professional / Business / Enterprise**, a **7-day free trial** hero badge, comparison table, **Testimonials** + **FAQ** sections | ☐ |
| 3 | On Pricing, click a plan | Redirects to `/register?plan=…` | ☐ |

### 4.2 Registration
| # | Steps | Expected | ✅/❌ |
|---|---|---|---|
| 4 | `/register` → fill agency, name, email, phone | Form validates email/phone | ☐ |
| 5 | Complete **WhatsApp verification** (required) | OTP requested; in dev the code is in the **backend console** → enter it | ☐ |
| 6 | Choose a paid plan, submit | Account created as `tenant_owner`, **active**, on a **7-day trial**; lands on Onboarding/Dashboard | ☐ |
| 7 | Log out, log back in with the new creds | Login succeeds immediately (no approval needed) | ☐ |
> If WhatsApp isn't configured, registration is easiest to skip — test with seeded accounts.

### 4.3 Login / Auth
| # | Steps | Expected | ✅/❌ |
|---|---|---|---|
| 8 | `/login` with `digiwebdex@gmail.com` / `DevAdmin123!local` | Lands on **/admin** (super admin console) | ☐ |
| 9 | `/login` with `user@demo.com` / `demo123` | Lands on **/dashboard** | ☐ |
| 10 | Wrong password | `401 Invalid credentials`, stays on login | ☐ |
| 11 | Login as a `sales_agent` | No Finance/Settings/Admin in sidebar (RBAC) | ☐ |

### 4.4 Dashboard
| # | Steps | Expected | ✅/❌ |
|---|---|---|---|
| 12 | As Owner, open `/dashboard` | KPI stat cards (bookings, clients, leads, invoices) render; plan usage bar; recent bookings/payments; seeded Umrah booking + INV-00001 visible | ☐ |
| 13 | Empty-tenant dashboard (fresh registration) | "Welcome" teaching empty-state with CTAs | ☐ |

### 4.5 CRM
| # | Steps | Expected | ✅/❌ |
|---|---|---|---|
| 14 | `/clients` | Seeded clients Ahmed Rahman, Fatima Begum listed | ☐ |
| 15 | Create a client | Saved, appears in list (tenant-scoped) | ☐ |
| 16 | `/leads` create a lead | Saved with status "new"; notification fires | ☐ |
| 17 | `/agents`, `/vendors` | Seeded agent Karim Hassan; vendors Royal Wings, Makkah Grand | ☐ |

### 4.6 Booking
| # | Steps | Expected | ✅/❌ |
|---|---|---|---|
| 18 | `/bookings` | Seeded "Umrah Package – March 2026" (confirmed) listed | ☐ |
| 19 | Create a booking (pick client + type) | Saved; amount/cost/profit stored; tenant-scoped | ☐ |
| 20 | Sidebar → **Travel Services** | 13 services shown; enabled ones open, others 🔒 (see §6) | ☐ |

### 4.7 Finance
| # | Steps | Expected | ✅/❌ |
|---|---|---|---|
| 21 | `/invoices` | Seeded INV-00001 (partial, ৳90,000 due) | ☐ |
| 22 | Open invoice → record a payment | Invoice paid/due/status update; booking rollup updates | ☐ |
| 23 | `/accounts` (as owner/accountant) | Cash/bank ledger balances; a Transaction was created for the payment | ☐ |
| 24 | As `sales_agent`, try `/accounts` | Blocked/hidden (RBAC — no `accounts`) | ☐ |

### 4.8 Reports
| # | Steps | Expected | ✅/❌ |
|---|---|---|---|
| 25 | `/reports` | Dashboard KPIs + report list; revenue/receivable derive from the **same ledger** as Finance | ☐ |
| 26 | Export a report (CSV/Excel) | Downloads; only allowed for roles with `reports:export` | ☐ |

### 4.9 Subscription
| # | Steps | Expected | ✅/❌ |
|---|---|---|---|
| 27 | `/subscription` | Current plan shows **Professional** (blueprint name), status, expiry, usage | ☐ |
| 28 | Trigger an upgrade | Payment-request / upgrade flow opens (manual/gateway) | ☐ |

### 4.10 Settings / Logout
| # | Steps | Expected | ✅/❌ |
|---|---|---|---|
| 29 | `/settings`, `/organization` (as owner) | Load; staff roles are view-only or blocked | ☐ |
| 30 | Logout | Session cleared, back to `/login`; protected routes redirect | ☐ |

---

## 5. Critical workflow — Lead → Customer → Booking → Invoice → Payment → Ledger → Reports

Verified wired end-to-end ([99-Production-Audit §8](99-Production-Audit.md)); test the full chain in one pass as the Tenant Owner:

| Step | Action | Expected | ✅/❌ |
|---|---|---|---|
| 1 | `/leads` → create lead "Test Pilgrim" | Lead saved (status new) | ☐ |
| 2 | Convert/create a **Client** from the lead's details | Client exists, tenant-scoped | ☐ |
| 3 | `/bookings` → new booking for that client (amount 100,000 / cost 70,000) | Booking saved; profit 30,000 | ☐ |
| 4 | Create an **Invoice** for the booking | `invoice.bookingId` links it; due = total | ☐ |
| 5 | Record a **Payment** (e.g. 50,000) | Invoice paid=50k/due=50k/status=partial; **booking** paid/due rollup updates | ☐ |
| 6 | Check **Ledger** (`/accounts`) | An income **Transaction** appears for the payment (idempotent) | ☐ |
| 7 | Check **Reports** (`/reports`) | Collected/receivable reflect the payment — same numbers as the ledger | ☐ |

**Pass = the ৳50,000 shows consistently across Invoice, Booking rollup, Ledger, and Reports.**

---

## 6. SaaS plan testing

The 5 tiers (internal id → display): trial → **Free Trial**, `basic` → **Starter**, `pro` → **Professional**, `business` → **Business**, `enterprise` → **Enterprise** ([08](08-Plan-Feature-Matrix.md)).

**How to switch a tenant's plan for testing:** Super Admin → `/admin/tenants` → open Al-Safa → change subscription plan/status. (Or register fresh tenants on different plans.)

### 6a. Locked modules (never hidden — 🔒 + upgrade)
There are **two** lock triggers:
| Trigger | How to see it |
|---|---|
| **Plan floor / feature** | On a **Starter** tenant, sidebar shows **Website CMS**, **Marketing**, **Reports** items 🔒 with an upgrade badge (they need Professional/Business). | ☐ |
| **Service focus** | Set the tenant's enabled services to e.g. *Air Ticket only* (onboarding/settings). Then **Travel Services** shows `Air Ticket` open and **Visa / Hotel / Hajj / …** 🔒. (The seeded demo tenant has an empty service focus → everything shows unlocked.) | ☐ |

| # | Steps | Expected | ✅/❌ |
|---|---|---|---|
| 1 | Click any 🔒 sidebar item | Tooltip "available in the **Business** plan"; click opens the **Upgrade Plan dialog** | ☐ |
| 2 | Dialog "Upgrade Plan" button | Navigates to `/subscription` | ☐ |
| 3 | Confirm unavailable services **never disappear** | All 13 Travel Services always visible (locked or open) | ☐ |

### 6b. Plan limits (backend-enforced, fail-closed)
| # | Steps | Expected | ✅/❌ |
|---|---|---|---|
| 4 | On a **Starter** tenant (limit 3 users), add a 4th team member | Blocked (`checkPlanLimit`) with a limit message | ☐ |
| 5 | Dashboard usage bar near limit | Turns amber at ≥80% | ☐ |
| 6 | Feature gate (e.g. WhatsApp on Starter) | Backend `403 FEATURE_NOT_IN_PLAN`; UI shows locked | ☐ |

### 6c. Subscription lifecycle
| # | Steps | Expected | ✅/❌ |
|---|---|---|---|
| 7 | Set tenant status `expired` (admin) | Next API call returns `402 SUBSCRIPTION_INACTIVE`; app routes to renewal; `/subscription` + `/billing` still reachable | ☐ |
| 8 | Super Admin bypass | super_admin never blocked by plan/subscription gates | ☐ |

---

## 7. Portal testing

⚠️ **Enable the portal locally first:** set `VITE_APP_DOMAIN=localhost` in root `.env`, restart `npm run dev`, then use **http://portal.localhost:8080** (Chrome resolves `*.localhost` automatically; other browsers may need a `hosts` entry). Also set `PORTAL_URL=http://portal.localhost:8080` in `backend/.env` so the magic link points locally.

### Customer Portal
| # | Steps | Expected | ✅/❌ |
|---|---|---|---|
| 1 | `portal.localhost:8080` → enter `ahmed@example.com` | "link sent" (always 200, no enumeration) | ☐ |
| 2 | Copy magic link from **backend console** → open it | Logged into the customer portal | ☐ |
| 3 | View dashboard / bookings / invoices | Sees **only own** bookings + invoices; **no internal cost/profit** | ☐ |
| 4 | Confirm read-only | No create/edit/delete actions exist | ☐ |

### Agent Portal
| # | Steps | Expected | ✅/❌ |
|---|---|---|---|
| 5 | Portal login with `karim@alsafa.com` | Agent portal loads | ☐ |
| 6 | View own customers / bookings / commission | Sees only own data + commission wallet (pending/paid) | ☐ |
| 7 | Cross-role isolation | An agency (main-app) token is rejected by the portal (wrong JWT audience) | ☐ |

---

## 8. Final checklist — before VPS deployment

**Blockers (from [102](102-RC1-Verification.md) / [103](103-RC1-Release-Checklist.md)):**
- ☐ **Migrations reconciled** — a fresh `prisma migrate deploy` on an empty DB creates **all** tables + indexes (38 tables were missing from migration history — [103 §2](103-RC1-Release-Checklist.md)). Validate on a scratch DB.
- ☐ **Secrets rotated** — the `.env.backup` values were in git history; rotate `JWT_SECRET`, `DATABASE_URL`, gateway/SMTP.
- ☐ **Prod env set** — real `VITE_API_URL` (not localhost), `DATABASE_URL`, `JWT_SECRET`; **`RATE_LIMIT_DISABLED` unset**, `ALLOW_DEV_JWT` unset, gateway `SANDBOX=false`.

**Quality gate:**
- ☐ `npm run build` OK · `tsc` clean · `eslint` (no new errors) · backend `node --test` 598/598 · frontend `vitest` 27/27.
- ☐ `GET /api/health` → `database:"connected"`, expected gateway modes.

**Acceptance:**
- ☐ Every §4 test case passes.
- ☐ The §5 money chain is consistent across Invoice/Booking/Ledger/Reports.
- ☐ §6 locks + upgrade dialog + plan limits behave correctly.
- ☐ §7 portals are read-only and isolated.

**Ops:**
- ☐ Pre-deploy DB backup taken **and restore-tested**.
- ☐ Rollback commit recorded; monitoring on `/api/health`.
- ☐ DNS/TLS for `app.`, `portal.`, `api.`, root + custom domains.

**Known open items (non-blocking, tracked):** enterprise price (custom vs 5,000 — [107](107-Frontend-Blueprint-Alignment.md)); deferred UI polish ([108](108-UI-Polish.md)); P2/P3 audit debt ([101](101-Audit-Remediation-Phase-2.md)); 3 unused deps pending lockfile reconcile ([106](106-Codebase-Cleanup.md)).

---

*Acceptance-test guide only. No code, schema, config, or data was changed. Awaiting approval.*
