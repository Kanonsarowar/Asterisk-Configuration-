#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Telecom IPRN Platform — Production Deployment Script
# Deploys: MySQL schema, Fastify API, React frontend, Asterisk configs
# Target: Ubuntu 22.04+ with Node.js 22+, MySQL 8+, Asterisk 22+
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=== Telecom IPRN Platform Deployment ==="

# ------ 1. MySQL setup ------
echo ""
echo "--- MySQL Database ---"
if command -v mysql &>/dev/null; then
    MYSQL_USER="${MYSQL_USER:-iprn}"
    MYSQL_PASSWORD="${MYSQL_PASSWORD:-secret}"
    MYSQL_DATABASE="${MYSQL_DATABASE:-iprn}"
    MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"

    echo "Creating database ${MYSQL_DATABASE} if needed..."
    mysql -u root -e "CREATE DATABASE IF NOT EXISTS ${MYSQL_DATABASE} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null || true
    mysql -u root -e "CREATE USER IF NOT EXISTS '${MYSQL_USER}'@'%' IDENTIFIED BY '${MYSQL_PASSWORD}';" 2>/dev/null || true
    mysql -u root -e "GRANT ALL PRIVILEGES ON ${MYSQL_DATABASE}.* TO '${MYSQL_USER}'@'%'; FLUSH PRIVILEGES;" 2>/dev/null || true

    echo "Running migrations..."
    cd "${SCRIPT_DIR}/api"
    MYSQL_HOST="${MYSQL_HOST}" MYSQL_USER="${MYSQL_USER}" MYSQL_PASSWORD="${MYSQL_PASSWORD}" MYSQL_DATABASE="${MYSQL_DATABASE}" \
        node "${SCRIPT_DIR}/scripts/run-migrations.js"
else
    echo "WARNING: mysql client not found, skipping DB setup"
fi

# ------ 2. API dependencies ------
echo ""
echo "--- Platform API ---"
cd "${SCRIPT_DIR}/api"
npm ci --omit=dev 2>/dev/null || npm install --omit=dev
echo "API dependencies installed."

# ------ 3. React frontend build ------
echo ""
echo "--- React Frontend ---"
cd "${SCRIPT_DIR}/web"
if [ -f "package.json" ]; then
    npm install
    npm run build 2>/dev/null || echo "Build skipped (dev mode)"
    echo "Frontend ready."
fi

# ------ 4. Asterisk config deployment ------
echo ""
echo "--- Asterisk Configuration ---"
ASTERISK_CONF="/etc/asterisk"
if [ -d "$ASTERISK_CONF" ]; then
    sudo mkdir -p "${ASTERISK_CONF}/pjsip.d" "${ASTERISK_CONF}/extensions.d"

    sudo cp "${SCRIPT_DIR}/asterisk/pjsip-platform.conf" "${ASTERISK_CONF}/pjsip.conf"
    sudo cp "${SCRIPT_DIR}/asterisk/extensions-platform.conf" "${ASTERISK_CONF}/extensions.conf"
    sudo cp "${SCRIPT_DIR}/asterisk/queues-platform.conf" "${ASTERISK_CONF}/queues.conf"
    sudo cp "${SCRIPT_DIR}/asterisk/voicemail-platform.conf" "${ASTERISK_CONF}/voicemail.conf"
    sudo cp "${SCRIPT_DIR}/asterisk/rtp-platform.conf" "${ASTERISK_CONF}/rtp.conf"

    sudo mkdir -p /var/spool/asterisk/recording
    sudo chown asterisk:asterisk /var/spool/asterisk/recording 2>/dev/null || true

    echo "Asterisk configs deployed to ${ASTERISK_CONF}"

    if pgrep asterisk &>/dev/null; then
        sudo asterisk -rx "dialplan reload" 2>/dev/null || true
        echo "Asterisk dialplan reloaded."
    fi
else
    echo "WARNING: ${ASTERISK_CONF} not found, skipping Asterisk config deployment"
fi

# ------ 5. Seed admin user ------
echo ""
echo "--- Admin Seed ---"
cd "${SCRIPT_DIR}/api"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASS="${ADMIN_PASS:-admin123}"
if [ -n "${MYSQL_DATABASE:-}" ]; then
    JWT_SECRET="${JWT_SECRET:-telecom-platform-secret}" \
    MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}" \
    MYSQL_USER="${MYSQL_USER:-iprn}" \
    MYSQL_PASSWORD="${MYSQL_PASSWORD:-secret}" \
    MYSQL_DATABASE="${MYSQL_DATABASE:-iprn}" \
        node scripts/seed-admin.js "$ADMIN_USER" "$ADMIN_PASS" 2>/dev/null || echo "Admin user may already exist"
fi

echo ""
echo "=== Deployment Complete ==="
echo "  API:      http://0.0.0.0:3010"
echo "  Frontend: http://0.0.0.0:3001"
echo "  Login:    ${ADMIN_USER} / ${ADMIN_PASS}"
echo ""
echo "Start services:"
echo "  cd platform/api && npm start    # API on :3010"
echo "  cd platform/web && npm run dev  # Frontend on :3001"
