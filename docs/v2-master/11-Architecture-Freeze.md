# 11 — Architecture Freeze (v2)

> 🧊 **STATUS: FROZEN — 2026-07-05.** This is the **official, single source of truth** for all TravelAgencyWeb v2 development.
> Where any other document (01–10), the codebase, or prior notes disagree with this file, **this file wins** and the other must be updated to match.
> Scope discipline: v2 targets the **Bangladesh travel-agency market**. Backward compatibility with the current schema and code is **mandatory** — every decision below is implementable additively (no destructive migration).

---

## 0. Freeze summary — the six locked decisions

| # | Decision | Principle |
|---|----------|-----------|
| 1 | **Generic Booking Engine** | One engine, every travel service. Service differences are data, not modules. |
| 2 | **Single Plan Engine** | One source of truth for plans, features, flags, sidebar, permissions, module access. FE never diverges from BE. |
| 3 | **Central Status Engine** | Every status centrally defined with a documented lifecycle. No free-text statuses. |
| 4 | **Unified Leads Pipeline** | One funnel: Lead → Inquiry → Quotation → Booking → Invoice → Payment → Delivery → Completed. |
| 5 | **Full B2B Agent Portal** | Booking submission, wallet, commission, ledger, invoice, document upload, tracking. |
| 6 | **Module Registry** | One registry entry per module drives sidebar, flags, permissions, plans, website, reports, APIs. |

