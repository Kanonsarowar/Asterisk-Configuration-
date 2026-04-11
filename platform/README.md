# Carrier IPRN API — Phase 1 (Fastify + TypeScript)

Separate from `dashboard/server.js`. Listens on **`CARRIER_PORT`** (default **3010**) so the existing dashboard can stay on **3000**.

## Setup

```bash
cd platform
cp .env.example .env
# Edit .env — same MySQL credentials as dashboard (iprn_system)
npm install
npm run build
npm start
```

## Verify (Phase 1)

```bash
curl -s http://127.0.0.1:3010/health
curl -s http://127.0.0.1:3010/api/live
curl -s http://127.0.0.1:3010/api/route/971
```

On first start, missing tables **`routes`** and **`vendors`** are created and a sample row for prefix `971` is inserted if empty.

## Dev (watch)

```bash
npm run dev
```

Requires **Node 20+**.

## Endpoints

| Method | Path | Notes |
|--------|------|--------|
| GET | `/health` | `{ "status": "ok" }` |
| GET | `/api/live` | Prefix stats from `call_logs` (last N rows, in-memory aggregate) |
| GET | `/api/route/:prefix` | Longest-prefix match on `routes` + `vendors` |
