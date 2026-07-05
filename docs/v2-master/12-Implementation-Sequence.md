# 12 — Implementation Sequence (v2 Delivery Roadmap)

> **Status:** Execution plan. Architecture is **FROZEN** — see [11-Architecture-Freeze](11-Architecture-Freeze.md). This document does not change the architecture; it sequences its delivery.
> **Audience:** all future Claude coding sessions (Sonnet builds, Opus reviews) + human reviewers.
> **Prime directive:** ship the frozen v2 **incrementally, additively, and reversibly** on top of the live codebase with **zero production downtime** and **zero data loss**. Existing tenants must keep working after every merge.

---

## 0. How to use this document

1. **Phases are ordered by dependency.** Do not start a phase until its `Required Previous Phase` is merged and released.
2. **Every phase is a strangler-fig migration**, not a rewrite: the new engine is built *beside* the old code, guarded by a **feature flag**, consumers switch one at a time, and the old path is deleted **last**.
3. **Every change is additive.** No column drops, no renames, no destructive migrations (frozen rule). DB changes use **expand → backfill → dual-write → switch-read → (later) contract**.
4. **Rollback = flip the flag.** If a phase misbehaves in production, disabling its feature flag must restore the previous behaviour without a redeploy.
5. Ground every task in real files — this repo already has `navigation.ts`, `moduleAccess.ts`, `permissions.ts`, `planFeatures.js`, `plans.ts`, `features.ts`, `serviceTypes.ts`, `serviceCatalog.ts`, the per-type `*Fields.tsx`, `backend/src/services/*`, and `/api/cron`. The engines **wrap these first**, then absorb them.

---

## 1. Global engineering standards (apply to ALL phases)

| Standard | Rule |
|----------|------|
| **Feature flags** | Every new subsystem ships behind a server-authoritative flag (extend the Single Plan Engine / a `SystemFlags` table or env). Default OFF in prod until the phase's DoD is met. |
| **Backward-compatible APIs** | Never change an existing endpoint's response shape or remove a field. Add new endpoints (or additive optional fields) instead. Version internally only if unavoidable. |
| **DB migrations** | Additive only: new tables, new **nullable** columns, new indexes. Migrations via `prisma migrate` (v2 standardizes on migrations; retire `db push`). Each migration must be safe to apply while old code runs. |
| **Dual-write window** | When replacing a data path, write to old + new simultaneously until reads are switched and verified, then stop old writes. |
| **Tenant isolation** | Every query filters `tenantId` ([10 §1](10-Development-Rules.md)). New engines must not create a query path that bypasses it. |
| **Testing gate** | Backend `node --test` + frontend `vitest` green; new logic covered; Playwright E2E for cross-stack flows. No phase merges red. |
| **Deployability** | `main`/integration branch must be deployable at the end of **every** phase — never a half-migrated state without a flag covering it. |
| **Observability** | Add structured logs + a `notificationDelivery`-style audit for every new automated action so regressions are visible. |

---

## 2. Phase template (fields captured for each phase)

Each phase below specifies: **Goal · Business Reason · Technical Reason · Modules · Database Changes · API Changes · Frontend Changes · Backend Changes · Permission Changes · Feature-Flag Changes · Testing Checklist · Regression Risks · Rollback Strategy · Definition of Done · Complexity · Time**, plus a **Phase Gate** block (**Dependencies · Required Previous Phase · Breaking Risks · DB Migration Strategy · Testing Requirements · Performance Checks · Security Checks · Manual QA Checklist · Release Checklist**).

---

# PHASE 1 — Foundation (Engines)

**Modules:** Module Registry · Feature Flags · Plan Engine · Permission Engine · Status Engine · Dynamic Sidebar

