# Using a phone or tablet (e.g. Samsung) on the same Wi‑Fi

The dashboard runs on your **PC** (or Mac). The tablet only opens a **browser**.  
`localhost` on the tablet means *the tablet itself*, so you must use your **computer’s LAN IP**.

## 1. Find your computer’s IP

- **Windows:** `ipconfig` → IPv4 Address (e.g. `192.168.1.50`)
- **macOS:** System Settings → Network, or `ipconfig getifaddr en0`
- **Linux:** `ip -4 addr show` or `hostname -I`

Example: **`192.168.1.50`**

## 2. Allow the firewall (if the tablet cannot connect)

Open inbound TCP **3010** (API) and **3001** (Next.js dev) on the PC.

## 3. Start the API (already listens on all interfaces)

```bash
cd platform/api
npm run dev
# Opens on http://0.0.0.0:3010 — reachable as http://YOUR_PC_IP:3010
```

## 4. Point the web app at the API (choose one)

**A — Recommended (proxy, no wrong `127.0.0.1` on tablet):**  
Do **not** set `NEXT_PUBLIC_API_URL`. The UI calls **`/api/platform/*`** on the Next server; it proxies to **`API_INTERNAL_URL`** (default `http://127.0.0.1:3010` on the PC). Add to `.env.local` only if the API is elsewhere:

```env
API_INTERNAL_URL=http://127.0.0.1:3010
```

**B — Direct API URL:** If you prefer the tablet to call the API host directly:

```env
NEXT_PUBLIC_API_URL=http://192.168.1.50:3010
```

Use your real PC IP — **never** `http://127.0.0.1:3010` in `NEXT_PUBLIC_*` when using a tablet.

## 5. Start the Next.js dev server

```bash
cd platform/web-next
npm run dev:lan
```

(`dev:lan` binds explicitly to `0.0.0.0` on port **3001**.)

## 6. On the Samsung tablet

Open Chrome (or Samsung Internet):

```text
http://192.168.1.50:3001/login
```

Log in with the admin user you created with `npm run seed`.

## Troubleshooting

| Problem | What to check |
|--------|----------------|
| Connection refused | PC and tablet on same Wi‑Fi; firewall; correct IP |
| Login fails / network error | `NEXT_PUBLIC_API_URL` must be `http://PC_IP:3010`, not `localhost` |
| “Not secure” warning | Normal for `http://` on LAN; fine for home lab |

## Optional: HTTPS on LAN

For stricter browsers or cookies, use a reverse proxy (Caddy/nginx) with a local cert, or Next `--experimental-https` only if you trust the self-signed warning on the tablet.
