# 103 — RC1 Release Checklist & Blocker Resolution

**Date:** 2026-07-06
**Purpose:** Resolve the three RC1 Release Blockers from [102-RC1-Verification.md](102-RC1-Verification.md) **procedurally** and provide the authoritative go-live runbook.
**Constraint note:** This task made **no** changes to application code, database, packages, migration files, or env — and did not commit (per instruction: "create ONE document"). Every fix below is a **verified, exact, executable step** for the operator to run at deploy time. Where a command needs a live/shadow DB (unavailable here), the command is given for the operator to run against staging.

---

## 0. Blocker resolution status

| RC1 Blocker | Finding this pass | Resolved by |
|---|---|---|
| **#1 Migration consistency** | **Worse than 102 estimated** — verified **38 of 100 models have no `CREATE TABLE` in migration history** (not just 4). `0_init` baselined at 37 tables; total migrated = 62. Both deploy paths run `prisma migrate deploy`, so a **fresh** DB gets only 62 tables and the app breaks. | §2 Migration Checklist (reconcile + validate on a fresh scratch DB) |
| **#2 Production environment** | `.env.production.example` + `.env.example` ship `VITE_API_URL=https://api.travelagencyweb.com/api`; PM2 script warns if `.env.production` missing; Docker bakes `VITE_API_URL` as a build arg. Localhost fallback is real only if `.env.production` is absent/placeholder. | §1 Production Environment Checklist |
| **#3 Deployment validation** | Two paths reviewed (PM2 primary, Docker alt). Both run `migrate deploy` + a `/api/health` check. **No automated backup or rollback** in either. | §3–§5 Deployment / Rollback / Backup |

---

## 0.1 Migration-drift evidence (the 38 missing tables)

Verified by comparing `^model` names in `schema.prisma` (100) against `CREATE TABLE` statements across all 28 migrations (62 distinct). No `@@map` is used, so model name = table name. Missing from migration history (present only because dev/prod were built with `prisma db push`):

```
BspRecord, BspUpload, Document, GroupTour, GroupTourBooking, HotelContract,
JobApplication, JobPosting, LoyaltyAccount, LoyaltyRule, LoyaltyTransaction,
MiceEvent, MiceEventItem, PaymentMethodConfig, PayrollRun, PayslipEntry,
PlatformStaff, ReferralCode, ReferralConversion, SalaryStructure,
SubscriptionAddon, SubscriptionHistory, SystemFlag, TaxRule, TicketRefund,
TicketReissue, TicketVoid, TransportContract, TravelApprovalRequest,
TravelPackage, TravelPackageDay, TravelPackageInclusion, TravelPackageMedia,
TravelPackagePricing, TravelPolicy, VisaApplication, WhatsAppLog, WhatsappOtp
```

Also missing from migrations: the Phase-1 **H4 indexes** `@@index([tenantId, createdAt])` on `AuditLog` and `Transaction`, and the loose, never-auto-applied `prisma/migrations/manual_add_email_verification.sql`.

> **Why it matters:** the migration history is not a faithful source of truth for the schema. Existing environments work because they were `db push`ed; but a **fresh** `prisma migrate deploy` (new server, disaster recovery, scaling) produces an incomplete DB, and running `migrate deploy` against an already-`db push`ed DB can error on drift. This must be reconciled **before go-live**.

---

## 1. Production Environment Checklist

Set/verify on the production target (`backend/.env` for PM2, or Docker/Coolify env for compose). **Required** = app fails or degrades badly without it. `.env.example` / `.env.production.example` are the templates — never ship real secrets in a tracked file (Phase-1 H1).

### Database
- [ ] `DATABASE_URL` — **required**, points to the **production** Postgres (NOT `localhost`). Format `postgresql://user:pass@host:5432/db?schema=public`.
- [ ] (Docker) `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` — **required** (`POSTGRES_PASSWORD` is `:?`-guarded in compose).

### JWT / Auth
- [ ] `JWT_SECRET` — **required, ≥ 32 chars.** The app calls `process.exit(1)` in production if missing/short (`middleware/jwtSecret.js`). **Rotate** the value exposed in git history (Phase-1 H1).
- [ ] `ALLOW_DEV_JWT` — **must be unset / false** in production.
- [ ] `RATE_LIMIT_DISABLED` — **must be unset** in production (else login brute-force protection is off — audit M1).

### SMTP (email — optional, degrades to console)
- [ ] `SMTP_HOST`, `SMTP_PORT` (587), `SMTP_SECURE` (false for 587), `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_FROM_NAME`, `ADMIN_NOTIFICATION_EMAIL`, `SUPER_ADMIN_ALERT_EMAIL`.

### SSLCommerz (gateway — optional)
- [ ] `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD`, `SSLCOMMERZ_SANDBOX=false` (live). Verify via `/api/health` → `paymentGateways.sslcommerz.mode = "live"`.