- **Goal:** Introduce the six control-plane engines from the freeze as the single sources of truth, wrapping (not yet replacing) today's scattered config.
- **Business Reason:** Eliminates the plan/feature/permission drift that risks mis-billing and wrong entitlements; makes every later phase cheap to gate and ship safely.
- **Technical Reason:** All later phases *consume* these engines. Building them first means Phases 2–10 register into one place instead of hand-wiring nav + permissions + plans separately.
- **Database Changes:** *(additive only)* new `SystemFlag` table (id, key, scope, enabled, tenantId?) for runtime flags; optional `PlanDefinition` cache table if the engine is DB-backed (else keep code-defined). **No changes to existing tables.**
- **API Changes:** new read endpoints `GET /api/registry`, `GET /api/plan-engine`, `GET /api/feature-flags` (tenant-scoped, additive). Existing endpoints untouched.
- **Frontend Changes:** new hooks `useModuleRegistry`, `usePlanEngine`, `useFeatureFlag`; `AppSidebar` reads the registry behind a `dynamicSidebar` flag (old `navigation.ts` remains as fallback).
- **Backend Changes:** `moduleRegistry.js` (canonical entries — wraps `navigation.ts` data), consolidate `planFeatures.js`/`plans.ts`/`features.ts` into one **backend-owned Plan Engine** with a generated FE consumer; `statusEngine.js` (central status definitions + `validateStatus(entity, value)`); `featureFlags.js`.
- **Permission Changes:** Permission Engine becomes the single resolver; `requirePermission` and `usePermissions` both read it. Matrix content unchanged ([07](07-Permission-Matrix.md)).
- **Feature-Flag Changes:** introduces the flag system itself + flags `dynamicSidebar`, `planEngineV2`, `statusEngineV2` (all default OFF).
- **Testing Checklist:** unit tests that Plan Engine returns identical values to the legacy tables for all 4 plans; registry renders the same 10 sidebar groups as `navigation.ts`; status validator accepts current values and rejects unknowns; permission resolver matches [07](07-Permission-Matrix.md) cell-for-cell.
- **Regression Risks:** sidebar items disappearing/duplicating; a plan losing a feature; a permission tightening unexpectedly.
- **Rollback Strategy:** flip `dynamicSidebar`/`planEngineV2` OFF → app reverts to `navigation.ts`/legacy plan tables (kept in place this phase).
- **Definition of Done:** engines return values **byte-identical** to legacy for every plan/role/module; flags OFF in prod; parity tests green; docs 07/08 confirmed as the engine's content.
- **Complexity:** High · **Time:** ~2 weeks.

**Phase Gate**
- **Dependencies:** none (first phase). **Required Previous Phase:** — .
- **Breaking Risks:** entitlement/permission divergence during cutover (mitigated by parity tests + flags).
- **DB Migration Strategy:** add `SystemFlag` (+ optional `PlanDefinition`); nullable/new only; reversible by dropping unused new tables.
- **Testing Requirements:** 100% parity suite (legacy vs engine) + snapshot of sidebar per role/plan.
- **Performance Checks:** engine reads cached per request; registry resolution O(modules) not per-item DB hits.
- **Security Checks:** flag/registry endpoints tenant-scoped and read-only; no privilege escalation via engine defaults (fail closed).
- **Manual QA:** log in as each role on each plan; confirm identical sidebar + gated buttons vs prod.
- **Release Checklist:** parity green → deploy with flags OFF → enable `dynamicSidebar` for one internal tenant → verify → enable globally.

---

# PHASE 2 — CRM (bounded context)

**Modules:** Customer · Agent · Supplier · Lead · Activities · Documents

- **Goal:** Consolidate the CRM context onto the engines and **reconcile the unified Leads pipeline** (Lead → Inquiry → …).
- **Business Reason:** CRM is the top of the funnel; clean lead/inquiry semantics drive conversion and remove the confusing dual concept.
- **Technical Reason:** CRM entities (`Client`, `Agent`, `Vendor`, `Lead`, activities, documents) are relatively self-contained — a safe first context to route through the Status Engine + Module Registry.
- **Database Changes:** none required (existing models suffice). Optional additive: index review on `Lead(tenantId,status)` (already present).
- **API Changes:** existing CRM endpoints unchanged; lead status writes now pass through `validateStatus("lead", …)`. Add `GET /api/crm/pipeline` if a unified funnel view is needed (additive).
- **Frontend Changes:** Leads UI aligned to the unified pipeline; the deprecated standalone Leads menu decision from [04](04-Service-Modules.md) finalized (Lead entity kept as pre-inquiry capture; converting a lead creates a Booking in `inquiry`). Documents hub reads registry.
- **Backend Changes:** route status writes → Status Engine; lead→client / lead→booking conversion paths reviewed for tenant scoping.
- **Permission Changes:** none (uses existing `clients`/`leads`/`agents`/`vendors` modules).
- **Feature-Flag Changes:** `crmV2` (statuses via engine) default OFF → ON after QA.
- **Testing Checklist:** lead lifecycle transitions only accept engine-valid statuses; convert-to-client dedup still works; activities logged; documents upload/list intact.
- **Regression Risks:** lead status writes rejected if a legacy value isn't registered; conversion double-creating clients.
- **Rollback Strategy:** flip `crmV2` OFF → status writes bypass validation (legacy behaviour).
- **Definition of Done:** all CRM flows pass through engines with zero behavioural change except invalid-status rejection; unified pipeline documented and reflected in UI.
- **Complexity:** Medium · **Time:** ~1.5 weeks.

