#!/bin/bash

# Rollback script for Asterisk Grafana Monitoring
# Usage: ./rollback.sh <remote_host> <remote_user>

set -e

REMOTE_HOST="${1:-localhost}"
REMOTE_USER="${2:-root}"
REMOTE_PATH="/opt/asterisk-monitoring"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Rolling back Asterisk Grafana Monitoring on $REMOTE_HOST${NC}"
echo "====================================================="
echo ""

echo -n "Stopping containers... "
ssh "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_PATH && docker-compose down"
echo -e "${GREEN}✓${NC}"

echo ""
echo -e "${GREEN}Rollback completed!${NC}"
echo "To redeploy, run: ./scripts/deploy.sh $REMOTE_HOST $REMOTE_USER"
