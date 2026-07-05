# 07 — Permission Matrix (RBAC)

> 🧊 **ARCHITECTURE FREEZE (v2) — 2026-07-05.** Authoritative frozen design: [11-Architecture-Freeze](11-Architecture-Freeze.md).
> - Permissions are owned by the **Module Registry / Single Plan Engine** — one source of truth consumed by both frontend and backend (they must never diverge). This matrix is the frozen content of that source ([11 §Final Permission Architecture](11-Architecture-Freeze.md)).

> **Status:** Authoritative reference, generated from code.
> **Sources of truth:**
> - `src/lib/permissions.ts` — **canonical** `DEFAULT_PERMISSIONS` (frontend, fullest form).
> - `backend/src/middleware/auth.js` — `ROLE_PERMISSIONS` (backend enforcement; a faithful subset).
>
> These two **must stay in sync** — see [10-Development-Rules](10-Development-Rules.md). RBAC (this doc) is **role-scoped and plan-agnostic**. It is a *separate axis* from plan/feature gating ([08-Plan-Feature-Matrix](08-Plan-Feature-Matrix.md)). A gated feature requires **both** to pass.

---

## 1. Roles

| Role | Scope | Description |
|------|-------|-------------|
| `super_admin` | **Platform** (all tenants) | Manages every tenant, subscriptions, payments, platform settings. The only non-tenant role. |
| `tenant_owner` | Tenant | Full access within their agency. |
| `manager` | Tenant | Manages most operations; limited on finance-delete, settings, team. |
| `sales_agent` | Tenant | Clients, leads, quotations, bookings (create/edit, no delete of financials). |
| `accountant` | Tenant | Invoices, payments, accounts, reports. |
| `operations` | Tenant | Bookings, Hajj/Umrah, vendors, packages, tasks. |

**Legacy role aliases** (`mapLegacyRole`): `owner → tenant_owner`, `admin → tenant_owner`, `member → sales_agent`. Unknown roles pass through unchanged. `usePermissions` defaults an unauthenticated/missing user to `sales_agent` (safest default).

## 2. Modules (19)

`dashboard`, `clients`, `agents`, `vendors`, `leads`, `tasks`, `quotations`, `packages`, `bookings`, `invoices`, `accounts`, `reports`, `hajj_umrah`, `subscription`, `team`, `organization`, `settings`, `website`, `admin_panel`.

Categorized (`MODULE_METADATA`): **overview** (dashboard) · **crm** (clients, agents, vendors, leads, tasks, quotations) · **operations** (packages, bookings, hajj_umrah) · **finance** (invoices, accounts, reports) · **management** (subscription, team, organization, settings, website) · **platform** (admin_panel).

## 3. Actions (6)

`view`, `create`, `edit`, `delete`, `approve`, `export`.

## 4. Full matrix

Legend: **V**=view **C**=create **E**=edit **D**=delete **A**=approve **X**=export · `—`=no access.

| Module | super_admin | tenant_owner | manager | sales_agent | accountant | operations |
|--------|:-----------:|:------------:|:-------:|:-----------:|:----------:|:----------:|
| dashboard | VCEDAX | VCEDAX | V·X | V | V·X | V |
| clients | VCEDAX | VCEDAX | VCEDAX | VCE | V | V |
| agents | VCEDAX | VCEDAX | VCEDAX | V | V | V |
| vendors | VCEDAX | VCEDAX | VCEDAX | V | V | VCE |
| leads | VCEDAX | VCEDAX | VCEDAX | VCED | — | — |
| tasks | VCEDAX | VCEDAX | VCEDAX | VCE | V | VCE |
| quotations | VCEDAX | VCEDAX | VCEDAX | VCE·X | V·X | V |
| packages | VCEDAX | VCEDAX | VCEDAX | VCE | V | VCE |
| bookings | VCEDAX | VCEDAX | VCEDAX | VCE | V | VCE·X |
| invoices | VCEDAX | VCEDAX | VCE·AX (no D) | V | VCE·AX (no D) | V |
| accounts | VCEDAX | VCEDAX | VCE·X (no D/A) | — | VCE·X (no D/A) | — |
| reports | VCEDAX | VCEDAX | V·X | — | V·X | V |
| hajj_umrah | VCEDAX | VCEDAX | VCEDAX | VC | V·X | VCE·X |
| subscription | VCEDAX | VCEDAX | V | — | V | — |
| team | VCEDAX | VCEDAX | V | — | — | — |
| organization | VCEDAX | VCEDAX | V | — | — | — |
| settings | VCEDAX | VCEDAX | — | — | — | — |
| website | VCEDAX | VCEDAX | V·E | — | — | — |
| admin_panel | VCEDAX | — | — | — | — | — |

### Notable rules
- **`super_admin`** is granted everything **and** short-circuits to `true` in `hasPermission` — it never actually consults the matrix.
- **`admin_panel`** is the only module granted *exclusively* to `super_admin`; every tenant role (including `tenant_owner`) has `—`.
- **Finance guardrails:** `manager` and `accountant` can approve invoices but **cannot delete** them, and can edit accounts but **cannot delete or approve** them. `sales_agent` and `operations` have **no accounts access at all**.
- **`sales_agent`** cannot touch finance (`invoices` view-only, `accounts`/`reports` none) or management modules.
- **`operations`** has no `leads`/`accounts`; owns booking ops and Hajj/Umrah.

## 5. Frontend vs backend — the differences

The two matrices are **identical at the action level** for every role×module both define. Differences are structural (represented, not enforced, differently):

1. **`super_admin`** — not a key in backend `ROLE_PERMISSIONS`; instead hard-bypassed in `requirePermission`, `requireRole`, `requireFeature`, and gated by `requireSuperAdmin`.
2. **`admin_panel`** — absent from the backend matrix entirely; admin routes are protected by `requireSuperAdmin`, not `requirePermission`.
3. **Denied = omitted (backend) vs explicit `NONE` (frontend).** The backend simply omits a role's `—` modules (an undefined `perms` array → denied). Behaviorally identical.

⚠️ Because these are two hand-maintained copies, **any permission change must edit both files** or the UI and API will disagree.

## 6. How it's enforced

- **Backend:** `router.<verb>("/path", requirePermission(module, action), handler)`. Missing role/module/action → `403 Forbidden: <role> cannot <action> <module>`.
- **Frontend:** `usePermissions().hasPermission(module, action)` for conditional UI; `<PermissionRoute module=…>` (alias `PM` in `App.tsx`) and `<PermissionGate>` for route/element guards.
- **Role-only checks:** `requireRole(...roles)` (coarse), `requireSuperAdmin` (platform).

## 7. Relationship to plan/module gating

RBAC answers *"can this role do this action on this module."* It does **not** know about plans. A tenant also needs their **plan** to unlock advanced module bundles / feature flags / resource limits (`moduleAccess`, `requireFeature`, `checkPlanLimit`). See [08-Plan-Feature-Matrix](08-Plan-Feature-Matrix.md) and [04-Service-Modules](04-Service-Modules.md). Both axes are ANDed; `super_admin` bypasses both.