**Phase Gate**
- **Dependencies:** Phase 1 (Status Engine, Registry, Permission Engine). **Required Previous Phase:** Phase 1.
- **Breaking Risks:** unregistered legacy status strings (mitigate: seed engine with every value found in prod data first).
- **DB Migration Strategy:** none/additive index only.
- **Testing Requirements:** migrate a snapshot of prod lead/client data in staging; run transition suite.
- **Performance Checks:** pipeline view paginated; no N+1 on activities.
- **Security Checks:** tenant scoping on all CRM reads; document upload MIME/size limits enforced.
- **Manual QA:** create lead → convert → verify client + booking(inquiry); dup-check; upload doc.
- **Release Checklist:** seed statuses → enable `crmV2` on internal tenant → verify → global.

---

# PHASE 3 — Sales & Generic Booking Engine (core)

**Modules:** Quotation · **Generic Booking Engine** · Invoice · Payments · Workflow Engine

- **Goal:** Deliver the **config-driven Generic Booking Engine** (Service Field Registry) and route Quotation→Booking→Invoice→Payment through the Status/Workflow engine.
- **Business Reason:** The booking engine is the product's spine; making service fields config-driven lets the business add service lines without code and unifies the sales flow.
- **Technical Reason:** Highest-value, highest-risk refactor — must be done after the engines exist and CRM is stable, before the per-service phases that depend on it.
- **Database Changes:** *(additive)* none to `Booking` core (`type` + `serviceDetails Json` already support it). Optional new `ServiceFieldDefinition` table if field registry is DB-driven (else code-defined JSON). Optional nullable `Booking.source` (e.g. `staff`/`agent_portal`) for Phase 7.
- **API Changes:** existing booking/invoice/payment endpoints unchanged; add `GET /api/booking-engine/fields/:serviceType` (returns field schema). **Fix the payment-delete reversal** (make `DELETE payment` recompute invoice/booking + reverse ledger) — behind `paymentReversalV2` flag.
- **Frontend Changes:** dynamic booking form renders from the field registry; the 9 `*Fields.tsx` remain as fallback until parity, then retired one service type at a time.
- **Backend Changes:** `serviceFieldRegistry.js`; booking/quotation/invoice status writes → Status Engine; preserve the money roll-up cascade ([05 §4](05-Workflow-Book.md)).
- **Permission Changes:** none (existing `quotations`/`bookings`/`invoices`/`accounts`).
- **Feature-Flag Changes:** `bookingEngineV2`, `paymentReversalV2` (default OFF).
- **Testing Checklist:** dynamic form output matches legacy per-type payloads; quotation→booking convert; payment cascade (invoice→booking→ledger→installments); **payment delete now reverses correctly**; refund flow.
- **Regression Risks:** serviceDetails shape drift; money roll-up miscalculation; installment allocation edge cases.
- **Rollback Strategy:** flip `bookingEngineV2` OFF → legacy per-type forms; `paymentReversalV2` OFF → legacy delete behaviour.
- **Definition of Done:** any service type can be booked via the registry with identical data to legacy; payment integrity (create + reverse) verified; per-type components removed only after parity.
- **Complexity:** Very High · **Time:** ~3 weeks.

**Phase Gate**
- **Dependencies:** Phases 1–2. **Required Previous Phase:** Phase 2.
- **Breaking Risks:** corrupting money totals; changing `serviceDetails` keys that reports rely on.
- **DB Migration Strategy:** additive nullable `Booking.source`; optional `ServiceFieldDefinition`; dual-render (legacy + registry) until parity.
- **Testing Requirements:** golden-file tests comparing legacy vs registry payloads per service type; money-cascade property tests.
- **Performance Checks:** booking list paginated; field-schema endpoint cached.
- **Security Checks:** serviceDetails validated/sanitized; no injection via dynamic fields; tenant scoping on all booking sub-routes.
- **Manual QA:** book each of the 12 services; take a partial payment then delete it; issue refund; verify accounts.
- **Release Checklist:** parity per service type → enable engine for one type at a time on internal tenant → global once all pass.

---

# PHASE 4 — Business Services (on the engine)

**Modules:** Air Ticket · Visa · Hotel · Tour · Hajj · Student · Manpower · Corporate · Passport · Travel Documentation (+ Transport/Cruise/Medical)