**Postponed to Future Roadmap (explicitly NOT v2):** Row-Level Security · double-entry accounting · advanced multi-currency · public Developer API · OpenAPI docs · API marketplace. See [§11](#11-future-roadmap-postponed).

---

## 1. Final Architecture

```
                         ┌──────────────────────── BROWSER ────────────────────────┐
                         │  app.domain (ERP)   portal.domain (portal)   {slug}/custom │
                         └──────────────┬──────────────┬─────────────────┬───────────┘
        React 18 + TS + Vite + shadcn/Tailwind · domainResolver selects the surface
                                        │              │                 │
                                        ▼              ▼                 ▼
                         ┌───────────────────────────────────────────────────────────┐
                         │  Express 4 API (/api)  —  CommonJS  —  :4000 dev / :3027 prod │
                         │  authenticate → subscriptionAccessGate → Module Registry     │
                         │  → requirePermission / checkPlanLimit / requireFeature       │
                         │  → Central Status Engine (validate) → handler                │
                         └───────────────┬───────────────────────────────────────────┘
                                         │  Prisma 5
                                         ▼
                              PostgreSQL 16  (multi-tenant, tenantId, onDelete: Cascade)
        integrations: SMTP · SMS (BulkSMSBD) · WhatsApp · bKash · SSLCommerz · manual/offline
        scheduled: subscription-expiry · trial-drip · passport-expiry · departure-reminders (via /api/cron)
        storage: local bind mounts (backend/uploads)
```

**Stack (frozen):** React 18 + TypeScript + Vite + Tailwind + shadcn/ui (frontend, ESM); Node + Express + Prisma (backend, CommonJS); PostgreSQL 16. Money is `Float` for v2. i18n EN/BN.

**Three surfaces (frozen):**
| Surface | Host | Audience | Auth |
|---------|------|----------|------|
| Main app (ERP) | `app.` / root / `admin.` / localhost | Agency staff + Super Admin | JWT (default audience) |
| Public tenant website | `{slug}.domain`, custom domain, `/site/:slug` | Agency prospects | public |
| **Portal (customer + supplier + B2B agent)** | `portal.` | External parties | passwordless magic-link JWT (audience `portal`) |

**Tenant isolation (frozen for v2):** enforced by **mandatory `tenantId` filtering in every query** ([10 §1](10-Development-Rules.md)), documented and code-reviewed. *Automated* enforcement (Prisma extension / RLS) is a **Future Roadmap** hardening item, not a v2 blocker.

---

## 2. Final Organogram

```
PLATFORM (global, no tenantId)
  super_admin ───────── PlatformStaff(permissions[])
      │  provisions / approves / suspends tenants, plans, payments
      ▼
TENANT (Agency = one Tenant row; everything tenantId-scoped)
  tenant_owner
     ├── manager
     │      ├── sales_agent        (front desk / sales)
     │      ├── operations         (ticketing / visa / hajj / delivery desks)
     │      └── accountant         (invoices / accounts / reports)
     └── (owner: full access)

EXTERNAL (Portal, magic-link)
  ├── customer  (a Client)   → view bookings, invoices, documents, tracking
  ├── supplier  (a Vendor)   → view purchase orders / payables
  └── AGENT (B2B sub-agent)  → FULL portal (see §7): submit bookings, wallet, commission,
                                ledger, invoices, document upload, booking tracking
```

Roles map 1:1 to the RBAC set in [07-Permission-Matrix](07-Permission-Matrix.md). Legacy aliases: `owner`/`admin`→`tenant_owner`, `member`→`sales_agent`.

---

## 3. Final Module Hierarchy

Ten sidebar groups (rendered from the **Module Registry**, §6). Membership is frozen; visibility is per-tenant (plan + service type + role).

| Group | Modules |
|-------|---------|
| Overview | dashboard |
| CRM | crm-hub, clients, corporate, agents, vendors |
| Sales & Bookings | quotations, **bookings (Generic Booking Engine)**, visa-stock, service-catalog, ticket-transactions, flight-reminders |
| Tour & Group Travel | group-tours, mice, travel-approvals, visa-tracker |
| Operations | documents, tasks, service-operations, hajj-operations, bd-operations |
| Finance & Accounts | invoices, payments, expenses, commissions, accounts, reports |
| HR & Payroll | team, hrm, roles, activity-log, payroll |
| Marketing & Loyalty | loyalty, referrals |
| Website & CMS | website-home, website-builder, website-blog, website-publish, website-seo |
| Administration | notifications, settings, organization, subscription, user-guide |

Platform-only surface: `/admin/*` (super_admin). External surface: Portal (§7).

---

## 4. Final Business Services

**All 12 business services are delivered through the ONE Generic Booking Engine (§5).** None is a separate booking module.

| Business service | Underlying service type(s) |
|------------------|----------------------------|
| Air Ticket | `air_ticket` |
| Visa | `visa` |
| Hajj & Umrah | `hajj_umrah` (+ Hajj Operations desk for pilgrim/group bulk) |
| Tour Packages | `tour_domestic`, `tour_international` |
| Hotel Booking | `hotel` |
| Student Consultancy | `study_abroad` |
| Manpower | `b2b_agent` (overseas employment) |
| Corporate Travel | `corporate_travel`, `mice_event` |
| Passport Services | `custom` (travel_documentation) |
| Travel Documentation | `custom` (travel_documentation) |
| Additional Services | `custom` (additional_services) |
| *(Transport, Cruise, Medical — also supported)* | `transport`, `cruise`, `medical_tourism` |

The 14 service types / 135 catalog subcategories / 6 onboarding presets remain the taxonomy ([04-Service-Modules](04-Service-Modules.md)). Hajj/Umrah keeps its **Operations desk** (pilgrims, groups, rooming, installments) as the bulk special case, but a Hajj sale is still a Booking in the engine.

---

## 5. Final Booking Engine (Generic)

**One `Booking` entity serves every service.** Frozen design:

- **Core record:** existing `Booking` model — `type` (service type), `amount/cost/profit/paidAmount/dueAmount`, `status`, `paymentStatus`, `opsStatus`, `serviceDetails Json`, agent/client/package links. **No schema change required** — this is already the shape.
- **Service-specific fields = configuration, not code.** Today there are 9 hardcoded `*Fields.tsx` components. v2 introduces a **Service Field Registry**: a declarative field-definition set per service type (label, key, input type, validation, i18n EN/BN) that renders dynamically into `serviceDetails`. Adding service line #15 = a registry entry, **not** a new component or migration.
- **Lifecycle (Central Status Engine, §8-status):** the booking status lifecycle is the operational spine of the unified pipeline:

```
inquiry → pending → confirmed → ticketed → traveling(=Delivery) → completed
                                        └──────────────→ cancelled
paymentStatus:  unpaid → partial → paid          (derived from invoice payments)
opsStatus:      per-service operational track (e.g. visa: applied→appointment→decision)
```

- **Backward compatibility:** existing per-type components remain valid during migration; the registry is introduced additively and they are retired incrementally.
- **Sub-collections stay:** segments, travelers, checklist, timeline, documents (all `/bookings/:id/...`).
- **Money roll-up unchanged:** payment → invoice → booking → ledger + installments ([05 §4](05-Workflow-Book.md)). The payment-delete reversal gap is a **must-fix** ([§10](#10-final-development-rules)).

---

## 6. Final Module Registry

**A single registry is the spine of the whole app.** One entry per module; every subsystem reads from it — nothing is hard-coded in the sidebar, no entitlement is duplicated.

**Registry entry (canonical shape):**
```
ModuleRegistryEntry {
  id            // e.g. "bookings"
  group         // sidebar group, e.g. "salesBookings"
  route         // e.g. "/bookings"
  titleKey      // i18n key (EN/BN), e.g. "sidebar.bookings"
  rbacModule    // Permission module (07) → drives requirePermission + UI gates
  minPlan       // plan floor (08) → Single Plan Engine
  requiredFeature   // feature flag (08), optional
  requiredServiceTypes[]  // service-type gating (04), optional
  website       // does this module expose public-website content?
  reports       // does this module contribute to Reports/BI?
  api           // API surface it owns (internal; public API is Future Roadmap)
}
```

**What the registry controls (frozen):**
| Concern | Sourced from registry entry |
|---------|-----------------------------|
| Sidebar | `group` + `route` + `titleKey` + all gates |
| Feature flags | `requiredFeature` |
| Permissions | `rbacModule` → matrix in [07](07-Permission-Matrix.md) |
| Plans | `minPlan` → [08](08-Plan-Feature-Matrix.md) |
| Website | `website` |
| Reports | `reports` |
| APIs | `api` |

**Rule:** the registry is defined **once (backend-owned)** and consumed by the frontend. This subsumes today's separate `navigation.ts` / `moduleAccess.ts` / permission maps into one authority. Introduced additively over existing config; backward compatible.

---

## 7. Final B2B Agent Portal

The Agent Portal is a **full self-service surface** in v2 (current code is read-only — this is the frozen target). Audience `portal`, role `agent`, magic-link auth. All actions tenant-scoped and sanitized (never expose internal `cost`/`profit` beyond the agent's own commission).

| Capability | Behaviour (frozen) |
|-----------|--------------------|
| **Booking Submission** | Agent creates a Booking that enters the tenant's pipeline at `inquiry`/`pending` (flagged as agent-originated) for staff confirmation. Reuses the Generic Booking Engine — no separate model. |
| **Wallet** | Agent balance (existing `Agent.balance` + `AgentTransaction` ledger) — deposits/adjustments visible. |
| **Commission** | Per-booking commission (`BookingAgentCommission`) — pending/paid totals + history. |
| **Ledger** | Full `AgentTransaction` statement (deposit / payment / adjustment, running balance). |
| **Invoice** | View invoices tied to the agent's bookings; download. |
| **Document Upload** | Attach documents to the agent's own bookings (reuses `BookingDocument`, multer upload). |
| **Booking Tracking** | Real-time status/paymentStatus/timeline (customer-safe events) for the agent's bookings. |

**Backward compatibility:** built on existing `Agent`, `AgentTransaction`, `AgentCommissionProfile`, `Booking`, `BookingDocument`, `Invoice` — additive endpoints under `/api/portal/agent/*`; at most a small additive flag to mark agent-originated bookings.

---

## 8. Final Permission Architecture

Unchanged in content from [07-Permission-Matrix](07-Permission-Matrix.md); **frozen in ownership**: the matrix is now a **product of the Single Plan Engine + Module Registry**, defined once and consumed by both tiers.

- **Roles (6 + platform):** `super_admin`, `tenant_owner`, `manager`, `sales_agent`, `accountant`, `operations` (+ `PlatformStaff`).
- **Modules (19):** dashboard … admin_panel.
- **Actions (6):** view, create, edit, delete, approve, export.
- **Enforcement (frozen):** backend `requirePermission(module, action)` is authoritative; UI mirrors it via gates. `super_admin` bypasses; `admin_panel` is super-admin-only; all checks **fail closed**.
- **Rule:** FE and BE permission definitions must resolve to the **same source** — no hand-maintained duplicate ([10 §2](10-Development-Rules.md)). Full grid in [07](07-Permission-Matrix.md).

---

## 9. Final Plan Engine

**ONE Single Plan Engine (backend-owned) is the sole authority** for Plans, Limits, Feature Flags, Sidebar visibility, Permissions defaults, and Module Access. The frontend **consumes** it (shared/generated definition) and defines nothing of its own. This resolves all drift documented in [08](08-Plan-Feature-Matrix.md).

**Frozen tiers:** `basic → pro → business → enterprise` (BDT; yearly = 10× monthly). `free`/`unlimited` are legacy aliases normalized by the engine. **Enterprise pricing is reconciled to one value** (the engine's, not two).

**One definition yields all of:**
```
PlanEngine[plan] → {
  limits:    { clients, bookings, leads, quotations, users, domains, whatsapp, ... }  // -1=∞, 0=off
  features:  { hasCustomDomain, hasWebsiteTemplates, hasSmsIntegration, hasWhatsApp,
               hasAgentCommission, hasAdvancedAnalytics, hasMarketingTools,
               hasRefundSystem, hasApiAccess, hasPrioritySupport, ... }
  modules:   advanced-bundle floors (via Module Registry minPlan)
  pricing:   { monthly, yearly }
  trial:     env-driven (TRIAL_DAYS, default 7, 0–90)
}
```

**Enforcement stack (frozen, per request):**
```
authenticate → subscriptionAccessGate(402 if expired) → checkPlanLimit(403) → requireFeature(403) → handler
```
Values (limits, flags, pricing) remain exactly as tabulated in [08](08-Plan-Feature-Matrix.md); the freeze changes **where they live** (one engine) and **that FE/BE cannot diverge**, not the numbers. All checks fail closed; `super_admin` and `enterprise (-1)` bypass appropriately.

---

## 10. Final Development Rules

The [10-Development-Rules](10-Development-Rules.md) doc governs; these are the **frozen v2 mandates** (must-follow), superseding any earlier "before coding" list:

1. **Tenant isolation** — every tenant-scoped query filters by `req.tenantId`; writes/deletes via `updateMany`/`deleteMany` + `{id, tenantId}` → 404 on miss. (Automated RLS = Future Roadmap.)
2. **Single Plan Engine** — plans/features/flags/sidebar/permissions/module-access come from ONE backend source; FE consumes it. No parallel definitions.
3. **Central Status Engine** — statuses defined once in a shared module, validated on every write against the documented lifecycle; **no free-text status**. Columns stay `String` (backward compatible).
4. **Module Registry** — add features by registering a module entry, not by hand-wiring nav + permissions + gates separately.
5. **Generic Booking Engine** — new service types are Service Field Registry config, not new models/components.
6. **Money integrity (v2 scope)** — `Float` retained; **every money mutation must have an idempotent reverse** (fix the payment-delete gap). Decimal/double-entry = Future Roadmap.
7. **Backward compatibility** — all v2 changes are additive; no destructive migrations; existing data/routes keep working.
8. **FE is cosmetic; BE enforces** — RBAC + plan + subscription all server-side, fail closed.
9. **DB via migrations** — standardize on `prisma migrate`; retire the `db push` setup path.
10. **Deploy discipline** — branch off `main`; deploy is manual (`scripts/vps-pm2-deploy.sh`); beware the prod `Stop`-hook auto-deploy ([10 §9](10-Development-Rules.md)).

---

## 11. Future Roadmap (postponed)

Explicitly **out of v2 scope** — excellent, but not required for the Bangladesh launch. Revisit post-v2:

| Item | Why deferred |
|------|--------------|
| PostgreSQL Row-Level Security | v2 uses documented manual `tenantId` filtering; RLS is hardening, not a launch blocker. |
| SAP-style double-entry accounting | v2 keeps the single-entry income/expense ledger + reversible mutations; sufficient for BD agencies. |
| Advanced multi-currency engine | v2 is BDT-only (BD-first); currency dimension added later. |
| Public Developer API | `hasApiAccess` flag reserved; no public surface in v2. |
| OpenAPI documentation | Follows the public API. |
| API marketplace | Long-term platform play. |

---

## 12. Architecture Freeze Checklist

Legend: ✓ Completed · ⚠ Pending (designed/frozen, implementation outstanding) · ❌ Not Started

### Documentation (freeze deliverables)
- ✓ Blueprint docs 01–10 authored and code-grounded
- ✓ Freeze banners applied to 01–10
- ✓ Factual corrections (migration workflow) applied to 06 & 10
- ✓ `11-Architecture-Freeze.md` authored as single source of truth
- ✓ Future Roadmap section defined (postponed items relocated)
- ✓ README index updated to include this freeze

### Approved-for-v2 designs (frozen; implementation not yet built)
- ⚠ **Generic Booking Engine** — design frozen; Service Field Registry not yet implemented (per-type components still in use)
- ⚠ **Single Plan Engine** — design frozen; three sources not yet consolidated (drift still live in code)
- ⚠ **Central Status Engine** — design frozen; status validation module not yet built (statuses still free-text in routes)
- ⚠ **Unified Leads Pipeline** — decision frozen; dual Leads/Inquiry concept not yet reconciled in code/nav
- ⚠ **Module Registry** — design frozen; registry not yet implemented (navigation/moduleAccess/permissions still separate)
- ❌ **Full B2B Agent Portal** — write flows (booking submission, upload) not started; current portal read-only

### Supporting fixes surfaced by review
- ⚠ Payment-delete does not reverse invoice/booking/ledger — fix required (v2)
- ⚠ DB workflow standardized on migrations — retire `db push` setup path
- ⚠ Enterprise pricing reconciled to one value in the Plan Engine

### Postponed (intentionally not started for v2)
- ❌ Row-Level Security · ❌ Double-entry accounting · ❌ Multi-currency · ❌ Public Developer API · ❌ OpenAPI · ❌ API marketplace

---

**This document is FROZEN. Changes require an explicit unfreeze decision.**
*Cross-references: [01-Vision](01-Vision.md) · [02-Business-Architecture](02-Business-Architecture.md) · [03-Master-Organogram](03-Master-Organogram.md) · [04-Service-Modules](04-Service-Modules.md) · [05-Workflow-Book](05-Workflow-Book.md) · [06-Database-Blueprint](06-Database-Blueprint.md) · [07-Permission-Matrix](07-Permission-Matrix.md) · [08-Plan-Feature-Matrix](08-Plan-Feature-Matrix.md) · [09-UI-UX-Standards](09-UI-UX-Standards.md) · [10-Development-Rules](10-Development-Rules.md)*
