#!/bin/bash

# Deploy script for Asterisk Grafana Monitoring
# Usage: ./deploy.sh <remote_host> <remote_user>

set -e

REMOTE_HOST="${1:-localhost}"
REMOTE_USER="${2:-root}"
REMOTE_PATH="/opt/asterisk-monitoring"
LOCAL_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/.."

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Deploying Asterisk Grafana Monitoring to $REMOTE_HOST${NC}"
echo "======================================================="
echo ""

# Check SSH connection
echo -n "[1/5] Checking SSH connection... "
if ssh -o ConnectTimeout=5 "$REMOTE_USER@$REMOTE_HOST" "echo 'OK'" > /dev/null; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗ Failed to connect to $REMOTE_HOST${NC}"
    exit 1
fi

# Create remote directory
echo -n "[2/5] Creating remote directory... "
ssh "$REMOTE_USER@$REMOTE_HOST" "mkdir -p $REMOTE_PATH"
echo -e "${GREEN}✓${NC}"

# Copy files to remote
echo -n "[3/5] Copying files to remote... "
rsync -avz --delete "$LOCAL_PATH/" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/" \
  --exclude '.git' \
  --exclude '.gitignore' \
  --exclude 'README.md' \
  --exclude 'node_modules' > /dev/null
echo -e "${GREEN}✓${NC}"

# Deploy with docker-compose
echo -n "[4/5] Deploying containers... "
ssh "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_PATH && docker-compose down 2>/dev/null || true && docker-compose up -d" > /dev/null 2>&1
echo -e "${GREEN}✓${NC}"

# Wait for services to start
echo -n "[5/5] Waiting for services to start... "
sleep 10
echo -e "${GREEN}✓${NC}"

echo ""
echo -e "${GREEN}Deployment completed successfully!${NC}"
echo ""
echo "Access your dashboard:"
echo "  Grafana:    http://$REMOTE_HOST:3000 (admin/admin)"
echo "  Prometheus: http://$REMOTE_HOST:9090"
echo ""
echo "Run health checks:"
echo "  ./scripts/health-check.sh $REMOTE_HOST $REMOTE_USER"