- **Goal:** Register every business service's field schema, operational desk, and status lifecycle into the Generic Booking Engine.
- **Business Reason:** These are the revenue lines; each must feel first-class while sharing one engine (BD priorities: air ticket, visa, Hajj, manpower, study).
- **Technical Reason:** Now purely **configuration + desk logic** on top of Phase 3 — low structural risk, high coverage.
- **Database Changes:** none new for the engine. Existing specialized models stay authoritative for desks: `HajjPackage/Group/Pilgrim`, `TicketRefund/Void/Reissue`, `VisaApplication`, `HotelContract`, `TransportContract`, `JobPosting/Application`.
- **API Changes:** additive desk endpoints already exist; ensure each service's ops routes pass status through the engine.
- **Frontend Changes:** each service's dynamic form + operations desk wired via registry; retire that service's legacy `*Fields.tsx`.
- **Backend Changes:** register field schemas + status lifecycles (e.g. visa: `applied→appointment→decision→delivered`; ticket refund: `requested→processing→completed`).
- **Permission Changes:** service desks gated by existing `requiredServiceTypes` + `hajj_umrah`/`bookings` modules.
- **Feature-Flag Changes:** per-service flags (`svc.airTicket`, `svc.visa`, …) so services flip on individually.
- **Testing Checklist:** per service: create booking, run desk lifecycle, verify status transitions + reports.
- **Regression Risks:** a service's legacy detail fields not represented in its registry schema.
- **Rollback Strategy:** per-service flag OFF → legacy form for that service only.
- **Definition of Done:** all 12 services book + operate via the engine; legacy per-type components fully removed.
- **Complexity:** High (breadth) · **Time:** ~3 weeks (parallelizable per service).

**Phase Gate**
- **Dependencies:** Phase 3. **Required Previous Phase:** Phase 3.
- **Breaking Risks:** missing field mapping per service (mitigate: field-diff audit per service before enabling).
- **DB Migration Strategy:** none/additive; specialized desk tables unchanged.
- **Testing Requirements:** one E2E per service type; Hajj bulk (package→group→pilgrim→installment) regression.
- **Performance Checks:** desk lists paginated; Hajj pilgrim lists indexed.
- **Security Checks:** passport/NID PII access restricted to permitted roles; tenant scoping.
- **Manual QA:** BD-priority services first (air ticket, visa, Hajj, manpower, study) end-to-end.
- **Release Checklist:** enable services in priority order, verify reports after each.

---

# PHASE 5 — Finance

**Modules:** Ledger · Accounts · Cash · Bank · bKash · Nagad · Expense · Income · Reports

- **Goal:** Harden the finance context: consistent ledger postings, accounts, BD payment methods, and reporting on the frozen (single-entry, `Float`, reversible) model.
- **Business Reason:** Owners choose the ERP they can trust for money; BD methods (cash/bank/bKash/Nagad/Rocket, manual proof) are table stakes.
- **Technical Reason:** Depends on the booking/payment engine (Phase 3) producing correct ledger entries; consolidates reporting reads.
- **Database Changes:** none required. Ensure `Account`, `Transaction`, `Expense`, `VendorBill` used consistently. (Double-entry/`Decimal` = Future Roadmap, **not here**.)
- **API Changes:** additive report endpoints; ensure every money mutation posts an **idempotent, reversible** ledger `transaction`.
- **Frontend Changes:** Accounts/Ledger/Reports read engines; add Nagad/Rocket to manual method config UI (via `PaymentMethodConfig`).
- **Backend Changes:** verify `accountLedger.js` + `invoiceInstallments.js` reversibility; expense approve/reject ledger sync; P&L / cash-flow / receivables / payables reports.
- **Permission Changes:** none (existing `accounts`/`reports`/`invoices`).
- **Feature-Flag Changes:** `financeV2` (reversible-ledger guarantees) default OFF.
- **Testing Checklist:** payment/refund/expense each produce correct + reversible ledger rows; reports reconcile to transactions; vendor payables cycle.
- **Regression Risks:** double-posting or orphaned ledger rows; report totals drifting from transactions.
- **Rollback Strategy:** `financeV2` OFF → legacy posting; ledger rows are additive so reversible.
- **Definition of Done:** every money movement is reversible and reconciles; BD methods configurable; reports match ledger.
- **Complexity:** High · **Time:** ~2 weeks.

**Phase Gate**
- **Dependencies:** Phase 3. **Required Previous Phase:** Phase 3 (Phase 4 recommended).
- **Breaking Risks:** financial mis-postings (highest business risk).
- **DB Migration Strategy:** additive only; ledger corrections via compensating entries, never edits.
- **Testing Requirements:** reconciliation property tests (Σ ledger == invoice/expense state); refund/void money paths.
- **Performance Checks:** report queries indexed + date-ranged; no full-table scans per tenant.
- **Security Checks:** finance modules restricted to accountant/owner; export audited.
- **Manual QA:** run a full month: bookings→invoices→partial payments→refund→expenses→P&L.
- **Release Checklist:** reconcile staging against a prod snapshot before enabling.

---

# PHASE 6 — Website CMS

