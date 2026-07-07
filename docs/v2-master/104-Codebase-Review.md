# 104 — Full Codebase Review (Phase 4, Task 1)

**Date:** 2026-07-06
**Type:** Read-only review of the entire repository. No code, schema, packages, or data were modified.
**Scope:** Backend, Frontend, Shared, Database, Scripts, Docker, PM2, Prisma.
**Relationship to prior docs:** complements the security/DB/perf audit ([99](99-Production-Audit.md)) and RC verification ([102](102-RC1-Verification.md)); this pass focuses on **cleanup** — dead code, duplication, unused deps/env, large files, structure, and maintainability.

---

## 0. Scorecard

| Dimension | Score /100 | One-line justification |
|---|---:|---|
| **Architecture Quality** | **72** | Sound multi-tenant core, CRUD factory, single-source plan/permission engines and clean service-type layering — undercut by a fragmented API layer (~40 copies of base-URL+auth) and a `normalizePlan` drift that violates the project's own single-source rule. |
| **Code Quality** | **64** | Disciplined effect cleanup and consistent file naming, but ~7 dead files + 14 unused UI primitives, copy-paste helpers (`round2`×5, `timeAgo`×2), and a scaffolded-but-never-wired form-validation stack (`zod`/`@hookform/resolvers`). |
| **Security** | **70** | No hardcoded frontend secrets; markdown XSS surface mitigated. Systemic weak point is JWT-in-`localStorage` across ~40 call sites, plus undocumented backend secrets (Telegram) outside `.env.example`. (CRITICAL/HIGH from [99] already fixed in Phases 1–2.) |
| **Performance** | **52** | Code-splitting is configured but defeated — ~90 eager page imports in `App.tsx` drive the 2.5 MB main bundle. Highest-ROI fix in the repo. |
| **Maintainability** | **60** | Heavy duplication tax + 14 files > 600 lines (`api.ts` 1529 + 24 satellite API files), scattered dead code, env drift — partially offset by good test discipline and consistent naming. |

> Method note: findings below were produced by a read-only sweep cross-checked against [99]. Items marked *candidate* should be re-verified before deletion (a symbol referenced only in `docs/*.md` is treated as unused).

---

## 1. Dead code / unused components

**Frontend pages:** none unused — all 108 `src/pages/**` are routed in `App.tsx`.

**Unused components (candidates — 0 refs in `src/`, only stale doc mentions):**
- `src/components/accounts/AccountSelect.tsx`
- `src/components/CrudPage.tsx` (Agents was refactored off it)
- `src/components/documents/DocumentAgencyHeader.tsx`

**Unused lib modules (candidates — exports referenced only within their own file):**
- `src/lib/demoData.ts` (`seedDemoData`)
- `src/lib/notificationEngine.ts` (~295 lines; client notification engine — real automation is server-side)
- `src/lib/smsAutomation.ts` (only used by the dead `notificationEngine.ts` → transitively dead)
- `src/lib/exportApi.ts` (client CSV export — superseded by server-side `DataExport.tsx`)

**Unused shadcn UI primitives (14, never imported outside `ui/`):** `aspect-ratio, breadcrumb, carousel, chart, context-menu, drawer, hover-card, input-otp, menubar, navigation-menu, pagination, resizable, toggle, toggle-group`. Removing these also strands ~11 transitive deps (§2).

**Backend / repo:**
- `backend/src/index.js.bak.1780061002` and `…bak.1780061220` — stray backup files.
- Orphan tables `BspUpload` / `BspRecord` (from [99] L4).
- `adjustAccountBalance` (intentionally unused — derived balances) and admin.js's shadowed `/payment-requests` handlers (from [99] M4/L5).
- `App.tsx:50` imports `BookingDetails` but renders it via `BookingSegmentRoute` (import appears unused — verify).

## 2. Unused packages

**Removable now:**
- `zod` (root) — **0 imports**; CLAUDE.md claims "forms: react-hook-form + zod" but zod was never wired.
- `@hookform/resolvers` (root) — 0 imports (the zod bridge; dead because zod is).
- `@testing-library/react` (devDep) — 0 imports (all 8 vitest suites are pure-logic).
- `@tailwindcss/typography` (devDep) — **not registered** in `tailwind.config.ts` plugins → `prose` classes in blog pages render unstyled (latent bug).

