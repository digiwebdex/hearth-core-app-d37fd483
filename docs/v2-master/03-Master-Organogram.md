# 03 — Master Organogram

> 🧊 **ARCHITECTURE FREEZE (v2) — 2026-07-05.** Authoritative frozen design: [11-Architecture-Freeze](11-Architecture-Freeze.md).
> - The **B2B Agent Portal is a full participant** in v2: booking submission, wallet, commission, ledger, invoice, document upload, and booking tracking — **not read-only**. The read-only description in §3 reflects current code, superseded by [11 §Final Organogram](11-Architecture-Freeze.md) and [05 §7](05-Workflow-Book.md).

> The people/role hierarchy of the platform and of an agency, and how those roles map to the code's access model.
> A rendered visual exists at [`../Master-Travel-Agency-Organogram.png`](../Master-Travel-Agency-Organogram.png).

## 1. Two-level hierarchy

```
┌──────────────────────────────────────────────────────────────────────┐
│ PLATFORM LEVEL  (global, no tenantId)                                 │
│                                                                        │
│   super_admin ─────────────────────────────  PlatformStaff            │
│   • all tenants, subscriptions, payments,     • platform-ops accounts │
│     coupons, master data, audit, health         with permissions[]    │
└───────────────────────────────┬──────────────────────────────────────┘
                                 │  provisions / approves / suspends
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│ TENANT LEVEL  (one Agency = one `Tenant` row, everything tenantId-scoped)│
│                                                                        │
│   tenant_owner                                                         │
│      ├── manager                                                       │
│      │      ├── sales_agent      (front desk / sales)                  │
│      │      ├── operations       (ticketing / visa / hajj desks)       │
│      │      └── accountant       (invoices / accounts / reports)       │
│      └── (owner has full access to all of the above)                   │
│                                                                        │
│   External (read-only Portal, magic-link):                            │
│      • customer   (a Client)                                           │
│      • supplier   (a Vendor)                                           │
│      • agent      (a B2B sub-Agent)                                    │
└──────────────────────────────────────────────────────────────────────┘
```

## 2. Roles → code

The org chart is enforced by the **RBAC role set** (canonical in `src/lib/permissions.ts`, mirrored in `backend/src/middleware/auth.js`). Full action grid in [07-Permission-Matrix](07-Permission-Matrix.md).

| Org role | Code role | Scope | Mandate |
|----------|-----------|-------|---------|
| Platform Admin | `super_admin` | Platform | Everything, all tenants; bypasses RBAC + plan + subscription gates. Sole holder of `admin_panel`. |
| Platform Ops | `PlatformStaff` (+ `permissions[]`) | Platform | Delegated platform tasks (not a `User`). |
| Agency Owner | `tenant_owner` | Tenant | Full access within the agency incl. settings, team, website, subscription. |
| Manager | `manager` | Tenant | Most operations; **cannot delete invoices, cannot delete/approve accounts, no settings**. |
| Sales / Front desk | `sales_agent` | Tenant | Clients, leads, quotations, bookings (create/edit). No finance, no management. |
| Operations | `operations` | Tenant | Bookings, Hajj/Umrah, vendors, packages, tasks. No leads/accounts. |
| Accountant | `accountant` | Tenant | Invoices, payments, accounts, reports (approve, no delete). |

**Legacy aliases:** `owner`→`tenant_owner`, `admin`→`tenant_owner`, `member`→`sales_agent` (`mapLegacyRole`). Unauthenticated/unknown defaults to `sales_agent` (safest).

## 3. External participants (Portal)

The Portal (`portal.` subdomain, `/api/portal`) gives an agency's **outside parties** read-only self-service via passwordless magic-link. One email can hold multiple roles simultaneously (`classifyEmail`):

| Portal role | Matched to | Can view (read-only) |
|-------------|-----------|----------------------|
| `customer` | `Client.email` | Own bookings, invoices + installments, customer-safe timeline. Internal cost/profit stripped. |
| `supplier` | `Vendor.email` | Own vendor bills / purchase orders (total/paid/due/status). |
| `agent` (B2B) | `Agent.email` | Own bookings + commission wallet (pending/paid totals). |

There are **no write endpoints** in the portal. See [05-Workflow-Book §7](05-Workflow-Book.md).

## 4. Provisioning lifecycle of a person

- **Tenant staff (`User`):** created via signup (owner) or invite (staff). `User.status` starts `pending` → `active` (admin/owner approval) → can be `rejected`/`inactive`. `authenticate` blocks non-`active` users with 403 (`PENDING_APPROVAL` / `REJECTED` / `INACTIVE`).
- **HR identity:** an active `User` may have a `StaffProfile` (1:1) carrying job title, department, salary structure, attendance, leave, payslips — the HRM view of the same person. See [06-Database-Blueprint §HRM](06-Database-Blueprint.md).
- **B2B agent identity:** an `Agent` may link to a `User` via `AgentCommissionProfile.userId` (so a sub-agent can also log in) and earns per-booking commission (`BookingAgentCommission`).

## 5. Who owns which module (RBAC ownership map)

| Module group | Primary owner role(s) |
|--------------|-----------------------|
| Dashboard | all (varying depth) |
| CRM (clients/leads/agents/vendors/tasks/quotations) | sales_agent + manager + owner |
| Sales & Bookings | sales_agent + operations + manager + owner |
| Operations desks (Hajj/Umrah, visa, ticketing) | operations + owner |
| Finance (invoices/accounts/reports) | accountant + owner (manager partial) |
| HR & Payroll | owner (manager view) |
| Website & CMS | owner (manager view/edit) |
| Settings / Organization / Subscription | owner (others view-only or none) |
| Admin panel | super_admin only |

Full cell-by-cell grants: [07-Permission-Matrix](07-Permission-Matrix.md).

---
*See also: [02-Business-Architecture](02-Business-Architecture.md) · [07-Permission-Matrix](07-Permission-Matrix.md)*