**Modules:** Website Builder · Blogs · Landing Pages · SEO · Domains

- **Goal:** Complete the per-tenant public website + CMS content model (currently only `WebsitePost` is structured).
- **Business Reason:** Agency websites feed leads back into CRM and are a Pro-plan upsell + white-label lever.
- **Technical Reason:** Independent bounded context; low coupling to finance/booking; safe to build in parallel after engines.
- **Database Changes:** *(additive)* structure what is today implicit JSON — optional `WebsitePage`, `WebsiteSection`, `WebsiteTestimonial` tables (nullable, additive), keep `WebsitePost` + `TenantDomain`.
- **API Changes:** additive CMS endpoints; existing `/api/public`, `/api/landing-cms`, `/api/website` preserved.
- **Frontend Changes:** theme builder, blog, landing pages, SEO panels read registry + Plan Engine (`hasWebsiteTemplates`, `minPlan: pro`).
- **Backend Changes:** CMS content model + publish pipeline; domain verification unchanged.
- **Permission Changes:** existing `website` module (owner full, manager view/edit).
- **Feature-Flag Changes:** `cmsV2` default OFF; gated additionally by `hasWebsiteTemplates`.
- **Testing Checklist:** publish/unpublish; blog CRUD; SEO meta; custom domain resolve; plan gating (basic hidden).
- **Regression Risks:** public site rendering breaking for existing tenants; domain resolution regressions.
- **Rollback Strategy:** `cmsV2` OFF → current website behaviour.
- **Definition of Done:** tenants can build/publish a branded site incl. blog/SEO; custom domains verified; plan-gated.
- **Complexity:** Medium-High · **Time:** ~2 weeks.

**Phase Gate**
- **Dependencies:** Phase 1 (Plan Engine/Registry). **Required Previous Phase:** Phase 1.
- **Breaking Risks:** breaking live public sites (mitigate: keep legacy render until parity).
- **DB Migration Strategy:** additive nullable CMS tables; backfill from existing JSON.
- **Testing Requirements:** render existing tenant sites pre/post; domain resolver suite.
- **Performance Checks:** public pages cacheable; SSR/edge caching considered for slugs.
- **Security Checks:** CMS HTML sanitized (XSS); public endpoints rate-limited; no tenant data leakage across sites.
- **Manual QA:** build a site on a Pro tenant, publish, hit via slug + custom domain.
- **Release Checklist:** parity on real tenant sites → enable.

---

# PHASE 7 — Portals (Customer · **Full B2B Agent** · Supplier)

**Modules:** Customer Portal · Agent Portal (full) · Supplier Portal

- **Goal:** Deliver the **full B2B Agent Portal** (booking submission, wallet, commission, ledger, invoice, document upload, tracking) and keep customer/supplier portals current.
- **Business Reason:** Sub-agent networks are the BD growth engine; agent self-service booking is the headline differentiator promised in the vision.
- **Technical Reason:** Depends on the Generic Booking Engine (Phase 3) — agent submissions reuse it (no new booking model).
- **Database Changes:** *(additive)* nullable `Booking.source = "agent_portal"` (from Phase 3); reuse `Agent`, `AgentTransaction`, `AgentCommissionProfile`, `BookingDocument`, `Invoice`.
- **API Changes:** **new write** endpoints under `/api/portal/agent/*` (submit booking, upload doc); existing read endpoints preserved. Portal JWT audience `portal` still cannot hit agency endpoints.
- **Frontend Changes:** agent portal app (`src/portal/`) gains submission form (reusing dynamic booking form), wallet, ledger, commission, invoice download, document upload, tracking.
- **Backend Changes:** agent-originated booking enters pipeline at `inquiry`/`pending` for staff confirmation; wallet/commission read models; sanitization (no internal cost/profit beyond own commission).
- **Permission Changes:** portal role `agent` write-scoped to own bookings; staff approval uses existing `bookings` permissions.
- **Feature-Flag Changes:** `agentPortalWrite` default OFF.
- **Testing Checklist:** agent submits booking → appears as staff `inquiry`; wallet/ledger/commission totals correct; doc upload; tracking reflects status; **no** access to other agents'/tenants' data.
- **Regression Risks:** privilege boundary leaks; agent bookings bypassing plan limits.
- **Rollback Strategy:** `agentPortalWrite` OFF → portal reverts to read-only (current behaviour).
- **Definition of Done:** full agent B2B lifecycle works end-to-end, fully sanitized and tenant/role-scoped.
- **Complexity:** High · **Time:** ~2.5 weeks.

