#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="/opt/iprn-platform"
REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

echo "=== IPRN Telecom Platform — Production Deploy ==="

# 1. MySQL
echo "--- Database ---"
if command -v mysql &>/dev/null; then
    sudo mysql -e "CREATE DATABASE IF NOT EXISTS iprn CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null || true
    sudo mysql -e "CREATE USER IF NOT EXISTS 'iprn'@'localhost' IDENTIFIED BY '${MYSQL_PASSWORD:-iprn_secret}';" 2>/dev/null || true
    sudo mysql -e "GRANT ALL ON iprn.* TO 'iprn'@'localhost'; FLUSH PRIVILEGES;" 2>/dev/null || true
    sudo mysql iprn < "${REPO_DIR}/packages/database/schema.sql" 2>/dev/null || echo "Schema already applied"
fi

# 2. Copy to deploy dir
echo "--- Deploy files ---"
sudo mkdir -p "$DEPLOY_DIR"
sudo rsync -a --exclude='node_modules' --exclude='.git' "${REPO_DIR}/" "${DEPLOY_DIR}/"
sudo chown -R iprn:iprn "$DEPLOY_DIR" 2>/dev/null || true

# 3. Install deps
echo "--- Dependencies ---"
cd "${DEPLOY_DIR}/packages/database" && npm ci --omit=dev 2>/dev/null || npm install --omit=dev
cd "${DEPLOY_DIR}/packages/auth" && npm ci --omit=dev 2>/dev/null || npm install --omit=dev
cd "${DEPLOY_DIR}/apps/api-server" && npm ci --omit=dev 2>/dev/null || npm install --omit=dev
cd "${DEPLOY_DIR}/apps/worker-engine" && npm ci --omit=dev 2>/dev/null || npm install --omit=dev
cd "${DEPLOY_DIR}/web" && npm ci 2>/dev/null || npm install

# 4. Seed admin
echo "--- Seed admin ---"
cd "${DEPLOY_DIR}/apps/api-server"
node src/seed.js admin "${ADMIN_PASS:-admin123}" 2>/dev/null || echo "Admin exists"

# 5. Asterisk configs
echo "--- Asterisk ---"
if [ -d /etc/asterisk ]; then
    sudo mkdir -p /etc/asterisk/pjsip.d /etc/asterisk/extensions.d
    sudo cp "${DEPLOY_DIR}/asterisk/pjsip-inbound.conf" /etc/asterisk/pjsip.conf
    sudo cp "${DEPLOY_DIR}/asterisk/extensions-inbound.conf" /etc/asterisk/extensions.conf
    sudo cp "${DEPLOY_DIR}/asterisk/func_odbc-inbound.conf" /etc/asterisk/func_odbc.conf
    sudo touch /etc/asterisk/pjsip.d/empty.conf /etc/asterisk/extensions.d/empty.conf
    sudo mkdir -p /var/spool/asterisk/recording
fi

# 6. Systemd services
echo "--- Services ---"
sudo cp "${DEPLOY_DIR}/infrastructure/systemd/iprn-api.service" /etc/systemd/system/ 2>/dev/null || true
sudo cp "${DEPLOY_DIR}/infrastructure/systemd/iprn-worker.service" /etc/systemd/system/ 2>/dev/null || true

# 7. Nginx
if [ -d /etc/nginx/sites-available ]; then
    sudo cp "${DEPLOY_DIR}/infrastructure/nginx/iprn-platform.conf" /etc/nginx/sites-available/
    sudo ln -sf /etc/nginx/sites-available/iprn-platform.conf /etc/nginx/sites-enabled/ 2>/dev/null || true
fi

echo ""
echo "=== Deploy Complete ==="
echo "  API:      http://0.0.0.0:3010"
echo "  Frontend: http://0.0.0.0:3001"
echo "  Start:    sudo systemctl start iprn-api iprn-worker"
