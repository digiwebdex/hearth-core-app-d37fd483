# 105 — Frontend Restructure (Phase 4, Task 2)

**Date:** 2026-07-06
**Goal:** Align the Tenant-ERP frontend navigation with the master SaaS blueprint — a 15-section sidebar, the 13 travel services as a first-class section, and **show-locked-not-hidden** plan/service gating — using **one** sidebar config, **one** set of reusable guards, and **no** new pages or backend changes.
**Constraints honored:** no backend/business-logic change · no API change · no duplicate pages · reuse existing routes/components · no hardcoded permissions or plan logic.
**Verification:** `npm run build` ✅ · TypeScript ✅ · ESLint ✅ · Frontend tests **27/27** ✅.

---

## 1. Old structure → New structure

| Aspect | Old | New |
|---|---|---|
| Sidebar sections | **10** groups (Overview, CRM, Sales & Bookings, Tour & Group Travel, Operations, Finance, HR, Marketing & Loyalty, Website, Administration) | **15** sections matching the blueprint (below) |
| Travel services | Scattered — service desks hidden inside Operations/Sales; per-type views reachable only via `/bookings/:preset` | Dedicated **Travel Services** section (§5) listing all **13** services |
| Not-included module | **Hidden** (filtered out) for service-type / module gates | **Shown locked** — greyed, 🔒, plan badge, tooltip, click → Upgrade dialog |
| Plan-gated item | Already shown locked (tooltip only) | Shown locked **+ upgrade badge + click-through Upgrade Plan dialog** |
| Sidebar component | 1 (`AppSidebar` + `AppSidebarNav`) | Same 1 — extended, not duplicated |
| Guards | `PermissionGate`, `FeatureGate`, `SubscriptionGate`, `usePlanAccess` | Same — now the **canonical** reusable set; sidebar reuses `usePlanAccess` + `isServiceTypeEnabled` |
| Upgrade UX | ad-hoc "/subscription" navigate | **1 reusable `UpgradePlanDialog`** |

**No pages were created or moved.** Every nav target is an existing route (`/bookings/:preset`, `/corporate`, `/packages/all`, `/hajj-umrah`, `/reports`, …). App.tsx routing, all 108 pages, and every API are unchanged.

## 2. Files changed

| File | Change |
|---|---|
| `src/config/navigation.ts` | Reshaped `getNavigationGroups()` to the 15-section tree + `TRAVEL_SERVICES` (13). Added optional plain `title`/`label` fallbacks (no i18n files touched). Single source of truth. |
| `src/components/AppSidebarNav.tsx` | RBAC still **hides**; plan/feature/service/advanced-module gates now render **locked** via `resolveLock()` (config-driven). New `LockedNavRow` = 🔒 + plan badge + reason tooltip + click → dialog. Reuses `usePlanAccess` + `isServiceTypeEnabled`. |
| `src/components/UpgradePlanDialog.tsx` | **New** reusable dialog (plan/feature/service/module reasons → Upgrade Plan / Manage Services CTAs). |
| `src/components/AppSidebar.tsx` | Passes `enabledServiceTypes` + `enabledSubcategories` to the nav group (service-focus locking). |
| `src/test/navigation.test.ts` | Rewritten for the 15-section structure + travel-service lock config (6 tests). |

## 3. Sidebar Tree (Tenant ERP — 15 sections)

