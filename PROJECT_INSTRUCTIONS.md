# Project instructions — IPRN Business Console

This document explains how the repository fits together and how to run, configure, and operate it day to day.

## What this project is

- **One admin console** (the Node dashboard on port **3000**): **IPRN Business Console**. It is the primary place to manage suppliers, **number inventory** (DIDs + destinations + rates), IVR audio slots, trunk/network settings, live status, CDR, and billing-related views when MySQL is enabled.
- **Asterisk configs** under `asterisk/` are **generated** from the dashboard. After you click **Apply & Reload Asterisk**, files are written into the repo copy and copied to `/etc/asterisk/` on the server (requires **sudo** for the dashboard user).
- **DID routing is not a separate product**: the same **Number inventory** list drives the **`did-routing`** context in `extensions.conf`. There is no separate “DID Routes” page.

## Source of truth

| Data | Where it lives |
|------|----------------|
| Suppliers, IVR slots (1–10), trunk, globals, extra panel users | `dashboard/data/db.json` |
| DID rows (full inventory) | **`numbers` table in MySQL** when `MYSQL_ENABLED=1`, otherwise `db.json` → `numbers` array |
| ODBC mirror for Asterisk | MySQL table **`number_inventory`** (kept in sync with DIDs when MySQL is on) |

Once you use the dashboard regularly, treat **Apply** as the step that pushes dialplan and PJSIP to the live PBX. Plain files in `asterisk/` in git can be overwritten on apply.

## Typical workflow

1. Sign in to the console (default `admin` / `admin123`, or `DASH_USER` / `DASH_PASS`).
2. Under **Number inventory**, add or edit DIDs, prefixes, IVR destination, supplier, IPRN fields as needed.
3. Under **IPRN routing defaults**, set fallback IVR and optional **ODBC routing** (uses MySQL `number_inventory` and DSN `iprn_db` when configured on Asterisk).
4. Adjust **Suppliers**, **IVR Audio**, **Trunk Config** as needed.
5. Click **Apply & Reload Asterisk** so `extensions.conf`, `pjsip.conf`, `acl.conf`, `rtp.conf`, and `func_odbc.conf` are regenerated, copied to `/etc/asterisk/`, and Asterisk is reloaded.

Optional: set **`AUTO_APPLY_ASTERISK_ON_LOGIN=1`** in `dashboard/.env` so a successful login also runs the same deploy step (still needs sudo).

## Environment variables (dashboard)

Copy `dashboard/.env.example` to `dashboard/.env` (or set variables via systemd). Pre-set environment variables win over `.env`.

| Variable | Purpose |
|----------|---------|
| `PORT` | HTTP port (default `3000`) |
| `DASH_USER` / `DASH_PASS` | Break-glass login (always works; not stored in `db.json`) |
| `AUTO_APPLY_ASTERISK_ON_LOGIN` | `1` / `true` / `yes` / `on` → deploy configs to Asterisk after each successful login |
| `MYSQL_ENABLED` | Set to `1` to use MySQL for the DID list and IPRN sync |
| `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD` | Database connection (`iprn_system`-style schema; see `dashboard/lib/mysql.js` and `dashboard/sql/*.sample`) |
| `MYSQL_CONNECTION_LIMIT` | Optional pool size |
| `IPRN_PLATFORM_URL` | Optional full URL; sidebar shows **Legacy IPRN UI** opening in a new tab (primary control remains this dashboard) |
| `ASTERISK_CONF_DIR` | Optional path to the directory where generated `.conf` files are written before `sudo cp` to `/etc/asterisk/` |

## Authentication and panel users

- The **env account** (`DASH_USER` / `DASH_PASS`) always works.
- Additional operators can be added under **Panel admins** in the UI; they are stored in `db.json` as **`adminUsers`** (passwords as SHA-256 hashes).

## Generated Asterisk artifacts

The dashboard regenerates (at minimum):

- `extensions.conf` — `from-supplier-ip`, `did-routing`, IVR contexts, optional ODBC-related contexts when enabled
- `pjsip.conf` — transport and supplier IP authentication
- `acl.conf` — ACL entries derived from supplier IPs
- `rtp.conf` — RTP range from trunk settings
- `func_odbc.conf` — when ODBC/IPRN routing features are used (also copied on apply)