### bKash (gateway — optional)
- [ ] `BKASH_APP_KEY`, `BKASH_APP_SECRET`, `BKASH_USERNAME`, `BKASH_PASSWORD`, `BKASH_SANDBOX=false` (live).
- [ ] Manual receive: `BKASH_ACCOUNT_NAME`, `BKASH_ACCOUNT_NUMBER`, `BKASH_INSTRUCTIONS`.

### Nagad (manual method — optional)
- [ ] `NAGAD_ACCOUNT_NAME`, `NAGAD_ACCOUNT_NUMBER`, `NAGAD_INSTRUCTIONS`. (Also Rocket/Bank if used: `ROCKET_*`, `BANK_ACCOUNT_*`, `BANK_NAME`, `BANK_BRANCH`.)

### WhatsApp (optional, degrades to console)
- [ ] `WHATSAPP_PROVIDER` + provider creds: Meta (`META_WHATSAPP_TOKEN`, `META_WHATSAPP_PHONE_ID`), or WASender (`WASENDER_API_KEY`, `WASENDER_INSTANCE_ID`), or Twilio (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`), `WHATSAPP_FROM_NUMBER`.

### SMS (optional, degrades to console)
- [ ] `SMS_PROVIDER`, `SMS_ENABLED=true`, `SMS_API_KEY`, `SMS_SENDER_ID`, `SMS_BASE_URL`, `TRIAL_EXPIRY_SMS_LANG`.

### Cron
- [ ] `CRON_SECRET` — **required** to authorize `/api/cron/*` (expiry, reminders). Set a strong value; the scheduler must send it via the `x-cron-secret` header (audit L3: prefer header over `?secret=`).

### Storage
- [ ] `UPLOAD_DIR` (e.g. `/app/uploads`), `LOG_DIR` (`/app/logs`), `PUBLIC_UPLOAD_URL` (prod URL, e.g. `https://api.travelagencyweb.com/uploads`). Ensure the volumes exist and are writable/persistent (Docker mounts `/srv/travelagencyweb/data/{uploads,logs}`).

### CORS & URLs
- [ ] `CORS_ORIGIN` — prod origins only (`https://travelagencyweb.com,https://app.travelagencyweb.com,https://portal.travelagencyweb.com,...`).
- [ ] `API_BASE_URL`, `FRONTEND_URL`, `PORTAL_URL` — prod URLs (NOT localhost).
- [ ] `TRUST_PROXY=true` (behind Traefik/nginx), `NODE_ENV=production`, `PORT` (3027 Docker / 4000 PM2).

### Frontend build (VITE_*) — the localhost safeguard
- [ ] **`VITE_API_URL`** — **required at build time**, set to the real prod API (e.g. `https://api.travelagencyweb.com/api`). If unset, `src/lib/api.ts` bakes `http://localhost:4000/api` into the bundle and the app fails.
  - PM2 path: ensure `.env.production` exists with the real `VITE_API_URL` **before** `npm run build` (the deploy script copies from `.env.production.example` and prints a warning if missing).
  - Docker path: pass `--build-arg VITE_API_URL=...` or set it in the compose env (default is already the prod URL).
- [ ] `VITE_APP_DOMAIN` — root domain for tenant hostname resolution (e.g. `travelagencyweb.com`).

### Anti-localhost verification (run before serving)
- [ ] After building, confirm no dev URL leaked into the bundle:
  `grep -r "localhost:4000" dist/ && echo "FAIL: localhost baked in" || echo "OK"`
- [ ] Confirm `DATABASE_URL`, `CORS_ORIGIN`, `API_BASE_URL`, `FRONTEND_URL`, `PORTAL_URL` contain no `localhost`/`127.0.0.1`.

---

## 2. Migration Checklist (Blocker #1 — do first)

**Goal:** make `prisma migrate deploy` reproduce the full 100-table schema (+ all indexes) on a *fresh* database.

### 2a. Diagnose
- [ ] On staging, run `cd backend && npx prisma migrate status` — expect it to report pending/drift.
- [ ] Confirm the drift set (should match §0.1): `npx prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma --shadow-database-url "$SHADOW_DB_URL" --script` → this prints the exact SQL for the 38 missing tables + H4 indexes + email-verification columns.

### 2b. Reconcile (choose ONE)
**Option A — Catch-up migration (recommended, least disruptive):**
- [ ] Generate the reconciling migration folder:
  ```
  mkdir -p prisma/migrations/20260707000000_rc1_reconcile
  npx prisma migrate diff \
    --from-migrations ./prisma/migrations \
    --to-schema-datamodel ./prisma/schema.prisma \
    --shadow-database-url "$SHADOW_DB_URL" \
    --script > prisma/migrations/20260707000000_rc1_reconcile/migration.sql
  ```
- [ ] Fold the intent of `manual_add_email_verification.sql` into it (or confirm the diff already includes those columns), then delete the loose file so the folder is clean.
- [ ] **Existing production DB (already has the tables via db push):** mark the new migration as already applied so it is not re-run:
  `npx prisma migrate resolve --applied 20260707000000_rc1_reconcile`
  Do the same for any earlier migrations Prisma reports as un-recorded.
- [ ] **Fresh DB:** nothing extra — `migrate deploy` will run it.

**Option B — Re-baseline (if the history is too tangled):**
- [ ] Archive `prisma/migrations/*` and create a single baseline from the current schema:
  `npx prisma migrate diff --from-empty --to-schema-datamodel ./prisma/schema.prisma --script > prisma/migrations/0_init/migration.sql`
- [ ] On existing DBs: `npx prisma migrate resolve --applied 0_init`.

### 2c. Validate (the acceptance gate — DO NOT skip)
- [ ] Point at a **fresh empty** scratch Postgres and run `npx prisma migrate deploy`.
- [ ] Confirm all tables exist: `psql "$SCRATCH_DB" -c "\dt"` → **100 tables**.
- [ ] Confirm H4 indexes exist:
  `psql "$SCRATCH_DB" -c "\di" | grep -E "AuditLog_tenantId_createdAt|Transaction_tenantId_createdAt"`
- [ ] `npx prisma migrate status` → **"Database schema is up to date"**, no drift.
- [ ] Commit the reconciling migration to the repo so both deploy paths pick it up (this is the one code/repo change required — perform it in a normal commit **after this checklist is approved**).

---

## 3. Deployment Checklist

### Common pre-flight
- [ ] §1 environment complete and §2 migrations validated on scratch DB.
- [ ] `git` on the intended release commit/tag; working tree clean.
- [ ] Full gate green: backend `node --test` (598), frontend `vitest run` (25), `tsc`, `eslint`, `vite build`.
- [ ] **Take a pre-deploy DB backup** (§5) and record the current release commit for rollback (§4).

### Path A — PM2 (`scripts/vps-pm2-deploy.sh`, primary)
- [ ] Ensure `backend/.env` and root `.env.production` are populated (real `VITE_API_URL`).
- [ ] Run `bash scripts/vps-pm2-deploy.sh` (git pull → frontend build → `npm install` → `prisma generate` → **`prisma migrate deploy`** → `pm2 restart hearth-api` → `pm2 save` → health loop).
- [ ] Confirm final line `API healthy ✓`. On failure the script dumps `pm2 logs` and exits 1 (no auto-rollback → go to §4).

### Path B — Docker Compose (`scripts/deploy.sh` + `app/docker-compose.yml`, alternative)
- [ ] Populate the compose `.env` (`POSTGRES_PASSWORD`, `JWT_SECRET`, `VITE_API_URL`, gateway/SMTP…).
- [ ] `bash scripts/deploy.sh` (git pull → `docker compose build` → `up -d`). The API container CMD runs `prisma migrate deploy && node src/index.js`; Postgres has a `pg_isready` healthcheck; the API image has a `/api/health` HEALTHCHECK.
- [ ] Confirm `API healthy ✓` and `docker compose ps` shows all services healthy.

### Post-deploy smoke test (both paths)
- [ ] `curl -fsS https://api.<domain>/api/health` → `status:"ok"`, `database:"connected"`, expected `paymentGateways` modes.
- [ ] Log in (staff), and exercise the chain: create Client → Lead → Booking → Invoice → record Payment → open Report → Customer Portal → Agent Portal.
- [ ] One export (`/api/export/workbook`) as an authorized role; confirm a low role gets `403` (Phase-1 H2).
- [ ] Confirm the frontend calls the **prod** API (browser devtools network tab — no `localhost`).

---

## 4. Rollback Checklist

There is **no automated rollback** — follow this manually if the smoke test or health check fails.

- [ ] **Code:** `git checkout <previous-release-commit>` (recorded in §3 pre-flight).
- [ ] **Rebuild & restart:**
  - PM2: re-run `scripts/vps-pm2-deploy.sh` on the previous commit (rebuilds frontend, `pm2 restart`).
  - Docker: `docker compose build && docker compose up -d` on the previous commit.
- [ ] **Database:** Prisma migrations are **forward-only** — they do not auto-revert. If the failed deploy applied a migration that must be undone, **restore from the pre-deploy backup** (§5) rather than reverse-migrating.
- [ ] Prefer **additive, backward-compatible** migrations (new tables/columns/indexes) so a code rollback works without a DB restore. The RC1 reconcile (§2) is additive.
- [ ] Verify `/api/health` green on the rolled-back version; re-run the smoke test (§3).
- [ ] Record the incident + root cause before retrying.

---

## 5. Backup Checklist

- [ ] **Pre-deploy backup (mandatory):** `pg_dump` the prod DB to the backup dir:
  `pg_dump "$DATABASE_URL" -F c -f /var/backups/hearth-core/predeploy_$(date +%Y%m%d_%H%M%S).dump`
  (Super-admins can also trigger `POST /api/export/db-backup`, now correctly super-admin-only — Phase-1 C1.)
- [ ] Confirm the backup dir exists and is on **persistent** storage (`/var/backups/hearth-core`; `GET /api/export/backup-info` reports the latest).
- [ ] **Volume backups (Docker):** snapshot `/srv/travelagencyweb/data/{postgres,uploads,logs}`.
- [ ] **Scheduled backups:** a daily `pg_dump` cron with retention (e.g. 14 daily + 8 weekly). Store off-box.
- [ ] **Test restore** at least once on a scratch DB: `pg_restore -d "$SCRATCH_DB" <dump>` → app boots + `/api/health` connected. A backup is not verified until a restore succeeds.

---

## 6. Monitoring Checklist

- [ ] **Health probe:** external uptime monitor hitting `GET /api/health` (both API and, via the frontend host, the SPA). Alert on non-`ok` / non-200.
- [ ] **Process:** `pm2 status` / `pm2 logs hearth-api` (PM2) or `docker compose logs -f` / container HEALTHCHECK (Docker); auto-restart on crash (PM2 `restart`, compose `restart: unless-stopped`).
- [ ] **Database:** monitor connections + `pg_isready`; alert on the health endpoint's `database:"error…"`.
- [ ] **Disk:** watch the `uploads`/`logs`/`postgres` volumes (payment proofs + document uploads grow).
- [ ] **Gateways:** watch `health.paymentGateways` modes (a gateway silently dropping to `disabled`/`sandbox` = misconfig).
- [ ] **Errors:** ship `LOG_DIR` logs to a collector; alert on 5xx spikes and on `[DB-BACKUP]`/auth failures.
- [ ] **Security signals:** watch auth-rate-limit hits and `402 SUBSCRIPTION_INACTIVE` / `403` spikes.

---

## 7. Go-Live Checklist (final gate)

**Blockers (must all be ✔):**
- [ ] **#1** RC1 reconcile migration authored, committed, and **validated on a fresh scratch DB → 100 tables + H4 indexes** (§2c). `migrate status` clean.
- [ ] **#2** All required env set for the prod target; **secrets rotated** (Phase-1 H1); `VITE_API_URL` real; `RATE_LIMIT_DISABLED` unset; `ALLOW_DEV_JWT` unset; gateway `SANDBOX=false`; anti-localhost grep passes.
- [ ] **#3** Chosen deploy path dry-run on **staging** end-to-end (build → migrate deploy → health) succeeds.

**Readiness:**
- [ ] Pre-deploy backup taken and **restore-tested** (§5).
- [ ] Rollback commit recorded and the previous build kept (§4).
- [ ] DNS + TLS for `travelagencyweb.com`, `app.`, `portal.`, `api.` (+ any custom agency domains) valid; Traefik/nginx routes verified.
- [ ] Monitoring + alerting live (§6).
- [ ] Seed/super-admin account exists (via `SEED_*` on first run) and 2FA enrolled.

**Launch:**
- [ ] Deploy to production via the chosen path.
- [ ] Run the full post-deploy smoke test (§3) against the real domains.
- [ ] Watch health + logs for the first 30–60 min.

**Recommended in the launch window (RC1 majors, not blockers — from 102 §12):** enable a conservative global rate limiter (M1), wrap the payment+ledger write in `prisma.$transaction` (M6), and whitelist write fields on financial routes (M3).

---

## Appendix — Verified facts behind this checklist

- Schema: 100 models, **62** created by migrations → **38 table drift** (§0.1); no `@@map`; H4 indexes absent from migrations.
- Deploy paths: `scripts/vps-pm2-deploy.sh` (PM2, `migrate deploy` @ line 91, `/api/health` loop, no rollback/backup); `scripts/deploy.sh` + `app/docker-compose.yml` (Docker/Traefik); `backend/Dockerfile` CMD `prisma migrate deploy && node src/index.js`, container HEALTHCHECK on `/api/health`.
- Env safeguards: `JWT_SECRET`/`POSTGRES_PASSWORD` are `:?`-required in compose; frontend `VITE_API_URL` is a build arg (Docker) / `.env.production` (PM2) defaulting to the prod API URL; `.env.example` + `.env.production.example` ship the prod `VITE_API_URL`.
- Health: `GET /api/health` reports DB connectivity, gateway modes, trial days, uptime, environment.

*This document did not modify code, migrations, schema, database, packages, or env, and was not committed. It is the executable runbook to clear the RC1 blockers. Awaiting approval.*
