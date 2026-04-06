# Gulf-Premium-Telecom — deployment & operations

Step-by-step verification, PM2, zero-downtime updates, backup, and go-live checklist.  
Paths are relative to the **repository root** unless noted.

---

## STEP 1 — Core (Phase 1 + 2): database + auth

### Verify DB connection

```bash
cd platform/api
cp .env.example .env
# Set MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, JWT_SECRET, INTERNAL_API_KEY
npm install
node -e "
import 'dotenv/config';
import { getPool } from './src/db.js';
const p = getPool();
const [r] = await p.query('SELECT 1 AS ok');
console.log(r);
await p.end();
"
```

### Verify login

```bash
npm start &
sleep 2
curl -s -X POST http://127.0.0.1:3010/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"YOUR_PASS"}' | jq .
```

Use a user created with `npm run seed -- admin 'YourPass'`.

---

## STEP 2 — Backend (Phase 3 + 4): numbers, suppliers, routing

### Create routes (admin JWT)

```bash
TOKEN="eyJ..."
curl -s -X POST http://127.0.0.1:3010/api/routes \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"prefix":"88213","supplier_id":1,"priority":0,"rate":0.05,"active":true}'
```

### Prefix search

- **Numbers UI**: `platform/web-next` → Numbers page → prefix filter.  
- **API**: `GET /api/numbers` (scoped by role).  
- **Route lookup**: `GET /route/{did}` with `X-Internal-Key` — see `platform/tools/prefix-tester.js`.

---

## STEP 3 — Asterisk (Phase 5): config + reload

1. Generate / install configs (choose one):
   - **API**: `POST /api/config/sync` (admin JWT or `X-Internal-Key`) with `ASTERISK_INSTALL_DIR=/etc/asterisk` if needed.
   - **Outbox**: DB triggers + API poller (default) or `npm run config-sync-loop` under PM2 with `CONFIG_SYNC_OUTBOX_POLL=0` on API.

2. Reload (no full Asterisk restart):

```bash
sudo asterisk -rx "module reload res_pjsip.so"   # skip if no PJSIP module
sudo asterisk -rx "pjsip reload"
sudo asterisk -rx "dialplan reload"
```

3. Verify endpoints / routing: place test call or use `platform/tools/` + Asterisk CLI `pjsip show endpoints` (when PJSIP is available).

---

## STEP 4 — Billing (Phase 6)

- **Cost / balance**: CDR finalize — `lib/billing.js` on ingest or `npm run finalize-cdr` / PM2 `iprn-billing` loop.
- **Verify**: `platform/tools/simulate-call.js` with optional `JWT_TOKEN` for DB row checks.

---

## STEP 5 — Fraud + monitoring (Phase 7)

- **CPS / CLI**: `GET /route/:number` with `X-Cli`, `X-User-Id`; settings `GET/PUT /api/billing/fraud-settings`.
- **Live**: PM2 `iprn-ami` → `scripts/ami-listener.js`; `GET /api/live/calls`.

---

## STEP 6 — Frontend (Phase 8)

```bash
cd platform/web-next
echo 'NEXT_PUBLIC_API_URL=http://127.0.0.1:3010' > .env.local
npm install && npm run build && npm run start
```

Open UI, sign in, confirm API calls succeed (browser devtools / Network).

---

## STEP 7 — Testing (Phase 9)

```bash
cd platform/tools
INTERNAL_API_KEY=... node simulate-call.js 441234567890 45
INTERNAL_API_KEY=... node prefix-tester.js 441234567890
INTERNAL_API_KEY=... node route-validator.js samples/route-expectations.json
```

---

## PM2 — service control

```bash
npm install -g pm2
cd /path/to/repo
git pull
./deploy/install-platform.sh   # api npm ci + web build + .env.local stub
pm2 start ecosystem.config.js
# or: pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup   # follow printed instructions
```

| App name | Role |
|----------|------|
| `iprn-backend` | Fastify API |
| `iprn-ami` | AMI listener → `live_calls` + optional CDR |
| `iprn-billing` | `finalize-cdr-loop.js` — ODBC CDR billing |
| `iprn-config-sync` | `config-sync-loop.js` — only if API `CONFIG_SYNC_OUTBOX_POLL=0` |
| `iprn-generator` | `asterisk-mysql-generator` watch — **disable** if you use API `configGenerator` only |
| `iprn-web` | Next.js production |

**Avoid duplicate config processing:** either API built-in poller **or** `iprn-config-sync`, not both.

---

## Zero-downtime updates

| Change | Action |
|--------|--------|
| Route / dialplan data | `dialplan reload` (after sync writes configs) |
| Supplier / PJSIP | `pjsip reload` / `module reload res_pjsip.so` |
| Backend code | `pm2 restart iprn-backend` |
| Billing script | `pm2 restart iprn-billing` |
| Frontend | `npm run build` then `pm2 restart iprn-web` |
| Full Asterisk restart | **Avoid** in production unless required |

---

## Daily backup (mandatory)

```bash
chmod +x deploy/scripts/backup.sh
export MYSQL_DATABASE=iprn MYSQL_USER=... MYSQL_PASSWORD=...
export ASTERISK_CONFIG_DIR=/etc/asterisk
export BACKUP_ROOT=/var/backups/telecom
./deploy/scripts/backup.sh
```

Cron example:

```cron
0 3 * * * MYSQL_DATABASE=iprn MYSQL_USER=u MYSQL_PASSWORD=p /path/to/repo/deploy/scripts/backup.sh
```

---

## Live traffic — gradual release

1. 1–2 test clients, limited prefixes.  
2. Scale while watching ASR, profit, failures (`/api/dashboard/summary`, CDR, live calls).  
3. Watch fraud triggers and balance.

---

## Post-deploy checklist

- [ ] Calls connecting?  
- [ ] Billing correct (`billed_duration`, revenue, cost)?  
- [ ] No unintended negative balance (policy per product)?  
- [ ] Failover order matches `GET /route` / dialplan?  
- [ ] No abnormal spikes (CPS, per-CLI, per-user limits)?  
- [ ] PM2 processes `online`; backups ran; reload procedure documented for on-call.

---

## Related docs

- [GULF_PREMIUM_TELECOM_PHASES.md](./GULF_PREMIUM_TELECOM_PHASES.md) — phase 1–9 map  
- [platform/README.md](../platform/README.md) — API, Asterisk, tools
