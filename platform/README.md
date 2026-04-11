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
