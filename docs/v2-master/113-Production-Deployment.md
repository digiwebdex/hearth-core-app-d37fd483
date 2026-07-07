# 113 — Production Database & Deployment Report

> **Status:** ✅ The database can now be recreated **entirely from migrations** on an empty PostgreSQL instance. Completed 2026-07-07.

## Problem
The Prisma migration history was **not** a faithful image of `schema.prisma`. The dev workflow used `prisma db push` (no migration files), so tables added that way were never captured in migrations. Result: `prisma migrate deploy` on a clean DB produced an **incomplete** database.

- **Models in `schema.prisma`:** 101
- **Tables created by the old migration chain:** 55 (29 migrations, several ALTER-only)
- **Models missing from migrations:** **46** (bookings foundation, HRM/payroll, loyalty/referrals, corporate, campaigns, CRM config, agent ledger, etc.)

## Fix — consolidated baseline
The inconsistent 29-migration chain was **archived** (moved, not deleted, to `backend/prisma/migrations-archive-pre-baseline/`) and replaced with a single verified baseline:

- `backend/prisma/migrations/00000000000000_init/migration.sql` — generated from the current `schema.prisma` via `prisma migrate diff --from-empty --to-schema-datamodel` (no DB required), then verified applying cleanly on an empty PostgreSQL.
- `migration_lock.toml` preserved (`provider = "postgresql"`).
- The `db push` dependency was removed from the workflow (see `backend/package.json` scripts below).

```
backend/prisma/migrations/
  00000000000000_init/migration.sql   ← full schema: 101 tables, 123 FKs, 225 indexes
  migration_lock.toml
backend/prisma/migrations-archive-pre-baseline/   ← old chain (kept for history)
```

## Verification

| Check | Result |
|-------|--------|
| `npx prisma validate` | ✅ schema valid |
| `npx prisma generate` | ✅ client generated (v5.22.0) |
| **Baseline applies on empty PostgreSQL** (verified with PGlite/WASM Postgres) | ✅ applied cleanly |
| Tables created | ✅ **101 / 101 models** |
| Primary keys | ✅ 101 |
| Foreign keys | ✅ 123 (FK enforcement verified — bad ref rejected) |
| Indexes | ✅ 225 (124 explicit + 101 PK) |
| Column defaults | ✅ applied (`subscriptionPlan='free'`, `enableHajjUmrahModule=true`, `ARRAY[]::TEXT[]`, `CURRENT_TIMESTAMP`) |
| FK insert + join (Tenant→Branch→User) | ✅ |
| `npm run build` (frontend) | ✅ built |
| `npm test` (backend) | ✅ 70/70 |
| Seed loads & references only existing models | ✅ (parses; only `PrismaClientInitializationError` when no live DB) |

> Note: initial DDL verification used embedded PostgreSQL (PGlite). A **full live boot was subsequently executed** using a real `postgres.exe` (via `embedded-postgres`, no system install) — see the Live Production Boot section below.

---

## Live Production Boot Verification (2026-07-07)

A **real** end-to-end boot was executed against a genuine, empty PostgreSQL (`postgres.exe` from the `embedded-postgres` package, running on `127.0.0.1:5599`). Every requested step ran for real:

| Step | Result |
|------|--------|
| Empty PostgreSQL created | ✅ |
| `prisma migrate deploy` | ✅ *"1 migration applied · Database schema is up to date!"* (the single baseline) |
| `prisma generate` | ✅ |
| `npm run db:seed` | ✅ tenants=2, users=2, branches=2, clients=2, bookings=1; **owner assigned to primary branch** |
| `npm run build` (frontend) | ✅ |
| Backend boots | ✅ `GET /api/health` → `"database":"connected"` |
| Frontend boots | ✅ Vite dev server |

**Live API + UI acceptance (all PASS against the real DB):**

