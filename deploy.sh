#!/usr/bin/env bash
# RudrasFarmFresh — deploy shop + admin builds and backend to Hostinger.
# Run from your Mac (Cursor terminal), project root:
#   chmod +x deploy.sh
#   ./deploy.sh
#
# Before first run on server: create backend/.env with APP_ENV=production and PROD_* values
# (or copy .env.example on the server and edit). This script does not upload your local .env.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

SSH_PORT="${SSH_PORT:-65002}"
SSH_USER="${SSH_USER:-u500831783}"
SSH_HOST="${SSH_HOST:-145.223.17.221}"
SSH_TARGET="${SSH_USER}@${SSH_HOST}"
REMOTE_HOME="${REMOTE_HOME:-/home/u500831783}"
APP_DIR="${APP_DIR:-$REMOTE_HOME/apps/rudrafarms}"
WEB_ROOT="${WEB_ROOT:-$REMOTE_HOME/domains/rudrasfarmfresh.in/public_html}"
GIT_REPO="${GIT_REPO:-https://github.com/Naviuidev/rudrafarms.git}"
GIT_BRANCH="${GIT_BRANCH:-main}"

RSYNC_SSH=(ssh -p "$SSH_PORT" -o BatchMode=no)

run_remote() {
  ssh -p "$SSH_PORT" "$SSH_TARGET" "$@"
}

echo "==> Hostinger deploy ($SSH_TARGET)"
echo "    Shop/admin → $WEB_ROOT"
echo "    Backend    → $APP_DIR/backend"
echo

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  echo "==> Building customer (production)…"
  (cd "$ROOT/customer" && npm ci && npm run build)
  echo "==> Building admin (production)…"
  (cd "$ROOT/admin" && npm ci && npm run build)
else
  echo "==> SKIP_BUILD=1 — using existing dist/ folders"
fi

echo "==> Server: clone or update repository…"
run_remote bash -s <<REMOTE
set -euo pipefail
mkdir -p "$(dirname "$APP_DIR")"
if [[ -d "$APP_DIR/.git" ]]; then
  cd "$APP_DIR"
  git fetch origin
  git checkout "$GIT_BRANCH"
  git pull origin "$GIT_BRANCH"
else
  git clone --branch "$GIT_BRANCH" "$GIT_REPO" "$APP_DIR"
fi
REMOTE

echo "==> Server: Composer install…"
run_remote bash -s <<REMOTE
set -euo pipefail
cd "$APP_DIR/backend"
if command -v composer >/dev/null 2>&1; then
  composer install --no-dev --optimize-autoloader
elif [[ -f "\$HOME/composer.phar" ]]; then
  php "\$HOME/composer.phar" install --no-dev --optimize-autoloader
else
  echo "Composer not found. Install it in hPanel or run composer-setup.php on the server."
  exit 1
fi
chmod -R u+rwX storage public/images 2>/dev/null || true
if [[ ! -f .env ]]; then
  echo "WARNING: $APP_DIR/backend/.env is missing. Copy .env.example and set APP_ENV=production and PROD_*."
fi
REMOTE

echo "==> Upload shop (customer/dist)…"
rsync -avz --delete \
  -e "${RSYNC_SSH[*]}" \
  --exclude admin --exclude api \
  "$ROOT/customer/dist/" \
  "$SSH_TARGET:$WEB_ROOT/"

echo "==> Upload control center (admin/dist)…"
rsync -avz --delete \
  -e "${RSYNC_SSH[*]}" \
  "$ROOT/admin/dist/" \
  "$SSH_TARGET:$WEB_ROOT/admin/"

echo "==> Server: API symlink + remove default page…"
run_remote bash -s <<REMOTE
set -euo pipefail
mkdir -p "$WEB_ROOT"
cd "$WEB_ROOT"
rm -f default.php
rm -rf api
ln -sfn "$APP_DIR/backend/public" api
ls -la api
REMOTE

echo
echo "==> Quick checks (from your Mac)…"
curl -fsS -o /dev/null -w "Shop (rudrasfarmfresh.in) HTTP %{http_code}\n" "https://rudrasfarmfresh.in/" || true
curl -fsS -o /dev/null -w "Admin folder (/admin/) HTTP %{http_code}\n" "https://rudrasfarmfresh.in/admin/" || true
curl -fsS -o /dev/null -w "API folder (/api/) HTTP %{http_code}\n" "https://rudrasfarmfresh.in/api/index.php" || true
API_BODY="$(curl -fsS "https://rudrasfarmfresh.in/api/api/auth/config.php" 2>/dev/null | /usr/bin/head -c 200 || true)"
if [[ -n "$API_BODY" ]]; then
  echo "API config: $API_BODY"
else
  echo "API config: no response yet (check backend/.env on server or subdomain DNS)."
fi
curl -fsS -o /dev/null -w "API subdomain HTTP %{http_code}\n" "https://api.rudrasfarmfresh.in/api/auth/config.php" 2>/dev/null || echo "API subdomain: DNS not ready (add api + admin in hPanel)."
curl -fsS -o /dev/null -w "Admin subdomain HTTP %{http_code}\n" "https://admin.rudrasfarmfresh.in/" 2>/dev/null || echo "Admin subdomain: DNS not ready."

echo
echo "Done. If the API fails, set $APP_DIR/backend/.env on the server and confirm"
echo "hPanel document roots: shop → public_html, admin → public_html/admin, api → public_html/api."
