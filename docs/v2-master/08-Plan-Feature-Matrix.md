# 08 — Plan & Feature Matrix

> 🧊 **ARCHITECTURE FREEZE (v2) — 2026-07-05.** Authoritative frozen design: [11-Architecture-Freeze](11-Architecture-Freeze.md).
> - **Single Plan Engine (frozen):** ONE source of truth defines Plans, Features, Feature Flags, Sidebar, Permissions and Module Access. Frontend and backend must **never** hold different plan definitions. The drift documented below is **resolved by consolidating into the engine** (backend-owned; frontend consumes it) ([11 §Final Plan Engine](11-Architecture-Freeze.md)).

> **Status:** Authoritative reference, generated from code.
> **Sources of truth (in priority order):**
> 1. `backend/src/lib/planFeatures.js` — **the enforced limits & feature flags** (`checkPlanLimit`, `requireFeature` read this).
> 2. `backend/src/lib/planPricing.js` — enforced pricing used by billing/payment-requests.
> 3. `src/lib/plans.ts` — frontend display config (pricing cards, comparison tables).
> 4. `src/lib/features.ts` — a **separate** frontend feature map used by some gates.
> 5. `backend/src/lib/trialConfig.js` — trial length (env-driven).

⚠️ **Known drift:** The four sources above do not fully agree. Where they differ, **the backend (`planFeatures.js` / `planPricing.js`) wins** because it is what the API actually enforces. Discrepancies are called out explicitly below so v2 can reconcile them. **Do not fix drift by editing one file — reconcile all four (see [10-Development-Rules](10-Development-Rules.md)).**

---

## 1. Plan tiers & aliases

Canonical enforced tiers: **`basic`, `pro`, `business`, `enterprise`**.

`free` and `unlimited` are **aliases**, resolved differently per file (this is drift to fix in v2):

| Alias | `planFeatures.js` (features/limits) | `planPricing.js` (price) | `plans.ts` (`getPlan`) | `features.ts` |
|-------|-------------------------------------|--------------------------|------------------------|---------------|
| `free` | → `basic` | distinct row, price **0** | → `basic` (deprecated) | distinct all-`false` column |
| `unlimited` | → `enterprise` | falls through to `free` default | not handled | not handled |
| unknown | → `basic` | → `free` default | → `basic` (`PLANS[0]`) | — |

**Rule:** Never pass a raw plan string to a limit/feature check — always let `normalizePlan()` collapse it. `getPlanLimit()` / `planHasFeature()` do this internally.

Type unions:
- `PlanType = "free" | "basic" | "pro" | "business" | "enterprise"` (`plans.ts`)
- `BillingCycle = "monthly" | "yearly"`
- `SubscriptionStatus = "trial" | "active" | "overdue" | "expired" | "suspended" | "cancelled"`

---

## 2. Resource limits (enforced)