**Phase Gate**
- **Dependencies:** Phases 3, (5 for invoices). **Required Previous Phase:** Phase 3.
- **Breaking Risks:** security boundary (external write access) — the single most sensitive phase.
- **DB Migration Strategy:** additive `Booking.source`; no destructive change.
- **Testing Requirements:** adversarial authz tests (agent A cannot see agent B / other tenants); magic-link expiry.
- **Performance Checks:** portal endpoints paginated; rate-limited (anti-enumeration already present).
- **Security Checks:** audience `portal` enforced; cost/profit stripped; upload MIME/size; plan-limit checks apply to agent-submitted bookings.
- **Manual QA:** full agent journey on a test tenant + attempt cross-tenant access (must fail).
- **Release Checklist:** security review sign-off (human) → enable for one pilot agency → global.

---

# PHASE 8 — Marketing (SMS · WhatsApp · Email · Campaign · Referral · Loyalty)

**Modules:** SMS · WhatsApp · Email · Campaign · Referral · Loyalty

- **Goal:** Consolidate outbound marketing + loyalty/referral onto the engines with plan/feature gating.
- **Business Reason:** Retention + BD-specific SMS/WhatsApp reach; upsell (business/enterprise features).
- **Technical Reason:** Builds on existing `smsService`, `whatsappService`, `emailService`, `Campaign`, `LoyaltyRule/Account`, `ReferralCode`.
- **Database Changes:** none required (models exist).
- **API Changes:** additive; existing SMS/WhatsApp/email/campaign endpoints preserved.
- **Frontend Changes:** campaign builder, loyalty/referral admin gated by `hasMarketingTools`/`minPlan`.
- **Backend Changes:** template management, audience preview, send pipeline via delivery log.
- **Permission Changes:** existing `clients`/`reports` modules; marketing gated by plan feature flags.
- **Feature-Flag Changes:** `marketingV2`; feature flags `hasMarketingTools`, `hasSmsIntegration`, `hasWhatsApp`.
- **Testing Checklist:** campaign send counts; template variables; loyalty accrual/redeem; referral conversion + payout.
- **Regression Risks:** accidental mass-send; provider misconfig sending real messages in test.
- **Rollback Strategy:** `marketingV2` OFF; provider env unset → console-log fallback (already the default).
- **Definition of Done:** campaigns/loyalty/referral fully functional and plan-gated; all sends audited.
- **Complexity:** Medium · **Time:** ~1.5 weeks.

**Phase Gate**
- **Dependencies:** Phases 1, 2. **Required Previous Phase:** Phase 2.
- **Breaking Risks:** real-message leakage in non-prod (mitigate: hard env guard + dry-run flag).
- **DB Migration Strategy:** none.
- **Testing Requirements:** provider sandbox/dry-run; audience preview correctness.
- **Performance Checks:** batch send throttled; no unbounded audience queries.
- **Security Checks:** opt-out/consent respected; PII in logs minimized.
- **Manual QA:** dry-run a campaign; accrue+redeem loyalty; convert a referral.
- **Release Checklist:** confirm provider prod creds only on prod; enable per plan tier.

---

# PHASE 9 — Automation (Notification · Reminder · Scheduled Jobs · Background Workers)

**Modules:** Notification Engine · Reminder Engine · Scheduled Jobs · Background Workers

- **Goal:** Formalize the scheduled/lifecycle automation layer that already exists in code but was undocumented (review finding M2).
- **Business Reason:** Retention & BD ops: passport-expiry alerts, departure reminders, trial-drip, renewal reminders, invoice due reminders.
- **Technical Reason:** Depends on stable finance/booking/CRM data; centralizes `backend/src/services/*` under one scheduler and delivery log.
- **Database Changes:** none required (uses `NotificationAutomation`, `NotificationDelivery`, `SmsSettings`).
- **API Changes:** additive admin endpoints for schedules/logs; existing `/api/cron` preserved.
- **Frontend Changes:** notification center + automation settings surfaced from registry.
- **Backend Changes:** unify `subscriptionExpiryService`, `trialDripService`, `passportExpiryAlertService`, `travelDepartureReminderService`, `subscriptionNotificationService` under a documented scheduler; every run writes a delivery/audit row.
- **Permission Changes:** automation config = `tenant_owner`.
- **Feature-Flag Changes:** per-automation flags (`auto.passportExpiry`, `auto.departure`, `auto.renewal`, `auto.trialDrip`).
- **Testing Checklist:** each job fires on schedule, is idempotent (no duplicate sends), respects tenant toggles + quiet failures.
- **Regression Risks:** duplicate/backlogged sends; timezone bugs (BD, Asia/Dhaka).
- **Rollback Strategy:** per-automation flag OFF; scheduler no-ops.
- **Definition of Done:** all scheduled jobs documented, idempotent, toggleable, audited; workflow book updated to include them.
- **Complexity:** Medium-High · **Time:** ~2 weeks.

