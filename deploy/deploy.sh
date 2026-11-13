#!/usr/bin/env bash
# Zero-downtime deploy — run ON THE SERVER:   bash deploy/deploy.sh [branch]     (default: main)
#
# The new version is built in its own folder while the live one keeps serving. Only when it is
# built, migrated and ready do we flip the `current` link and restart (about a second), then
# health-check it and roll back automatically if it doesn't answer.
#
#   /var/www/mtn-scholars               git clone used only as the source of code (never served)
#   /var/www/mtn-scholars-app/shared/.env    production settings, shared by every release
#   /var/www/mtn-scholars-app/releases/<time>-<commit>   one folder per deploy (last 3 kept)
#   /var/www/mtn-scholars-app/current   -> the live release
#
# Safe on a shared host: low-priority build, memory and disk guards, and database changes only
# ever create mtnvc_ tables (see scripts/db-migrate.ts).
set -euo pipefail

# Everything lives in a function so `git pull` below can't change this file while bash is reading it.
main() {
  SRC="${SRC:-/var/www/mtn-scholars}"
  APP_ROOT="${APP_ROOT:-/var/www/mtn-scholars-app}"
  BRANCH="${1:-main}"
  PORT="${PORT:-3110}"
  KEEP=3
  CURRENT="$APP_ROOT/current"
  APP=mtn-scholars

  [ -f "$APP_ROOT/shared/.env" ] || { echo "Missing $APP_ROOT/shared/.env — create it first (see README)."; exit 1; }

  cd "$SRC"
  git fetch -q origin
  git checkout -q "$BRANCH"
  git pull -q --ff-only origin "$BRANCH"
  COMMIT="$(git rev-parse --short HEAD)"
  REL="$APP_ROOT/releases/$(date +%Y%m%d-%H%M%S)-$COMMIT"
  PREV="$(readlink -f "$CURRENT" 2>/dev/null || true)"
  echo "→ Deploying $BRANCH @ $COMMIT (currently live: ${PREV:-legacy in-place install})"

  AVAIL_MB=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)
  [ "$AVAIL_MB" -ge 900 ] || { echo "Only ${AVAIL_MB} MB of memory free — not building on a shared server right now. Try again shortly."; exit 1; }
  DISK_MB=$(df -Pm "$APP_ROOT" | awk 'NR==2 {print $4}')
  [ "$DISK_MB" -ge 2500 ] || { echo "Only ${DISK_MB} MB of disk free — refusing to create another release."; exit 1; }

  mkdir -p "$REL"
  trap 'echo "✖ Deploy failed before going live — the running site was not touched."; rm -rf "$REL"' ERR
  git archive HEAD | tar -x -C "$REL"
  ln -s "$APP_ROOT/shared/.env" "$REL/.env"
  cd "$REL"

  # Reuse the previous node_modules (hard-linked, instant) unless dependencies or the schema changed.
  DEPS_KEY="$(cat package-lock.json prisma/schema.prisma | sha256sum | cut -d' ' -f1)"
  if [ -n "$PREV" ] && [ -f "$PREV/.deps-key" ] && [ "$(cat "$PREV/.deps-key")" = "$DEPS_KEY" ] && [ -d "$PREV/node_modules" ]; then
    echo "→ Dependencies unchanged — reusing them"
    cp -al "$PREV/node_modules" node_modules
  else
    echo "→ Installing dependencies"
    nice -n 15 npm ci --no-audit --no-fund
  fi
  echo "$DEPS_KEY" > .deps-key

  echo "→ Building"
  NODE_OPTIONS=--max-old-space-size=1280 nice -n 15 npm run build

  echo "→ Checking database (only creates mtnvc_ tables)"
  npm run db:migrate
  trap - ERR

  echo "→ Going live"
  ln -sfn "$REL" "$APP_ROOT/current.new"
  mv -Tf "$APP_ROOT/current.new" "$CURRENT"
  start_app

  if health_check; then
    echo "✔ Healthy."
  else
    echo "✖ New version did not respond — rolling back."
    rollback "$PREV"
    exit 1
  fi

  # Keep the newest $KEEP releases.
  ls -1dt "$APP_ROOT"/releases/*/ 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -rf
  pm2 save >/dev/null
  echo "Deployed $BRANCH @ $COMMIT → https://mtnfscholars.dragnet.ng"
}

app_cwd() {
  pm2 jlist 2>/dev/null | python3 -c "
import sys, json
raw = sys.stdin.read()
data = json.loads(raw[raw.index('['):])   # pm2 can print warnings before the JSON
for p in data:
    if p['name'] == '$APP': print(p['pm2_env']['pm_cwd'])
" 2>/dev/null || true
}

start_app() {
  local now; now="$(app_cwd)"
  if [ "$now" = "$CURRENT" ]; then
    pm2 reload "$APP" --update-env >/dev/null
    return
  fi
  # Not yet on the release layout (first switch from the in-place install), or not running at all.
  # Never leave two processes with our name fighting over the port.
  if pm2 describe "$APP" >/dev/null 2>&1; then pm2 delete "$APP" >/dev/null; fi
  pm2 start "$CURRENT/ecosystem.config.cjs" --update-env >/dev/null
}

health_check() {
  for _ in $(seq 1 30); do
    if curl -sf -o /dev/null -m 5 "http://127.0.0.1:$PORT/admin/login"; then return 0; fi
    sleep 1
  done
  return 1
}

rollback() {
  local prev="$1"
  if [ -n "$prev" ] && [ -d "$prev" ]; then
    ln -sfn "$prev" "$APP_ROOT/current.new" && mv -Tf "$APP_ROOT/current.new" "$CURRENT"
    start_app
    health_check && echo "↩ Rolled back to $prev" || echo "‼ Rollback also failed — check: pm2 logs $APP"
  elif [ -d "$SRC/.next" ]; then
    echo "↩ Restoring the legacy in-place install"
    pm2 delete "$APP" >/dev/null 2>&1 || true
    APP_CWD="$SRC" pm2 start "$SRC/ecosystem.config.cjs" --update-env >/dev/null
    health_check && echo "↩ Legacy install is serving again" || echo "‼ Could not restore — check: pm2 logs $APP"
  fi
}

main "$@"
exit $?