Sample ODBC ini: `asterisk/odbc-iprn.ini.sample`.

## MySQL / IPRN

- Enable **`MYSQL_ENABLED=1`** and provide valid DB credentials.
- Schema creation/migrations run when the dashboard connects (see `dashboard/lib/mysql.js`).
- DID writes update **`numbers`** and sync **`number_inventory`** for Asterisk ODBC workflows.
- SQL samples and grants: `dashboard/sql/*.sample`.

## Local development

```bash
cd dashboard
node server.js
# http://localhost:3000
```

Ensure Asterisk and sudo-based CLI commands match your OS if you use Apply from a dev machine.

## Production deployment

See **README.md** → **Quick Deploy on VPS** (`deploy.sh`). The dashboard is typically installed under `/opt/asterisk-dashboard`; **`db.json` is preserved** on redeploy when that path already exists.

## Optional: separate IPRN API (`platform/api`)

A Fastify API may live under `platform/api` (e.g. port **3010**). It is **not** required for the main console. Use **`IPRN_PLATFORM_URL`** only if you still operate a legacy web UI alongside this dashboard.

## Multi-tenant client portal (IPRN users / subusers)

Requires **MySQL** (`MYSQL_ENABLED=1` and a working pool). Adds **three tables** (created automatically if missing):

| Table | Purpose |
|-------|---------|
| `iprn_users` | Client logins: `username`, `password_hash`, `role` (`admin` / `user` / `subuser`), `parent_user_id`, `balance`, `status` |
| `iprn_user_numbers` | Which full numbers (must exist in `numbers`) are assigned to which `iprn_users.id` |
| `iprn_invoices` | Generated invoice rows (amount, period, JSON `meta` with call aggregates) |

**Operator (panel) login** — unchanged (`DASH_USER`, `adminUsers`, or env admin). Sidebar shows **IPRN clients** when MySQL numbers are ready: create users, set balance, assign numbers from inventory.

**Client portal login** — same `/login` form; if credentials match `iprn_users` and not the panel, the UI switches to **Client portal** with pages: Overview, Live calls, CDR, Balance, Invoices, Subusers / Number allocation (for `user`/`admin` roles), Call generator.

**Access rules (summary)**

- **Subuser**: only own assigned numbers; live calls and CDR filtered to those numbers; cannot manage subusers or allocate for others.
- **User / admin** (root client, `parent_user_id` null): can create subusers, assign numbers they hold to subusers, generate invoices for users in their subtree.
- **Panel** sessions cannot call `/api/tenant/*`; **tenant** sessions cannot call operator `/api/*` (403).

**CDR and cost** — Tenant CDR is filtered from Asterisk `Master.csv` by matching `src`/`dst` to assigned numbers. Cost is estimated as `(billsec/60) * rate` using the `numbers.rate` row when the destination matches.

**Call generator** — Set **`TENANT_ORIGINATE_CMD`** to a full `channel originate ...` string for `sudo asterisk -rx`. Placeholders: **`{DEST}`** (called party, digits), **`{FROM}`** (assigned DID, digits). Example:  
`channel originate Local/7001@from-internal application Dial PJSIP/{DEST}@your-trunk`  
If **`TENANT_ENFORCE_BALANCE=1`**, originate is rejected when the tenant row `balance` ≤ 0. **Per-call balance deduction inside Asterisk** is not implemented in this extension (no dialplan changes); use balance as a prepaid display + optional gate for the generator only.

**Channel variables `USER_ID` / `SUBUSER_ID`** — Not set by this layer. Add in your own dialplan/AMI if you need ownership on the PBX side.

**Exports** — Invoice line: **CSV** download per invoice (`/api/tenant/invoices/:id/csv`). PDF: use print-to-PDF from CSV/spreadsheet.

## Backup

Back up **`dashboard/data/db.json`** and, when using MySQL, your database dumps. See README **Backup** section.

## Further reading

- **README.md** — deploy, firewall, service commands, file map  
- **AGENTS.md** — Cursor / automation notes, dialplan validation commands  
- **dashboard/.env.example** — commented env template  
