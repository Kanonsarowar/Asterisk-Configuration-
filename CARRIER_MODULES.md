# Carrier modules (layout)

| Path | Purpose |
|------|---------|
| `platform-api/` | Fastify API — default port **3010** |
| `platform-ami/` | AMI → `call_logs` — **separate Node process** |
| `platform-db/sql/` | SQL reference only (no runtime) |
| `platform-dashboard/public/` | Static HTML/CSS/JS (see **`carrier.html`** for live API) |

Full **`/opt/platform`** layout: **`OPT_PLATFORM.md`**.

## Deploy paths (example)

- API: sync **`platform-api/`** → `/opt/carrier-api`
- AMI: sync **`platform-ami/`** → `/opt/platform-ami` + second systemd unit

## systemd (AMI)

```ini
[Service]
WorkingDirectory=/opt/platform-ami
ExecStart=/usr/bin/node /opt/platform-ami/dist/runAmi.js
EnvironmentFile=/opt/platform-ami/.env
User=www-data
```

Same `MYSQL_*` as API; include `AMI_*`.
