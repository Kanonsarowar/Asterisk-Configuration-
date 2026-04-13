# `platform/` (compatibility)

Carrier code now lives in **separate modules** at the repo root:

| Module | Role |
|--------|------|
| **`platform-api/`** | Fastify HTTP API (port **3010**) |
| **`platform-ami/`** | Asterisk AMI → `call_logs` (separate process) |
| **`platform-db/sql/`** | SQL schemas & reference migrations |
| **`platform-dashboard/public/`** | Static UI (HTML/CSS/JS) |

## Quick start

```bash
# API
cd platform-api && cp .env.example .env && npm ci && npm run build && npm start

# AMI (second terminal or systemd)
cd platform-ami && cp .env.example .env && npm ci && npm run build && npm start
```

From **`platform/`** you can still run:

```bash
npm run install:all
npm run build
```

Deploy **`platform-api`** to `/opt/carrier-api` (or keep path and sync `platform-api/` contents). Deploy **`platform-ami`** as a second service (e.g. `/opt/platform-ami`).

AMI manager sample: **`platform-ami/deploy/manager.conf`** or **`asterisk/manager.conf`**.
