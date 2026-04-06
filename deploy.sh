#!/bin/bash
# ============================================
# Asterisk IPRN — full production deploy
# - Legacy dashboard :3000 (systemd)
# - Platform stack   :3010 API + :3001 Next (PM2) — Fastify + MySQL
# Run from repository root: sudo bash deploy.sh
# ============================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

INSTALL_DIR="/opt/asterisk-dashboard"
SERVICE_NAME="asterisk-dashboard"
VPS_IP="${VPS_IP:-167.172.170.88}"

# Platform (set SKIP_PLATFORM=1 to deploy only legacy dashboard)
SKIP_PLATFORM="${SKIP_PLATFORM:-0}"

# MySQL for platform (override before deploy)
PLATFORM_DB="${PLATFORM_DB:-iprn}"
PLATFORM_DB_USER="${PLATFORM_DB_USER:-iprn_app}"
PLATFORM_ADMIN_PASS="${PLATFORM_ADMIN_PASS:-admin123}"

echo "============================================"
echo "  Asterisk IPRN — Dashboard + Platform"
echo "============================================"
echo ""

if [ "$EUID" -ne 0 ]; then
  echo "ERROR: Run as root: sudo bash deploy.sh"
  exit 1
fi

# ---- NODE.JS ----
if ! command -v node &> /dev/null; then
  echo "[1/10] Installing Node.js 22.x..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
else
  echo "[1/10] Node.js already installed: $(node -v)"
fi

command -v pm2 &>/dev/null || npm install -g pm2

# ---- ASTERISK ----
if ! command -v asterisk &> /dev/null; then
  echo "[2/10] Installing Asterisk..."
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y asterisk
else
  echo "[2/10] Asterisk already installed: $(asterisk -V 2>/dev/null || echo 'unknown')"
fi

# ---- BACKUP ----
echo "[3/10] Backing up existing configs..."
BACKUP_DIR="/etc/asterisk/backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp /etc/asterisk/pjsip.conf "$BACKUP_DIR/" 2>/dev/null || true
cp /etc/asterisk/extensions.conf "$BACKUP_DIR/" 2>/dev/null || true
echo "  Backup: $BACKUP_DIR"

# ---- LEGACY DASHBOARD :3000 ----
echo "[4/10] Copying legacy dashboard to $INSTALL_DIR..."
DB_JSON_LIVE="$INSTALL_DIR/data/db.json"
DB_JSON_SAVE=""
if [ -f "$DB_JSON_LIVE" ]; then
  DB_JSON_SAVE=$(mktemp)
  cp "$DB_JSON_LIVE" "$DB_JSON_SAVE"
  echo "  Saved existing db.json"
