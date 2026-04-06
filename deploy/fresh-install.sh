#!/usr/bin/env bash
#
# Fresh deploy — Gulf-Premium-Telecom stack (Fastify + Next + PM2)
#
# Run on Ubuntu VPS as root (or sudo). Requires: git, curl, mysql-server, node 18+.
#
#   cd /opt && git clone <repo> telecom && cd telecom
#   bash deploy/fresh-install.sh
#
# Environment (optional):
#   INSTALL_ROOT=/opt/telecom       # default if already in repo
#   MYSQL_DATABASE=iprn
#   MYSQL_APP_USER=iprn_app
#   MYSQL_APP_PASSWORD=yourpass     # random if unset
#   ADMIN_PASS=admin123
#   GIT_BRANCH=cursor/...           # branch to checkout
#
set -euo pipefail

RED='\033[0;31m'; GRN='\033[0;32m'; NC='\033[0m'

if [[ "${EUID:-0}" -ne 0 ]]; then
  echo -e "${RED}Run as root: sudo bash deploy/fresh-install.sh${NC}"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
INSTALL_ROOT="${INSTALL_ROOT:-$ROOT}"
cd "$INSTALL_ROOT"

if [[ -n "${GIT_BRANCH:-}" ]]; then
  git fetch origin "$GIT_BRANCH" 2>/dev/null || true
  git checkout "$GIT_BRANCH" 2>/dev/null || true
  git pull origin "$GIT_BRANCH" 2>/dev/null || git pull || true
fi

DB_NAME="${MYSQL_DATABASE:-iprn}"
DB_USER="${MYSQL_APP_USER:-iprn_app}"
DB_PASS="${MYSQL_APP_PASSWORD:-$(openssl rand -base64 18 | tr -d '/+=' | head -c 20)}"
ADMIN_PASS="${ADMIN_PASS:-admin123}"

echo -e "${GRN}== [1/8] Node + PM2${NC}"
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
command -v pm2 &>/dev/null || npm install -g pm2

echo -e "${GRN}== [2/8] MySQL database + app user${NC}"
if ! command -v mysql &>/dev/null; then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y mysql-server
fi
MYSQL_CLI=(mysql)
if ! mysql -e "SELECT 1" &>/dev/null; then
  MYSQL_CLI=(sudo mysql)
fi
"${MYSQL_CLI[@]}" <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL

echo -e "${GRN}== [3/8] Schema${NC}"
mysql -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" < "$INSTALL_ROOT/platform/sql/mysql_schema.sql"

echo -e "${GRN}== [4/8] API .env${NC}"
API_ENV="$INSTALL_ROOT/platform/api/.env"
JWT_SECRET="$(openssl rand -hex 32)"
INTERNAL_KEY="$(openssl rand -hex 24)"
if [[ -f "$API_ENV" ]]; then
  cp "$API_ENV" "${API_ENV}.bak.$(date +%s)"
fi
cp "$INSTALL_ROOT/platform/api/.env.example" "$API_ENV"
sed -i "s/^MYSQL_USER=.*/MYSQL_USER=${DB_USER}/" "$API_ENV"
sed -i "s/^MYSQL_PASSWORD=.*/MYSQL_PASSWORD=${DB_PASS}/" "$API_ENV"
sed -i "s/^MYSQL_DATABASE=.*/MYSQL_DATABASE=${DB_NAME}/" "$API_ENV"
sed -i "s/^JWT_SECRET=.*/JWT_SECRET=${JWT_SECRET}/" "$API_ENV"
sed -i "s/^INTERNAL_API_KEY=.*/INTERNAL_API_KEY=${INTERNAL_KEY}/" "$API_ENV"

echo -e "${GRN}== [5/8] npm install API + Web${NC}"
cd "$INSTALL_ROOT/platform/api"
npm ci --omit=dev
cd "$INSTALL_ROOT/platform/web-next"
npm ci

echo -e "${GRN}== [6/8] Web .env (proxy mode)${NC}"
WEB_ENV="$INSTALL_ROOT/platform/web-next/.env.local"
echo "API_INTERNAL_URL=http://127.0.0.1:3010" > "$WEB_ENV"
# Do NOT set NEXT_PUBLIC_API_URL — tablet uses /api/platform

echo -e "${GRN}== [7/8] Seed admin + build${NC}"
cd "$INSTALL_ROOT/platform/api"
npm run seed -- admin "$ADMIN_PASS" 2>/dev/null || npm run seed -- admin "$ADMIN_PASS" --reset

cd "$INSTALL_ROOT/platform/web-next"
npm run build

echo -e "${GRN}== [8/8] PM2 — stop old stack, start fresh${NC}"
pm2 delete iprn-api iprn-backend iprn-web iprn-ami iprn-billing iprn-config-sync 2>/dev/null || true
ECO="$INSTALL_ROOT/ecosystem.config.js"
[[ -f "$ECO" ]] || ECO="$INSTALL_ROOT/deploy/ecosystem.config.cjs"
pm2 start "$ECO"
pm2 save

PUB_IP="$(curl -fsSL -4 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"

echo ""
echo -e "${GRN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GRN}FRESH DEPLOY COMPLETE${NC}"
echo ""
echo "  Dashboard:  http://${PUB_IP}:3001/login"
echo "  Admin user: admin"
echo "  Password:   ${ADMIN_PASS}"
echo ""
echo "  MySQL DB:   ${DB_NAME}"
echo "  MySQL user: ${DB_USER}"
echo "  MySQL pass: ${DB_PASS}"
echo "  INTERNAL_API_KEY (Asterisk / ingest): ${INTERNAL_KEY}"
echo ""
echo "  Saved API env: $API_ENV"
echo -e "${GRN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Firewall: ufw allow 22/tcp && ufw allow 3001/tcp && ufw allow 3010/tcp && ufw enable"
echo "Change admin password after first login."
