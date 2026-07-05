# v2 Master Blueprint

> 🧊 **ARCHITECTURE FROZEN — 2026-07-05.** The official frozen source of truth is **[11-Architecture-Freeze](11-Architecture-Freeze.md)**. It governs all v2 development; where docs 01–10 or the code disagree, doc 11 wins.

The authoritative, code-grounded reference set for **TravelAgencyWeb (TAWSS / Hearth Core App)** — a multi-tenant travel-agency ERP + SaaS. Each doc is generated from and cross-checked against the actual codebase (permission matrix, plan config, Prisma schema, route handlers), with known drift/bugs flagged for v2 to reconcile.

| # | Doc | What it covers |
|---|-----|----------------|
| 01 | [Vision](01-Vision.md) | Problem, users, principles, the 5 pillars, market scope, success metrics |
| 02 | [Business Architecture](02-Business-Architecture.md) | SaaS model, subscription flow, multi-tenant system architecture, the 3 surfaces, deployment |
| 03 | [Master Organogram](03-Master-Organogram.md) | Platform ↔ tenant hierarchy, roles→code, portal participants, provisioning |
| 04 | [Service Modules](04-Service-Modules.md) | 14 service types, 135-item catalog, 6 presets, 10 nav groups, gating layers |
| 05 | [Workflow Book](05-Workflow-Book.md) | State machines: lead, quotation, booking, invoice/payment, expense, automation, portal |
| 06 | [Database Blueprint](06-Database-Blueprint.md) | ~78 Prisma models by domain, tenant isolation, enum-like values, uniqueness |
| 07 | [Permission Matrix](07-Permission-Matrix.md) | RBAC roles × 19 modules × 6 actions, full grid, FE/BE sync |
| 08 | [Plan & Feature Matrix](08-Plan-Feature-Matrix.md) | Tiers, limits, feature flags, pricing, trial, enforcement (+ drift callouts) |
| 09 | [UI/UX Standards](09-UI-UX-Standards.md) | Stack, bilingual rules, state components, UI gating, IA |
| 10 | [Development Rules](10-Development-Rules.md) | Tenant isolation, paired sources of truth, server enforcement, money/ledger, the deploy hook |
| **11** | 🧊 [**Architecture Freeze**](11-Architecture-Freeze.md) | **FROZEN source of truth** — final architecture, organogram, module hierarchy, business services, booking engine, module registry, permission architecture, plan engine, dev rules, Future Roadmap, freeze checklist |

## How to use

- **New to the codebase?** Read 01 → 02 → 03, then 04 and 05 for how it works day-to-day.
- **Building a feature?** 04 (where it lives) + 07/08 (who can use it) + 09 (how it looks) + 10 (the rules).
- **Touching data/flows?** 06 (schema) + 05 (state machines) are authoritative.
- **Reconciling v2 debt?** 08 and 10 flag the known drift and bugs to fix.

> Source of truth is always the code. When a doc and the code disagree, the code wins — and the doc should be updated. Related repo docs: root `CLAUDE.md`, `AGENTS.md`, and the broader `../` docs folder.