fi
mkdir -p "$INSTALL_DIR"
cp -r dashboard/* "$INSTALL_DIR/"
if [ -n "$DB_JSON_SAVE" ] && [ -f "$DB_JSON_SAVE" ]; then
  mkdir -p "$INSTALL_DIR/data"
  cp "$DB_JSON_SAVE" "$INSTALL_DIR/data/db.json"
  rm -f "$DB_JSON_SAVE"
  echo "  Restored db.json"
fi
mkdir -p "$INSTALL_DIR/../asterisk"
cp -r asterisk/* "$INSTALL_DIR/../asterisk/" 2>/dev/null || true

echo "[5/10] npm install (legacy dashboard)..."
if [ -f "$INSTALL_DIR/package.json" ]; then
  if [ -f "$INSTALL_DIR/package-lock.json" ]; then
    (cd "$INSTALL_DIR" && npm ci --omit=dev)
  else
    (cd "$INSTALL_DIR" && npm install --omit=dev)
  fi
fi

mkdir -p /var/lib/asterisk/sounds/custom /var/log/asterisk/cdr-csv /var/spool/asterisk/outgoing

# ---- CREDENTIALS :3000 ----
echo "[6/10] Legacy dashboard credentials..."
if [ -z "$DASH_USER" ]; then
  read -p "  Dashboard username (port 3000) [admin]: " DASH_USER
  DASH_USER=${DASH_USER:-admin}
fi
if [ -z "$DASH_PASS" ]; then
  read -sp "  Dashboard password (port 3000) [admin123]: " DASH_PASS
  echo ""
  DASH_PASS=${DASH_PASS:-admin123}
fi

# ---- SYSTEMD :3000 ----
echo "[7/10] systemd service (legacy dashboard)..."
cat > /etc/systemd/system/${SERVICE_NAME}.service << EOF
[Unit]
Description=Asterisk IPRN Dashboard
After=network.target asterisk.service

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/node ${INSTALL_DIR}/server.js
Restart=on-failure
RestartSec=5
Environment=PORT=3000
Environment=ASTERISK_CONF_DIR=${INSTALL_DIR}/../asterisk
Environment=DASH_USER=${DASH_USER}
Environment=DASH_PASS=${DASH_PASS}

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ${SERVICE_NAME}
systemctl restart ${SERVICE_NAME}

# ---- PLATFORM :3010 + :3001 ----
PLATFORM_API="$SCRIPT_DIR/platform/api"
PLATFORM_WEB="$SCRIPT_DIR/platform/web-next"
ECOSYSTEM="$SCRIPT_DIR/ecosystem.config.js"
[ -f "$ECOSYSTEM" ] || ECOSYSTEM="$SCRIPT_DIR/deploy/ecosystem.config.cjs"

if [ "$SKIP_PLATFORM" = "1" ] || [ ! -f "$PLATFORM_API/package.json" ]; then
  echo "[8/10] Platform stack: skipped (SKIP_PLATFORM=1 or no platform/)"
else
  echo "[8/10] Platform — MySQL + API + Next + PM2..."

  if ! command -v mysql &> /dev/null; then
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y mysql-server
  fi

  if [ -z "$PLATFORM_DB_PASS" ]; then
    PLATFORM_DB_PASS=$(openssl rand -base64 18 | tr -d '/+=' | head -c 20)
    echo "  Generated PLATFORM_DB_PASS (save this): $PLATFORM_DB_PASS"
  fi

  MYSQL_ADMIN=(mysql)
  if ! mysql -e "SELECT 1" &>/dev/null; then
    MYSQL_ADMIN=(sudo mysql)
  fi

  "${MYSQL_ADMIN[@]}" <<SQL
CREATE DATABASE IF NOT EXISTS \`${PLATFORM_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${PLATFORM_DB_USER}'@'localhost' IDENTIFIED BY '${PLATFORM_DB_PASS}';
ALTER USER '${PLATFORM_DB_USER}'@'localhost' IDENTIFIED BY '${PLATFORM_DB_PASS}';
GRANT ALL PRIVILEGES ON \`${PLATFORM_DB}\`.* TO '${PLATFORM_DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL

  NEED_SCHEMA=0
  if ! mysql -u"$PLATFORM_DB_USER" -p"$PLATFORM_DB_PASS" "$PLATFORM_DB" -e "SELECT 1 FROM users LIMIT 1" &>/dev/null; then
    NEED_SCHEMA=1
  fi
  if [ "$FORCE_PLATFORM_SCHEMA" = "1" ]; then
    NEED_SCHEMA=1
  fi
  if [ "$NEED_SCHEMA" = "1" ]; then
    echo "  Importing platform/sql/mysql_schema.sql..."
    mysql -u"$PLATFORM_DB_USER" -p"$PLATFORM_DB_PASS" "$PLATFORM_DB" < "$SCRIPT_DIR/platform/sql/mysql_schema.sql"
  else
    echo "  Platform DB already has data — skipping full schema import (set FORCE_PLATFORM_SCHEMA=1 to re-import)"
  fi

  API_ENV="$PLATFORM_API/.env"
  if [ ! -f "$API_ENV" ]; then
    JWT_SECRET=$(openssl rand -hex 32)
    INTERNAL_KEY=$(openssl rand -hex 24)
    cp "$PLATFORM_API/.env.example" "$API_ENV"
    sed -i "s/^MYSQL_USER=.*/MYSQL_USER=${PLATFORM_DB_USER}/" "$API_ENV"
    sed -i "s/^MYSQL_PASSWORD=.*/MYSQL_PASSWORD=${PLATFORM_DB_PASS}/" "$API_ENV"
    sed -i "s/^MYSQL_DATABASE=.*/MYSQL_DATABASE=${PLATFORM_DB}/" "$API_ENV"
    sed -i "s/^JWT_SECRET=.*/JWT_SECRET=${JWT_SECRET}/" "$API_ENV"
    sed -i "s/^INTERNAL_API_KEY=.*/INTERNAL_API_KEY=${INTERNAL_KEY}/" "$API_ENV"
    echo "  Created $API_ENV (INTERNAL_API_KEY saved in file)"
  else
    echo "  Keeping existing $API_ENV"
  fi

  (cd "$PLATFORM_API" && npm ci --omit=dev)
  (cd "$PLATFORM_API" && npm run seed -- admin "$PLATFORM_ADMIN_PASS" 2>/dev/null || npm run seed -- admin "$PLATFORM_ADMIN_PASS" --reset)

  echo "API_INTERNAL_URL=http://127.0.0.1:3010" > "$PLATFORM_WEB/.env.local"

  (cd "$PLATFORM_WEB" && npm ci && npm run build)

  pm2 delete iprn-api iprn-backend iprn-web iprn-ami iprn-billing iprn-config-sync 2>/dev/null || true
  pm2 start "$ECOSYSTEM"
  pm2 save
  echo "  PM2 started from $ECOSYSTEM"
