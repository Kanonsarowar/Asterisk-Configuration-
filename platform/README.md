# Carrier IPRN API — Fastify + TypeScript (`/platform`)

Separate from `dashboard/server.js`. Listens on **`CARRIER_PORT`** (default **3010**).

## Phase 2 — Asterisk AMI

Phase 2 AMI (inbound IPRN): **`startAMI()`** after DB init. **`Newchannel`**: DID from **`Exten`** (stored in **`prefix`**), **`Uniqueid`**, **`CallerIDNum`** → insert `ONGOING`; skip **`Local/`**, channels with **`internal`**, and **`Exten`** shorter than 5 chars. **`Hangup`**: **`UPDATE ... SET duration, disposition WHERE uniqueid = ?`** (no `ORDER BY` / `LIMIT`). No **`Dial`** / **`Destination`**. Set **`AMI_ENABLED=0`** to disable.

**Asterisk manager** sample is in **two places** (same content):

- **`platform/deploy/manager.conf`** — use this when you only deploy `/opt/carrier-api` (no `asterisk/` folder).
- **`asterisk/manager.conf`** — use this from a full repo clone.

```bash
# carrier-api-only tree on the server:
sudo cp /opt/carrier-api/deploy/manager.conf /etc/asterisk/manager.conf

# full repo:
sudo cp /path/to/repo/asterisk/manager.conf /etc/asterisk/manager.conf

sudo asterisk -rx "manager reload"
# or full restart:
sudo systemctl restart asterisk
```

Verify AMI is listening: `sudo ss -tlnp | grep 5038`

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
