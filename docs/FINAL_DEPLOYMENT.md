# Final deployment — Gulf-Premium-Telecom IPRN stack

**Target:** Ubuntu VPS (e.g. `167.172.170.88`) + browser on phone/tablet.  
**Stack:** MySQL + Fastify API (`:3010`) + Next.js UI (`:3001`) + PM2.

---

## A) One script — legacy + platform (same as old `deploy.sh`)

From repo root on the VPS (clone into e.g. `/opt/telecom` or use your path):

```bash
cd /path/to/Asterisk-Configuration-
sudo bash deploy.sh
```

Installs **:3000** legacy dashboard (systemd) **and** **:3010** API + **:3001** Next (PM2 + MySQL).  
`SKIP_PLATFORM=1 sudo -E bash deploy.sh` — legacy only.

---

## A2) Fresh platform only (no legacy)

```bash
cd /opt
rm -rf telecom
git clone https://github.com/Kanonsarowar/Asterisk-Configuration-.git telecom
cd telecom
git checkout cursor/-bc-be33ae59-2617-4c2c-b806-a62a5a33b088-0181

sudo bash deploy/fresh-install.sh
```

Optional:

```bash
ADMIN_PASS='YourSecurePass' MYSQL_DATABASE=iprn sudo -E bash deploy/fresh-install.sh
```

**Save the script output:** admin password, MySQL `iprn_app` password, `INTERNAL_API_KEY`.

```bash
ufw allow 22/tcp
ufw allow 3001/tcp
ufw allow 3010/tcp
ufw enable
```

**Tablet / PC browser:** `http://YOUR_VPS_IP:3001/login` — user `admin`, password from output.

---

## B) Update existing server (keep data)

```bash
cd /opt/telecom
git pull
./deploy/install-platform.sh
pm2 restart all
pm2 save
```

Apply new SQL migrations only if prompted in release notes:

```bash
mysql -u iprn_app -p iprn < platform/sql/008_config_sync_outbox.sql   # example
```

---

## C) What runs under PM2

| App | Role |
|-----|------|
| `iprn-backend` | API — **only one** process on port **3010** |
| `iprn-web` | Next.js — port **3001**, proxies `/api/platform/*` → `127.0.0.1:3010` |
| `iprn-ami` | Optional — live calls / CDR from AMI |
| `iprn-billing` | Optional — finalize ODBC CDR rows |
| `iprn-config-sync` | Optional — use **only** if `CONFIG_SYNC_OUTBOX_POLL=0` on backend |

**Do not** run a second app (e.g. `iprn-api`) on **3010**.

---

## D) Configuration files

| File | Purpose |
|------|---------|
| `platform/api/.env` | `MYSQL_*`, `JWT_SECRET`, `INTERNAL_API_KEY`, `PORT=3010` |
| `platform/web-next/.env.local` | `API_INTERNAL_URL=http://127.0.0.1:3010` — **do not** set `NEXT_PUBLIC_API_URL=http://127.0.0.1:3010` (breaks tablets) |

---

## E) Tablet shows “Failed to fetch” on login

1. Open **`http://YOUR_IP:3001/status`** (server-side check: Next → API).  
   - If **health** errors → API down or wrong `API_INTERNAL_URL`; run `pm2 restart iprn-backend`, check `platform/api/.env`.  
   - If **health** is `database: down` → fix MySQL in `.env`.  
2. On VPS: `pm2 delete iprn-api 2>/dev/null; pm2 restart iprn-backend` (only **one** app on **3010**).  
3. `cd /opt/telecom && git pull && cd platform/web-next && npm run build && pm2 restart iprn-web`  
4. Tablet: **hard refresh** or clear site data (old cached JS may still call wrong URL).

---

## F) Health checks (on VPS)

```bash
curl -s http://127.0.0.1:3010/health
curl -s -X POST http://127.0.0.1:3010/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"YOUR_ADMIN_PASS"}'
curl -s -X POST http://127.0.0.1:3001/api/platform/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"YOUR_ADMIN_PASS"}'
```

Expect JSON with `"token"`. Reset password:  
`cd /opt/telecom/platform/api && npm run seed -- admin 'NewPass' --reset`

---

## G) Asterisk (optional)

```bash
# After API .env has ASTERISK_INSTALL_DIR=/etc/asterisk (optional)
curl -s -X POST http://127.0.0.1:3010/api/config/sync \
  -H "X-Internal-Key: YOUR_INTERNAL_API_KEY"
sudo asterisk -rx "pjsip reload"
sudo asterisk -rx "dialplan reload"
```

Apply `platform/sql/008_config_sync_outbox.sql` for DB-triggered sync.

---

## H) Daily backup (cron)

```bash
chmod +x /opt/telecom/deploy/scripts/backup.sh
```

```cron
0 3 * * * MYSQL_DATABASE=iprn MYSQL_USER=iprn_app MYSQL_PASSWORD=xxx ASTERISK_CONFIG_DIR=/etc/asterisk /opt/telecom/deploy/scripts/backup.sh
```

---

## I) Legacy dashboard (different product)

Port **3000** — `deploy.sh` / `/opt/asterisk-dashboard`. **Not** the same login as **3001**.

---

## J) Reference docs

| Doc | Topic |
|-----|--------|
| [DEPLOYMENT_AND_OPERATIONS.md](./DEPLOYMENT_AND_OPERATIONS.md) | Steps, zero-downtime, checklist |
| [TABLET_AND_VPS_WORKFLOW.md](./TABLET_AND_VPS_WORKFLOW.md) | Tablet + SSH only |
| [GULF_PREMIUM_TELECOM_PHASES.md](./GULF_PREMIUM_TELECOM_PHASES.md) | Phase map |

**Repository root:** [README.md](../README.md) · **Platform:** [platform/README.md](../platform/README.md)
