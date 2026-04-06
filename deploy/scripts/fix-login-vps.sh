#!/usr/bin/env bash
# One-shot: fix common "admin login" issues on VPS. Run as root.
# Usage: bash fix-login-vps.sh
set -euo pipefail
ROOT="${ROOT:-/opt/telecom}"
API="$ROOT/platform/api"
WEB="$ROOT/platform/web-next"

echo "=== [1] Stop duplicate API on port 3010 (keep iprn-backend only) ==="
for name in iprn-api api; do
  if pm2 describe "$name" &>/dev/null; then
    echo "Deleting pm2 app: $name"
    pm2 delete "$name" || true
  fi
done

echo "=== [2] Ensure iprn-backend exists ==="
cd "$ROOT"
if pm2 describe iprn-backend &>/dev/null; then
  pm2 restart iprn-backend
elif [[ -f "$ROOT/ecosystem.config.js" ]]; then
  pm2 start "$ROOT/ecosystem.config.js" --only iprn-backend
elif [[ -f "$ROOT/deploy/ecosystem.config.cjs" ]]; then
  pm2 start "$ROOT/deploy/ecosystem.config.cjs" --only iprn-backend
else
  echo "No ecosystem file; start manually: cd $API && pm2 start src/server.js --name iprn-backend"
fi
sleep 2

echo "=== [3] API health + DB ==="
curl -sS "http://127.0.0.1:3010/health" || echo "curl failed — nothing on 3010?"
echo ""

echo "=== [4] Remove bad NEXT_PUBLIC from web .env (tablet 127.0.0.1 bug) ==="
if [[ -f "$WEB/.env.local" ]]; then
  if grep -q 'NEXT_PUBLIC_API_URL=http://127.0.0.1' "$WEB/.env.local" 2>/dev/null; then
    sed -i '/NEXT_PUBLIC_API_URL=http:\/\/127.0.0.1/d' "$WEB/.env.local"
    echo "Removed NEXT_PUBLIC_API_URL=127.0.0.1 from .env.local"
  fi
fi

echo "=== [5] Rebuild Next + restart iprn-web ==="
cd "$WEB"
export API_INTERNAL_URL="${API_INTERNAL_URL:-http://127.0.0.1:3010}"
npm run build
if pm2 describe iprn-web &>/dev/null; then pm2 restart iprn-web
elif [[ -f "$ROOT/ecosystem.config.js" ]]; then pm2 start "$ROOT/ecosystem.config.js" --only iprn-web
elif [[ -f "$ROOT/deploy/ecosystem.config.cjs" ]]; then pm2 start "$ROOT/deploy/ecosystem.config.cjs" --only iprn-web
fi
sleep 2

echo "=== [6] Reset admin password (change admin123 after) ==="
cd "$API"
npm run seed -- admin 'admin123' --reset || npm run seed -- admin 'admin123'

echo "=== [7] Test login (must see token in JSON) ==="
echo "--- Direct API ---"
curl -sS -X POST http://127.0.0.1:3010/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' | head -c 200
echo ""
echo "--- Via Next proxy ---"
curl -sS -X POST http://127.0.0.1:3001/api/platform/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' | head -c 200
echo ""
pm2 save
echo ""
echo "Done. On tablet: http://YOUR_IP:3001/login  admin / admin123"
echo "If step 7 shows 401: user missing — import schema: mysql ... < platform/sql/mysql_schema.sql"
