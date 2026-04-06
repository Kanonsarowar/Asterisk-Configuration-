#!/usr/bin/env bash
# Run on VPS as root. Diagnoses Fastify login + Next proxy.
set -e
API_DIR="${1:-/opt/telecom/platform/api}"
WEB_URL="${2:-http://127.0.0.1:3001}"

echo "=== 1) Who listens on 3010? ==="
ss -tlnp | grep 3010 || true

echo ""
echo "=== 2) Direct API POST /login (expect 200 + token JSON) ==="
curl -sS -w "\nHTTP %{http_code}\n" -X POST http://127.0.0.1:3010/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' | head -20

echo ""
echo "=== 3) Via Next proxy (same as tablet when using /api/platform) ==="
curl -sS -w "\nHTTP %{http_code}\n" -X POST "$WEB_URL/api/platform/login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' | head -20

echo ""
echo "=== 4) MySQL: admin row? ==="
cd "$API_DIR"
set -a
[[ -f .env ]] && source .env
set +a
mysql -h"${MYSQL_HOST:-127.0.0.1}" -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" \
  -e "SELECT id, username, role, status, LEFT(password_hash,20) AS hash_prefix FROM users WHERE username='admin';" 2>&1 || echo "(mysql failed — fix .env credentials)"

echo ""
echo "If (2) is 401: wrong password — run: cd $API_DIR && npm run seed -- admin 'admin123' --reset"
echo "If (2) fails to connect: only ONE app on 3010 — pm2 delete iprn-api OR fix duplicate"
echo "If (3) fails but (2) works: restart iprn-web, check API_INTERNAL_URL"