fi

# ---- FIREWALL ----
echo "[9/10] Firewall (UFW)..."
if command -v ufw &> /dev/null; then
  ufw allow 22/tcp    2>/dev/null || true
  ufw allow 3000/tcp  2>/dev/null || true
  ufw allow 3001/tcp  2>/dev/null || true
  ufw allow 3010/tcp  2>/dev/null || true
  ufw allow 5060/udp  2>/dev/null || true
  ufw allow 10000:20000/udp 2>/dev/null || true
  ufw --force enable 2>/dev/null || true
  echo "  UFW: 22, 3000, 3001, 3010, SIP/RTP"
else
  echo "  UFW not installed"
fi

# ---- VERIFY ----
echo "[10/10] Verify..."
sleep 2
if systemctl is-active --quiet ${SERVICE_NAME}; then
  LEGACY_STATUS="RUNNING"
else
  LEGACY_STATUS="FAILED — journalctl -u ${SERVICE_NAME} -n 50"
fi

echo ""
echo "============================================"
echo "  Deployment Complete"
echo "============================================"
echo ""
echo "  Legacy dashboard:  http://${VPS_IP}:3000/login"
echo "  Legacy login:      ${DASH_USER} / (password you entered)"
echo "  Legacy status:     ${LEGACY_STATUS}"
echo ""
if [ "$SKIP_PLATFORM" != "1" ] && [ -f "$PLATFORM_API/package.json" ]; then
  echo "  Platform UI:       http://${VPS_IP}:3001/login"
  echo "  Platform admin:    admin / ${PLATFORM_ADMIN_PASS}"
  echo "  API (internal):    http://127.0.0.1:3010  (also :3010 if firewall open)"
  echo "  Tablet: use :3001 — login uses /api/platform proxy (no 127.0.0.1 in browser)"
  echo "  Diagnostics:       http://${VPS_IP}:3001/status"
  echo ""
  echo "  PM2:  pm2 status | pm2 logs iprn-backend"
fi
echo ""
echo "  Service (legacy):   systemctl restart ${SERVICE_NAME}"
echo "  Data (legacy):      ${INSTALL_DIR}/data/db.json"
echo "============================================"
