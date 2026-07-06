# 107 — Frontend Blueprint Alignment

**Date:** 2026-07-06
**Goal:** Bring the plan-facing frontend to the v2 Master Blueprint — the 5-plan model, the final Plan Feature Matrix, and the locked-service UX — reusing existing backend APIs. No backend, business-logic, or schema changes.
**Compared against:** [08-Plan-Feature-Matrix.md](08-Plan-Feature-Matrix.md), [07-Permission-Matrix.md](07-Permission-Matrix.md), [03-Master-Organogram.md](03-Master-Organogram.md).
**Verification:** TypeScript ✅ · ESLint (0 new errors) ✅ · Frontend tests **27/27** ✅ · Production build ✅.

> **What was already aligned (prior commit `f7ec23e`, doc [105](105-Frontend-Restructure.md)):** the 15-section Tenant-ERP sidebar, the 13 locked Travel Services, the reusable `UpgradePlanDialog`, and the show-locked-not-hidden gating. This commit completes the alignment on the **plan / pricing surfaces** the restructure didn't touch and makes every screen speak the blueprint's plan names.

---

## 1. Plan matrix (the 5 blueprint plans)

Internal ids stay `basic/pro/business/enterprise` (the backend contract in `planFeatures.js`/`planPricing.js`); the UI now shows the blueprint names everywhere via one helper (`getPlanDisplayName` in `src/lib/plans.ts`).

| Blueprint plan | Internal id | Monthly (BDT) | Source |
|---|---|---|---|
| **Free Trial (7 days)** | trial state | 0 | env `TRIAL_DAYS` (7); shown as a hero badge on Pricing |
| **Starter** | `basic` | 500 | matches `planPricing.js` |
| **Professional** | `pro` | 800 | matches `planPricing.js` |
| **Business** | `business` | 1,500 | matches `planPricing.js` |
| **Enterprise** | `enterprise` | 5,000 † | see note |

The **feature flags** in `plans.ts` already match 08's enforced `PLAN_FEATURES` table (email/hajj on all; custom-domain/website/SMS/WhatsApp/agent-commission from Professional; advanced-analytics/marketing/refund from Business; API/priority-support Enterprise-only) — verified cell-by-cell, no change needed. The one **drift fixed** this pass: the comparison table showed Branches `1/1/1/∞`; corrected to `1/2/5/∞` to match `maxBranches` (08 §2: "trust maxBranches").

† **Pending business decision (documented, not decided here):** 08 §5 flags that Enterprise is `custom (-1)` in the enforced backend but hard-priced `5,000/50,000` in the frontend. I left the frontend value as-is rather than unilaterally changing a price — the Pricing page already routes Enterprise through a "Contact Sales" CTA. Resolving custom-vs-fixed is a business call; flagging it as the single remaining matrix drift.

## 2. Files changed

| File | Change |
|---|---|
| `src/lib/plans.ts` | `name` Basic→**Starter**, Pro→**Professional**; added `FREE_TRIAL_DAYS` + **`getPlanDisplayName()`** (one source for blueprint names); fixed the Branches comparison drift. |
| `src/pages/marketing/Pricing.tsx` | Added a visible **"7-day free trial — no card required"** hero badge. Plan cards, prices, and the full comparison table already render from `plans.ts`, so the new names propagate automatically. |
| `src/components/AppSidebar.tsx` | Footer plan badge now shows the blueprint name (`Starter` not `basic`). |
| `src/components/AppSidebarNav.tsx` | Locked-nav tooltips + `UpgradePlanDialog` now say the blueprint name ("available in the **Professional** plan"). |
| `src/pages/Subscriptions.tsx` | Current-plan badge → blueprint name. |
| `src/components/SubscriptionRenewalPage.tsx` | Current-plan badge → blueprint name. |

**Single source, wide reach:** because Pricing, the register dialog, the feature-comparison table, Subscription, and the sidebar all read `plans.ts`, editing that one file re-labels every plan surface consistently — no screen hardcodes "Basic"/"Pro". Admin/super-admin screens intentionally keep the raw canonical id (operational clarity + `<Select>` value bindings).

## 3. Navigation & Sidebar (blueprint hierarchy)

