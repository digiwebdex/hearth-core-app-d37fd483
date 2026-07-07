# 115 — CRM Module Completion Report

**Milestone:** Organization ERP → **Module 1: CRM** (v2 Master Blueprint)
**Status:** Implementation complete; verified via build + typecheck + tests + contract/tenant-isolation audit.
**Scope rule honored:** Reuse existing auth / permissions / subscription gate / DB models / APIs. **One** new additive Prisma model (`CrmActivity`), **zero** duplicate models, no parallel APIs, no duplicated business logic. All changes additive & backward compatible.

---

## 1. Feature status (7/7 requested CRM sub-features)

| # | Sub-feature | Status | How (reuse-first) |
|---|-------------|--------|-------------------|
| 1 | **Customers** | ✅ Already complete + enhanced | `clients.js` / `Clients.tsx` / `ClientProfile.tsx` were already full CRUD (passport, NID, wallet, family, tags, documents). **Added** a unified **Timeline** tab (notes + activities) to `ClientProfile.tsx`. |
| 2 | **Leads** | ✅ Already complete | `leads.js` + `Leads.tsx`/`LeadDetails.tsx` — full pipeline, `LeadActivity` timeline, convert. Left intact (its own timeline already works; not duplicated). Full Lead→Inquiry *pipeline unification* remains a separate frozen-but-pending architectural item (blueprint §12) — leads are fully functional today. |
| 3 | **Corporate Clients** | ✅ New management surface | `CorporateTravel.tsx` upgraded from a read-only billing view into a full **management surface** (Clients tab: create/edit corporate profiles with company, contact, credit limit, contract ref/expiry, address; Billing tab: the existing monthly roll-up). **Reuses the `Client` model** (`clientType="corporate"`) — no `CorporateClient` model created. New `clientApi.listCorporate()` over an additive `?clientType=` filter on `GET /clients`. Added to the CRM sidebar group per blueprint §3. |
| 4 | **Suppliers (Vendors)** | ✅ Already complete | `vendors.js` + `Vendors.tsx`/`VendorDetails.tsx` — CRUD, bills, payments, `VendorNote` timeline. Left intact. |
| 5 | **Tasks** | ✅ Enhanced | New `tasks.js` route **replaces** the generic `crud("task")` mount — same CRUD contract (no FE breakage) **plus** optional CRM linkage (`relatedType`/`relatedId`), server-set `createdBy`, `?relatedType&relatedId` filtering, richer status/priority. `Tasks.tsx` rewritten: assignee field, "Linked to" column, new status/priority options, and **full EN/BN** (previously hardcoded English). |
| 6 | **Activities** | ✅ New | New entity-agnostic `CrmActivity` model + `/api/crm-activities` route + reusable `ActivityTimeline` component. Logs call / email / meeting / whatsapp / sms / visit / other with optional follow-up date, pinning, and outcome — surfaced on the Customer & Corporate profiles. |
| 7 | **Notes** | ✅ New | Same `CrmActivity` store (`type="note"`) — a note is just a text-only activity. One model serves both features (no separate Note table); filter chip toggles Notes / Activities / All. |

---

## 2. Architecture & reuse

- **One additive Prisma model:** `CrmActivity { tenantId, entityType, entityId, type, title, body, outcome, dueAt, pinned, metadata, createdBy, timestamps }` — mirrors the existing entity-agnostic `Document` model shape (bare `tenantId` scalar, `{entityType,entityId}`, no per-parent FK), so **one** table serves clients, corporate clients, vendors and agents. Notes + Activities are a `type` discriminator on this one model — **no duplication**.
- **Task columns (additive):** `relatedType`, `relatedId`, `createdBy`, `updatedAt` + two indexes. Backfilled; existing rows unaffected.
- **Migration:** `20260708090000_crm_activity_and_task_links` — pure `ADD COLUMN` + `CREATE TABLE`/`CREATE INDEX`. No destructive change. `prisma generate` verified.
- **Backend additions (additive only):** `routes/crmActivities.js`, `routes/tasks.js`; mounted in `app.js` at `/api/crm-activities` and `/api/tasks` (the latter swaps the generic factory for the enriched route while preserving its endpoints). Tiny `?clientType=` filter added to `GET /clients`.
- **Frontend:** all new calls centralized in `src/lib/api.ts` (`crmActivityApi`, `clientApi.listCorporate`, `taskApi.listByRelated`, enriched `Task`/new `CrmActivity` types); one reusable component `src/components/crm/ActivityTimeline.tsx`; `CorporateTravel.tsx` and `Tasks.tsx` upgraded; `ClientProfile.tsx` gains a Timeline tab; `navigation.ts` gains the Corporate CRM entry.

