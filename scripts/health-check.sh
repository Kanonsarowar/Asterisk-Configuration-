#!/bin/bash

# Health check script for Asterisk Grafana Monitoring
# Monitors all services and reports status

REMOTE_HOST="${1:-localhost}"
REMOTE_USER="${2:-root}"
REMOTE_PATH="/opt/asterisk-monitoring"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Asterisk Monitoring - Health Check${NC}"
echo "====================================="
echo ""

# Check Grafana
echo -n "Grafana: "
if curl -s "http://$REMOTE_HOST:3000/api/health" > /dev/null; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${RED}✗ DOWN${NC}"
fi

# Check Prometheus
echo -n "Prometheus: "
if curl -s "http://$REMOTE_HOST:9090/-/healthy" > /dev/null; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${RED}✗ DOWN${NC}"
fi

# Check Asterisk Exporter
echo -n "Asterisk Exporter: "
if curl -s "http://$REMOTE_HOST:9487/metrics" > /dev/null; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${RED}✗ DOWN${NC}"
fi

# Container status
echo ""
echo "Container Status:"
ssh "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_PATH && docker-compose ps"

# System resources
echo ""
echo "System Resources:"
ssh "$REMOTE_USER@$REMOTE_HOST" "free -h && echo '' && df -h"
