# 04 — Service Modules & Catalog

> 🧊 **ARCHITECTURE FREEZE (v2) — 2026-07-05.** Authoritative frozen design: [11-Architecture-Freeze](11-Architecture-Freeze.md).
> - **Generic Booking Engine (frozen):** ONE engine serves every travel service — Air Ticket, Visa, Hajj & Umrah, Tour Packages, Hotel, Student Consultancy, Manpower, Corporate Travel, Passport Services, Travel Documentation, Additional Services. Service-specific fields are **config-driven**, not separate per-service modules ([11 §Final Booking Engine](11-Architecture-Freeze.md)).
> - **Module Registry (frozen):** a single registry defines each module's sidebar, feature flags, permissions, plan floor, website, reports and API surface ([11 §Final Module Registry](11-Architecture-Freeze.md)).
> - **Leads unified:** one pipeline only — Lead → Inquiry → Quotation → Booking → Invoice → Payment → Delivery → Completed. The half-deprecated dual concept is retired.

> **Status:** Authoritative reference, generated from code.
> **Sources:** `src/config/navigation.ts`, `src/lib/serviceTypes.ts`, `src/lib/serviceCatalog.ts`, `src/lib/enabledServiceTypes.ts`, `src/lib/moduleAccess.ts`, and their backend mirrors under `backend/src/constants/` + `backend/src/lib/moduleAccess.js`.

This doc defines **what the product sells** (service taxonomy) and **how the app surfaces it** (navigation + gating). Three distinct concepts must not be conflated:

| Concept | Count | Namespace | Purpose |
|---------|-------|-----------|---------|
| **Service types** | 14 | `serviceTypes.ts` | Coarse booking/menu categories a tenant enables. |
| **Catalog subcategories** | 135 | `serviceCatalog.ts` | Fine customer-facing sub-services (each maps to a legacy service type). |
| **RBAC modules** | 19 | `permissions.ts` | Permission surface (see [07](07-Permission-Matrix.md)). |
| **Advanced module bundles** | 12 | `moduleAccess.ts` | Plan-gated, opt-in sidebar bundles. |

---

## 1. The 14 service types

Enabled per tenant at signup; drive which menus, booking types, and website sections appear. Identical in frontend and backend (`SERVICE_TYPES`). Bilingual EN/BN labels.

`hajj_umrah` · `tour_domestic` · `tour_international` · `visa` · `air_ticket` · `hotel` · `transport` · `cruise` · `study_abroad` · `medical_tourism` · `corporate_travel` · `mice_event` · `b2b_agent` · `custom`

Unknown/empty → normalizes to `custom` (`normalizeServiceType`).

> Note: there is no standalone `student`/`manpower`/`ticket`/`insurance` service *type* — those map to `study_abroad`, `b2b_agent`, `air_ticket`, and catalog categories respectively.

## 2. The 135-item catalog (14 categories)

`SERVICE_CATALOG` is the richer customer-facing taxonomy. Each category has a `legacyServiceType` that maps its subcategories back to one of the 14 types for filtering.

| Category | legacyServiceType | # subs |
|----------|-------------------|:-----:|
| `air_ticketing` | air_ticket | 10 |
| `hajj_umrah` | hajj_umrah | 11 |
| `visa_processing` | visa | 10 |
| `manpower` | b2b_agent | 11 |
| `hotel_accommodation` | hotel | 8 |
| `transportation` | transport | 9 |
| `tour_packages` | tour_domestic (mixed) | 19 |
| `cruise_holiday` | cruise | 8 |
| `study_abroad` | study_abroad | 8 |
| `corporate_travel` | corporate_travel (mixed) | 8 |
| `travel_documentation` | custom | 8 |
| `event_attraction` | mice_event | 8 |
| `travel_insurance` | custom | 7 |
| `additional_services` | custom | 10 |

**Cross-type subcategories** (a category's items don't all share its type): `tour_packages` contains `tour_corporate → corporate_travel` and `tour_medical → medical_tourism`; `corporate_travel` contains `corp_event → mice_event`, `corp_visa → visa`, `corp_hotel → hotel`.

The canonical id list is mirrored in `backend/src/constants/serviceCatalogIds.js` (`ALL_SUBCATEGORY_IDS`, 135 ids) — **keep in sync** with `serviceCatalog.ts`.

## 3. Onboarding presets (6)

At register Step 2, an agency picks a preset (or custom subcategory selection). Presets bundle categories:

| Preset | Categories |
|--------|------------|
| `hajj_agency` | hajj_umrah, visa_processing, transportation |
| `tour_agency` | tour_packages, hotel_accommodation, transportation |
| `visa_center` | visa_processing, travel_documentation |
| `manpower_agency` | manpower, visa_processing, travel_documentation |
| `study_consultancy` | study_abroad, visa_processing |
| `full_service` | all 14 categories |

Flow: chosen subcategory ids → `normalizeEnabledSubcategories` → `deriveServiceTypesFromSubcategories` → persisted as `{ enabledSubcategories, enabledServiceTypes }` on the tenant (+ derived legacy module flags for back-compat).

## 4. Navigation (10 sidebar groups)

Built by `getNavigationGroups()`. Items carry `id`, `titleKey` (i18n), `url`, `module` (RBAC), and optional gating (`minPlan`, `requiredFeature`, `requiredServiceTypes`).

