# AGENTS.md

## Cursor Cloud specific instructions

This repository contains **Asterisk PBX configuration files** (not a buildable application). Config files under `asterisk/`:

- `asterisk/pjsip.conf` – PJSIP transport & IP-authenticated trunk
- `asterisk/extensions.conf` – Dialplan with DID routing and IVR audio playback (no ring groups)
- `asterisk/manager.conf` – AMI (port 5038, user `carrier`); copy also lives at **`platform-ami/deploy/manager.conf`**. Deploy: `sudo cp …/manager.conf /etc/asterisk/manager.conf`, then `asterisk -rx "manager reload"` or `systemctl restart asterisk`
- **Carrier modules (root):** `platform-api/` (Fastify HTTP), `platform-ami/` (AMI worker), `platform-db/sql/` (SQL only), `platform-dashboard/public/` (static UI). Legacy `platform/` is a thin npm shim — use `platform-api` for `/opt/carrier-api` deploys.

### Running Asterisk locally

Asterisk 22.x is compiled from source and installed to `/usr/sbin/asterisk` with modules in `/usr/lib/asterisk/modules`. It was built **without pjproject** (so `res_pjsip` modules are not loaded), but the dialplan engine and all non-PJSIP modules work.

To deploy and validate the repo configs:

```bash
sudo cp /workspace/asterisk/pjsip.conf /etc/asterisk/pjsip.conf
sudo cp /workspace/asterisk/extensions.conf /etc/asterisk/extensions.conf
# Replace placeholders for local testing:
sudo sed -i 's/SUPPLIER_IP/127.0.0.1/g' /etc/asterisk/pjsip.conf
sudo sed -i 's/YOUR_PUBLIC_IP/127.0.0.1/g' /etc/asterisk/pjsip.conf
```

Start Asterisk: `sudo asterisk -f &` (foreground, background process).
Connect to CLI: `sudo asterisk -r` or run single commands via `sudo asterisk -rx "<command>"`.

### Validating dialplan changes

```bash
sudo asterisk -rx "dialplan reload"
sudo asterisk -rx "dialplan show from-supplier-ip"
sudo asterisk -rx "dialplan show did-routing"
sudo asterisk -rx "dialplan show ivr-main"
sudo asterisk -rx "dialplan show ivr-sales"
```

### Gotchas

- **No linter or test suite** exists in this repo; validation is done by loading configs into Asterisk and checking `dialplan show`.
- **No package manager or build system** – this is a config-only repo.
- **PJSIP commands** (e.g. `pjsip show endpoint`) won't work because Asterisk was compiled without pjproject. Dialplan validation and most other modules work fine.
- **Sound files** referenced in the dialplan (`custom/main-menu`, `custom/sales-menu`) don't exist in the repo; stub files are created at `/var/lib/asterisk/sounds/custom/` for testing.
- The `extensions.conf` line with `NoOp(No DID found in request; rejecting call)` generates a harmless parser warning about missing closing parenthesis – this is a known Asterisk parser quirk with semicolons in `NoOp()` arguments.

### Web Dashboard

The `dashboard/` directory contains a Node.js web UI (zero external dependencies) for managing Asterisk config.

```bash
cd /workspace/dashboard && node server.js
# Runs at http://localhost:3000
```

Features: Number management with integrated DID routing (each number has a destination), 10 fixed IVR audio slots, trunk configuration, live Asterisk status, call statistics (CDR), SIP invite log, CSV/file upload for bulk number import (with supplier selector), ACL-based IP security, prefix pattern matching in dialplan, and config preview. Ring groups have been removed; all routing goes directly to IVR slots. The dashboard requires authentication — default credentials are `admin` / `admin123` (override with `DASH_USER` and `DASH_PASS` env vars). Clicking **Apply Changes** regenerates `asterisk/extensions.conf`, `asterisk/pjsip.conf`, and `asterisk/acl.conf`, copies them to `/etc/asterisk/`, and reloads Asterisk.

**Note:** Numbers and DID Routes have been merged — there is no separate DID Routes page or `/api/did-routes` endpoint. Each number entry in `db.json` carries `destinationType` (always `ivr`) and `destinationId` fields that define its DID routing behavior. IVR destination is set at the prefix level in the Numbers page. The IVR page shows 10 fixed slots (IVR 1-10) with audio file upload only — no DTMF options or add/delete.

- The dashboard stores data in `dashboard/data/db.json` (auto-created on first run with defaults matching the original repo configs).
- Config files under `asterisk/` are **overwritten** when Apply is clicked from the dashboard; the dashboard is the source of truth once used.
- The `res_pjsip` reload will report "No such module" since Asterisk was compiled without pjproject; this is harmless.
