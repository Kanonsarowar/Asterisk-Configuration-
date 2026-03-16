#!/bin/bash
# ============================================
# Asterisk Dashboard - VPS Deployment Script
# Target: 167.172.170.88
# ============================================
set -e

INSTALL_DIR="/opt/asterisk-dashboard"
SERVICE_NAME="asterisk-dashboard"

echo "============================================"
echo "  Asterisk Dashboard Deployment"
echo "  Target VPS: 167.172.170.88"
echo "============================================"
echo ""

# Check root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root: sudo bash deploy.sh"
  exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "Installing Node.js 22.x..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

NODE_VERSION=$(node -v)
echo "Node.js version: $NODE_VERSION"

# Check Asterisk
if ! command -v asterisk &> /dev/null; then
  echo "ERROR: Asterisk is not installed."
  echo "Please install Asterisk first: sudo apt-get install asterisk"
  exit 1
fi

ASTERISK_VERSION=$(asterisk -V 2>/dev/null || echo "unknown")
echo "Asterisk version: $ASTERISK_VERSION"

# Backup existing Asterisk configs
echo ""
echo "Backing up existing Asterisk configs..."
BACKUP_DIR="/etc/asterisk/backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp /etc/asterisk/pjsip.conf "$BACKUP_DIR/" 2>/dev/null || true
cp /etc/asterisk/extensions.conf "$BACKUP_DIR/" 2>/dev/null || true
echo "Backup saved to: $BACKUP_DIR"

# Install project
echo ""
echo "Installing to $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"

# Copy project files
cp -r dashboard/* "$INSTALL_DIR/"
mkdir -p "$INSTALL_DIR/../asterisk"
cp -r asterisk/* "$INSTALL_DIR/../asterisk/" 2>/dev/null || true

# Create IVR sound directories
mkdir -p /var/lib/asterisk/sounds/custom

# Create systemd service
echo ""
echo "Creating systemd service..."
cat > /etc/systemd/system/${SERVICE_NAME}.service << EOF
[Unit]
Description=Asterisk PBX Dashboard
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

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
systemctl daemon-reload
systemctl enable ${SERVICE_NAME}
systemctl restart ${SERVICE_NAME}

echo ""
echo "============================================"
echo "  Deployment Complete!"
echo "============================================"
echo ""
echo "  Dashboard URL:  http://167.172.170.88:3000"
echo "  Service:        systemctl status ${SERVICE_NAME}"
echo "  Logs:           journalctl -u ${SERVICE_NAME} -f"
echo ""
echo "  NEXT STEPS:"
echo "  1. Open http://167.172.170.88:3000 in your browser"
echo "  2. Go to Trunk Config and set your real Supplier IP"
echo "  3. Update DID routes with your actual DID numbers"
echo "  4. Upload IVR audio files to /var/lib/asterisk/sounds/custom/"
echo "  5. Click 'Apply Changes' to deploy to Asterisk"
echo ""
echo "  FIREWALL: Make sure port 3000 is open:"
echo "    ufw allow 3000/tcp"
echo "============================================"
