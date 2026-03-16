# Asterisk PBX Configuration + Web Dashboard

Manage your Asterisk PBX inbound routing, IVR menus, and ring groups through a web dashboard.

## Features

- **DID Route Management** -- Add, edit, delete inbound DID routes via UI
- **IVR Menu Builder** -- Create IVR menus with DTMF options, audio files, timeout/invalid actions
- **Ring Group Manager** -- Configure agent ring groups with extensions and voicemail
- **Trunk Configuration** -- Set supplier IP, public IP, codecs, ports
- **Live Dashboard** -- Real-time Asterisk status, active channels, memory, uptime
- **Config Preview** -- View auto-generated `extensions.conf` and `pjsip.conf` before deploying
- **One-Click Apply** -- Generates configs, deploys to `/etc/asterisk/`, and reloads Asterisk

## Quick Deploy on VPS

```bash
# SSH into your VPS
ssh root@167.172.170.88

# Clone the repo
git clone https://github.com/Kanonsarowar/Asterisk-Configuration-.git /tmp/asterisk-deploy
cd /tmp/asterisk-deploy

# Run deployment (installs Node.js if needed, creates systemd service)
sudo bash deploy.sh
```

Dashboard will be running at: **http://167.172.170.88:3000**

## Manual Setup

### Prerequisites

- **Asterisk** installed and running (`sudo apt-get install asterisk`)
- **Node.js 18+** (`node -v` to check)

### Install

```bash
git clone https://github.com/Kanonsarowar/Asterisk-Configuration-.git
cd Asterisk-Configuration-/dashboard
node server.js
```

Open `http://YOUR_SERVER_IP:3000` in your browser.

### Run as Background Service

```bash
# Using systemd (recommended)
sudo bash deploy.sh

# Or manually with nohup
cd dashboard && nohup node server.js > /var/log/asterisk-dashboard.log 2>&1 &
```

## Configuration

### First-Time Setup

1. Open the dashboard at `http://YOUR_SERVER_IP:3000`
2. Go to **Trunk Config** and enter your SIP provider IP and your server's public IP
3. Go to **DID Routes** and add your real DID numbers
4. Go to **IVR Menus** and configure your IVR menus
5. Go to **Ring Groups** and set up your agent extensions
6. Click **Apply Changes** to generate configs and reload Asterisk

### Audio Files

Upload your IVR audio files (WAV format) to:
```
/var/lib/asterisk/sounds/custom/
```

Reference them in the dashboard as `custom/filename` (without extension).

## Files

```
├── deploy.sh                    # One-command VPS deployment script
├── asterisk/
│   ├── pjsip.conf               # Auto-generated PJSIP trunk config
│   └── extensions.conf          # Auto-generated dialplan
└── dashboard/
    ├── server.js                # Node.js web server (port 3000)
    ├── package.json
    ├── data/
    │   └── db.json              # Dashboard data store
    ├── lib/
    │   ├── store.js             # JSON data store
    │   ├── asterisk.js          # Asterisk CLI integration
    │   └── config-generator.js  # Generates .conf files from dashboard data
    └── public/
        ├── index.html           # Dashboard UI
        ├── css/style.css        # Styles
        └── js/
            ├── app.js           # Dashboard application
            └── api.js           # API client
```

## Service Management

```bash
# Check status
sudo systemctl status asterisk-dashboard

# View logs
sudo journalctl -u asterisk-dashboard -f

# Restart
sudo systemctl restart asterisk-dashboard

# Stop
sudo systemctl stop asterisk-dashboard
```

## Firewall

Make sure these ports are open:

| Port | Protocol | Purpose |
|------|----------|---------|
| 3000 | TCP | Dashboard web UI |
| 5060 | UDP | SIP signaling |
| 10000-20000 | UDP | RTP media |

```bash
sudo ufw allow 3000/tcp
sudo ufw allow 5060/udp
sudo ufw allow 10000:20000/udp
```
