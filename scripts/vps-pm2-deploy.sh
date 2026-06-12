#!/usr/bin/env bash
# Deploy hearth-core-app on VPS using PM2 (production path used on srv1468666).
# Run on server: bash /var/www/hearth-core-app/scripts/vps-pm2-deploy.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/hearth-core-app}"
BACKEND_DIR="$APP_DIR/backend"
PM2_NAME="${PM2_NAME:-hearth-api}"
BRANCH="${BRANCH:-main}"

log() { echo "[$(date -Iseconds)] $*"; }

cd "$APP_DIR"

log "Pull $BRANCH"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

if [ ! -f .env.production ]; then
  cat > .env.production <<'EOF'
VITE_API_URL=https://api.travelagencyweb.com/api
VITE_APP_DOMAIN=travelagencyweb.com
EOF
  log "Created .env.production"
fi

log "Build frontend"
npm install
npm run build

log "Backend install + migrations"
cd "$BACKEND_DIR"
[ -f .env ] || { echo "Missing backend/.env — configure DATABASE_URL and JWT_SECRET first." >&2; exit 1; }
npm install
npx prisma generate
if [ -d prisma/migrations ] && [ "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  npx prisma migrate deploy
else
  npx prisma db push
fi

log "Restart PM2 ($PM2_NAME)"
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_NAME"
else
  pm2 start src/index.js --name "$PM2_NAME" --cwd "$BACKEND_DIR"
fi
pm2 save

if command -v nginx >/dev/null; then
  nginx -t && systemctl reload nginx
fi

log "Health check"
for i in $(seq 1 12); do
  if curl -fsS https://api.travelagencyweb.com/api/health >/dev/null 2>&1; then
    log "Deploy OK"
    exit 0
  fi
  sleep 5
done

echo "API health check failed — check pm2 logs $PM2_NAME" >&2
pm2 logs "$PM2_NAME" --lines 40 --nostream >&2
exit 1
