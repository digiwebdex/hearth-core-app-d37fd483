# TravelAgencyWeb (Hearth Core App)

Multi-tenant travel agency ERP — CRM, sales, operations, finance, and website CMS.

## Quick start (local)

1. **PostgreSQL 16** on `localhost:5432` (see `AGENTS.md` for bootstrap commands).
2. Copy `backend/.env.example` → `backend/.env` and set `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`.
3. Backend: `cd backend && npm run setup && npm run dev` → http://localhost:4000
4. Frontend: `npm install && npm run dev` → http://localhost:8080

Health check: `curl http://localhost:4000/api/health`

## Documentation

| Doc | Purpose |
|-----|---------|
| [AGENTS.md](./AGENTS.md) | Cloud agent / developer runbook |
| [docs/architecture.md](./docs/architecture.md) | System architecture |
| [docs/deployment-guide.md](./docs/deployment-guide.md) | VPS / Docker production |
| [docs/saas-master-blueprint.md](./docs/saas-master-blueprint.md) | Product menu & UX blueprint |
| [docs/Travel-Agency-ERP-Full-Audit-Improvement-Plan.md](./docs/Travel-Agency-ERP-Full-Audit-Improvement-Plan.md) | Security & roadmap audit |

## Production deploy (PM2 VPS)

```bash
cd /var/www/hearth-core-app
bash scripts/vps-pm2-deploy.sh
```

GitHub Actions auto-deploy: set `VPS_HOST`, `VPS_SSH_USER`, `VPS_SSH_KEY` (see `AGENTS.md`).

## Tests

- Frontend: `npm test` (Vitest)
- Backend: `cd backend && npm test` (Node test runner + Supertest)
