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

**Next.js `web-next/` layout (App Router)**

- `app/(auth)/login` — JWT login → `localStorage`
- `app/(dashboard)/dashboard` — shell; Balance, Live, CDR, Invoices (all roles)
- `app/(dashboard)/dashboard/(admin)` — Users, Suppliers, Routes, Numbers (admin/reseller only)
- `components/dashboard/*` — PageHeader, FilterBar, TableCard, Badge, Toggle, RequireStaff
- `hooks/useSession`, `hooks/usePolling` — profile refresh + API polling
- `lib/api.js`, `lib/auth.js` — Fastify base URL, Bearer token, role helpers

## Key HTTP routes

| Method | Path | Auth |
|--------|------|------|
| POST | `/login` | — |
| GET | `/route/:number` | `X-Internal-Key` |
| POST | `/api/cdr/ingest` | `X-Internal-Key` |
| POST | `/api/config/sync` | admin JWT or `X-Internal-Key` |
| CRUD | `/api/users`, `/api/suppliers`, `/api/routes`, `/api/numbers`, … | JWT |
| GET | `/api/cdr?user_id=` (admin), `/api/cdr/export.csv`, `/api/live/calls` | JWT |
| GET | `/api/billing/invoices?user_id=` (admin) | JWT |
| GET | `/api/billing/invoice-summary` | JWT |
| PATCH | `/api/users/:id/billing-currency` | admin / reseller |
| GET/POST | `/api/billing/invoices`, `/api/billing/settings` | JWT (admin for settings) |
| GET/PUT | `/api/billing/fraud-settings` | JWT (admin) |

## Routing engine (`lib/routingEngine.js`)

- **Failover**: `resolveRouteSuppliers` returns `{ suppliers, meta }` — ordered chain; Asterisk dialplan / `failoverSuppliers` tries each until `ANSWER`. Platform `configGenerator` uses the same LCR/priority sort per prefix.
- **LCR**: `system_settings.billing.routing_mode = lcr` — sort by effective buy rate (`routes.rate` if &gt; 0, else `suppliers.cost_per_minute`), then `lcr_tie_break` (`priority_then_supplier_id` | `supplier_id`).
- **CLI validation**: `validateCli` + `checkFraudAndCps` — optional min length, blocked regex list, repeated-digit CLI; stricter optional rules on **premium** numbers (`strict_cli_on_premium`, `premium_cli_extra_regexes`).
- **Premium**: `premium` / `premium_number` on route lookup response when `numbers.type = premium`.
- **Fraud**: global CPS (`max_cps_global`), per-CLI hourly (`max_calls_per_cli_per_hour`), per-user per-minute (`max_calls_per_user_per_minute` when `X-User-Id` / `user_id` passed to `GET /route/:number`), unique-destination burst (`max_unique_destinations_per_user_per_minute`). Configure via `GET/PUT /api/billing/fraud-settings` or `system_settings.fraud` JSON. Apply `sql/007_routing_fraud_settings.sql` on existing DBs.

## Billing

- Configurable in `system_settings.billing`: `minimum_bill_seconds`, `increment_seconds`, `routing_mode` (`priority` | `lcr`), `max_cps_global`, `default_billing_currency`, `currencies` (metadata per ISO 4217 code)
- `lib/billingEngine.js` — production billing: prefix/rate resolution, `computeBilledSeconds`, `amountFromBilledRate` (`cost = billed_seconds/60*rate`), `buildUserInvoiceSummary`
- `lib/billing.js` — `finalizeCdrFinancials` writes `billed_duration`, `revenue` / `cost` / `profit`, `user_rate_per_min` / `supplier_rate_per_min`, `billing_currency`, `matched_prefix`; debits `users.balance` by revenue
- Per-user currency: `users.billing_currency` (default `USD`); set via `PATCH /api/users/:id/billing-currency` (admin/reseller) or on create (`billing_currency` body field)
- Invoice summary: `GET /api/billing/invoice-summary?period_start=&period_end=` (admin: `user_id=`; reseller: `user_id=` for child users). `POST /api/billing/invoices` stores `summary_json` + `currency` on the invoice row
- Apply `sql/006_billing_multicurrency.sql` and `sql/007_routing_fraud_settings.sql` on existing databases

## Asterisk

- Generated configs: set `ASTERISK_GENERATED_DIR`, copy to `/etc/asterisk/` or symlink `pjsip.d` / `extensions.d`
- Samples: `asterisk/extensions-iprn-lookup.conf.sample`, `asterisk/manager.conf.sample`, `asterisk/cdr_mysql.conf.sample`, `asterisk/cdr_adaptive_odbc_mysql.conf.sample`, `asterisk/res_odbc_mysql.conf.sample`, `asterisk/odbc_mysql.ini.sample`
- **CDR → MySQL**: `cdr_adaptive_odbc` maps into `cdr` (CLI, destination, duration, disposition, uniqueid, call_id from linkedid). Apply migrations `sql/003_cdr_financials_applied.sql`, `sql/004_live_calls_enhance.sql`, and `sql/005_cdr_uniqueid_unique.sql` on existing DBs.
- **Billing after ODBC**: rows need `finalizeCdrFinancials` — run `cd api && npm run finalize-cdr` on a schedule, or use AMI `Cdr` events (`npm run ami` with `CDR_FROM_AMI=1`) / `POST /api/cdr/ingest` so inserts go through `lib/cdrInsert.js` immediately.
- **Cost from prefix**: `finalizeCdrFinancials` picks the longest matching `routes` row for `(destination, supplier_id)` and uses `routes.rate` as cost per minute when set (CLI regex respected); otherwise `suppliers.cost_per_minute`.
- **Live monitor**: `npm run ami` updates `live_calls` (channels, state, direction, exten). `GET /api/live/calls` returns rows.
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
