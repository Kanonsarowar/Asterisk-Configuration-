#!/usr/bin/env bash
set -euo pipefail

# Full project deployer for Asterisk-Configuration-
# - Installs/updates Dashboard (port 3000)
# - Optionally installs/updates Platform API + SPA (port 3010)
# - Prepares Asterisk runtime directories and systemd services

if [[ ${EUID} -ne 0 ]]; then
  echo "ERROR: run as root: sudo bash deploy.sh"
  exit 1
fi

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DASH_SRC="${REPO_DIR}/dashboard"
PLATFORM_SRC="${REPO_DIR}/platform/api"
ASTERISK_SRC="${REPO_DIR}/asterisk"

DASH_DIR="/opt/asterisk-dashboard"
PLATFORM_DIR="/opt/iprn-platform-api"
SERVICE_DASH="asterisk-dashboard"
SERVICE_PLATFORM="iprn-platform-api"

DASH_USER="${DASH_USER:-admin}"
DASH_PASS="${DASH_PASS:-admin123}"
DASH_PORT="${DASH_PORT:-3000}"
INSTALL_PLATFORM="${INSTALL_PLATFORM:-yes}"
PLATFORM_PORT="${PLATFORM_PORT:-3010}"

echo "[1/10] Install base packages"
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y curl ca-certificates gnupg lsb-release ufw postgresql postgresql-contrib

echo "[2/10] Install Asterisk (package or keep existing source build)"
if command -v asterisk >/dev/null 2>&1; then
  echo "Asterisk already present: $(asterisk -V 2>/dev/null || echo 'unknown version')"
else
  if apt-cache policy asterisk 2>/dev/null | grep -q Candidate:; then
    CANDIDATE=$(apt-cache policy asterisk | awk '/Candidate:/ {print $2; exit}')
    if [[ "$CANDIDATE" != "(none)" ]]; then
      DEBIAN_FRONTEND=noninteractive apt-get install -y asterisk || echo "WARNING: apt asterisk install failed; continuing"
    else
      echo "WARNING: Package 'asterisk' has no installation candidate on this OS. Continuing without apt install."
    fi
  else
    echo "WARNING: Could not query apt candidate for asterisk. Continuing."
  fi
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[3/10] Install Node.js 22.x"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
else
  echo "[3/10] Node already installed: $(node -v)"
fi

echo "[4/10] Backup existing Asterisk config"
BACKUP_DIR="/etc/asterisk/backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp /etc/asterisk/pjsip.conf "$BACKUP_DIR/" 2>/dev/null || true
cp /etc/asterisk/extensions.conf "$BACKUP_DIR/" 2>/dev/null || true
cp /etc/asterisk/acl.conf "$BACKUP_DIR/" 2>/dev/null || true

echo "[5/10] Deploy dashboard source"
DB_JSON_TMP=""
if [[ -f "${DASH_DIR}/data/db.json" ]]; then
  DB_JSON_TMP="$(mktemp)"
  cp "${DASH_DIR}/data/db.json" "$DB_JSON_TMP"
fi

mkdir -p "$DASH_DIR"
cp -a "${DASH_SRC}/." "$DASH_DIR/"
if [[ -n "$DB_JSON_TMP" && -f "$DB_JSON_TMP" ]]; then
  mkdir -p "${DASH_DIR}/data"
  cp "$DB_JSON_TMP" "${DASH_DIR}/data/db.json"
  rm -f "$DB_JSON_TMP"
fi

if [[ -f "${DASH_DIR}/package-lock.json" ]]; then
  (cd "$DASH_DIR" && npm ci --omit=dev)
else
  (cd "$DASH_DIR" && npm install --omit=dev)
fi

echo "[6/10] Create dashboard service"
cat > "/etc/systemd/system/${SERVICE_DASH}.service" <<UNIT
[Unit]
Description=Asterisk Dashboard
After=network.target asterisk.service

[Service]
Type=simple
User=root
WorkingDirectory=${DASH_DIR}
ExecStart=/usr/bin/node ${DASH_DIR}/server.js
Restart=on-failure
RestartSec=5
Environment=PORT=${DASH_PORT}
Environment=DASH_USER=${DASH_USER}
Environment=DASH_PASS=${DASH_PASS}

[Install]
WantedBy=multi-user.target
UNIT

if [[ "${INSTALL_PLATFORM}" == "yes" ]]; then
  echo "[7/10] Deploy platform API"
  mkdir -p "$PLATFORM_DIR"
  cp -a "${PLATFORM_SRC}/." "$PLATFORM_DIR/"

  if [[ -f "${PLATFORM_DIR}/package-lock.json" ]]; then
    (cd "$PLATFORM_DIR" && npm ci --omit=dev)
  else
    (cd "$PLATFORM_DIR" && npm install --omit=dev)
  fi

  if [[ ! -f "${PLATFORM_DIR}/.env" ]]; then
    cp "${PLATFORM_DIR}/.env.example" "${PLATFORM_DIR}/.env"
  fi

  sed -i "s/^PORT=.*/PORT=${PLATFORM_PORT}/" "${PLATFORM_DIR}/.env" 2>/dev/null || true

  cat > "/etc/systemd/system/${SERVICE_PLATFORM}.service" <<UNIT
[Unit]
Description=IPRN Platform API
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=${PLATFORM_DIR}
ExecStart=/usr/bin/node ${PLATFORM_DIR}/src/server.js
Restart=on-failure
RestartSec=5
Environment=PORT=${PLATFORM_PORT}

[Install]
WantedBy=multi-user.target
UNIT
fi

echo "[8/10] Sync repository Asterisk templates"
mkdir -p /opt/asterisk
cp -a "${ASTERISK_SRC}/." /opt/asterisk/
mkdir -p /var/lib/asterisk/sounds/custom /var/log/asterisk/cdr-csv /var/spool/asterisk/outgoing

echo "[9/10] Start services"
systemctl daemon-reload
systemctl enable "$SERVICE_DASH"
systemctl restart "$SERVICE_DASH"

if [[ "${INSTALL_PLATFORM}" == "yes" ]]; then
  systemctl enable "$SERVICE_PLATFORM"
  systemctl restart "$SERVICE_PLATFORM"
fi
if systemctl list-unit-files | grep -q "^asterisk.service"; then
  systemctl enable asterisk || true
  systemctl restart asterisk || true
else
  echo "WARNING: asterisk.service not found (common on source-based installs)."
fi

echo "[10/10] Firewall rules"
ufw allow 22/tcp || true
ufw allow ${DASH_PORT}/tcp || true
if [[ "${INSTALL_PLATFORM}" == "yes" ]]; then
  ufw allow ${PLATFORM_PORT}/tcp || true
fi
ufw allow 5060/udp || true
ufw allow 10000:20000/udp || true
ufw --force enable || true

echo ""
echo "Deployment complete."
echo "Dashboard: http://<server-ip>:${DASH_PORT} (user: ${DASH_USER})"
if [[ "${INSTALL_PLATFORM}" == "yes" ]]; then
  echo "Platform:  http://<server-ip>:${PLATFORM_PORT}"
fi
echo "Asterisk templates copied to: /opt/asterisk"
echo "Asterisk live config directory: /etc/asterisk"
echo ""
echo "Useful checks:"
echo "  systemctl status ${SERVICE_DASH}"
[[ "${INSTALL_PLATFORM}" == "yes" ]] && echo "  systemctl status ${SERVICE_PLATFORM}"
echo "  systemctl status asterisk"
echo "  bash ${REPO_DIR}/check-setup.sh"
