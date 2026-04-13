# Deploy layout: `/opt/platform`

Create the four modules under one parent (symlinks or copies from your Git clone `REPO`):

```bash
sudo mkdir -p /opt/platform
REPO=/path/to/Asterisk-Configuration-

# Option A: symlinks (easy updates)
sudo ln -sfn "$REPO/platform-api"   /opt/platform/platform-api
sudo ln -sfn "$REPO/platform-ami"  /opt/platform/platform-ami
sudo ln -sfn "$REPO/platform-db"    /opt/platform/platform-db
sudo ln -sfn "$REPO/platform-dashboard" /opt/platform/platform-dashboard

# Option B: rsync copies (no git on server)
# sudo rsync -a "$REPO/platform-api/" /opt/platform/platform-api/
```

## API

```bash
sudo cp /opt/platform/platform-api/.env.example /opt/platform/platform-api/.env
sudo nano /opt/platform/platform-api/.env
cd /opt/platform/platform-api && sudo -u www-data npm ci && sudo -u www-data npm run build
sudo systemctl restart carrier-api   # ExecStart → /opt/platform/platform-api/dist/server.js
```

## AMI

```bash
cd /opt/platform/platform-ami && sudo -u www-data npm ci && sudo -u www-data npm run build
sudo systemctl restart platform-ami   # ExecStart → .../dist/runAmi.js
```

## Dashboard (static)

```bash
cd /opt/platform/platform-dashboard/public && python3 -m http.server 3020
```

Open `http://HOST:3020/carrier.html?api=http://127.0.0.1:3010` (CORS: set `CORS_ORIGIN` on API).

## SQL reference

`mysql ... < /opt/platform/platform-db/sql/iprn_audio_ivr_core.sql`  
(API and AMI also apply compatible columns at startup when possible.)
