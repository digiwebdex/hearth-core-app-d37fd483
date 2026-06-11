# AGENTS.md

## Cursor Cloud specific instructions

### Product overview

TravelAgencyWeb (TAWSS) is a multi-tenant travel-agency SaaS monorepo:
- **Frontend** (Vite + React): repo root, dev server on **http://localhost:8080**
- **Backend API** (Express + Prisma): `backend/`, dev server on **http://localhost:4000**
- **Database**: PostgreSQL 16 (required for full-stack dev)

See `docs/architecture.md`, `docs/deployment-guide.md`, and `docs/environment-variables.md` for production details.

### PostgreSQL (local dev)

Docker is not required for local dev. PostgreSQL 16 must be running on `localhost:5432`.

```bash
sudo pg_ctlcluster 16 main start   # if not already running
pg_isready -h localhost
```

First-time DB bootstrap (once per fresh database):

```bash
sudo -u postgres psql -c "CREATE USER travelagencyweb_user WITH PASSWORD 'devpassword123';"
sudo -u postgres psql -c "CREATE DATABASE travelagencyweb_db OWNER travelagencyweb_user;"
```

Copy `backend/.env.example` → `backend/.env` and set at minimum:

- `DATABASE_URL=postgresql://travelagencyweb_user:devpassword123@localhost:5432/travelagencyweb_db?schema=public`
- `JWT_SECRET` (any long random string)
- `PORT=4000`
- `CORS_ORIGIN=http://localhost:8080,http://localhost:5173`
- `UPLOAD_DIR=/workspace/backend/uploads` and `LOG_DIR=/workspace/backend/logs`

Then run `cd backend && npm run setup` (installs deps, `prisma db push`, seeds demo data). For migration-based deploys use `npx prisma migrate deploy` instead of `db push`.

### Starting services

Run in separate terminals (or tmux sessions):

```bash
# Terminal 1 — API
cd backend && npm run dev

# Terminal 2 — frontend
npm run dev
```

Health check: `curl http://localhost:4000/api/health`

### Seeded credentials

Configure via `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_DEMO_EMAIL`, `SEED_DEMO_PASSWORD` in `backend/.env`. Defaults match the historical demo accounts; passwords are **not** printed by the seed script.

| Role | Default email |
|------|----------------|
| Super admin | `digiwebdex@gmail.com` |
| Demo tenant owner | `user@demo.com` |

Login UI: http://localhost:8080/login → redirects to `/dashboard` on success.

### Lint / test / build

| Command | Location | Notes |
|---------|----------|-------|
| `npm run lint` | repo root | ESLint; repo has many pre-existing `no-explicit-any` violations |
| `npm test` | repo root | Vitest unit tests (jsdom, no live API) |
| `npm run build` | repo root | Vite production build |
| `npm run dev` | `backend/` | Nodemon API server |

Playwright E2E (`playwright.config.ts`) requires frontend + backend + Postgres all running.

### Gotchas

- Frontend defaults API to `http://localhost:4000/api` (no `.env` needed for basic local dev).
- Vite dev port is **8080**, not 5173. Backend CORS must include `http://localhost:8080`.
- `backend/package.json` has a `setup` script but no lockfile; `npm install` in `backend/` is required separately from root.
- Optional integrations (SMTP, SSLCommerz, bKash, SMS, WhatsApp) default to console logging when unset.
- Production stack lives in `app/docker-compose.yml` (Postgres + API + Nginx frontend); `vps/` is deployment tooling only.