**Transitively dead (~11):** imported only by the 14 unused UI primitives (`embla-carousel-react`, `vaul`, `input-otp`, `react-resizable-panels`, several `@radix-ui/react-*`).

**Verify before touching:** `@playwright/test` (no `*.spec.ts`; depends on a Lovable-provided config). `react-hook-form` is used in exactly one file (`ui/form.tsx`) — scaffolded, never adopted. All eslint/vite/postcss/tailwind/prisma/supertest tooling is config-used (fine). Backend: all 13 deps used.

## 3. Unused / undocumented environment variables

**Declared in `backend/.env.example`, never read in code:** `PUBLIC_UPLOAD_URL`, `LOG_DIR` (Docker-only), `WASENDER_INSTANCE_ID` (doc comment only).

**Read in code, undocumented in `.env.example`:** `CUSTOM_DOMAIN_CORS_CACHE_MS`, `TRUST_PROXY_HOPS`, `TELEGRAM_BOT_TOKEN` / `TELEGRAM_ADMIN_CHAT_ID` (a whole Telegram integration with no `.env` section — also a secret-hygiene note), `RATE_LIMIT_DISABLED`, `AUTH_RATE_LIMIT_WINDOW_MS`, `PORTAL_AUTH_RATE_LIMIT_WINDOW_MS`.

**Frontend:** `VITE_API_URL`, `VITE_APP_DOMAIN`, and a one-off `VITE_VPS_IP` (`AdminDomains.tsx`) — no frontend `.env.example` documents them (ties to [102] deploy risk).

## 4. Duplicate utilities (highest cleanup value)

| Helper | Copies | Risk |
|---|---|---|
| `round2` | **5** byte-identical (`bookingPricing`, `billingEngine`, `financeCore`, `reportingCenter`, `portalFoundation`) | Low — extract one shared util |
| **`normalizePlan`** | **3, DRIFTED** — `planFeatures.js` maps aliases; `planPricing.js` + `paymentRequests.js` don't (a `"unlimited"` plan prices as 0) | **Correctness** — violates "plan logic lives only in planFeatures.js" |
| Phone normalization | 5 (2 divergent algorithms, mirrored front/back) | Medium — lenient vs strict disagree on the same input |
| `timeAgo` | 2 verbatim (`NotificationBell`, `AdminNotificationBell`) | Low |
| `renderMarkdown` | 2 hand-rolled sanitizers (`SiteBlog`, `WebsiteBlog`) | Low-med — fragile if edited (XSS) |
| `slugify` | 5 (blogs.js, crud.js, scripts/seed) | Low |
| `formatCurrency` | **missing** — `৳${x.toLocaleString()}` scattered ad-hoc | Low |

## 5. Duplicate API-client pattern (frontend)

The "single API client" (`request()` in `api.ts`) is bypassed pervasively — effectively **~40 independent copies** of base-URL + auth-header resolution:
- **~24 `src/lib/*Api.ts`** modules each re-declare `const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api"` + their own `authHeaders()`/`localStorage.getItem("token")`.
- **11 pages/components** inline raw `fetch()` with the same re-derived base+token (several admin pages, `FlightReminders`, `TicketTransactions`, `DataExport`, `WhatsAppSettings`, …).
- `api.ts` itself re-inlines the base 3× for multipart uploads (lines 160/500/524).

This is the same `localhost` fallback repeated ~40× ([102] §10.2) and the primary Maintainability drag.

## 6. Large files (> 600 lines)

**Frontend:** `lib/api.ts` **1529**, `WebsiteCustomizer` 1177, `Bookings` 1048, `Invoices` 910, `Packages` 782, `StaffHrm` 751, `QuotationBuilder` 741, `BookingDetails` 729, `Dashboard` 677, `TicketTransactions` 655, `LeadDetails` 643, `ui/sidebar` 637, `admin/AdminSettings` 633, `Leads` 614.
**Backend:** `routes/bookings.js` 663, `routes/admin.js` 650, `services/notificationService.js` 639, `routes/auth.js` 625.

## 7. Structure & naming

- `src/hooks/` mixes kebab shadcn hooks (`use-mobile.tsx`, `use-toast.ts`) with camelCase project hooks (`usePermissions.ts`, `usePlanAccess.ts`).
- Fragmented API layer (monolithic `api.ts` + 24 satellites) — structural, not just style.
- Backend mirrors split inconsistently (`utils/contactValidation.js` vs `lib/phoneNormalize.js`).
- Positive: pages/components consistently PascalCase; `serviceTypes → enabledServiceTypes → serviceCatalog` is proper layering; `src/portal/` is cleanly self-contained.