Unchanged from `f7ec23e`, re-verified: **15 sections** — Dashboard · CRM · Sales · Booking · **Travel Services** · Finance & Accounts · HR & Payroll · Documents · Marketing · Website CMS · Reports · Automation · Integrations · Settings · Subscription. One reusable `navigation.ts` config → one `AppSidebar`/`AppSidebarNav` renderer. (navigation.test.ts asserts the 15-section order + the 13 travel services and passes.)

## 4. Travel Services — 13, never hidden

Air Ticket · Visa · Hotel · Hajj & Umrah · Tour · Transportation · Insurance · Student Consultancy · Overseas Manpower · Corporate Travel · Passport Service · Travel Documentation · Other Services.

Each is shown for **every** tenant: **normal** when the service type is enabled, otherwise **🔒 locked** with an upgrade badge + reason tooltip, and clicking opens the reusable **`UpgradePlanDialog`**. Locks resolve from the tenant's `enabledServiceTypes` via the canonical `isServiceTypeEnabled` — unavailable services never disappear. (Delivered in `f7ec23e`; this commit only improves the lock's plan-name wording.)

## 5. Guards — Plan / Permission / Feature

The three reusable guards exist and gate at complementary layers (the **backend remains the enforcement boundary**; frontend guards are UX):

| Guard | Reusable component(s) | Applied at |
|---|---|---|
| **Permission Guard** | `PermissionRoute` (route), `PermissionGate` (component) | every RBAC-gated route in `App.tsx` (`PM` wrapper), per the [07](07-Permission-Matrix.md) matrix (`usePermissions` → `permissions.ts`) |
| **Plan Guard** | sidebar `resolveLock` + `usePlanAccess` + `UpgradePlanDialog`, `SubscriptionRoute`/`SubscriptionGate` | nav (lock) + subscription-blocked routing; backend `checkPlanLimit` enforces |
| **Feature Guard** | `FeatureGate`, nav `requiredFeature` → locked | component-level + nav lock; backend `requireFeature` enforces |

> Scope note: the guard **infrastructure** is single-source and reused. I did **not** retrofit an explicit page-level guard onto all 108 pages — that would be a large, risky change beyond alignment, and it's unnecessary because gating already happens at the route level (`PermissionRoute`), the nav level (locks), and — authoritatively — the API level (`checkPlanLimit`/`requireFeature`, which fail closed). `FeatureGate` is available for any page that needs in-body feature gating.

## 6. Portal & role flow (organogram)

Matches [03](03-Master-Organogram.md), preserved from the restructure:
- **Public Website** → **Authentication** → **Super Admin** (`/admin/*`, `AdminRoute`) → **Tenant ERP** (15-section sidebar, RBAC by role) → **Customer / Agent / Supplier Portal** (`src/portal/`, magic-link, read-only, `/api/portal`).
- Roles (`permissions.ts`, mirrored in `auth.js`): `tenant_owner · manager · sales_agent · operations · accountant` + `super_admin`; portal roles `customer · supplier · agent`. No change — this pass only aligns the plan naming these screens display.

## 7. Verification

| Check | Result |
|---|---|
| TypeScript (`tsc --noEmit`) | ✅ clean |
| ESLint (changed files) | ✅ 0 new errors (5 pre-existing `no-explicit-any` in Pricing/Subscriptions, untouched lines) |
| Frontend tests (`vitest run`) | ✅ 27/27 (incl. navigation structure) |
| Production build (`npm run build`) | ✅ success · main bundle 880 kB (no regression) |

## 8. Honest notes / deliberate limits

- **Alignment, not ground-up rewrite.** Because `plans.ts` is the single source these screens read, the highest-leverage, lowest-risk alignment was to fix the source + the one page (Pricing) that needed a new element, and let names propagate. Dashboard/Settings/Landing were **not** rewritten — they don't display plan-tier names that mismatched, and rewriting 600-line working pages would risk regressions for no blueprint gain. If you want specific visual rework on those, that's a separate, scoped task.
- **Enterprise price** (§1 †) is the one open matrix decision — left to you.
- **i18n:** the new Free-Trial hero badge is a hardcoded English string (the marketing site is English-primary); add a `sidebar`/`marketing` i18n key if BN parity is required.
- No backend, API, schema, permission, or plan-*data* changes (only display names + one corrected comparison cell).

---

*Frontend blueprint alignment complete. Awaiting approval.*
