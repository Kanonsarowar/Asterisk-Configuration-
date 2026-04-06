# AGENTS.md

## Cursor Cloud specific instructions

This repository is an **IPRN (International Premium Rate Number) telecom platform** with three services:

| Service | Directory | Port | Start command |
|---------|-----------|------|--------------|
| **Asterisk Dashboard** | `dashboard/` | 3000 | `cd /workspace/dashboard && node server.js` |
| **Platform API** (Fastify) | `platform/api/` | 3010 | `cd /workspace/platform/api && node src/server.js` |
| **Asterisk PBX** | `asterisk/` configs | 5060 | `sudo asterisk -f &` |

### Services overview

- **Dashboard** (primary): Node.js web UI for managing suppliers, DID numbers, IVR audio, trunk config, CDR, and Asterisk config generation. Stores data in `dashboard/data/db.json` (auto-created). Auth: `admin` / `admin123` (or `DASH_USER`/`DASH_PASS` env vars). Login endpoint is `/api/auth/login`.
- **Platform API** (secondary): Fastify REST API + web UI for IPRN management with JWT auth, role-based access, PostgreSQL backend. Requires `.env` at `platform/api/.env` (see `.env.example`). Login endpoint is `POST /login`.
- **Asterisk PBX**: The telecom engine. Configs under `asterisk/` are deployed to `/etc/asterisk/` via the dashboard's "Apply Changes" button.

### Starting services

```bash
# 1. Start Asterisk
sudo cp /workspace/asterisk/*.conf /etc/asterisk/
sudo sed -i 's/SUPPLIER_IP/127.0.0.1/g; s/YOUR_PUBLIC_IP/127.0.0.1/g' /etc/asterisk/pjsip.conf
sudo asterisk -f &

# 2. Start Dashboard (port 3000)
cd /workspace/dashboard && node server.js &

# 3. Start Platform API (port 3010) — requires PostgreSQL running
cd /workspace/platform/api && node src/server.js &
```

### PostgreSQL setup (for Platform API)

```bash
sudo pg_ctlcluster 16 main start
sudo -u postgres createuser --superuser ubuntu
sudo -u postgres createdb iprn
sudo -u postgres psql -c "ALTER USER ubuntu PASSWORD 'devpass123';"
psql -d iprn -f /workspace/platform/sql/schema.sql
cd /workspace/platform/api && node scripts/seed-admin.js admin admin123
```

Platform API `.env` needs `DATABASE_URL=postgres://ubuntu:devpass123@localhost:5432/iprn` and a `JWT_SECRET`.

### Validating dialplan changes

```bash
sudo asterisk -rx "dialplan reload"
sudo asterisk -rx "dialplan show from-supplier-ip"
sudo asterisk -rx "dialplan show did-routing"
sudo asterisk -rx "dialplan show ivr-1"
```

### Gotchas

- **No linter or test suite** exists; validation is done by loading configs into Asterisk and checking `dialplan show`, and by running the services and testing APIs.
- The apt-installed Asterisk (20.x) works for dialplan validation. PJSIP module loads but IP-auth identify sections may differ from production (22.x compiled from source).
- **Sound files** referenced in the dialplan (`custom/main-menu`, `custom/sales-menu`) don't exist in the repo; create stub files at `/var/lib/asterisk/sounds/custom/` for testing.
- The dashboard login endpoint is `/api/auth/login` (not `/api/login`).
- Dashboard `node_modules` are committed to the repo (only `mysql2` and its deps); the platform API's `node_modules` are not committed and must be installed with `npm install`.
- The platform API `.env` file is gitignored; you must create it from `.env.example` each session.
- The `res_pjsip` reload from the dashboard will report "No such module" if Asterisk was compiled without pjproject; this is harmless for dialplan validation.
