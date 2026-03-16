#!/bin/bash
# ============================================
# Asterisk IPRN Dashboard - Production Deploy
# Target: 167.172.170.88
# ============================================
set -e

INSTALL_DIR="/opt/asterisk-dashboard"
SERVICE_NAME="asterisk-dashboard"
VPS_IP="167.172.170.88"

echo "============================================"
echo "  Asterisk IPRN Dashboard - Production Deploy"
echo "============================================"
echo ""

if [ "$EUID" -ne 0 ]; then
  echo "ERROR: Run as root: sudo bash deploy.sh"
  exit 1
fi

# ---- NODE.JS ----
if ! command -v node &> /dev/null; then
  echo "[1/7] Installing Node.js 22.x..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
else
  echo "[1/7] Node.js already installed: $(node -v)"
fi

# ---- ASTERISK ----
if ! command -v asterisk &> /dev/null; then
  echo "[2/7] Installing Asterisk..."
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y asterisk
else
  echo "[2/7] Asterisk already installed: $(asterisk -V 2>/dev/null || echo 'unknown')"
fi

# ---- BACKUP ----
echo "[3/7] Backing up existing configs..."
BACKUP_DIR="/etc/asterisk/backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp /etc/asterisk/pjsip.conf "$BACKUP_DIR/" 2>/dev/null || true
cp /etc/asterisk/extensions.conf "$BACKUP_DIR/" 2>/dev/null || true
echo "  Backup: $BACKUP_DIR"

# ---- INSTALL ----
echo "[4/7] Installing dashboard to $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"
cp -r dashboard/* "$INSTALL_DIR/"
mkdir -p "$INSTALL_DIR/../asterisk"
cp -r asterisk/* "$INSTALL_DIR/../asterisk/" 2>/dev/null || true

# Directories Asterisk needs
mkdir -p /var/lib/asterisk/sounds/custom
mkdir -p /var/log/asterisk/cdr-csv
mkdir -p /var/spool/asterisk/outgoing

# ---- CREDENTIALS ----
echo "[5/7] Setting up credentials..."
if [ -z "$DASH_USER" ]; then
  read -p "  Dashboard username [admin]: " DASH_USER
  DASH_USER=${DASH_USER:-admin}
fi
if [ -z "$DASH_PASS" ]; then
  read -sp "  Dashboard password [admin123]: " DASH_PASS
  echo ""
  DASH_PASS=${DASH_PASS:-admin123}
fi

# ---- SYSTEMD SERVICE ----
echo "[6/7] Creating systemd service..."
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

# ---- FIREWALL ----
echo "[7/7] Configuring firewall..."
if command -v ufw &> /dev/null; then
  ufw allow 22/tcp    2>/dev/null || true
  ufw allow 3000/tcp  2>/dev/null || true
  ufw allow 5060/udp  2>/dev/null || true
  ufw allow 10000:20000/udp 2>/dev/null || true
  ufw --force enable 2>/dev/null || true
  echo "  UFW rules applied"
else
  echo "  UFW not installed, skipping firewall setup"
fi

# ---- VERIFY ----
sleep 2
if systemctl is-active --quiet ${SERVICE_NAME}; then
  STATUS="RUNNING"
else
  STATUS="FAILED - check: journalctl -u ${SERVICE_NAME} -n 50"
fi

echo ""
echo "============================================"
echo "  Deployment Complete!"
echo "============================================"
echo ""
echo "  Dashboard:  http://${VPS_IP}:3000"
echo "  Login:      ${DASH_USER} / (your password)"
echo "  Status:     ${STATUS}"
echo ""
echo "  Service Commands:"
echo "    systemctl status ${SERVICE_NAME}"
echo "    systemctl restart ${SERVICE_NAME}"
echo "    journalctl -u ${SERVICE_NAME} -f"
echo ""
echo "  NEXT STEPS:"
echo "  1. Login at http://${VPS_IP}:3000"
echo "  2. Go to Suppliers - verify/rename your 8 SIP providers"
echo "  3. Go to Numbers - add your DID number ranges"
echo "  4. Go to DID Routes - route numbers to IVR/ring groups"
echo "  5. Click 'Apply Changes' to deploy to Asterisk"
echo ""
echo "  SECURITY:"
echo "  - Change default password immediately after first login"
echo "  - Set DASH_USER and DASH_PASS env vars in systemd service"
echo "    sudo systemctl edit ${SERVICE_NAME}"
echo ""
echo "  FILES:"
echo "  - Dashboard data: ${INSTALL_DIR}/data/db.json"
echo "  - Asterisk config: /etc/asterisk/"
echo "  - CDR logs: /var/log/asterisk/cdr-csv/Master.csv"
echo "  - Service: /etc/systemd/system/${SERVICE_NAME}.service"
echo "============================================"