1. **Overview** — dashboard
2. **CRM** — crm-hub, clients, corporate\*, agents, vendors
3. **Sales & Bookings** — quotations, bookings, visa-stock, service-catalog (`/packages/all`), ticket-transactions\*, flight-reminders\*
4. **Tour & Group Travel** — group-tours\*, mice\*, travel-approvals\*, visa-tracker\* (all `minPlan: basic`)
5. **Operations** — documents, tasks, service-operations, hajj-operations\*, bd-operations\*
6. **Finance & Accounts** — invoices, payments, expenses, commissions\*, accounts, reports
7. **HR & Payroll** — team, hrm, roles, activity-log (conditional), payroll
8. **Marketing & Loyalty** — loyalty, referrals (`minPlan: enterprise`)
9. **Website & CMS** — website-home, website-builder, website-blog, website-publish, website-seo (`minPlan: pro` + `requiredFeature: hasWebsiteTemplates`)
10. **Administration** — notifications, settings, organization, subscription, userGuide

`packagesDefaultPath = "/packages/all"`. Items marked `*` are service-type gated (see §5). *(Standalone Leads/Follow-ups nav removed — leads live as the "Inquiry" status on bookings + a dashboard widget.)*

## 5. Gating layers (all must pass to show/use an item)

A nav item / feature is available only when **all** applicable gates pass:

1. **RBAC** — role grants `view` on the item's `module` ([07](07-Permission-Matrix.md)).
2. **Service type** (`requiredServiceTypes`) — tenant has ≥1 of the listed types enabled:
   - `corporate`, `travel-approvals` → `corporate_travel` | `mice_event`
   - `ticket-transactions`, `flight-reminders` → `air_ticket`
   - `group-tours` → `tour_domestic` | `tour_international` | `mice_event`
   - `mice` → `mice_event`
   - `visa-tracker` → `visa` | `study_abroad`
   - `hajj-operations` → `hajj_umrah`
   - `bd-operations` → `study_abroad` | `b2b_agent`
   - `commissions` → `air_ticket` | `b2b_agent` | `tour_domestic` | `tour_international` | `hajj_umrah`
3. **Plan floor** (`minPlan`) — tenant plan rank ≥ item floor.
4. **Feature flag** (`requiredFeature`) — plan has the flag (e.g. `hasWebsiteTemplates`).

**"Show everything" default:** empty `enabledServiceTypes` **and** empty `enabledSubcategories` ⇒ all service-typed items visible. If subcategories are set, they take precedence and derive the effective types (`resolveEffectiveServiceTypes`).

> **Deprecated:** `enableHajjUmrahModule` / `enableBdOperationsModule` tenant flags are **ignored** for menu visibility — operations desks now derive from `enabledServiceTypes`. The flags are still computed (`deriveModuleFlagsFromServiceTypes`) for payload back-compat only.

## 6. Advanced module bundles (`moduleAccess.ts`)

A separate, plan-gated, opt-in system (namespace distinct from RBAC modules; only `website` overlaps both). Bundles: `crm`, `subAgents`, `corporate`, `ticketing`, `tourGroups`, `visa`, `hajj`, `studentManpower`, `documentsDesk`, `hrPayroll`, `marketing`, `website`.

- **Plan ranks:** `free:0, basic:1, pro:2, business:3, enterprise:4` (`unlimited → enterprise`).
- **Default floor:** `business`; override: `website` floor = `pro`.
- **`website`** is `autoOn` (shown automatically for eligible plans, not a Settings toggle); others require the tenant to opt in via `enabledModules`.
- `planCanUseModule(bundle, plan)` = `rank(plan) ≥ rank(floor(bundle))`.
- **Enforced server-side** in `backend/src/lib/moduleAccess.js` — "menu-hiding on the frontend is not enough." Keep the two mirrors in sync.

## 7. Functional module map (product view)

| Domain | Sidebar group | Representative routes |
|--------|---------------|-----------------------|
| Dashboard | Overview | `/dashboard` |
| CRM | CRM | `/crm`, `/clients`, `/corporate`, `/agents`, `/vendors` |
| Sales & Bookings | Sales & Bookings | `/quotations`, `/bookings`, `/visa-stock`, `/packages/all`, `/ticket-transactions`, `/flight-reminders` |
| Tour & Group Travel | Tour & Group Travel | `/group-tours`, `/mice`, `/travel-approvals`, `/visa-tracker` |
| Operations | Operations | `/documents`, `/tasks`, `/operations/services`, `/hajj-umrah`, `/operations/bd` |
| Finance & Accounts | Finance & Accounts | `/invoices`, `/payments`, `/expenses`, `/commissions`, `/accounts`, `/reports` |
| HRM | HR & Payroll | `/team`, `/hrm`, `/roles`, `/activity-log`, `/payroll` |
| Marketing & Loyalty | Marketing & Loyalty | `/loyalty`, `/referrals` |
| Website & CMS | Website & CMS | `/website`, `/website/builder`, `/website/blog`, `/website/publish`, `/website/seo` |
| Administration | Administration | `/notifications`, `/settings`, `/organization`, `/subscription`, `/user-guide` |
| **Customer/Supplier Portal** | *(separate app shell)* | `src/portal/` → `/api/portal` |
| **Platform Admin** | *(super-admin only)* | `/admin/*` → `/api/admin` |
