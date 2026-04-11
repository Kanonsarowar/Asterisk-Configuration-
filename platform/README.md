# Carrier IPRN API — Phase 1 (Fastify + TypeScript)

Separate from `dashboard/server.js`. Listens on **`CARRIER_PORT`** (default **3010**).

## Responses

All JSON APIs use a single envelope:

- **Success:** `{ "success": true, "data": ... }`
- **Error:** `{ "success": false, "error": { "code": "...", "message": "...", "details": {} } }`

- **`GET /health`** — Phase 1 minimal response: `{ "status": "ok" }` (no envelope; suitable for dumb health checks).
- **`GET /ready`** — `{ "success": true, "data": { "status": "ok", "database": "connected"|"disconnected", "databaseError"? } }` when DB is down.
- **`GET /api/live`** — `{ "success": true, "data": [ { "prefix", "calls", "asr", "acd" }, ... ] }` (empty array if `call_logs` is missing or empty).

## Setup

```bash
cd platform
cp .env.example .env
# MYSQL_* required — password must be non-empty
npm install
npm run build
npm start
```

## Verify

```bash
curl -s http://127.0.0.1:3010/health
curl -s http://127.0.0.1:3010/ready
curl -s http://127.0.0.1:3010/api/live
curl -s http://127.0.0.1:3010/api/route/971
```

`.env` is loaded after process start and **overrides empty** `MYSQL_*` from systemd so passwords are not lost.

On first connect, **`routes` → `vendors` foreign key** is applied when possible; orphan `routes.vendor_id` rows are removed first.

## Dev

```bash
npm run dev
```

Node **20+**.

## Troubleshooting

### `tsc` / `EACCES: permission denied` writing `dist/`

The service user (often `www-data`) must own the project tree, or builds run as `root` leave `dist/` owned by root so later `npm run build` as another user fails.

**Fix (typical):**

```bash
sudo chown -R www-data:www-data /opt/carrier-api
sudo rm -rf /opt/carrier-api/dist
sudo -u www-data bash -lc 'cd /opt/carrier-api && npm ci && npm run build'
```

Always **build as the same user** that runs `node dist/server.js` (see `User=` in the systemd unit). Avoid `sudo npm run build` unless you immediately `chown` the tree again.

### Browser shows endless “loading” on `http://YOUR_IP:3010`

The API listens on **`0.0.0.0`** by default (`CARRIER_HOST`). If the page never finishes loading, **inbound TCP 3010 is usually blocked** (UFW, `iptables`, or your cloud provider’s **firewall / security group**). Allow port **3010** there, or put **Nginx** on 80/443 and proxy to `127.0.0.1:3010`.

On the droplet:

```bash
sudo ufw status
sudo ufw allow 3010/tcp comment 'carrier-api'
sudo ufw reload
```

Also open **3010** in DigitalOcean **Networking → Firewalls** (or equivalent) for your droplet.
