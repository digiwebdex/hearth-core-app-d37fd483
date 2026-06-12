#!/usr/bin/env bash
# PM2 deploy for legacy/production VPS layout (/var/www/hearth-core-app).
# Used by GitHub Actions (VPS_DEPLOY_MODE=pm2) and manual deploys.
#
# Env overrides:
#   APP_DIR      — repo root (default: /var/www/hearth-core-app)
#   PM2_NAME     — process name (default: hearth-api, falls back to hearth-core-api)
#   GIT_BRANCH   — branch to pull (default: main)
#   HEALTH_URL   — API health URL (default: http://127.0.0.1:4000/api/health)
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/hearth-core-app}"
PM2_NAME="${PM2_NAME:-hearth-api}"
GIT_BRANCH="${GIT_BRANCH:-main}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:4000/api/health}"

if [ ! -d "$APP_DIR/.git" ]; then
  echo "❌ Not a git repo: $APP_DIR" >&2
  exit 1
fi

cd "$APP_DIR"

echo "[$(date -Iseconds)] git pull origin $GIT_BRANCH"
git fetch origin "$GIT_BRANCH"
git pull --ff-only origin "$GIT_BRANCH"

if [ ! -f .env.production ] && [ -f .env.production.example ]; then
  cp .env.production.example .env.production
  echo "⚠️  Created .env.production from example — verify VITE_API_URL"
fi

echo "[$(date -Iseconds)] npm install (frontend)"
npm install

echo "[$(date -Iseconds)] npm run build (frontend)"
npm run build

echo "[$(date -Iseconds)] backend install + migrate"
cd "$APP_DIR/backend"
npm install
npx prisma generate
npx prisma migrate deploy

echo "[$(date -Iseconds)] pm2 restart $PM2_NAME"
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_NAME"
elif pm2 describe hearth-core-api >/dev/null 2>&1; then
  PM2_NAME=hearth-core-api
  pm2 restart "$PM2_NAME"
else
  pm2 start src/index.js --name "$PM2_NAME" --cwd "$APP_DIR/backend"
fi
pm2 save

echo "[$(date -Iseconds)] health check $HEALTH_URL"
for i in $(seq 1 30); do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    echo "[$(date -Iseconds)] API healthy ✓ (pm2: $PM2_NAME)"
    exit 0
  fi
  sleep 2
done

echo "[$(date -Iseconds)] API failed health check" >&2
pm2 logs "$PM2_NAME" --lines 40 --nostream >&2 || true
exit 1
