# platform-api

Fastify HTTP API: `/health`, `/ready`, `/api/live`, `/api/route/:prefix`. **No AMI** (use `platform-ami`).

## Setup

```bash
cd platform-api
cp .env.example .env
npm install
npm run build
npm start
```

Default port **3010** (`CARRIER_PORT`).
