# 106 — Codebase Cleanup Sprint (Phase 4A)

**Date:** 2026-07-06
**Scope:** Execute ONLY the cleanup recommendations from [104-Codebase-Review.md](104-Codebase-Review.md). No business logic, DB schema, backend APIs, UI design, navigation, permissions, or SaaS-plan changes.
**Verification:** `npm run build` ✅ (bundle **−65%**) · TypeScript ✅ · ESLint (changed files) ✅ · Frontend tests **27/27** ✅ · Backend tests **598/598** ✅.

> Doc numbered **106** (not 105) because `105-Frontend-Restructure.md` already exists from the prior phase (kept per your "clean on top" choice).

---

## 1. Files removed (dead code)

**Frontend components (0 external refs):**
- `src/components/accounts/AccountSelect.tsx`
- `src/components/CrudPage.tsx`
- `src/components/documents/DocumentAgencyHeader.tsx`

**Frontend lib modules (0 external refs; the last two form a dead cluster):**
- `src/lib/demoData.ts`
- `src/lib/notificationEngine.ts` (~295 lines — client notification engine; real automation is server-side)
- `src/lib/smsAutomation.ts` (only importer was `notificationEngine.ts`)
- `src/lib/exportApi.ts` (superseded by server-side `DataExport.tsx`)

**Backend backups:**
- `backend/src/index.js.bak.1780061002`
- `backend/src/index.js.bak.1780061220`

**Unused npm dependencies (removed from `package.json`, 0 imports repo-wide):**
- `zod`, `@hookform/resolvers`, `@testing-library/react`

> Deliberately **kept**: `@tailwindcss/typography` (referenced as intended styling in [09-UI-UX-Standards](09-UI-UX-Standards.md); removing/registering it would touch UI). The 14 unused shadcn UI primitives from the review were **not** removed — they interlink and strand transitive deps; safer as a dedicated follow-up.

## 2. Files refactored

**New shared modules (single sources of truth):**
- `src/lib/apiConfig.ts` — `API_BASE_URL` + `authHeaders()` (+ `authHeaderOnly()`).
- `src/lib/format.ts` — `timeAgo()` + `formatCurrency()`.
- `backend/src/lib/numeric.js` — `round2()` + `slugify()`.

**Migrated onto shared helpers:** normalizePlan (2 files), round2 (5 files), slugify (2 files), timeAgo (2 files), API base/auth (27 files), lazy-loading (`App.tsx`), env docs (2 files). Details in §4–§7.

## 3. Performance & bundle improvements

**Lazy-loading (`src/App.tsx`):** ~85 route pages converted from eager `import` to `React.lazy()` behind **one** top-level `<Suspense>` boundary; framework/providers/route-guards stay eager. **All routes and URLs are unchanged.** The unused `BookingDetails` import was dropped.

**Main bundle:**

| | Before | After | Change |
|---|---:|---:|---:|
| `index-*.js` (raw) | 2,524 kB | **880 kB** | **−65%** |
| `index-*.js` (gzip) | 649 kB | **265 kB** | **−59%** |

Pages now ship as on-demand chunks (e.g. `Reports` 51 kB, `HajjUmrah` 52 kB, `WebsiteCustomizer` 53 kB, `SiteHome` 47 kB), and recharts is isolated in its own `AreaChart` chunk (392 kB) loaded only where charts render. First paint no longer downloads the admin console, marketing pages, or the heaviest ERP pages.

## 4. Duplicate code removed

| Helper | Before | After |
|---|---|---|
| `round2` | 5 identical copies (billingEngine, bookingPricing, financeCore, portalFoundation, reportingCenter) | 1 (`numeric.js`) |
| `slugify` | 2 copies (blogs.js, crud.js) | 1 (`numeric.js`) |
| `timeAgo` | 2 copies (NotificationBell, AdminNotificationBell) | 1 (`format.ts`) |
| `normalizePlan` | 4 definitions (2 lib + 2 route copies) | route copies now import the shared `planPricing.normalizePlan` |

