#!/usr/bin/env bash
# Install/build Gulf-Premium-Telecom stack from repo root (no root required).
# Run on the server after: git clone / git pull
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== platform/api =="
cd "$ROOT/platform/api"
if [[ -f package-lock.json ]]; then npm ci --omit=dev; else npm install --omit=dev; fi

echo "== platform/web-next =="
cd "$ROOT/platform/web-next"
if [[ -f package-lock.json ]]; then npm ci; else npm install; fi
if [[ ! -f .env.local ]] && [[ ! -f .env.production ]]; then
  echo "Creating .env.local (proxy mode — no NEXT_PUBLIC_API_URL; tablet uses /api/platform)"
  echo 'API_INTERNAL_URL=http://127.0.0.1:3010' > .env.local
fi
npm run build

echo ""
echo "Done. Next on this server:"
echo "  1. cp platform/api/.env.example platform/api/.env  # set MYSQL_*, JWT_SECRET, INTERNAL_API_KEY"
echo "  2. mysql ... < platform/sql/mysql_schema.sql  # + migrations 003-008 if upgrading"
echo "  3. cd platform/api && npm run seed -- admin 'SecurePassword'"
echo "  4. npm i -g pm2 && pm2 start $ROOT/ecosystem.config.js && pm2 save"
echo "  5. Configure Asterisk + POST /api/config/sync or outbox poller — see docs/DEPLOYMENT_AND_OPERATIONS.md"
