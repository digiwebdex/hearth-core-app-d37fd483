#!/bin/bash
# ══════════════════════════════════════════════════
# VPS Manual Deploy Script for Hearth Core App
# Run on your VPS: bash deploy.sh
# ══════════════════════════════════════════════════

set -e

APP_DIR="/var/www/hearth-core-app"
BACKEND_DIR="$APP_DIR/backend"

echo "═══ Step 1: Pull latest code ═══"
cd "$APP_DIR"
git pull origin main

echo "═══ Step 2: Ensure build env ═══"
if [ ! -f .env.production ]; then
  cat > .env.production << 'EOF'
VITE_API_URL=https://api.travelagencyweb.com/api
VITE_APP_DOMAIN=travelagencyweb.com
EOF
  echo "✅ Created .env.production"
fi

echo "═══ Step 3: Build frontend ═══"
npm install
npm run build

echo "═══ Step 4: Deploy backend ═══"
cd "$BACKEND_DIR"

if [ ! -f .env ]; then
  echo "⚠️  Backend .env not found! Run SETUP-VPS.sh first."
  exit 1
fi

npm install
npx prisma generate
if [ -d prisma/migrations ] && [ "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  npx prisma migrate deploy
else
  npx prisma db push --accept-data-loss
fi

PM2_NAME="${PM2_NAME:-hearth-api}"
pm2 describe "$PM2_NAME" > /dev/null 2>&1 && pm2 restart "$PM2_NAME" || pm2 start src/index.js --name "$PM2_NAME"
pm2 save

echo "═══ Step 4: Reload Nginx ═══"
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "✅ Deployment complete!"
echo "   Main:     https://travelagencyweb.com"
echo "   App:      https://app.travelagencyweb.com"
echo "   Portal:   https://portal.travelagencyweb.com"
echo "   API:      https://api.travelagencyweb.com/api/health"