## 8. Performance bottlenecks

- **Root cause of the 2.5 MB bundle:** `App.tsx` eagerly imports **~90** page components (only ~15 are `lazy()`). Every user downloads all 22 admin pages + the 1177/1048/910-line pages upfront. Converting the eager, route-only pages to `lazy()` is the single highest-ROI change.
- No wholesale `import * as` of heavy libs outside `ui/` (good). Two 30 s polling bells — acceptable, both cleaned up.

## 9. Memory-leak risks

**Essentially clean.** Every `setInterval`/`addEventListener` in `src/` has matching cleanup; backend has no `setInterval`; the CORS custom-domain cache is a single TTL-bounded object (replaced, not appended). No concrete leak suspects.

## 10. Security (cleanup lens; full audit in [99])

- `dangerouslySetInnerHTML` — 3 sites, low risk (chart style injection + escaped markdown with `https?://`-only links).
- **JWT in `localStorage`** — systemic XSS-exfiltration surface across ~40 call sites (known pattern).
- Backend: hardcoded fallback alert phone/email in `notificationService.js`; Telegram tokens outside `.env.example`.

---

## 11. Technical debt register (cleanup)

| Item | Type | Effort | Priority |
|---|---|---|---|
| ~40-copy API base/auth duplication | Duplication | High | P2 |
| `normalizePlan` drift (3 copies) | Correctness | Low | **P1** |
| ~90 eager imports → 2.5 MB bundle | Performance | Med | **P1** |
| 7 dead files + 14 unused UI primitives | Dead code | Low | P2 |
| Unused deps (`zod`, `@hookform/resolvers`, `@testing-library/react`) | Dead deps | Low | P2 |
| `@tailwindcss/typography` not registered (blog `prose` unstyled) | Bug | Low | P2 |
| `round2`×5 / `timeAgo`×2 / phone×5 / `slugify`×5 | Duplication | Low-Med | P3 |
| 14 files > 600 lines (esp. `api.ts` 1529) | Maintainability | High | P3 |
| Env drift (undocumented + unused vars) | Config | Low | P3 |
| `hooks/` naming inconsistency | Style | Low | P3 |

## 12. Cleanup recommendations (prioritized)

**P1 — correctness & top-ROI**
1. Consolidate `normalizePlan` to the single `planFeatures.js` implementation; delete the drifting copies in `planPricing.js` / `paymentRequests.js` (they mis-price `unlimited`).
2. Convert route-only, non-shared pages in `App.tsx` to `lazy()` (target the eager admin + 900+-line pages) to cut the 2.5 MB bundle — the biggest single performance win.

**P2 — safe deletions & dep hygiene**
3. Remove the 3 dead components + 4 dead lib modules + 2 backend `.bak` files (verify each has 0 non-doc refs first).
4. Prune the 14 unused UI primitives and the deps they strand; drop `zod`, `@hookform/resolvers`, `@testing-library/react`.
5. Register `@tailwindcss/typography` in `tailwind.config.ts` (or remove it) — fixes unstyled blog `prose`.
6. Extract a single `apiFetch`/base-URL+auth helper and migrate the 24 satellite `*Api.ts` + 11 inline fetches onto it (removes the ~40× `localhost` fallback; ties into [102] prod-config safety).

**P3 — structural**
7. Extract shared `round2`, `timeAgo`, `formatCurrency`, `slugify`, phone-normalize utils.
8. Split the largest files (`api.ts` → per-domain modules; `WebsiteCustomizer`, `Bookings`, `Invoices`).
9. Reconcile env docs (document `TELEGRAM_*`, `RATE_LIMIT_DISABLED`, `CUSTOM_DOMAIN_CORS_CACHE_MS`; remove unused `PUBLIC_UPLOAD_URL`/`WASENDER_INSTANCE_ID` or wire them).
10. Standardize `src/hooks/` naming.

> None of these were executed — this is a review. Note the overlap with Phase-2 P2/P3 debt in [101]; the `normalizePlan` drift and bundle split are the two highest-value cleanups.

---

*End of review. No code, schema, packages, or data were modified. Awaiting approval.*