## 3. Security posture (tenant isolation & RBAC)

- **Tenant isolation:** every new query filters by `req.tenantId`; every write sets `tenantId: req.tenantId`; every update/delete uses `updateMany`/`deleteMany` on `{ id, tenantId }` → 404 on miss (never a bare `update`). Matches [10 §1](10-Development-Rules.md).
- **RBAC:** `crm-activities` gated on the CRM anchor module `clients` (view/create/edit/delete) — same precedent as `crmEngine`/`crmAnalytics`/`crmSettings`. `tasks` gated on the `tasks` module. All checks server-side, fail closed; `super_admin` bypasses as designed.
- **No trust of client-supplied identity:** `createdBy` is set from `req.userId`, never the body; `entityType`/`type`/`relatedType` are whitelist-normalized server-side.

## 4. UX & bilingual

- Reusable `ActivityTimeline` uses shadcn primitives (Card, Select, Textarea, Badge, AlertDialog) + lucide icons; responsive (stacks on mobile, `overflow-x-auto` tables); destructive delete behind an `AlertDialog`.
- **English & Bangla:** new `crmActivity.*` and `tasksPage.*` key sets + extended `corporate.*` and `sidebar.corporate` added to **both** `en.json` and `bn.json` (locale files edited programmatically → additions-only diff, CRLF/indent preserved; both parse). The Tasks page, previously hardcoded English, is now fully bilingual.

## 5. Verification performed

| Check | Result |
|-------|--------|
| Frontend production build (`npm run build`) | ✅ Built in ~18 s, no errors (pre-existing chunk-size warning only) |
| Type-check (`npx tsc --noEmit`, whole repo) | ✅ **0 errors** |
| Frontend tests (`npm test`) | ✅ 28/28 pass (incl. `navigation.test.ts`) |
| Backend tests (`cd backend && npm test`) | ✅ **606/607 pass** (+8 new CRM tests) |
| New backend test (`crmActivities.test.js`) | ✅ 8/8 (registry shape + auth gates on crm-activities & tasks) |
| Backend app load smoke (`createApp()`) | ✅ Loads; new routes mounted |
| ESLint (changed files) | ✅ No new errors/warnings |
| i18n JSON validity (en + bn) | ✅ Both parse; keys mirrored |

**Known non-CRM test failure:** `backend/test/sidebarEngine.test.js:111` (capability plan-floor for `tourGroups`) — **pre-existing and unrelated**, already flagged in report [114](114-Customer-Portal-Completion.md) for the plan-redesign owner. Unchanged by this milestone.

**Live click-through** (Customer profile → add Note → log Activity (call) with follow-up → pin → delete; Corporate → create client → edit → open profile; Task → create with assignee → link display) validated at the build + type + API-contract + tenant-isolation-audit level (matching the report-114 standard). A live browser walk needs the embedded-Postgres stack with seed data; available on request.

## 6. Files

**New (backend):** `src/routes/crmActivities.js`, `src/routes/tasks.js`, `test/crmActivities.test.js`, `prisma/migrations/20260708090000_crm_activity_and_task_links/migration.sql`.
**Modified (backend):** `prisma/schema.prisma` (`CrmActivity` model + `Task` columns), `src/app.js` (mounts), `src/routes/clients.js` (`?clientType=` filter).
**New (frontend):** `src/components/crm/ActivityTimeline.tsx`.
**Modified (frontend):** `src/pages/CorporateTravel.tsx`, `src/pages/Tasks.tsx`, `src/pages/ClientProfile.tsx`, `src/lib/api.ts`, `src/config/navigation.ts`, `src/i18n/locales/{en,bn}.json`.

## 7. Deliberately deferred (documented, not silently dropped)

- **Lead → Inquiry pipeline unification** (blueprint decision #4 / §12): leads remain a fully-working standalone pipeline; folding them into the `Booking.inquiry` stage is a large, invasive architectural change the freeze itself lists as pending. Not required for CRM to be functionally complete.
- **Unified timeline on Vendors/Leads:** they already have working `VendorNote` / `LeadActivity` timelines — not migrated to `CrmActivity` to avoid ripping out working features and creating churn. `CrmActivity` already supports `vendor`/`agent`/`lead` entity types for future consolidation.
