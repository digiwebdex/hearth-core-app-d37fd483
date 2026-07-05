# 05 — Workflow Book

> 🧊 **ARCHITECTURE FREEZE (v2) — 2026-07-05.** Authoritative frozen design: [11-Architecture-Freeze](11-Architecture-Freeze.md).
> - **Central Status Engine (frozen):** every status is centrally defined with a documented lifecycle; **no free-text status values**. Value sets live in one shared code-level definition (backward-compatible with existing `String` columns).
> - **Unified pipeline (frozen):** the lead/booking state machines below are governed by one funnel — **Lead → Inquiry → Quotation → Booking → Invoice → Payment → Delivery → Completed**.
> - **Agent Portal gains write flows** in v2 (booking submission, wallet, ledger, document upload). The "read-only" note in §7 reflects current code, not the frozen target.

> The core business **state machines**, extracted from the backend route handlers. These are the flows every service type shares.
>
> ⚠️ **Important:** Most `PATCH …/status` routes store the status string **verbatim from the request body — there is no DB/enum guard.** The state machines below are conventions enforced by the UI plus the *automated* transitions in the handlers. Only booking-commission (`pending`/`paid`) and expense approve/reject hard-validate. Keep this in mind for v2 — see [10-Development-Rules](10-Development-Rules.md).

## The universal 6-step flow

```
Lead ──▶ Client ──▶ Quotation ──▶ Booking ──▶ Invoice ──▶ Payment
                                     │                        │
                                     └────── Operations ──────┘   (+ Vendor payables, Accounts, Reports)
```

Every service type (Hajj, tour, visa, ticket, manpower…) runs this same backbone. Detail per stage below.

---

## 1. Lead lifecycle

**Statuses:** `new → contacted → qualified → quoted → won | lost`

| Transition | Trigger | Side effects |
|-----------|---------|-------------|
| create | `POST /leads` (gated `checkPlanLimit("leads")`) | fires `lead_created` automation |
| manual status change | `PATCH /leads/:id/status` | always logs `leadActivity` type `status_change` (old→new); if →`won` and `crmConfig.automations.leadWonCreateTask`, auto-creates a high-priority `task` |
| → `quoted` | a quotation is created for the lead | forced only if lead not in `won`/`lost`; logs activity |
| → `won` | `POST /leads/:id/convert` **or** quotation→booking convert | dup-check client by email OR phone; link/create `Client`, set `clientId`; audit `lead/converted` |
| delete | `DELETE /leads/:id` | — |

Helpers: `GET /leads/check-duplicate?email=&phone=`, `GET /leads/:id/activities`, `GET /leads/:id/quotations`.

---

## 2. Quotation lifecycle

**Statuses:** `draft → sent → approved | rejected | expired`
Key fields: `version` (starts 1), `validUntil`, `grandTotal`/`totalCost`/`totalProfit`, package snapshots, `clientId`/`leadId`.

| Transition | Trigger | Side effects |
|-----------|---------|-------------|
| create | `POST /quotations` (gated `checkPlanLimit`) | enrich from linked package; if `leadId`, promote lead → `quoted`; if created as `sent`, run sent-transition |
| edit | `PATCH /quotations/:id` | whitelisted fields; runs sent-transition if status becomes `sent` |
| status change | `PATCH /quotations/:id/status` | runs sent-transition handler |
| **sent-transition** | status → `sent` (from non-`sent`) | resolve/create `Client`; dispatch `quotation_sent` automation |
| duplicate | `POST /quotations/:id/duplicate` | clone, title "(Copy)", reset `status:draft`, `version:1` |
| **convert to booking** | `POST /quotations/:id/convert-to-booking` (perm `quotations:approve`) | requires client; creates `Booking` (`amount=grandTotal`, `cost=totalCost`, `profit=totalProfit`, `paidAmount:0`, `dueAmount:grandTotal`, `paymentStatus:unpaid`, **`status:pending`**); sets quotation `approved`; promotes lead → `won` |

Version history: `GET /quotations/:id/versions` (`quotationVersion`, read-only snapshots).

---

