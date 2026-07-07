# 112 — Subscription & Billing System: Audit & Completion

> **Status:** Completed 2026-07-07. Full end-to-end audit of the Subscription & Billing system (registration → plan selection → payment → lifecycle → onboarding), followed by fixes for every confirmed high/critical gap. Method: 5 parallel subsystem audits with adversarial verification of each high-severity finding (all verified `real=true`).

## Scope audited
Tenant **registration/provisioning**, **plan selection & pricing**, **payment integration** (manual / SSLCommerz / bKash), **subscription lifecycle** (trial → active → expired/suspended/cancelled, renewal, upgrade/downgrade, add-ons), and **onboarding**.

---

## Confirmed gaps fixed

### Payments (critical — security & correctness)
| # | Gap | Fix | Files |
|---|-----|-----|-------|
| P1 | **SSLCommerz callback never activated** — app only registered `express.json()`, so form-encoded callbacks arrived with an empty body. | Added `express.urlencoded({ extended: true })`. | `backend/src/app.js` |
| P2 | **Spoofable free activation** — `/success` skipped validation when `val_id` was absent, then activated unconditionally. | Mandatory server-to-server validation (`validateWithSsl`) on **both** `/success` and `/ipn`; no validated `val_id` ⇒ no activation. Amount taken from the **gateway-validated** response, not the posted body. | `backend/src/routes/sslcommerz.js` |
| P3 | **Underpayment provisioned full plan** — paid amount was never checked against price. | `activateSubscriptionFromPaymentRequest` now verifies paid ≥ expected (request `expectedAmount`, else list price); underpaid ⇒ `needs_info`, not activated. Covers SSLCommerz **and** bKash. | `backend/src/services/paymentGateway.js` |
| P4 | **Non-idempotent activation** — SSLCommerz `success` + `ipn` double-fire double-extended renewals and duplicated rows. | Early-return when the request is already `approved`. | `backend/src/services/paymentGateway.js` |

### Registration & provisioning (high)
| # | Gap | Fix | Files |
|---|-----|-----|-------|
| R1 | **No primary Branch at signup** — owner & first staff left `branchId=null` (invariant only held for seeded demos). | Shared `ensurePrimaryBranch(prisma, tenantId)` now runs at registration and in seed; owner is assigned to the "Head Office" branch. | `backend/src/lib/tenantProvisioning.js` (new), `backend/src/routes/auth.js`, `backend/prisma/seed.js` |
| R2 | **Onboarding service selection didn't enable its module** — BD Operations stayed off. | `deriveModuleFlags()` sets `enableBdOperationsModule`/`enableHajjUmrahModule` from the chosen service types at registration. | `backend/src/lib/tenantProvisioning.js`, `backend/src/routes/auth.js` |

### Enterprise = Contact Sales (high)
| # | Gap | Fix | Files |
|---|-----|-----|-------|
| E1 | Marketing pricing cards funneled Enterprise into `/register`, minting an enterprise trial. | Enterprise card routes to `/contact-us?interest=enterprise`. | `src/pages/marketing/Pricing.tsx`, `src/pages/Index.tsx` |
| E2 | In-app Enterprise CTA opened a payment dialog showing/charging **৳-1**; `nextSuggestedPlan` suggested Enterprise as buyable. | Enterprise card shows a **Contact Sales** link; `nextSuggestedPlan` caps at Business. | `src/pages/Subscriptions.tsx` |
| E3 | Backend accepted `enterprise` self-signup and payment requests. | Register maps `enterprise` → Business trial + enterprise **lead**; `buildPaymentRequestInput` rejects enterprise with `CONTACT_SALES`; auto-activation refuses custom-priced plans. | `backend/src/routes/auth.js`, `backend/src/routes/paymentRequests.js`, `backend/src/services/paymentGateway.js` |

### Lifecycle (high)
| # | Gap | Fix | Files |
|---|-----|-----|-------|
| L1 | **Add-on activation didn't raise enforced limits** (`checkPlanLimit` ignored add-ons). | `checkPlanLimit` now adds active `additional_users`/`additional_branch` quantities to the enforced limit. | `backend/src/middleware/auth.js` |
| L2 | **Reactivate left tenant blocked** — status set to `active` without restoring expiry; no history. | Reactivation restores/extends `subscriptionExpiry` and writes a `SubscriptionHistory` (`reactivated`). | `backend/src/routes/admin.js` |

### Onboarding (high)
| # | Gap | Fix | Files |
|---|-----|-----|-------|
| O1 | **Guided wizard orphaned** — signups went straight to `/dashboard`. | Register now routes new tenants to `/onboarding`. | `src/pages/Register.tsx` |
| O2 | **Completion never persisted** (dead `localStorage` flag, no Tenant field). | New `Tenant.onboardingCompletedAt` (+ migration) and `POST /tenants/me/complete-onboarding`; wizard persists on finish. | `backend/prisma/schema.prisma`, `backend/prisma/migrations/20260707010000_tenant_onboarding_completed/`, `backend/src/routes/tenants.js`, `src/lib/api.ts`, `src/pages/Onboarding.tsx` |

---