```
1  Dashboard
2  CRM ............... CRM workspace · Clients · Agents · Vendors
3  Sales ............. Quotations · Service Catalog (/packages/all) · Visa Stock
4  Booking ........... Bookings · Ticket Transactions* · Flight Reminders* · Group Tours*
                        · MICE* · Travel Approvals* · Visa Tracker*
5  Travel Services ... Air Ticket · Visa · Hotel · Hajj & Umrah · Tour · Transportation
                        · Insurance · Student Consultancy · Overseas Manpower
                        · Corporate Travel · Passport Service · Travel Documentation
                        · Other Services      ← each shown NORMAL or 🔒 by service focus
6  Finance & Accounts  Invoices · Payments · Expenses · Commissions* · Accounts
7  HR & Payroll ...... Team · HRM · Roles · Recruitment · (Activity Log) · Payroll
8  Documents ......... Documents · Tasks
9  Marketing ......... Campaigns · Loyalty · Referrals
10 Website CMS ....... Home · Builder · Blog · Publish · SEO   (pro + hasWebsiteTemplates)
11 Reports ........... Financial Reports · Sales Analytics · Financial Statements
12 Automation ........ Notifications · Reminders
13 Integrations ...... Payment & Messaging (→ Settings)        (pro+)
14 Settings .......... Settings · Organization · Tax Rules · User Guide
15 Subscription ...... Subscription · Billing
```
`*` = service-type-gated (locks when the tenant's service focus excludes it). Travel Services URLs reuse `/bookings/:preset` (Air Ticket → `/bookings/flight`, Visa → `/bookings/visa`, Hotel → `/bookings/hotel`, Tour → `/bookings/tour`, Transport → `/bookings/transport`, Insurance → `/bookings/insurance`, Student → `/bookings/student`, Manpower → `/bookings/manpower`), the existing `/hajj-umrah` and `/corporate` pages, and `/packages/all` for Passport/Documentation/Other.

## 4. Navigation Tree (route hierarchy — unchanged, documented)

```
Public Website (marketing + tenant sites)   /  /about /packages /blog /contact /pricing …  + /site/:slug/*
   │
Authentication                              /login /register /forgot-password /reset-password /verify-email
   │
Super Admin (AdminRoute)                    /admin/*   (23 pages)
   │
Tenant ERP (ProtectedRoute / PermissionRoute)  /dashboard …  ← 15-section sidebar
   │
Customer Portal ─┐
Agent Portal ─────┤  src/portal/  (separate app shell, portal.* host, /api/portal)
Staff Portal ─────┘  = role-scoped Tenant ERP (sales_agent / accountant / operations)
```

## 5. Plan Matrix (marketing name → enforced tier)

| Marketing plan | Enforced tier | Unlocks (frontend gating mirrors backend `planFeatures.js`) |
|---|---|---|
| **Free Trial** | trial state (basic caps) | Full basic capability until `subscriptionExpiry` |
| **Starter** | `basic` | Core CRM/Sales/Booking/Finance; Payroll, Expenses, Accounts, Reports, Tax |
| **Professional** | `pro` | + Website CMS, SMS/WhatsApp, Agent Commission, custom domain |
| **Business** | `business` | + Advanced Analytics, Marketing tools, Refund system, Recruitment |
| **Enterprise** | `enterprise` | + API access, Loyalty, Referrals, unlimited limits |

Locks are **derived**, never hardcoded: the sidebar reads `minPlan` / `requiredFeature` from the nav config and resolves them through `usePlanAccess` (which reads `plans.ts`, the frontend mirror of `planFeatures.js`). Travel-service locks derive from `enabledServiceTypes` via `isServiceTypeEnabled` (the canonical resolver, incl. the "show-everything" default for fresh tenants).

## 6. Permission Flow (how each nav item resolves)

```
For each item in the 15-section config:
  1. RBAC        canAccess(item.module)            ── false → HIDE (role can't use it)
  2. Plan floor  rank(plan) ≥ rank(item.minPlan)   ── false → LOCK 🔒 (reason: plan)
  3. Feature     plan.has(item.requiredFeature)     ── false → LOCK 🔒 (reason: feature)
  4. Service     ≥1 of item.requiredServiceTypes    ── false → LOCK 🔒 (reason: service)
                   enabled for the tenant
  5. Adv. module isNavItemModuleEnabled(...)         ── false → LOCK 🔒 (reason: module)
  else → NORMAL link
Locked row → tooltip + click → UpgradePlanDialog (Upgrade Plan / Manage Services)
```
RBAC is the **only** gate that hides (a role genuinely without a module). Every plan/service/feature reason **shows the item locked** — the requested "don't hide, show 🔒" behavior. This mirrors the backend, which still enforces the same gates server-side (`checkPlanLimit` / `requireFeature` / service-type checks) — the frontend lock is UX, not the security boundary.

## 7. Portal Flow

The blueprint hierarchy already exists and is unchanged — this restructure documents and preserves it:
- **Public Website** — marketing `Index` + tenant public sites (`WebsiteProvider`, slug/custom-domain via `domainResolver`).
- **Authentication** — login/register/reset/verify.
- **Super Admin** — `/admin/*` behind `AdminRoute` (`super_admin` only).
- **Tenant ERP** — protected app with the new 15-section sidebar; `PermissionRoute` per module.
- **Customer Portal / Agent Portal** — `src/portal/` shell (separate JWT audience, email-ownership, `/api/portal`).
- **Staff Portal** — the Tenant ERP scoped by role (sales_agent / accountant / operations) via the same RBAC matrix + sidebar hiding.

## 8. Frontend improvements delivered

- **One** sidebar config (`navigation.ts`) → **one** renderer (`AppSidebarNav`) → **one** shell (`AppSidebar`). No duplicated navigation or menu config.
- **Config-driven locking** — no hardcoded plan/permission strings in components; gates live as data on nav items and resolve through the shared `usePlanAccess` + `isServiceTypeEnabled`.
- **One reusable `UpgradePlanDialog`** for every locked module (plan/feature/service reasons).
- **Discoverability** — every module (incl. Business/Enterprise-only and unselected services) is visible-but-locked, so tenants see what upgrading unlocks (conversion-friendly) instead of a hidden menu.
- **Zero new pages / zero API changes** — 100% route reuse; backward compatible.
- **Consistent UI** — reuses shadcn `Sidebar`/`Tooltip`/`Dialog`/`Badge`, so spacing/icons/colors and light+dark themes are inherited automatically.

## 9. Known follow-ups (not in scope here)

- **i18n:** the 6 new section labels + Travel Services item titles use plain English `title`/`label` fallbacks; add `sidebar.*` EN/BN keys for full localization.
- **Bundle size:** the 2.5 MB main chunk (eager imports in `App.tsx`) is unchanged — tracked as a P1 cleanup in [104-Codebase-Review.md](104-Codebase-Review.md) §8, deliberately out of this navigation restructure.
- **Integrations section** links to `/settings` (where gateways/SMS/WhatsApp are configured today); a dedicated Integrations page is a future enhancement, not a duplicate page.

---

*Frontend restructure complete. Backend, APIs, and existing pages unchanged. Awaiting approval.*