## 3. Booking lifecycle — the operational hub

**Customer status (`status`):** `inquiry → pending → confirmed → ticketed → traveling → completed | cancelled`
**Ops status (`opsStatus`):** free track, defaults `pending`.
**Payment status (`paymentStatus`):** `unpaid | partial | paid` — **derived from invoice payments, never set directly** (see §4).

| Transition | Trigger | Side effects |
|-----------|---------|-------------|
| create | `POST /bookings` (gated `checkPlanLimit`) | resolve/auto-create client; resolve agent (only `commissionProfile.status=active`); enrich from package; `profit = amount − cost`; `syncAgentCommission`; audit `created`; fire `booking_created` automation |
| edit | `PATCH /bookings/:id` | re-normalize; re-sync commission |
| status change | `PATCH /bookings/:id/status` | writes `bookingTimelineEvent` (`status_change`, old→new) + audit `status_changed` |
| follow-up board | `GET /bookings/board/follow-ups` | lists `status:inquiry`, bucketed `due`/`upcoming`/`noDate` |
| set/snooze follow-up | `PATCH /bookings/:id/follow-up` | update `followUpDate`/`followUpNote`, optional status change (e.g. inquiry→confirmed) |
| commission | `PATCH /bookings/:id/commission` (perm `agents:approve`) | set `agentCommissionStatus` `pending`|`paid` only |

**Agent commission** (`bookingAgentCommission`): auto-computed `amount × commissionRate%` on create/edit; **frozen once `paid`**; deleted if no active agent.

**Sub-collections** (`/bookings/:id/…`): `segments`, `travelers`, `checklist` (toggle `done`+`doneAt`/`doneBy`), `timeline` (auto `status_change`/`system`), `documents` (multer ≤10 MB, PDF/JPG/PNG/WEBP/DOC/DOCX).

---

## 4. Invoice + Payment flow — the money roll-up

**Invoice statuses:** `unpaid | partial | paid | overdue | refunded | cancelled`
Numbering: `INV-00001` (max-scan). `overdue` is valid but set externally (not by these routes). Server-side `overdue` persistence is a **known gap**.

### The core money path — `POST /invoices/:id/payments`
Recording a payment fires this **cascade** (all in one handler):

```
1. create `payment` (receivedBy, bookingId, method)
2. invoice:  paidAmount = Σpayments;  dueAmount = total − paid
             status = paid≥total ? "paid" : paid>0 ? "partial" : "unpaid"
3. booking roll-up: recompute paidAmount/dueAmount/paymentStatus across ALL the booking's invoices
4. ledger:   ensureLedgerIncomeTransaction → idempotent `transaction`
             (type:income, category:invoice_payment, ref:payment.id)
5. installments: allocatePaymentToInstallments → fill by dueDate,sortOrder,createdAt;
                 update each installment paidAmount + status (pending|partial|paid)
6. audit:    invoiceAuditEvent(payment) + auditLog(payment_received)
7. automation: fire `payment_received` (with running balance)
```

⚠️ **Known bug:** `DELETE /invoices/:id/payments/:payId` does **not** recompute invoice/booking totals or reverse the ledger entry. Fix candidate for v2.

**Installments** (`invoiceInstallment`): status `pending|partial|paid` via `installmentStatus(amount, paidAmount)`. CRUD under `/invoices/:id/installments`.
**Refunds** (`invoiceRefund`, perm `invoices:approve`): recompute `refundedAmount`; set invoice `refunded` when refunded ≥ total.
**Status change** (`PATCH /invoices/:id/status`): logs `invoiceAuditEvent`; `cancelled` captures `cancelReason`.

### Online gateways (`/api/payments`)
`POST /payments/initiate` dispatches to `cod` (instant success), `sslcommerz`, or `bkash`. Progress tracked via `auditLog` module `payment_gateway` (`payment_initiated`, `bkash_created`, `payment_success/failed/cancelled`, `ipn_validated`). `GET /payments/status/:transactionId` maps to `pending`/`success`/`failed`/`cancelled`.

---

## 5. Expense approval flow

**Statuses:** `pending → approved | rejected`