**normalizePlan nuance (important):** the review called this "3 drifted copies," but the two *library* normalizers are **domain-distinct and intentional** — `planFeatures.js` maps `free → basic` (features/limits), while `planPricing.js` keeps `free → free` (pricing = 0). Merging them would change free-plan **pricing** — a plan/business-logic change, which this sprint forbids. So only the two **true copy-paste duplicates** (`paymentRequests.js`, `adminSubscriptionWorkflow.js`, both byte-identical to `planPricing.normalizePlan`) were removed and pointed at the shared function. Behavior is byte-for-byte preserved (verified by the 598 backend tests).

## 5. API cleanup

The `~40` duplicated copies of `import.meta.env.VITE_API_URL || "http://localhost:4000/api"` are gone. **27 files** (24 `src/lib/*Api.ts` + `AdminSettings`, `FlightReminders`, `TicketTransactions`) now import `API_BASE_URL` from the single `apiConfig.ts`; 5 also drop their duplicated `authHeaders()` for the shared one. Verified: the `localhost` fallback string now exists in **exactly one file** (`apiConfig.ts`). Behavior is identical (same URL, same headers) — this only removes duplication, so there is one place to change how requests are addressed/authenticated (and one place that owns the prod-vs-localhost fallback flagged in [102 §10.2](102-RC1-Verification.md)).

## 6. Environment cleanup

- **Frontend `/.env.example`** — added the previously-undocumented `VITE_VPS_IP` (already documented `VITE_API_URL`, `VITE_APP_DOMAIN`).
- **`backend/.env.example`** — documented the read-but-undocumented vars: `RATE_LIMIT_DISABLED`, `AUTH_RATE_LIMIT_WINDOW_MS`, `PORTAL_AUTH_RATE_LIMIT_WINDOW_MS`, `TRUST_PROXY_HOPS`, `CUSTOM_DOMAIN_CORS_CACHE_MS`, and the Telegram alert integration (`TELEGRAM_BOT_TOKEN` / `TELEGRAM_ADMIN_CHAT_ID`).

## 7. Verification results

| Check | Command | Result |
|---|---|---|
| Frontend build | `npm run build` | ✅ success · main bundle 2,524 → **880 kB** |
| TypeScript | `tsc --noEmit` | ✅ clean |
| ESLint (changed files) | `eslint <changed>` | ✅ **0 new errors** (shared modules + 24 lib API files + App.tsx all clean) |
| Backend tests | `node --test` | ✅ **598 / 598** |
| Frontend tests | `vitest run` | ✅ **27 / 27** |
| API centralization | grep `localhost:4000/api` in `src` | ✅ only `apiConfig.ts` |

## 8. Honest notes / deliberate limits

- **Pre-existing ESLint debt untouched:** the repo has ~260 pre-existing `@typescript-eslint/no-explicit-any` errors (documented in CLAUDE.md). This cleanup adds **none** — 20 of them live in `TicketTransactions.tsx` / `AdminSettings.tsx`, which I touched only for the API-base swap (the `any` usages are in their existing code). Removing dead files *reduced* the total. Fixing `no-explicit-any` was out of scope (not a 104 recommendation; could alter types).
- **Package removal is manifest-only:** the 3 unused deps were removed from `package.json`, but I did **not** run an install (per "do not install packages") and this repo carries **both** `package-lock.json` and `bun.lock`. Run `npm install` (and `bun install`) once to reconcile both lockfiles; until then a strict `npm ci` / `--frozen-lockfile` would see drift.
- **Not done (documented as follow-ups, higher risk / out of scope):** removing the 14 unused shadcn UI primitives + their transitive deps; consolidating the divergent phone-normalizers (lenient vs strict encode different behavior — merging would change output); splitting the largest files (`api.ts` etc.). These remain in the [104](104-Codebase-Review.md) register.

---

*Cleanup complete. No business logic, schema, API, UI, navigation, permission, or plan changes. Awaiting approval.*