**Phase Gate**
- **Dependencies:** Phases 2, 3, 5, 8. **Required Previous Phase:** Phase 5.
- **Breaking Risks:** duplicate notifications at scale.
- **DB Migration Strategy:** none.
- **Testing Requirements:** idempotency keys on every scheduled send; clock-skew tests (Asia/Dhaka).
- **Performance Checks:** jobs batched + rate-limited; no per-tenant tight loops.
- **Security Checks:** cron endpoint authenticated (token); no PII over-exposure in reminders.
- **Manual QA:** simulate expiry/departure dates; confirm single send + delivery log.
- **Release Checklist:** enable one automation at a time in prod, watch delivery logs.

---

# PHASE 10 — AI Layer (optional enhancement, post-core)

**Modules:** OCR · AI Assistant · AI Reports · AI Dashboard

- **Goal:** Layer AI assists **on top of** the stable v2 (passport/visa OCR, natural-language assistant, AI-generated reports/insights).
- **Business Reason:** Differentiation + data-entry speed (OCR passports/NID is high-value in BD); not required for launch.
- **Technical Reason:** Purely additive, isolated; must not sit on the critical path of any core flow. Uses the latest Claude models (see repo `claude-api` reference) via server-side calls only.
- **Database Changes:** *(additive)* optional `AiJob`/`OcrResult` tables; never alter core tables.
- **API Changes:** additive `/api/ai/*` endpoints; strictly optional.
- **Frontend Changes:** OCR upload assist on client/booking forms; assistant panel; AI insight widgets on dashboard/reports.
- **Backend Changes:** provider-abstracted AI service (server-side keys only), guardrails, cost controls; OCR → structured `serviceDetails`/client fields (human-confirmed).
- **Permission Changes:** AI features gated by plan (enterprise) + role.
- **Feature-Flag Changes:** `aiLayer`, per-feature (`ai.ocr`, `ai.assistant`, `ai.reports`) default OFF.
- **Testing Checklist:** OCR accuracy on sample passports; assistant scoped to tenant data only; AI never writes without human confirm.
- **Regression Risks:** none to core if properly isolated; cost overruns.
- **Rollback Strategy:** `aiLayer` OFF → product fully functional without AI.
- **Definition of Done:** AI features usable, opt-in, plan-gated, cost-bounded, and non-blocking to core flows.
- **Complexity:** High · **Time:** ~3 weeks (deferrable).

**Phase Gate**
- **Dependencies:** Phases 1–5 (stable data). **Required Previous Phase:** Phase 5 (Phase 9 recommended).
- **Breaking Risks:** none if isolated; watch data-privacy of sending PII to a model.
- **DB Migration Strategy:** additive AI tables only.
- **Testing Requirements:** prompt/response fixtures; PII redaction tests; human-in-the-loop gates.
- **Performance Checks:** async jobs; never block a request on a model call.
- **Security Checks:** PII handling + consent for OCR; keys server-side; tenant data isolation in prompts.
- **Manual QA:** OCR a passport → verify extracted fields require confirmation.
- **Release Checklist:** enterprise pilot → measure cost/accuracy → expand.

---

## 3. Phase dependency graph

```
P1 Foundation ─┬─▶ P2 CRM ─┬─▶ P3 Sales & Booking Engine ─┬─▶ P4 Business Services
               │           │                              ├─▶ P5 Finance ──┐
               ├─▶ P6 Website CMS (parallel after P1)      │               │
               │                                           └─▶ P7 Portals   │
               └─▶ P8 Marketing (after P2) ────────────────────────────────┤
                                                                            ▼
                                                     P9 Automation (needs P2,P3,P5,P8)
                                                                            │
                                                                            ▼
                                                     P10 AI Layer (optional, after P5/P9)
```
Critical path: **P1 → P2 → P3 → P4/P5 → P7 → P9**. P6 and P8 run in parallel to shorten calendar time.

---

## 4. Master Development Timeline (week-by-week)

Assumes one focused build track; parallelizable where noted. ~18–20 weeks to full v2 (P10 optional).

| Weeks | Phase | Focus | Parallel track |
|------:|-------|-------|----------------|
| 1–2 | P1 Foundation | Engines + flags + dynamic sidebar (flags OFF) | — |
| 3–4 | P2 CRM | Statuses via engine, unified leads | *(start P6 CMS)* |
| 4–5 | P6 Website CMS | Content model, publish, SEO | overlaps P2 |
| 5–7 | P3 Booking Engine | Field registry, money integrity, payment reversal | — |
| 8–10 | P4 Business Services | Register 12 services, retire per-type forms | *(start P8 Marketing)* |
| 9–10 | P8 Marketing | Campaigns, loyalty, referral | overlaps P4 |
| 10–11 | P5 Finance | Reversible ledger, BD methods, reports | — |
| 12–14 | P7 Portals | Full B2B agent portal (+ security review) | — |
| 15–16 | P9 Automation | Scheduler, reminders, idempotency | — |
| 17 | **Stabilization** | Bug bash, perf, security audit, docs sync | — |
| 18–20 | P10 AI (optional) | OCR + assistant + AI reports | deferrable |

