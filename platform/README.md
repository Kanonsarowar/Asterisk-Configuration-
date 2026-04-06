# Telecom IPRN platform (MySQL + Fastify + Next.js)

Production-oriented stack under `platform/` (alongside the legacy repo `dashboard/`):

- **MySQL 8** schema: `sql/mysql_schema.sql` — users (admin/reseller/user, balance, sub-users), customers, suppliers, numbers (prefix + inclusive range, premium flag), prefix `routes` (failover + LCR fields), CDR, invoices, audit, live_calls, config_versions, system_settings
- **Fastify** REST API (`api/`) — JWT, RBAC, pooled `mysql2`, validation on selected routes
- **Internal routing** — `GET /route/:number` with `X-Internal-Key` (HTTP lookup for AGI / ARI)
- **CDR ingest** — `POST /api/cdr/ingest` (internal key) → billing finalize (billed seconds, revenue/cost/profit, balance debit)
- **Config generator** — `api/src/services/configGenerator.js` writes `pjsip.d/` + `extensions.d/` + root includes; `POST /api/config/sync` (admin JWT or internal key)
- **AMI listener** — `npm run ami` maintains `live_calls`
- **Next.js dashboard** — `web-next/` (login, admin tables, CDR filters, live polling)
- **CLI tools** — `tools/` (simulate-call, prefix-tester, route-validator)

Legacy **PostgreSQL** artifacts remain under `sql/schema.sql` for reference only; the active path is MySQL.

## Quick start

```bash
# 1) MySQL database
mysql -u root -p -e "CREATE DATABASE iprn CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p iprn < sql/mysql_schema.sql

# 2) API
cd api
cp .env.example .env
# Edit: MYSQL_*, JWT_SECRET, INTERNAL_API_KEY
npm install
npm run seed -- admin 'YourSecurePass'
npm start
# API: http://localhost:3010

# 3) Next.js UI (optional)
cd ../web-next
echo 'NEXT_PUBLIC_API_URL=http://127.0.0.1:3010' > .env.local
npm install
npm run dev
# UI: http://localhost:3001
```

## Key HTTP routes

| Method | Path | Auth |
|--------|------|------|
| POST | `/login` | — |
| GET | `/route/:number` | `X-Internal-Key` |
| POST | `/api/cdr/ingest` | `X-Internal-Key` |
| POST | `/api/config/sync` | admin JWT or `X-Internal-Key` |
| CRUD | `/api/users`, `/api/suppliers`, `/api/routes`, `/api/numbers`, … | JWT |
| GET | `/api/cdr`, `/api/cdr/export.csv`, `/api/live/calls` | JWT |
| GET/POST | `/api/billing/invoices`, `/api/billing/settings` | JWT (admin for settings) |

## Billing

- Configurable in `system_settings.billing`: `minimum_bill_seconds`, `increment_seconds`, `routing_mode` (`priority` | `lcr`), `max_cps_global`
- `lib/billing.js` — `finalizeCdrFinancials` applies rounding, computes revenue (number `rate_per_min`), cost (supplier `cost_per_minute`), profit, debits `users.balance`

## Asterisk

- Generated configs: set `ASTERISK_GENERATED_DIR`, copy to `/etc/asterisk/` or symlink `pjsip.d` / `extensions.d`
- Samples: `asterisk/extensions-iprn-lookup.conf.sample`, `asterisk/manager.conf.sample`, `asterisk/cdr_mysql.conf.sample`
- Auto-regenerate on supplier/route changes: `AUTO_SYNC_ASTERISK=1` in API `.env`

## Tools

```bash
cd tools
INTERNAL_API_KEY=... node simulate-call.js 441234567890 45
INTERNAL_API_KEY=... node prefix-tester.js 441234567890
INTERNAL_API_KEY=... node route-validator.js numbers.txt
```

## Operational notes

- Terminate TLS in front; restrict internal endpoints to PBX IPs
- Full config rollback needs stored file bodies (see `/api/config/rollback/:id` response); use git or object storage in production
