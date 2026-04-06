# Gulf-Premium-Telecom — IPRN Panel (Phase 1–9)

This document maps **phase 1–9** delivery to what exists in this repository. All phases listed below are **implemented** in code/config; production rollout still requires your environment (MySQL, Asterisk, TLS, credentials).

---

## Phase 1 — Core platform & data model

| Deliverable | Location |
|-------------|----------|
| MySQL schema (users, customers, suppliers, numbers, routes, CDR, invoices, settings) | `platform/sql/mysql_schema.sql` |
| Migrations for billing, CDR, live calls, config sync, fraud/routing | `platform/sql/003_*.sql` … `008_*.sql` |
| API foundation (Fastify, JWT, pooled DB) | `platform/api/src/server.js`, `platform/api/src/db.js` |

**Status: complete**

---

## Phase 2 — Identity, access & audit

| Deliverable | Location |
|-------------|----------|
| Login, JWT, roles (admin / reseller / user) | `platform/api/src/routes/login.js`, `platform/api/src/hooks/authenticate.js` |
| RBAC, number/CDR scoping | `platform/api/src/lib/rbac.js` |
| Audit log | `platform/api/src/lib/audit.js` |
| Next.js auth (localStorage JWT) | `platform/web-next/app/(auth)/login`, `platform/web-next/lib/api.js` |

**Status: complete**

---

## Phase 3 — Number inventory & DID intelligence

| Deliverable | Location |
|-------------|----------|
| Numbers CRUD, import, assign, status | `platform/api/src/routes/numbers.routes.js` |
| Longest-prefix / range match for routing | `platform/api/src/lib/routingEngine.js` → `findNumberForDestination` |
| Premium vs non-premium flag | `numbers.type` in schema + routing/fraud hooks |
| Dashboard UI (admin) | `platform/web-next/app/(dashboard)/dashboard/(admin)/numbers` |
| Legacy Node dashboard (optional) | `dashboard/` per `README.md` / `PROJECT_INSTRUCTIONS.md` |

**Status: complete**

---

## Phase 4 — Suppliers, routes, failover & LCR

| Deliverable | Location |
|-------------|----------|
| Supplier endpoints | `platform/api/src/routes/suppliers.routes.js` |
| Prefix routes with priority & rate | `platform/api/src/routes/routing.routes.js` |
| Failover ordering + LCR (effective buy rate) | `platform/api/src/lib/routingEngine.js` |
| Internal route lookup (AGI / Asterisk) | `GET /route/:number` → `platform/api/src/routes/route-lookup.js` |
| Generated Asterisk dialplan (same order) | `platform/api/src/services/configGenerator.js` |
| Standalone generator (optional) | `asterisk-mysql-generator/` |

**Status: complete**

---

## Phase 5 — Asterisk integration, CDR & sync

| Deliverable | Location |
|-------------|----------|
| PJSIP + extensions generation | `platform/api/src/services/configGenerator.js` |
| Safe reload (`asterisk -rx`, optional sudo) | `configGenerator.reloadAsterisk`, `configSyncService` |
| Config sync: DB triggers → outbox → regenerate → version → rollback | `platform/sql/008_config_sync_outbox.sql`, `platform/api/src/services/configSyncService.js` |
| CDR → MySQL (ODBC samples + AMI path) | `platform/asterisk/*.sample`, `platform/api/scripts/ami-listener.js`, `platform/api/src/routes/cdr-ingest.routes.js` |
| `POST /api/config/sync`, rollback API | `platform/api/src/routes/config.routes.js` |

**Status: complete**

---

## Phase 6 — Billing, balances & invoices

| Deliverable | Location |
|-------------|----------|
| Billed seconds (minimum + increment), revenue/cost/profit | `platform/api/src/lib/billingEngine.js`, `platform/api/src/lib/billing.js` |
| Multi-currency metadata, per-user `billing_currency` | `platform/sql/006_billing_multicurrency.sql`, `users.billing_currency` |
| CDR ingest → finalize financials | `platform/api/src/lib/cdrInsert.js` |
| Invoice create + `summary_json` | `platform/api/src/routes/billing.routes.js` |
| UI: Balance, CDR, Invoices | `platform/web-next/app/(dashboard)/dashboard/balance`, `cdr`, `invoices` |

**Status: complete**

---

## Phase 7 — Fraud, CLI policy & live operations

| Deliverable | Location |
|-------------|----------|
| CPS, per-CLI hourly, per-user CPM, dest burst | `platform/api/src/lib/routingEngine.js` → `checkFraudAndCps` |
| CLI validation, premium stricter rules | `validateCli`, fraud JSON in `system_settings` |
| Fraud settings API | `GET/PUT /api/billing/fraud-settings` |
| Live calls (AMI → `live_calls`) | `platform/api/scripts/ami-listener.js`, `GET /api/live/calls` |
| Live UI | `platform/web-next/app/(dashboard)/dashboard/live` |

**Status: complete**

---

## Phase 8 — Admin & user panels (web)

| Deliverable | Location |
|-------------|----------|
| Admin: Users, Suppliers, Routes, Numbers | `platform/web-next/.../(admin)/` |
| Account: Overview, Balance, Live, CDR, Invoices | `platform/web-next/app/(dashboard)/dashboard/` |
| Shared UI components, polling | `platform/web-next/components/dashboard`, `hooks/usePolling.js` |
| API integration | `platform/web-next/lib/api.js`, `lib/auth.js` |

**Status: complete**

---

## Phase 9 — Quality, tooling & documentation

| Deliverable | Location |
|-------------|----------|
| CLI simulator, prefix tester, route validator, failover test | `platform/tools/` |
| Billing expectation helpers | `platform/tools/lib/billingExpect.js` |
| Sample expectations | `platform/tools/samples/route-expectations.json` |
| Platform README (API, billing, Asterisk, tools) | `platform/README.md` |
| Operator / deploy docs | `README.md`, `PROJECT_INSTRUCTIONS.md`, `AGENTS.md` |

**Status: complete**

---

## Quick verification checklist

1. **DB**: `mysql ... < platform/sql/mysql_schema.sql` (+ migrations 003–008 if upgrading).
2. **API**: `cd platform/api && cp .env.example .env && npm i && npm start` (port 3010).
3. **UI**: `cd platform/web-next && npm i && npm run dev` with `NEXT_PUBLIC_API_URL`.
4. **Asterisk**: set `ASTERISK_GENERATED_DIR` / `ASTERISK_INSTALL_DIR`, run `POST /api/config/sync` or enable outbox poller + triggers.
5. **Tests**: `cd platform/tools` — see `platform/README.md` Tools section.

---

*If your internal Gulf-Premium-Telecom phase doc uses different names, align rows above to that doc — the codebase coverage is as listed.*