| Transition | Trigger | Ledger effect (`syncExpenseTransaction`) |
|-----------|---------|------------------------------------------|
| create | `POST /expenses` (perm `accounts:create`) | sync (no ledger unless approved) |
| approve | `POST /expenses/:id/approve` | upsert `transaction` (type:expense, status:completed, ref:expense) |
| reject / un-approve | `POST /expenses/:id/reject` or status≠approved | existing ledger transaction set `cancelled` (retracts) |
| delete | `DELETE /expenses/:id` | deletes expense **and** its ledger transaction |

**Ledger rule:** an approved expense ⇒ a completed `transaction`; anything else ⇒ that transaction cancelled. Ledger entries come from exactly two sources: invoice payments (income, idempotent) and approved expenses (expense).

---

## 6. Notification automation

**Engine:** `dispatchTenantAutomation(eventType, ctx)`. Channels: **`in_app`** and **`sms`** only. Non-blocking. Every attempt writes a `notificationDelivery` row (`pending → sent|failed`).

| Event | Fired from | Master toggle | In-app (→ link) | SMS template | SMS recipient |
|-------|-----------|---------------|-----------------|--------------|---------------|
| `lead_created` | `POST /leads` | `notifyOnLead` | `system` → `/leads` | `custom` | lead phone |
| `booking_created` | `POST /bookings` | `notifyOnBooking` | `booking_created` → `/bookings` | `booking` | client phone |
| `payment_received` | invoice payment | `notifyOnPayment` | `payment_received` → `/invoices` | `payment` | client phone |
| `quotation_sent` | quotation sent-transition | `notifyOnBooking` | `quotation_sent` → `/quotations` | `custom` | client/lead phone |

- **In-app** → tenant staff, tenant-wide (`notification` row with `userId:null`). Fires if the event's `inApp` flag is on.
- **SMS** → the customer/lead, only if event `sms` flag ON **and** `smsSettings.smsEnabled` **and** SMS env configured **and** a phone exists. Template from active `smsTemplate` (tenant or global) else hard-coded fallback. Missing SMS env with SMS enabled → a `failed` delivery row ("SMS environment not configured").

Config: `GET/PATCH /api/notification-automation` (PATCH is `tenant_owner`). Logs at `/notifications` in the app and `GET /logs`.

---

## 7. Portal flows (customer / supplier / agent)

Separate JWT audience (`portal`) — cannot hit agency endpoints. Passwordless magic-link, email-identified. **Strictly read-only self-service — no mutations.**

**Auth:** `POST /portal/auth/request-link` (rate-limited, anti-enumeration `{ok:true}` always) → 15-min magic JWT → `POST /portal/auth/verify` re-classifies roles, issues 7-day session JWT → `GET /portal/auth/me`.

| Role | Endpoint | Returns (sanitized) |
|------|----------|---------------------|
| customer | `GET /portal/bookings`, `/portal/bookings/:id` | bookings; detail = travelers (name+nationality), invoices+installments, **customer-safe timeline only** (`status_change`,`system`); **cost/profit stripped** |
| agent (B2B) | `GET /portal/agent/bookings`, `/portal/agent/commissions` | own bookings + commission wallet (`pendingTotal`, `paidTotal`, count) |
| supplier | `GET /portal/purchase-orders` | own vendor bills (total/paid/due/status/dueDate) |

Non-matching role → `[]` or 403.

---

## Cross-cutting

- **Money roll-up chain:** `payment → invoice → booking → ledger transaction + installments`, all inside `POST /invoices/:id/payments`.
- **Status strings are unguarded** on manual status routes — treat the state machines here as UI/convention contracts, and consider adding server-side validation in v2.
- **Known gaps to address in v2:** payment deletion doesn't reverse totals/ledger; `overdue` not persisted server-side; refund→ledger transaction not yet posted; expense→account link UI partial; gateway→installment allocation edge cases.

---
*See also: [04-Service-Modules](04-Service-Modules.md) · [06-Database-Blueprint](06-Database-Blueprint.md) · [07-Permission-Matrix](07-Permission-Matrix.md)*
