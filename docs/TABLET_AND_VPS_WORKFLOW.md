# Samsung tablet + VPS only (no laptop)

You can run the whole stack on your **VPS** (`167.172.170.88`) and use the **Galaxy Tab S9** for:

- **Browser** — dashboard, API docs, health checks  
- **SSH client** — deploy, `git pull`, `pm2`, logs, `nano`/`vi`  

You do **not** need a laptop if the server does the builds and you edit via SSH or GitHub.

---

## Recommended layout

| Where | What runs |
|-------|-----------|
| **VPS** | MySQL, Fastify API, Next.js (PM2), Asterisk (if installed), Node builds |
| **Tablet** | Chrome → `http://167.172.170.88:3001` (Next) or `:3010` (API), Termius → SSH |

There is no “local PC” in this setup — the VPS **is** your environment.

---

## 1. SSH from the tablet

Install **Termius**, **JuiceSSH**, or **Samsung DeX + terminal** (if you use a dock).

```bash
ssh root@167.172.170.88
# or your sudo user
```

Use **SSH keys** (paste public key in `~/.ssh/authorized_keys` on VPS) so you are not typing long passwords on the tablet.

---

## 2. One-time server setup (on VPS over SSH)

```bash
cd /opt   # or /telecom-system
git clone https://github.com/Kanonsarowar/Asterisk-Configuration-.git telecom
cd telecom
git checkout cursor/-bc-be33ae59-2617-4c2c-b806-a62a5a33b088-0181   # or main/your branch

# MySQL
mysql -u root -p < platform/sql/mysql_schema.sql   # adjust DB name/user per your policy

# API
cd platform/api
cp .env.example .env
nano .env   # MYSQL_*, JWT_SECRET, INTERNAL_API_KEY, PORT=3010

npm run seed -- admin 'YourStrongPassword'
# If admin already exists and you forgot the password:
npm run seed -- admin 'admin123' --reset

# Install + build + PM2 (from repo root)
cd /opt/telecom
chmod +x deploy/install-platform.sh
./deploy/install-platform.sh
```

**Tablet login fix:** Do **not** set `NEXT_PUBLIC_API_URL=http://127.0.0.1:3010` — on a tablet that points at the tablet itself and login fails.

**Recommended (default):** Remove `NEXT_PUBLIC_API_URL` from `.env.local` (or leave the file empty). The Next.js app then uses **`/api/platform/*`** on the same host (port **3001**); the server proxies to Fastify on **`127.0.0.1:3010`** (`API_INTERNAL_URL`, set in PM2 `ecosystem.config.cjs`).

**Optional:** Set `NEXT_PUBLIC_API_URL=http://167.172.170.88:3010` only if you open port **3010** to the internet and want the browser to call the API directly (CORS is not required for same-origin proxy).

Rebuild after env changes:

```bash
cd /opt/telecom/platform/web-next && npm run build && pm2 restart iprn-web
```

Start processes:

```bash
cd /opt/telecom
npm i -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # run the command it prints once
```

Open firewall (UFW example):

```bash
ufw allow 22/tcp
ufw allow 3010/tcp
ufw allow 3001/tcp
ufw allow 5060/udp   # SIP if Asterisk on same host
ufw enable
```

**"Failed to fetch" on tablet at `:3001/login`:** Often the Next build had `NEXT_PUBLIC_API_URL=http://127.0.0.1:3010` (tablet calls itself). New builds override that when the site is opened by IP/hostname. Still fix `.env.local`, run `npm run build`, `pm2 restart iprn-web`. Ensure **`iprn-backend`** is running (`pm2 status`) and **`curl -s http://127.0.0.1:3010/login`** returns 404 or JSON (not connection refused).

**Different product — legacy dashboard:** Gulf Premium Telecom **operator** login on port **3000** is `http://167.172.170.88:3000/login` (Node `dashboard/`), not Next on **3001**.

---

## 3. On the tablet (browser)

- **Login UI:** `http://167.172.170.88:3001/login`  
- **API health:** `http://167.172.170.88:3010` (root may 404; use `/login` POST or dashboard)

Use **HTTPS** in production (Caddy, nginx + Let’s Encrypt) and set `NEXT_PUBLIC_API_URL` to `https://your-domain`.

---

## 4. Daily work without a laptop

| Task | How |
|------|-----|
| Deploy new code | SSH → `cd /opt/telecom && git pull && ./deploy/install-platform.sh && pm2 restart all` |
| Edit `.env` | SSH → `nano platform/api/.env` |
| Logs | `pm2 logs` |
| Asterisk reload | `asterisk -rx "dialplan reload"` (after config sync) |
| Backup | Cron + `deploy/scripts/backup.sh` (see DEPLOYMENT_AND_OPERATIONS.md) |

---

## 5. Optional: edit code without `nano` on tablet

- **GitHub** — merge PRs on tablet; on VPS only `git pull` + rebuild.  
- **GitHub Codespaces / Gitpod** — browser IDE, then push; VPS pulls.  
- **VS Code Server / code-server** — run on VPS, open in tablet browser (heavier).

---

## 6. Legacy dashboard (port 3000)

The repo **`deploy.sh`** still targets **`167.172.170.88`** and installs the Node dashboard under **`/opt/asterisk-dashboard`**. That is separate from the **platform** stack (3010/3001). Pick one primary UI or run both on different ports with a reverse proxy.

---

## Related docs

- [DEPLOYMENT_AND_OPERATIONS.md](./DEPLOYMENT_AND_OPERATIONS.md) — PM2, backup, reload matrix  
- [LOCAL_TABLET_AND_LAN.md](./LOCAL_TABLET_AND_LAN.md) — only if you later add a **home PC** on Wi‑Fi  

---

**Summary:** Treat the **VPS as your only machine** for this project; the **Tab S9** is the control panel (browser + SSH). No laptop required.