| Area | Verification |
|------|-------------|
| **Login** | UI login (seeded owner) → redirected to `/dashboard`, no errors |
| **Registration** | Full WhatsApp-OTP flow → 201, tenant created |
| **Trial** | New tenant `status=trial`, 7-day expiry; module flags derived from services (air_ticket+visa ⇒ BD-ops off) |
| **Branch provisioning** | Primary "Head Office" branch auto-created; owner assigned |
| **Dashboard** | `GET /dashboard/stats` 200; UI shows plan **Professional**, Staff 1/10, Branches 0/3, Domains 0/1 (capability model, no count limits) |
| **Subscription** | `/plan-engine/me` 200, `/billing/subscription` 200 |
| **Payment** | `/payment-requests` 200 |
| **CRM** | `/clients` 200 (2 rows) |
| **Booking** | `/bookings` 200 (1 row — seeded Umrah booking) |
| **Finance** | `/accounts` 200 |
| **Reports** | `/reporting/reports` 200 |
| **Website** | `/tenants/me` 200 |
| **Branches / Team** | `/branches` 200, `/tenants/me/members` 200 |
| **Capability gating (live)** | `/loyalty/rules` → **403** for a Professional tenant (Business-floor API gate enforced), and Business/Enterprise sidebar modules render locked |
| **Enterprise Contact Sales** | self-signup with `plan=enterprise` not minted as enterprise |

**Conclusion:** the project **boots successfully end-to-end from a completely clean database**. Database & Deployment is verified.

> The verification used ephemeral servers (embedded PostgreSQL, backend on :4100, frontend on :8090→API :4100). Temp verification scripts were removed; the `embedded-postgres`/PGlite packages were installed with `--no-save` (not added to `package.json`).

### Migration status
- Migrations directory now contains exactly **one** migration (`00000000000000_init`) that is byte-for-byte derived from `schema.prisma`.
- **Every model in `schema.prisma` (101) exists in migrations (101).** Zero drift.

### Missing tables — **none**
All 46 previously-missing models are in the baseline (verified: 101 CREATE TABLE = 101 models).

### Missing indexes — **none**
All `@index`/`@unique`/`@@index` declarations are emitted (225 indexes applied on the clean DB).

### Missing constraints — **none**
All 101 primary keys, 123 foreign keys (with `onDelete` behaviors incl. `Cascade`/`SetNull` for Branch relations) and NOT NULL/defaults are present and enforced (verified via insert/FK-rejection tests).

### Seed verification
- `prisma/seed.js` parses and loads; references only models present in the baseline (`tenant`, `user`, `branch`, `client`, `agent`, `booking`, `invoice`, `lead`, `vendor`, …).
- Representative seed shape (Tenant → primary Branch → owner User, with FK + defaults) inserts successfully against the baseline DB.
- Full `npm run db:seed` requires a live PostgreSQL (not available here) but is schema-compatible with the baseline.

## Updated scripts (`backend/package.json`) — no more `db push`
```
"db:migrate":     "npx prisma migrate deploy",
"db:migrate:dev": "npx prisma migrate dev",
"db:seed":        "node prisma/seed.js",
"db:reset":       "npx prisma migrate reset --force --skip-seed && npm run db:seed",
"setup":          "npm install && npx prisma generate && npm run db:migrate && npm run db:seed"
```

## Deployment runbook

### Fresh / clean database
```
createdb tawss                     # empty PostgreSQL
cd backend
npx prisma migrate deploy          # applies 00000000000000_init → full schema
npx prisma generate
npm run db:seed                    # optional: platform admin + demo tenant
```

### Existing production database (already built via the old chain + db push)
The tables already exist, so do **not** re-run the baseline blindly. Mark it as already applied:
```
npx prisma migrate resolve --applied 00000000000000_init
```
Then future `migrate deploy` runs proceed normally. (Verify with `npx prisma migrate status`.)

## Rollback strategy
- **Migration/deploy rollback:** the pre-baseline chain is preserved in `backend/prisma/migrations-archive-pre-baseline/` and in git history — restore it to revert the consolidation. Prisma migrations are forward-only; to undo a bad deploy, restore from the pre-deploy **database backup** (take one before every `migrate deploy`).
- **Data safety:** always `pg_dump` before deploying. For a failed fresh deploy, drop and recreate the empty DB and re-run `migrate deploy` (idempotent from empty).
- **Schema changes going forward:** use `npm run db:migrate:dev` to author a new migration (never `db push`), commit the generated migration, and deploy with `npm run db:migrate`.

## Follow-ups (non-blocking)
- Orphan models `BspUpload` / `BspRecord` (defined, referenced by no code) — included in the baseline for fidelity; remove from `schema.prisma` if truly unused.
- Update `CLAUDE.md` / `AGENTS.md` prose that still describes the `db push` dev workflow.
