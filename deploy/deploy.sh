#!/usr/bin/env bash
# Run ON THE SERVER:  bash deploy/deploy.sh [branch]      (default: main)
# Safe on a shared host: builds with low priority and a memory cap, and refuses to build if the
# server is short on memory. Database changes only create mtnvc_ tables (see scripts/db-migrate.ts).
set -euo pipefail
cd "$(dirname "$0")/.."
BRANCH="${1:-main}"

[ -f .env ] || { echo "Missing .env — copy .env.example to .env and fill it in first."; exit 1; }

git fetch origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

npm ci --no-audit --no-fund
npx prisma generate

AVAIL_MB=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)
if [ "$AVAIL_MB" -lt 900 ]; then
  echo "Only ${AVAIL_MB} MB of memory is free — not building on a shared server right now. Try again shortly."
  exit 1
fi
NODE_OPTIONS=--max-old-space-size=1280 nice -n 15 npm run build

npm run db:migrate
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save
echo "Deployed $BRANCH → https://mtnfscholars.dragnet.ng"
