# 116 — Booking Engine Completion Report

**Milestone:** Organization ERP → **Module 2: Booking Engine** (v2 Master Blueprint)
**Status:** Implementation complete; verified via build + typecheck + tests.
**Scope rule honored:** Reuse the ONE generic `Booking` engine and the existing (read-only) Status Engine data. **No** new Prisma model, **no** duplicate booking model, **no** schema change. Additive + backward compatible.

---

## 1. What the audit found (starting point)

The generic `Booking` engine was already solid: one `Booking` model serves all service types (`type` + `serviceType` + `serviceDetails` JSON), all 11 business services are creatable/manageable with UI, and sub-collections (segments/travelers/checklist/timeline/documents) + the payment→invoice→booking money roll-up all work. Tenant isolation is clean throughout.

**The one unmet frozen mandate** was the **Central Status Engine**: `backend/src/lib/statusEngine.js` documented the full booking lifecycle whitelist but was explicitly **read-only** — "nothing here is wired into any write path." The booking status routes wrote `req.body.status` **verbatim**, so free-text and illegal jumps (e.g. `inquiry → completed`, reopening `cancelled`) were possible. This violated [11 §10.3](11-Architecture-Freeze.md) / [10 §4](10-Development-Rules.md) ("no free-text status; whitelist the state machine").

## 2. What this milestone delivered

### Central Status Engine — now ENFORCED on every booking write (the core deliverable)
- **New engine accessors** (`statusEngine.js`): `validateTransition(setId, current, next)`, `isKnownStatus`, `allowedNextStatuses`. Conservative & backward compatible: the target must be a **known** status (kills free-text); a no-op is allowed; an **unknown/legacy current** value never traps a record (any known target allowed); otherwise the target must be in the current status's `nextStatuses`.
- **Wired into all four booking write paths** in `bookings.js`: `POST /` (create), `PATCH /:id` (generic edit), `PATCH /:id/status`, `PATCH /:id/follow-up`. An invalid change returns **`400 INVALID_STATUS_TRANSITION`** with the `allowedNextStatuses` list; the timeline/audit/automation side effects are otherwise untouched. Statuses can no longer be written free-text.
- **Frontend now mirrors the backend** ([10 §2](10-Development-Rules.md) paired sources): new `src/lib/bookingStatus.ts` (a documented mirror of `WORKFLOW_STATUS_REGISTRY.bookingStatus`) drives the status dropdowns in `Bookings.tsx` (edit form, anchored to the booking's persisted status) and `BookingDetails.tsx` — they now offer **only valid transitions**, so the UI never presents an option the API will 400.

## 3. Coverage of the 11 required business services

All 11 were already reachable through the one generic engine and remain so (unchanged, verified by the audit): **Air Ticket** (`ticket`/`air_ticket`), **Visa** (`visa`), **Hajj** & **Umrah** (`hajj_umrah` + the Hajj Operations desk), **Hotel** (`hotel`), **Holiday/Tour** (`tour`/`package`), **Transport** (`transport`), **Insurance** (`insurance`), **Student Visa** (`student`/`study_abroad`), **Manpower** (`manpower`/`b2b_agent`), **Group Tour** (`GroupTour`). Each has a field component in the booking form. No service is a hard gap; none required a new model.

## 4. Security & correctness

- **Tenant isolation:** unchanged and intact — every guarded write still resolves the booking via `getTenantBooking`/`ensureBookingExists` (`{ id, tenantId }`) before validating, and writes via `updateMany`. The status guard runs **after** the tenant-scoped fetch, so it can never leak or act cross-tenant.
- **Fail-safe:** an unknown status-**set** id (a caller/config mistake, not user input) does not block writes; only user-supplied status **values** are validated. Legacy rows with off-whitelist current statuses are never trapped.
- **No behavior regression:** all existing booking tests pass under enforcement (no test performed an illegal transition); the money roll-up, timeline events, audit log and `booking_created` automation are unchanged.

## 5. Verification performed

| Check | Result |
|-------|--------|
| Type-check (`npx tsc --noEmit`) | ✅ **0 errors** |
| Frontend tests (`npm test`) | ✅ 28/28 |
| Backend tests (`cd backend && npm test`) | ✅ **613/614 pass** (+7 new transition tests) |
| Transition-logic spot check (9 cases incl. legacy/no-op/unknown) | ✅ all correct |
| Backend app load smoke (`createApp()`) | ✅ Loads |
| Frontend production build | ✅ Built ~20 s |
| ESLint (new `bookingStatus.ts`) | ✅ clean; changed pages add no new `any` |

**Known non-booking test failure:** `sidebarEngine.test.js:111` — pre-existing & unrelated (see report [114](114-Customer-Portal-Completion.md)/[115](115-CRM-Module-Completion.md)). Unchanged.

## 6. Files

**Modified (backend):** `src/lib/statusEngine.js` (enforcement accessors), `src/routes/bookings.js` (guard on 4 write paths), `test/statusEngine.test.js` (+7 tests).
**New (frontend):** `src/lib/bookingStatus.ts`.
**Modified (frontend):** `src/pages/Bookings.tsx`, `src/pages/BookingDetails.tsx`.

## 7. Deliberately deferred (documented, blueprint-sanctioned)

- **Service Field Registry consumed by the frontend** (one declarative registry rendering dynamically into `serviceDetails`, replacing the 9 hardcoded `*Fields.tsx` components): the freeze itself ([11 §5](11-Architecture-Freeze.md)) states *"existing per-type components remain valid during migration; the registry is introduced additively and they are retired incrementally."* The 5 backend `*Domain.js` field registries already exist. A full dynamic-form rewrite would destabilize 9 working, in-use field components for an architectural (config-not-code) gain, not a functional one — the services are all already creatable/manageable. Left for incremental migration per the freeze, rather than a risky big-bang rewrite in this milestone.
- **Payment-delete reversal** ([11 §10.6](11-Architecture-Freeze.md) must-fix): it corrupts the booking money roll-up but lives in the invoice/payment/ledger code — scheduled for **Module 3 (Finance & Accounting)**, its natural home, to avoid splitting the fix.
- **Wiring the unused type-scoped routes** (`/api/{air-ticket,visa,…}-bookings`) into the FE: they duplicate `/api/bookings` behavior and the FE calls none of them; folding/retiring them is an incremental cleanup, not a functional gap.