**Hard gate before each phase enable-in-prod:** parity/regression suite green + human review checkpoint.

---

## 5. Responsibilities (per session type)

**Human (product owner / reviewer)**
- Approve each phase kickoff and each prod flag-flip.
- Own the **security sign-off for Phase 7** and the **finance reconciliation sign-off for Phase 5**.
- Provide prod data snapshots (anonymized) for staging parity.

**Claude Opus (architect / reviewer)**
- Author/adjust per-phase task breakdowns from this roadmap.
- Run `/code-review` (and ultrareview where warranted) at each phase boundary.
- Verify backward compatibility + tenant isolation + flag coverage before merge.
- Keep docs 01–12 in sync when reality clarifies (never change frozen decisions without unfreeze).

**Claude Sonnet (implementation)**
- Execute one bounded context / one phase at a time, behind its flag.
- Write tests alongside code (parity tests first for refactors).
- Keep each PR small, additive, deployable; never merge red.
- Update the phase's DoD checklist as items complete.

---

## 6. Git, branching, merge & deployment strategy

**Branching**
- Long-lived integration branch: **`v2-develop`** (cut from `v2-master-blueprint`).
- Per phase: **`v2/pNN-<context>`** (e.g. `v2/p03-booking-engine`); per task: short-lived branch off the phase branch.
- **Do not develop directly on `main`** — the prod `Stop`-hook auto-commits+pushes `main` and PM2-restarts ([10 §9](10-Development-Rules.md)). `main` is release-only.

**Commit strategy**
- Small, single-purpose commits; conventional prefixes (`feat(p3): …`, `fix(p3): …`, `test(p3): …`, `chore:`).
- Reference the phase + DoD item. End messages with the repo's required `Co-Authored-By` line only when committing (not this planning turn).

**Merge strategy**
- Task branch → phase branch: squash-merge after review + green tests.
- Phase branch → `v2-develop`: merge only when the phase DoD + Phase Gate pass; Opus review required.
- `v2-develop` → `main`: only at a **release** (phase or phase-group), with flags OFF by default; human approves.

**Deployment strategy (zero-downtime)**
1. Merge to `main` (release).
2. Apply **additive** migrations first (`prisma migrate deploy`) — safe with old code running.
3. **`pm2 reload hearth-api`** (graceful, not `restart`) so in-flight requests drain.
4. Rebuild + serve frontend (`scripts/vps-pm2-deploy.sh`).
5. **Flags stay OFF**; enable per-tenant (internal → pilot → global) with verification between steps.
6. Rollback: flip flag OFF (instant) or redeploy previous build; additive migrations need no down-migration.

**Local testing strategy**
- Postgres 16 local; `backend` (`:4000`) + frontend (`:8080`).
- `cd backend && npm test` (node --test) + root `npm test` (vitest) before every push.
- Playwright E2E for cross-stack flows (needs full stack up).
- Seed with representative multi-tenant + multi-plan data to catch isolation/plan regressions.

**Production deployment strategy**
- Deploy off-peak; announce nothing user-visible until the flag is enabled.
- Canary: enable each phase on one internal tenant, then a pilot agency, then all.
- Watch `notificationDelivery`/audit logs + error logs for one cycle before global enable.
- Keep the previous build available for instant PM2 rollback.

---

## 7. Non-negotiables (carry into every phase)

TravelAgencyWeb v2 must remain: **Enterprise-quality · Modular · Feature-Flag-Driven · Generic Booking Engine · Module-Registry-Driven · Single Plan Engine · Central Status Engine · Backward-Compatible · Bangladesh-Travel-Agency-Focused.**

Any task that would violate one of these, or the frozen architecture in [11-Architecture-Freeze](11-Architecture-Freeze.md), is **out of scope** and must be raised for an explicit unfreeze decision before proceeding.

---
*Governed by [11-Architecture-Freeze](11-Architecture-Freeze.md). Cross-references: [04](04-Service-Modules.md) · [05](05-Workflow-Book.md) · [06](06-Database-Blueprint.md) · [07](07-Permission-Matrix.md) · [08](08-Plan-Feature-Matrix.md) · [10](10-Development-Rules.md).*
