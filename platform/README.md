# Telecom IPRN platform (PostgreSQL + Fastify)

This stack sits **beside** the legacy `dashboard/` (Node + MySQL) app. It implements:

- **PostgreSQL** schema: users (roles), customers, suppliers, numbers (DIDs), `ivr`, `routes` (failover), `cdr`, `audit_logs`
- **Fastify** REST API with **JWT** (`Authorization: Bearer`) and **bcrypt** passwords
- **Internal lookup** `GET /route/:did` with header `X-Internal-Key: $INTERNAL_API_KEY` for Asterisk / AGI
- **Vanilla JS** UI under `web/public` (sidebar: Dashboard, Numbers, Customers, Suppliers, IVR, Routing, Call Logs, Reports)
- **RBAC**: admin (full), reseller (own customers + numbers), client (assigned numbers + own CDR)

## Quick start

```bash
# 1) Create database and apply schema
createdb iprn
psql "$DATABASE_URL" -f sql/schema.sql
# Optional: financial auto-fill on CDR insert
psql "$DATABASE_URL" -f sql/002_cdr_financial_trigger.sql

# 2) API + UI
cd api
cp .env.example .env
# Edit .env: DATABASE_URL, JWT_SECRET, INTERNAL_API_KEY
npm install
npm run seed -- admin 'YourSecurePass'
npm start
# UI + API: http://localhost:3010
```

## Key HTTP routes

| Method | Path | Auth |
|--------|------|------|
| POST | `/login` | — |
| GET | `/route/:number` | `X-Internal-Key` |
| GET/POST | `/numbers`, `/numbers/import`, `/numbers/assign`, `/numbers/update-status` | JWT |
| PUT | `/numbers/:id` | JWT (ivr_id, supplier_id, sell_rate) |
| GET/POST | `/customers` | JWT |
| GET/POST | `/suppliers` | JWT (POST admin) |
| GET/POST | `/ivr`, `/ivr/upload` | JWT |
| GET/POST | `/routes` | JWT |
| GET | `/cdr`, `/cdr/stats` | JWT |
| GET | `/dashboard/summary` | JWT |

## Telecom economics

- **Revenue** ≈ `(duration_seconds / 60) * sell_rate` on the matched `numbers` row (see optional DB trigger).
- **Cost** ≈ `(duration_seconds / 60) * supplier.cost_per_minute`.
- **Profit** = revenue − cost (trigger or batch job).
- **ASR / ACD** from `/cdr/stats` (answered vs total, average duration on answered).

## Asterisk integration

1. **CDR → PostgreSQL**: install `unixodbc` + PostgreSQL ODBC driver; configure `/etc/odbc.ini` (see `asterisk/odbc.ini.sample`), `res_odbc.conf`, `cdr_adaptive_odbc.conf` samples. Map Asterisk fields to `cdr` columns (`call_id`, `caller`, `destination`, `duration_seconds`, `disposition`, …).
2. **Dynamic routing**: on each call, call `GET http://127.0.0.1:3010/route/${DID}` with `X-Internal-Key`. Response includes `ivr.file`, `primarySupplier`, ordered `failoverSuppliers`. Parse JSON (AGI/FastAGI recommended) → `Playback` / `Dial`.
3. Samples: `asterisk/extensions-iprn-lookup.conf.sample`, `asterisk/agi/lookup-route.sh`.

## Operational notes

- **TLS** termination: put Caddy/Nginx in front; keep `INTERNAL_API_KEY` secret and restrict `/route/*` to loopback or PBX IP.
- **Active calls** on the dashboard summary is a placeholder until AMI/`core show channels` integration is added.
- **IVR files**: uploads land under `IVR_UPLOAD_DIR`; copy prompts to `/var/lib/asterisk/sounds/...` or symlink for Asterisk to read.
