# Deployment Guide

## First-time setup on a fresh VPS

```bash
# 0. SSH in
ssh root@187.77.144.38

# 1. Create folder structure
sudo mkdir -p /srv/travelagencyweb/{app,data/{postgres,uploads,logs,temp},backups/{database,uploads,full-project,restore-test},scripts,docs}
sudo chown -R $USER:$USER /srv/travelagencyweb

# 2. Clone repo
git clone https://github.com/digiwebdex/hearth-core-app-7a9aeeb7.git /srv/travelagencyweb/app
cd /srv/travelagencyweb/app

# 3. Copy scripts + docs to the canonical locations
cp scripts/*.sh /srv/travelagencyweb/scripts/
chmod +x /srv/travelagencyweb/scripts/*.sh
cp -r docs/* /srv/travelagencyweb/docs/

# 4. Create env file
cp app/.env.example app/.env
nano app/.env   # fill POSTGRES_PASSWORD, JWT_SECRET, CRON_SECRET, SMTP_*, etc.

# 5. Build & start
cd /srv/travelagencyweb/app
docker compose --env-file .env up -d --build

# 6. Wait & verify
sleep 15
/srv/travelagencyweb/scripts/health-check.sh
docker exec travelagencyweb-api curl -fsS http://127.0.0.1:3027/api/health
```

## Coolify path (recommended)
1. In Coolify create **Project → travelagencyweb**.
2. Add resource **PostgreSQL 16** named `travelagencyweb-postgres`. Copy generated credentials.
3. Add resource **Application → Dockerfile**, repo = GitHub, **base directory = `/backend`**, name `travelagencyweb-api`. Set env vars from `backend/.env.example`. Set domain = `api.travelagencyweb.com`.
4. Add resource **Application → Dockerfile**, repo = GitHub, **base directory = `/`**, name `travelagencyweb-frontend`. Set build-arg `VITE_API_URL=https://api.travelagencyweb.com`. Set domains = `travelagencyweb.com`, `www.travelagencyweb.com`, `app.travelagencyweb.com`.
5. Mount volumes for API: `/srv/travelagencyweb/data/uploads → /app/uploads`, `/srv/travelagencyweb/data/logs → /app/logs`.
6. Deploy each resource. Coolify auto-issues Let's Encrypt SSL.

## DNS (Hostinger)
```
A  @     187.77.144.38
A  www   187.77.144.38
A  app   187.77.144.38
A  api   187.77.144.38
```

## Cutover from legacy PM2 (`hearth-api` :3027)

```bash
# 1. Final dump of legacy DB
pg_dump -h 127.0.0.1 -p 5432 -U hearth -d hearth_db \
  --no-owner --no-acl --clean --if-exists \
  | gzip > /srv/travelagencyweb/backups/database/cutover-$(date +%F).sql.gz

# 2. Rsync uploads
rsync -av /var/www/hearth-core-app/backend/uploads/ /srv/travelagencyweb/data/uploads/

# 3. Restore into new DB
gunzip -c /srv/travelagencyweb/backups/database/cutover-*.sql.gz \
  | docker exec -i travelagencyweb-postgres psql -U travelagencyweb_user -d travelagencyweb_db

# 4. Verify parity
OLD_DATABASE_URL=postgresql://hearth:PASS@127.0.0.1:5432/hearth_db \
NEW_DATABASE_URL=postgresql://travelagencyweb_user:PASS@127.0.0.1:5433/travelagencyweb_db \
  /srv/travelagencyweb/scripts/verify-migration.sh

# 5. Swap DNS / Nginx / Coolify so api.travelagencyweb.com hits the container, not PM2.

# 6. Freeze legacy (do NOT delete for 7 days)
pm2 stop hearth-api
pm2 save
```

## PM2 production deploy (current live stack)

Until Docker/Coolify cutover, production runs at **`/var/www/hearth-core-app`** with PM2 process **`hearth-api`**.

After `main` is updated (e.g. PR merges):

```bash
ssh root@YOUR_VPS_IP
bash /var/www/hearth-core-app/scripts/vps-pm2-deploy.sh
```

Or manually: pull `main`, `npm run build`, `cd backend && npx prisma migrate deploy`, `pm2 restart hearth-api`.

See also `docs/sidebar-routes-implementation-plan.md` §8 and root `deploy.sh` (uses `PM2_NAME=hearth-api`).

**GitHub Actions:** `.github/workflows/deploy.yml` targets `/opt/projects/hearth-core` and requires repo secrets `VPS_HOST` + `VPS_SSH_KEY`. It does not deploy the PM2 path until secrets and script path are aligned.

## Acceptance checklist (31 items)

- [ ]  1. Repo cloned to `/srv/travelagencyweb/app`
- [ ]  2. Persistent data only under `/srv/travelagencyweb/data`
- [ ]  3. Uploads at `/srv/travelagencyweb/data/uploads`
- [ ]  4. Logs at `/srv/travelagencyweb/data/logs`
- [ ]  5. Backups under `/srv/travelagencyweb/backups`
- [ ]  6. Frontend resolves on travelagencyweb.com / www / app
- [ ]  7. `GET https://api.travelagencyweb.com/api/health` returns 200 + database connected
- [ ]  8. PM2 `hearth-api` stopped (kept on disk 7 days)
- [ ]  9. API public only via `api.travelagencyweb.com`
- [ ] 10. Admin login works
- [ ] 11. Admin writes hit Postgres on VPS
- [ ] 12. Public visitors see admin-managed data
- [ ] 13. Contact/booking forms save to DB
- [ ] 14. Uploads land in `/srv/travelagencyweb/data/uploads`
- [ ] 15. Uploaded files served via API
- [ ] 16. DB survives `docker compose down && up`
- [ ] 17. Uploads survive redeploy
- [ ] 18. Latest legacy data migrated
- [ ] 19. Latest legacy uploads migrated
- [ ] 20. Legacy source frozen
- [ ] 21. `backup-db.sh` cron works
- [ ] 22. Restore drill passed (test DB + uploads)
- [ ] 23. Coolify shows all 3 resources healthy
- [ ] 24. API container port not in `ss -tulnp` on host
- [ ] 25. DB container port not in `ss -tulnp` on host
- [ ] 26. Only :80/:443/:22 open publicly (`ufw status`)
- [ ] 27. No Lovable runtime in production
- [ ] 28. No Supabase runtime in production
- [ ] 29. No external DB
- [ ] 30. No external file storage
- [ ] 31. `handover.md` completed and committed
