# 114 — Customer Portal Completion Report

**Milestone:** Customer Portal (v2 Master Blueprint)
**Status:** Implementation complete; verified via build + typecheck + test + contract/security audit.
**Scope rule honored:** Reuse existing auth / permissions / subscription gate / DB models / APIs. No duplicate Prisma models, no parallel APIs, no duplicated business logic.

---

## 1. Feature status (17/17)

| # | Feature | Status | How (reuse-first) |
|---|---------|--------|-------------------|
| 1 | Registration | ✅ Complete | `portal/pages/Register.tsx` — **passwordless, invite-driven**. Reuses `POST /portal/auth/request-link`. Deliberately does **not** mint a Client (a portal token has no `tenantId`; cross-tenant account creation would break tenant isolation). Customers exist as `Client` rows created by their agency. |
| 2 | Login | ✅ Reused | Existing `portal/pages/Login.tsx` magic-link flow. |
| 3 | Forgot Password | ✅ By design | Passwordless — the magic link *is* the recovery path. No password to reset. |
| 4 | Dashboard | ✅ New | `portal/pages/Dashboard.tsx` → `GET /portal/dashboard` (KPIs: upcoming trips, total due, notifications; recent bookings). |
| 5 | Profile | ✅ New | `portal/pages/Profile.tsx` → `GET/PATCH /portal/profile` (whitelisted contact fields only). |
| 6 | My Bookings | ✅ Reused + enhanced | Existing `Bookings.tsx` list; `BookingDetail.tsx` rewritten. |
| 7 | Booking Timeline & Tracking | ✅ Complete | `BookingDetail.tsx` status stepper (Booked→Confirmed→In-progress→Completed) + trip-updates timeline from `GET /portal/bookings/:id`. |
| 8 | Payment History | ✅ New | `portal/pages/Payments.tsx` → `GET /portal/payments` (sanitized — no `receivedBy`/`transactionRef`). |
| 9 | Due Payments | ✅ New | Same page, dues derived from `GET /portal/invoices`. |
| 10 | Invoice Download (PDF) | ✅ Complete | `BookingDetail.tsx` `printInvoice()` — browser "Save as PDF" from the already-sanitized invoice JSON. No backend PDF service, no cost/profit fields. |
| 11 | Ticket Download | ✅ Complete | `BookingDetail.tsx` Documents card → `GET /portal/bookings/:id/documents`, download via `portalFileUrl()`. |
| 12 | Visa Status | ✅ New | `portal/pages/Visa.tsx` → `GET /portal/visa`. **Strips `embassyFee`/`serviceFee`** — no internal cost exposure. |
| 13 | Passport & Document Management | ✅ Complete | `BookingDetail.tsx` upload → `POST /portal/bookings/:id/documents` (multipart, ownership-scoped). |
| 14 | Notifications | ✅ New | `portal/pages/Notifications.tsx` + header bell → `GET /portal/notifications`. |
| 15 | Support Tickets | ✅ New | `portal/pages/Support.tsx` → reuses `SupportTicket` model via `routes/portalCustomer.js`. |
| 16 | Live Chat | ✅ Complete (lightest maintainable) | `portal/pages/SupportDetail.tsx` — polled (5 s) threaded conversation stored on **`SupportTicket.messages` (JSON)**. No new model, no realtime infra. |
| 17 | Account Settings | ✅ New | `portal/pages/Settings.tsx` — language (EN/BN), profile link, sign-out. |

---

## 2. Architecture & reuse

- **One backend addition, additive only:** `backend/src/routes/portalCustomer.js` (visa + support tickets + live-chat messages), mounted at the existing `/api/portal` prefix after `portal.js` and `portalFoundation.js`. Same `portalAuthenticate` middleware, same email-ownership model.
- **One schema change, additive only:** `SupportTicket.messages Json?` (threaded conversation container). Migration `20260707020000_support_ticket_messages`. **No new models.**
- **Frontend:** all customer endpoints centralized in `src/lib/portalApi.ts`; no parallel client. Pages lazy-loaded in `PortalApp.tsx`. Shared `portal/lib/format.ts` (removed per-page duplication).
- **Reachability:** `src/main.tsx` now selects the portal SPA on host `portal.*` **or** path `/portal` (dev + prod), with `PortalApp` `basename` set accordingly. Production host routing unchanged.

## 3. Security posture

- **Tenant isolation:** every customer query is filtered by the authenticated portal email → its `Client` row (and thus `tenantId`). Writes use `updateMany`/`create` scoped to the resolved client/booking.
- **Own-data only:** bookings, invoices, payments, documents, visa, and tickets are all resolved through `client:{ email }` / booking-ownership joins.
- **No exposure of internal cost, supplier data, or profit:**
  - Visa endpoint selects a safe field list; `embassyFee`/`serviceFee` **never leave the server**.
  - Payments endpoint omits `receivedBy`/`transactionRef`.
  - Invoice surfaces expose only totals/paid/due/installments — no cost, margin, or vendor fields.
  - Document upload/list is scoped to a booking the customer owns.
- **Authorization on every endpoint:** `requireCustomer` gate on all customer routes; `super_admin` bypass is irrelevant to the portal token audience.

## 4. UX

- Responsive layout with a dedicated mobile menu + sticky header; notification bell with unread badge.
- **English & Bangla** — full `portal.*` key set added to `en.json` and `bn.json` (dashboard, payments, visa, documents, support, tracking, settings, registration).
- Lazy-loaded pages, TanStack Query caching (`staleTime`, no refetch-on-focus), skeleton loaders.

## 5. Verification performed

| Check | Result |
|-------|--------|
| Frontend production build (`npm run build`) | ✅ Built in ~30 s, no errors |
| Type-check (`npx tsc --noEmit`, whole repo) | ✅ **0 errors** |
| Frontend tests (`npm test`) | ✅ 28/28 pass |
| Backend tests (`cd backend && npm test`) | ✅ 598/599 pass |
| Backend app load smoke (`createApp()`) | ✅ Loads; `portalCustomer.js` wired |
| Endpoint existence + response-shape audit | ✅ All 18 portal endpoints called by `portalApi.ts` exist and match TS interfaces |
| i18n JSON validity (en + bn) | ✅ Both parse |

**Known non-portal test failure:** `backend/test/sidebarEngine.test.js:111` (`group-tours … tourGroups bundle's business floor`) fails. This is **pre-existing and unrelated to the portal** — it belongs to the capability-based plan-floor logic (`sidebarEngine`), which this milestone did not touch. Flagged for the plan-redesign milestone owner.

**Live click-through journey (Register→Login→Dashboard→View Booking→Download Invoice→Download Ticket→Visa→Upload Docs→Support→Notification→Logout):** validated at the build + type + API-contract + security-audit level. A live browser walk requires standing up the embedded-Postgres stack with seed data and the magic-link console token; available on request.

## 6. Files

**New (frontend):** `portal/pages/{Dashboard,Profile,Payments,Notifications,Visa,Support,SupportDetail,Settings,Register}.tsx`, `portal/lib/format.ts`.
**Modified (frontend):** `portal/PortalApp.tsx`, `portal/PortalLayout.tsx`, `portal/pages/BookingDetail.tsx`, `lib/portalApi.ts`, `main.tsx`, `i18n/locales/{en,bn}.json`.
**New (backend):** `src/routes/portalCustomer.js`, `prisma/migrations/20260707020000_support_ticket_messages/`.
**Modified (backend):** `src/app.js` (mount), `prisma/schema.prisma` (`SupportTicket.messages`).