## Verification
- `prisma validate` ✅, client regenerated ✅, all changed backend modules load ✅.
- Backend tests: **70 pass / 0 fail** (planEngine, moduleAccess, billingEngine).
- Frontend: production **build clean**, **28/28** Vitest pass, **no new** type errors.
- Migrations authored: `add_branch_model`, `tenant_onboarding_completed` (apply with `prisma migrate deploy` on a live DB).

> Live end-to-end payment runs were not exercisable in this environment (no reachable Postgres; the gateway sandboxes need real store credentials). All fixes are code-verified and unit/build-verified.

---

## Production Acceptance Test (2026-07-07)

Method: code-path acceptance of **every** journey + repo-wide hygiene audit (7 parallel agents, high findings adversarially verified). A *live* click-through was not possible — this environment has **no database** (no Postgres/MySQL/SQLite/Docker). All journeys were traced through the real code; all fixes are unit/build-verified.

### Journey results
**PASS (18):** Registration · Trial (full-eval gating + expiry block) · Onboarding persistence · Staff limits (add-on aware) · Plan selection · Add-ons (activate → enforced limit) · Invoice generation · Manual payment (proof → approve → activate) · Payment history · Subscription history · Upgrade · Renewal · Suspension · Expiry · Reactivation · Permission enforcement (FE/BE parity) · Domain limits · SSLCommerz/bKash core (validation, idempotency, amount).

**Found & FIXED (7 high):**
| # | Issue | Fix | Files |
|---|-------|-----|-------|
| A1 | Trial user saw plan branch/domain limits though backend grants unlimited during trial. | `usePlanAccess` now resolves limits/features against the effective (enterprise-during-trial) plan, mirroring `effectiveGatingPlan`. | `src/hooks/usePlanAccess.ts` |
| A2 | Enterprise still shown as buyable (৳-1) on the **renewal** screen (duplicate `nextSuggestedPlan`). | Capped the duplicate at Business; excluded Enterprise from renewal cards. | `src/hooks/useSubscriptionPayment.ts`, `src/components/SubscriptionRenewalPage.tsx` |
| A3 | Coupon usage never incremented on **online** (gateway) activation. | `activateSubscriptionFromPaymentRequest` now calls `incrementCouponUsage`. | `backend/src/services/paymentGateway.js` |
| A4 | Coupon-discounted online payments wrongly flagged **underpaid** (`expectedAmount` held pre-discount price). | `expectedAmount` now stores the **net** amount charged. | `backend/src/routes/paymentRequests.js` |
| A5 | Any plan change classified as **upgrade** (no rank compare) — downgrades mislabeled. | Rank comparison → `downgrade` in both resolvers + gateway history. | `backend/src/routes/paymentRequests.js`, `adminSubscriptionWorkflow.js`, `services/paymentGateway.js` |
| A6 | Business-floor APIs (`/hrm`, `/payroll`, `/loyalty`, `/referrals`) had **no plan-floor gate** — a Starter/Pro owner could call them directly. | Added `requireFeature("hasHrPayroll"/"hasMarketingTools")`. | `backend/src/routes/{hrm,payroll,loyalty,referrals}.js` |
| A7 | Hardcoded/legacy plan display names (`Basic`/`Pro`/`Ultimate`). | Normalized to Starter/Professional/Business/Enterprise. | `src/pages/Organization.tsx`, `src/components/ModuleSettings.tsx`, `src/pages/admin/AdminReports.tsx` |

### Hygiene audit result
- ✅ **Zero** booking/client/lead/quotation count limits in source. ✅ No business service type gated by plan. ✅ No broken imports (`serviceTypeAccess.js` confirmed deleted/unreferenced). ✅ New marketing/branch files reachable. ✅ No orphaned/unmounted routes.
- Remaining low/info (documented, not blockers): `features.ts` secondary feature map duplicates `plans.ts` flags; a few unused shadcn primitives & 2 unused api exports; orphan `BspUpload`/`BspRecord` models; SMS/Storage display quotas not yet metered.

### ⚠️ One platform-level HIGH (outside Subscription & Billing scope)
`prisma migrate deploy` cannot build a **clean** DB: the migrations directory is not a faithful image of `schema.prisma` (~37 of 101 models — bookings foundation, HRM, etc. — were added via the `db push` dev workflow and never migrated). This is **pre-existing, platform-wide** debt, not a Subscription & Billing defect (the branch + onboarding migrations added here are consistent). It can only be remediated with a database:
```
npx prisma migrate diff --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url <postgres-url> --script \
  > prisma/migrations/<ts>_baseline_missing_tables/migration.sql
```

## Remaining backlog (medium — not blockers)
- Wire `/api/billing` + `/api/plan-engine` into the frontend (currently the Subscription page uses the legacy `payment-requests` path); allow coupons on the main Subscription page.
- Remove FE-advertised SMS/Storage quotas the backend does not yet meter, or implement metering.
- Lifecycle polish: end-of-cycle **downgrade** scheduling, an explicit **cancel** transition, a produced **overdue** grace state, and reconsider the gate exempting `/email` & `/sms` for suspended tenants.
- Onboarding: add a **Branch setup** step and drive the checklist entirely from real state.
- Move manual-proof uploads off local disk for multi-instance deploys.