From `PLAN_LIMITS` in `planFeatures.js`. **`-1` = unlimited, `0` = not allowed.** Enforced by `checkPlanLimit(resource)` middleware, which counts existing rows for the tenant and blocks creation at the limit (fails **closed** — returns 503 if it can't validate).

| Resource | basic | pro | business | enterprise |
|----------|:-----:|:---:|:--------:|:----------:|
| clients | 500 | 1000 | 2000 | ∞ |
| bookings | 500 | 1000 | 2000 | ∞ |
| leads | 500 | 1000 | 2000 | ∞ |
| quotations | 500 | 1000 | 2000 | ∞ |
| users (team) | 3 | 10 | 25 | ∞ |
| domains | 0 | 1 | 2 | ∞ |
| whatsapp (msgs/mo) | 0 | 200 | ∞ | ∞ |

`RESOURCE_MODEL_MAP` (which Prisma model each countable resource counts): `clients→client`, `bookings→booking`, `users→user`, `domains→tenantDomain`, `leads→lead`, `quotations→quotation`. `whatsapp` is a **usage quota**, not a row count — it has no model in the map.

### Frontend-only display limits (`plans.ts`, not backend-enforced)
| Field | basic | pro | business | enterprise |
|-------|:-----:|:---:|:--------:|:----------:|
| maxBranches | 1 | 2 | 5 | ∞ |
| maxSmsPerMonth | 0 | 500 | 2000 | ∞ |
| maxStorageMB | 500 | 2048 | 10240 | ∞ |
| maxReports | 10 | 30 | ∞ | ∞ |

> ⚠️ **Drift:** the `FEATURE_COMPARISON` display copy in `plans.ts` shows Branches as 1/1/1/∞, contradicting the `maxBranches` values above (1/2/5/∞). Trust `maxBranches`.

---

## 3. Feature flags (enforced)

From `PLAN_FEATURES` in `planFeatures.js`, gated by `requireFeature(flag)` middleware. The frontend `plans.ts` mirrors these 12 `hasX` flags with **identical** values.

| Flag | basic | pro | business | enterprise |
|------|:-----:|:---:|:--------:|:----------:|
| hasEmailNotifications | ✅ | ✅ | ✅ | ✅ |
| hasHajjUmrah | ✅ | ✅ | ✅ | ✅ |
| hasCustomDomain | ❌ | ✅ | ✅ | ✅ |
| hasWebsiteTemplates | ❌ | ✅ | ✅ | ✅ |
| hasSmsIntegration | ❌ | ✅ | ✅ | ✅ |
| hasWhatsApp | ❌ | ✅ | ✅ | ✅ |
| hasAgentCommission | ❌ | ✅ | ✅ | ✅ |
| hasAdvancedAnalytics | ❌ | ❌ | ✅ | ✅ |
| hasMarketingTools | ❌ | ❌ | ✅ | ✅ |
| hasRefundSystem | ❌ | ❌ | ✅ | ✅ |
| hasApiAccess | ❌ | ❌ | ❌ | ✅ |
| hasPrioritySupport | ❌ | ❌ | ❌ | ✅ |

### Secondary feature map (`src/lib/features.ts` → `DEFAULT_FEATURE_MAP`)
A **separate**, string-id feature map (17 features, adds a `free` column). Used by some frontend gates. It **conflicts** with the enforced flags in two places — reconcile in v2:

| Feature id | free | basic | pro | business | enterprise | Conflict |
|------------|:----:|:-----:|:---:|:--------:|:----------:|----------|
| accounting | ❌ | ✅ | ✅ | ✅ | ✅ | |
| payment_gateway | ❌ | ❌ | ✅ | ✅ | ✅ | |
| sslcommerz | ❌ | ❌ | ✅ | ✅ | ✅ | |
| bkash | ❌ | ❌ | ❌ | ✅ | ✅ | |
| custom_gateway | ❌ | ❌ | ❌ | ❌ | ✅ | |
| refund_system | ❌ | ❌ | ❌ | ✅ | ✅ | |
| email_notifications | ❌ | **❌** | ✅ | ✅ | ✅ | ⚠️ backend `hasEmailNotifications` basic = ✅ |
| sms_integration | ❌ | ❌ | ✅ | ✅ | ✅ | |
| whatsapp | ❌ | ❌ | **❌** | ✅ | ✅ | ⚠️ backend `hasWhatsApp` pro = ✅ (+200/mo quota) |
| marketing_tools | ❌ | ❌ | ❌ | ✅ | ✅ | |
| website_templates | ❌ | ❌ | ✅ | ✅ | ✅ | |
| custom_domain | ❌ | ❌ | ✅ | ✅ | ✅ | |
| custom_website_design | ❌ | ❌ | ❌ | ❌ | ✅ | |
| advanced_analytics | ❌ | ❌ | ❌ | ✅ | ✅ | |
| payment_reports | ❌ | ❌ | ❌ | ✅ | ✅ | |
| agent_commission | ❌ | ❌ | ✅ | ✅ | ✅ | |
| api_access | ❌ | ❌ | ❌ | ❌ | ✅ | |

---

## 4. Payment gateways by plan (`plans.ts`)

| Plan | Enabled gateways |
|------|------------------|
| basic | `manual` |
| pro | `manual`, `sslcommerz` |
| business | `manual`, `sslcommerz`, `bkash` |
| enterprise | `manual`, `sslcommerz`, `bkash`, `custom` |

---

## 5. Pricing

Currency: **BDT** (৳). Yearly = **monthly × 10** (2 months free) in both backend and frontend.

### Enforced (`planPricing.js`)
| Plan | Monthly | Yearly |
|------|--------:|-------:|
| free | 0 | 0 |
| basic | 500 | 5,000 |
| pro | 800 | 8,000 |
| business | 1,500 | 15,000 |
| enterprise | custom (`-1` → 0) | custom (`-1` → 0) |

### Display (`plans.ts`)
| Plan | Monthly | Yearly | Badge |
|------|--------:|-------:|-------|
| basic | 500 | 5,000 | — |
| pro | 800 | 8,000 | Most Popular |
| business | 1,500 | 15,000 | Best Value |
| enterprise | **5,000** | **50,000** | — |

> ⚠️ **Drift:** enterprise is `custom/-1` in the backend but hard-priced `5,000/50,000` in the frontend card. Decide the v2 intent (custom-quote vs fixed) and unify.

Helpers (`plans.ts`): `getDisplayMonthlyPrice`, `getYearlySavings` (= 2 months), `getLimitLabel` (`-1→"Unlimited"`, `0→"None"`), `checkUsage` (warns at **≥80%**, blocks at **≥100%**).

---

## 6. Trial

Trial length is **env-driven, not per-plan** (`trialConfig.js`):
- `getTrialDays()` = `TRIAL_DAYS` env var, **default 7**, clamped to **0–90**.
- `addTrialExpiry(from)` adds that many days to set `subscriptionExpiry`.
- Every plan's `trialDays` field in `plans.ts` is `0` ("no per-plan trial") — the real trial comes from the env value at signup.
- Live value is surfaced at `GET /api/health` (`trialDays`) and consumed by `useConfiguredTrialDays`.

A trialing tenant is blocked once `subscriptionExpiry < now` (see the `subscriptionAccessGate` in [02-Business-Architecture](02-Business-Architecture.md) / [05-Workflow-Book](05-Workflow-Book.md)).

---

## 7. How enforcement wires together

```
Request → authenticate (sets req.tenantId, req.userRole)
        → subscriptionAccessGate  (402 if tenant expired/suspended)
        → checkPlanLimit(resource) (403 if count ≥ PLAN_LIMITS[plan][resource])
        → requireFeature(flag)     (403 FEATURE_NOT_IN_PLAN if !PLAN_FEATURES[plan][flag])
        → handler
```

- `super_admin` bypasses all four checks.
- `enterprise`/`unlimited` bypass limits via `-1`.
- Both `checkPlanLimit` and `requireFeature` **fail closed** (503/403) on validation errors — never fail open.

See [07-Permission-Matrix](07-Permission-Matrix.md) for role-based (not plan-based) access.
