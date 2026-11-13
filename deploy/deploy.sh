#!/usr/bin/env bash
# Zero-downtime (blue/green) deploy — run ON THE SERVER:   bash deploy/deploy.sh [branch]   (default: main)
#
#   1. Build the new version in its own folder while the live one keeps serving.
#   2. Check the database (only ever creates mtnvc_ tables).
#   3. Start the new version on the spare port (blue = 3110, green = 3111) and health-check it.
#   4. Point Apache at it with a graceful reload (no dropped connections), verify, then stop the old one.
#
# If anything fails before step 4 the live site is never touched. If the switch itself fails it is
# reverted automatically.
#
#   /var/www/mtn-scholars                 git clone used only as the source of code (never served)
#   /var/www/mtn-scholars-app/shared/.env production settings shared by every release
#   /var/www/mtn-scholars-app/releases/   one folder per deploy (last 3 kept)
#   /var/www/mtn-scholars-app/active-color  blue | green — which one Apache currently points at
set -euo pipefail

SRC="${SRC:-/var/www/mtn-scholars}"
APP_ROOT="${APP_ROOT:-/var/www/mtn-scholars-app}"
APP=mtn-scholars
DOMAIN="${DOMAIN:-mtnfscholars.dragnet.ng}"
PORT_CONF=/etc/apache2/conf-available/mtn-scholars-port.conf
KEEP=3

port_of() { [ "$1" = green ] && echo 3111 || echo 3110; }

health_check() {   # $1 = port
  for _ in $(seq 1 40); do
    curl -sf -o /dev/null -m 5 "http://127.0.0.1:$1/admin/login" && return 0
    sleep 1
  done
  return 1
}

# Apache reads the backend port from `Define MTN_PORT <n>`; the vhosts use ${MTN_PORT}.
ensure_apache_port_include() {
  [ -f "$PORT_CONF" ] && return 0
  echo "→ One-time: making the Apache site switchable between blue and green"
  local files=() f
  for f in /etc/apache2/sites-available/mtnfscholars.conf /etc/apache2/sites-available/mtnfscholars-le-ssl.conf; do
    [ -f "$f" ] && files+=("$f")
  done
  [ "${#files[@]}" -gt 0 ] || { echo "No Apache site for $DOMAIN found — set it up first (deploy/apache-mtnfscholars.conf)."; exit 1; }
  echo "Define MTN_PORT 3110" | sudo -n tee "$PORT_CONF" >/dev/null
  sudo -n a2enconf mtn-scholars-port >/dev/null
  for f in "${files[@]}"; do
    sudo -n cp -p "$f" "$f.pre-bluegreen"
    sudo -n sed -i 's#http://127\.0\.0\.1:[0-9]*/#http://127.0.0.1:${MTN_PORT}/#g' "$f"
  done
  if sudo -n apache2ctl configtest 2>&1 | grep -q "Syntax OK"; then
    sudo -n systemctl reload apache2
  else
    echo "✖ Apache config test failed — restoring the original files."
    for f in "${files[@]}"; do sudo -n cp -p "$f.pre-bluegreen" "$f"; done
    sudo -n a2disconf mtn-scholars-port >/dev/null; sudo -n rm -f "$PORT_CONF"
    exit 1
  fi
}

set_apache_port() {   # $1 = port
  echo "Define MTN_PORT $1" | sudo -n tee "$PORT_CONF" >/dev/null
  sudo -n apache2ctl configtest 2>&1 | grep -q "Syntax OK" || return 1
  sudo -n systemctl reload apache2
}

public_ok() {   # checks the real HTTPS site as Apache serves it (certificate included)
  curl -sf -o /dev/null -m 10 --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/admin/login"
}

# Everything below lives in a function so `git pull` can't change this file while bash is reading it.
main() {
  BRANCH="${1:-main}"
  [ -f "$APP_ROOT/shared/.env" ] || { echo "Missing $APP_ROOT/shared/.env — create it first (see README)."; exit 1; }

  cd "$SRC"
  git fetch -q origin
  git checkout -q "$BRANCH"
  git pull -q --ff-only origin "$BRANCH"
  COMMIT="$(git rev-parse --short HEAD)"
  REL="$APP_ROOT/releases/$(date +%Y%m%d-%H%M%S)-$COMMIT"
  PREV=""; [ -L "$APP_ROOT/current" ] && PREV="$(readlink -f "$APP_ROOT/current")"

  if [ -f "$APP_ROOT/active-color" ]; then
    OLD_COLOR="$(cat "$APP_ROOT/active-color")"; OLD_NAME="$APP-$OLD_COLOR"
    [ "$OLD_COLOR" = blue ] && NEW_COLOR=green || NEW_COLOR=blue
  else
    OLD_COLOR=legacy; OLD_NAME="$APP"; NEW_COLOR=green   # first run: the existing single process uses 3110
  fi
  OLD_PORT="$(port_of "$OLD_COLOR")"; NEW_PORT="$(port_of "$NEW_COLOR")"; NEW_NAME="$APP-$NEW_COLOR"
  echo "→ Deploying $BRANCH @ $COMMIT   live: $OLD_COLOR (:$OLD_PORT)   next: $NEW_COLOR (:$NEW_PORT)"

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

  ensure_apache_port_include

  echo "→ Starting the new version on :$NEW_PORT (the live one keeps serving)"
  if pm2 describe "$NEW_NAME" >/dev/null 2>&1; then pm2 delete "$NEW_NAME" >/dev/null; fi
  APP_COLOR="$NEW_COLOR" APP_PORT="$NEW_PORT" APP_CWD="$REL" pm2 start "$REL/ecosystem.config.cjs" --update-env >/dev/null
  if ! health_check "$NEW_PORT"; then
    echo "✖ The new version did not start — leaving the live site as it is."
    pm2 logs "$NEW_NAME" --lines 15 --nostream 2>/dev/null | tail -15 || true
    pm2 delete "$NEW_NAME" >/dev/null 2>&1 || true
    exit 1
  fi

  echo "→ Switching traffic to :$NEW_PORT"
  if set_apache_port "$NEW_PORT" && public_ok; then
    echo "✔ Live on $NEW_COLOR."
  else
    echo "✖ Switch failed — reverting to :$OLD_PORT."
    set_apache_port "$OLD_PORT" || true
    pm2 delete "$NEW_NAME" >/dev/null 2>&1 || true
    exit 1
  fi
  ln -sfn "$REL" "$APP_ROOT/current.new" && mv -Tf "$APP_ROOT/current.new" "$APP_ROOT/current"
  echo "$NEW_COLOR" > "$APP_ROOT/active-color"

  sleep 10   # let requests still running on the old version finish
  pm2 delete "$OLD_NAME" >/dev/null 2>&1 || true
  ls -1dt "$APP_ROOT"/releases/*/ 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -rf
  pm2 save >/dev/null
  echo "Deployed $BRANCH @ $COMMIT → https://$DOMAIN"
}

main "$@"
exit $?
