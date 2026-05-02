# VPS Deployment Guide — 72.60.190.132

**Date:** 2026-05-02  
**Status:** New VPS Setup  
**Asterisk Configuration:** IPRN Business Console

---

## Overview

This guide covers the complete setup and deployment of the **Asterisk IPRN Business Console** on your new VPS at **72.60.190.132**.

The system will provide:
- **Asterisk PBX** running on UDP port 5060 (SIP signaling)
- **IPRN Business Console** dashboard on TCP port 3000 (web management)
- **Multi-supplier SIP routing** with IP-based authentication
- **DID (Direct Inbound Dialing) inventory** management
- **IVR (Interactive Voice Response)** configuration
- **CDR (Call Detail Records)** logging and statistics
- **Live call monitoring** and statistics

---

## Pre-Deployment Checklist

Before starting, ensure you have:

- [ ] SSH access to **72.60.190.132** as `root`
- [ ] Ubuntu/Debian-based system (Ubuntu 20.04+, Debian 11+)
- [ ] Minimum **2 GB RAM**, **10 GB disk space**
- [ ] Port forwarding configured (if needed):
  - SSH: 22/TCP
  - Dashboard: 3000/TCP
  - SIP: 5060/UDP
  - RTP: 10000–20000/UDP
- [ ] Public IP documentation for supplier firewall rules

---

## Step 1: SSH into Your VPS

```bash
ssh root@72.60.190.132
```

Verify you're on the correct system:
```bash
hostname
uname -a
```

Update system packages:
```bash
apt-get update && apt-get upgrade -y
```

---

## Step 2: Clone the Repository

```bash
git clone https://github.com/Kanonsarowar/Asterisk-Configuration-.git /tmp/asterisk-deploy
cd /tmp/asterisk-deploy
```

---

## Step 3: Run the Deployment Script

The `deploy.sh` script automates installation:

```bash
sudo bash deploy.sh
```

This will:

1. **Install Node.js 22.x** (if not present)
2. **Install Asterisk** (if not present)
3. **Backup existing configs** to `/etc/asterisk/backup_TIMESTAMP/`
4. **Install the dashboard** to `/opt/asterisk-dashboard/`
5. **Preserve production data** (`db.json` from any previous installation)
6. **Run npm install** to fetch all dependencies (including `mysql2`)
7. **Create system directories** for Asterisk (sounds, CDR logs, outgoing)
8. **Prompt for dashboard credentials:**
   - Username (default: `admin`)
   - Password (default: `admin123`)
9. **Create systemd service** for auto-start on reboot
10. **Configure UFW firewall** rules

### During `deploy.sh` Execution

When prompted, enter your dashboard credentials:

```
[6/8] Setting up credentials...
  Dashboard username [admin]: your_username
  Dashboard password [admin123]: your_secure_password
```

⚠️ **IMPORTANT:** The script runs as `root` and needs `sudo` access for Asterisk operations. If you see permission errors, re-run with `sudo`.

---

## Step 4: Verify Installation

After deployment completes, you should see:

```
============================================
  Deployment Complete!
============================================

  Dashboard:  http://72.60.190.132:3000
  Login:      admin / (your password)
  Status:     RUNNING
  ...
```

### Check Service Status

```bash
sudo systemctl status asterisk-dashboard
sudo systemctl status asterisk
```

### View Live Logs

```bash
sudo journalctl -u asterisk-dashboard -f
sudo journalctl -u asterisk -f
```

### Verify Open Ports

```bash
netstat -tulpn | grep -E ':(22|3000|5060)'
ss -tulpn | grep -E ':(22|3000|5060)'
```

Expected output:
- `22` (SSH)
- `3000` (Dashboard)
- `5060` (SIP)

---

## Step 5: Access the Dashboard

1. **Open browser:** `http://72.60.190.132:3000`
2. **Login** with your credentials (default: `admin` / `admin123`)
3. **You should see:**
   - Live Asterisk status
   - Active calls counter
   - Memory and uptime
   - Navigation menu on the left

---

## Step 6: Initial Configuration

### 6.1 Update Suppliers (SIP Providers)

After login:

1. Go to **Suppliers** page
2. Review pre-configured suppliers (8 default providers)
3. **Update IP addresses** if you use different SIP providers:
   - Vultr, Hetzner, OVH, AWS, Contabo, myLoc, DataClub, etc.
4. Click **Save**

Example suppliers with typical IPs:
| # | Name | Typical IP |
|---|------|-----------|
| 1 | Vultr | 108.61.70.46 |
| 2 | Hetzner | 157.90.193.196 |
| 3 | OVH | 51.77.77.223 |
| 4 | AWS | 52.28.165.40, 52.57.172.184 |
| 5 | Custom | Your provider IP |

### 6.2 Add Number Inventory (DIDs)

1. Go to **Number Inventory**
2. Click **Add DID** or **Bulk Import**
3. Enter:
   - **Number prefix** (e.g., `44` for UK, `1` for US)
   - **DID range** (e.g., `441234567890–441234567999`)
   - **Supplier** (select from configured suppliers)
   - **Destination** (IVR slot, extension, or external number)
   - **Rate** (optional, for billing)
4. Click **Save**

### 6.3 Configure IVR Audio (Optional)

1. Go to **IVR Audio**
2. Select slot **1–10**
3. Upload `.wav` or `.mp3` file
4. Click **Upload**

### 6.4 Review Trunk Settings

1. Go to **Trunk Config**
2. Verify:
   - **Port:** `5060`
   - **Codecs:** G.729, alaw, ulaw, gsm
   - **Public IP:** `72.60.190.132` (your VPS public IP)
   - **RTP range:** `10000–20000`
3. Adjust if needed; click **Save**

---

## Step 7: Apply & Reload Asterisk

Once configuration is complete:

1. Click **Apply & Reload Asterisk** button (usually in the dashboard top bar or settings)
2. The system will:
   - Generate `extensions.conf`, `pjsip.conf`, `acl.conf`, `rtp.conf`
   - Copy configs to `/etc/asterisk/`
   - Reload Asterisk daemon
3. Wait for confirmation message
4. **Hard-refresh browser** (`Ctrl+Shift+R` or `Cmd+Shift+R`) to see updates

---

## Step 8: Test Inbound Call Flow

Once Asterisk is reloaded with your config:

1. **From a SIP phone/client**, register to **72.60.190.132:5060** with credentials
2. **Ask supplier to send a test call** to one of your DIDs
3. **Monitor on dashboard:**
   - Go to **Live calls** (if available)
   - Check CDR (Call Detail Records)
   - View `/var/log/asterisk/cdr-csv/Master.csv`

Expected flow:
```
Supplier IP → 72.60.190.132:5060 → Asterisk (IP-auth via acl.conf)
→ from-supplier-ip context → did-routing context → IVR/Destination
```

---

## Step 9: Security Hardening

### 9.1 Change Dashboard Password

```bash
sudo systemctl edit asterisk-dashboard
```

Add or modify:
```ini
[Service]
Environment=DASH_USER=your_username
Environment=DASH_PASS=your_new_secure_password
```

Save (Ctrl+X, then Y, then Enter), then restart:
```bash
sudo systemctl restart asterisk-dashboard
```

### 9.2 Firewall Configuration

Verify UFW (Uncomplicated Firewall) is enabled and configured:

```bash
sudo ufw status
```

If not enabled:
```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 3000/tcp  # Dashboard
sudo ufw allow 5060/udp  # SIP
sudo ufw allow 10000:20000/udp  # RTP
sudo ufw --force enable
```

### 9.3 Disable Root SSH (Optional)

For enhanced security, disable direct root login and use a regular user with `sudo`:

```bash
# Create a new user
adduser deploy
usermod -aG sudo deploy

# On your local machine, copy SSH key
ssh-copy-id -i ~/.ssh/id_rsa.pub deploy@72.60.190.132

# Test login as deploy
ssh deploy@72.60.190.132

# Then disable root SSH
sudo sed -i 's/^PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart ssh
```

### 9.4 Rate Limiting

Consider adding rate limiting for SIP (use Fail2Ban):

```bash
sudo apt-get install fail2ban
# Configure /etc/fail2ban/jail.local as needed
```

---

## Step 10: Backup Configuration

### 10.1 Backup Dashboard Data

The most critical file is `db.json` (contains suppliers, DIDs, IVR config):

```bash
sudo cp /opt/asterisk-dashboard/data/db.json ~/db-backup-$(date +%Y%m%d_%H%M%S).json
sudo chown $(whoami) ~/db-backup-*.json
```

### 10.2 Backup Asterisk Configs

```bash
sudo tar -czf ~/asterisk-backup-$(date +%Y%m%d_%H%M%S).tar.gz /etc/asterisk/
sudo chown $(whoami) ~/asterisk-backup-*.tar.gz
```

### 10.3 Set Up Regular Backups (Cron)

```bash
cat > ~/backup-asterisk.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/root/backups"
mkdir -p "$BACKUP_DIR"
DATE=$(date +%Y%m%d_%H%M%S)

# Dashboard data
cp /opt/asterisk-dashboard/data/db.json "$BACKUP_DIR/db-$DATE.json"

# Asterisk configs
tar -czf "$BACKUP_DIR/asterisk-$DATE.tar.gz" /etc/asterisk/ 2>/dev/null

# Keep only last 30 days
find "$BACKUP_DIR" -mtime +30 -delete
EOF

chmod +x ~/backup-asterisk.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /root/backup-asterisk.sh") | crontab -
```

---

## Step 11: Service Management

### Start/Stop/Restart

```bash
# Dashboard
sudo systemctl start asterisk-dashboard
sudo systemctl stop asterisk-dashboard
sudo systemctl restart asterisk-dashboard
sudo systemctl status asterisk-dashboard

# Asterisk
sudo systemctl start asterisk
sudo systemctl stop asterisk
sudo systemctl restart asterisk
sudo systemctl status asterisk
```

### View Logs

```bash
# Dashboard errors
sudo journalctl -u asterisk-dashboard -n 100

# Asterisk errors
sudo journalctl -u asterisk -n 100

# Follow in real-time
sudo journalctl -u asterisk-dashboard -f
```

### Enable/Disable Auto-Start

```bash
# Enable (auto-start on boot)
sudo systemctl enable asterisk-dashboard
sudo systemctl enable asterisk

# Disable
sudo systemctl disable asterisk-dashboard
```

---

## Step 12: Monitoring & Troubleshooting

### 12.1 Check Asterisk Status

```bash
sudo asterisk -rx "core show channels"
sudo asterisk -rx "sip show peers"  # or "pjsip show endpoints"
sudo asterisk -rx "core show version"
```

### 12.2 Check Dashboard Logs for Errors

```bash
sudo tail -f /var/log/syslog | grep asterisk-dashboard
```

### 12.3 Verify Call Routing

```bash
# Check generated configurations
cat /etc/asterisk/extensions.conf | grep -A 10 "did-routing"
cat /etc/asterisk/pjsip.conf | grep -A 5 "identify"
cat /etc/asterisk/acl.conf
```

### 12.4 Test SIP Connectivity

From your local machine:
```bash
# Test connectivity to SIP port
nc -zv 72.60.190.132 5060
telnet 72.60.190.132 5060
```

### 12.5 Monitor CDR (Call Detail Records)

```bash
# View CDR CSV
tail -f /var/log/asterisk/cdr-csv/Master.csv

# Or via dashboard: CDR page
```

---

## Step 13: Optional – MySQL Integration

If you want to use MySQL for number inventory and advanced billing:

### 13.1 Install MySQL Server

```bash
sudo apt-get install mysql-server
sudo mysql_secure_installation
```

### 13.2 Create IPRN Database

```bash
sudo mysql -u root -p << 'EOF'
CREATE DATABASE iprn CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'iprn_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON iprn.* TO 'iprn_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
EOF
```

### 13.3 Enable MySQL in Dashboard

Edit `/opt/asterisk-dashboard/.env`:

```bash
sudo nano /opt/asterisk-dashboard/.env
```

Add:
```bash
MYSQL_ENABLED=1
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=iprn
MYSQL_USER=iprn_user
MYSQL_PASSWORD=your_secure_password
```

### 13.4 Restart Dashboard

```bash
sudo systemctl restart asterisk-dashboard
```

---

## Step 14: Update & Maintenance

### 14.1 Pull Latest Code

```bash
cd /tmp/asterisk-deploy
git pull origin main
# or specific branch
git pull origin cursor/development-environment-setup-b95d
```

### 14.2 Redeploy

```bash
sudo bash deploy.sh
```

The script will:
- Preserve your existing `db.json` (suppliers, DIDs, IVR config)
- Update all code and dependencies
- Restart the dashboard
- NOT reset your configuration

### 14.3 Hard-Refresh Dashboard

After update, hard-refresh in browser:
- **Chrome/Firefox:** Ctrl+Shift+R
- **Safari:** Cmd+Shift+R

---

## File Structure on VPS

After deployment:

```
72.60.190.132 (/root)
├── /opt/asterisk-dashboard/         ← Dashboard installation
│   ├── server.js                     ← Main server
│   ├── data/db.json                  ← CONFIG (suppliers, DIDs, IVR)
│   ├── package.json
│   ├── lib/                          ← Core logic
│   │   ├── store.js, auth.js, config-generator.js, asterisk.js
│   │   └── cdr.js, mysql.js, numbers-service.js
│   └── public/                       ← Web UI
│       ├── index.html
│       ├── login.html
│       └── js/, css/
├── /etc/asterisk/                    ← Asterisk config (auto-generated on Apply)
│   ├── pjsip.conf                    ← SIP endpoints & authentication
│   ├── extensions.conf               ← Dialplan (from-supplier-ip, did-routing, IVR)
│   ├── acl.conf                      ← IP access lists
│   ├── rtp.conf                      ← RTP settings
│   └── func_odbc.conf                ← Optional MySQL routing
├── /var/log/asterisk/
│   ├── full                          ← Full Asterisk debug log
│   ├── cdr-csv/Master.csv            ← Call detail records
│   └── messages                      ← System messages
└── /etc/systemd/system/asterisk-dashboard.service  ← Service definition
```

---

## Quick Reference – Common Commands

| Task | Command |
|------|---------|
| Dashboard status | `sudo systemctl status asterisk-dashboard` |
| Dashboard logs | `sudo journalctl -u asterisk-dashboard -f` |
| Asterisk status | `sudo systemctl status asterisk` |
| Check active calls | `sudo asterisk -rx "core show channels"` |
| Check SIP endpoints | `sudo asterisk -rx "pjsip show endpoints"` |
| Reload Asterisk | `sudo asterisk -rx "core reload"` |
| Verify config syntax | `sudo asterisk -c` |
| Access Asterisk CLI | `sudo asterisk -r` |
| Restart all services | `sudo systemctl restart asterisk asterisk-dashboard` |
| View CDR | `tail -f /var/log/asterisk/cdr-csv/Master.csv` |
| Backup data | `sudo cp /opt/asterisk-dashboard/data/db.json ~/db-backup.json` |

---

## Troubleshooting

### Issue: Dashboard shows "Asterisk not connected"

**Solution:**
```bash
sudo systemctl status asterisk
sudo systemctl restart asterisk
sudo asterisk -c  # Check config syntax
```

### Issue: Can't reach dashboard at port 3000

**Solution:**
```bash
# Check if service is running
sudo systemctl status asterisk-dashboard

# Check if port is listening
sudo netstat -tulpn | grep 3000

# Check firewall
sudo ufw status
sudo ufw allow 3000/tcp
```

### Issue: SIP calls not routing

**Solution:**
1. Verify suppliers are configured correctly (go to **Suppliers** page)
2. Click **Apply & Reload Asterisk** to regenerate configs
3. Check dialplan: `sudo asterisk -rx "dialplan show did-routing"`
4. Monitor logs: `sudo tail -f /var/log/asterisk/full`

### Issue: High CPU or memory usage

**Solution:**
```bash
# Check Asterisk memory
ps aux | grep asterisk

# Check system resources
free -h
top

# Restart if necessary
sudo systemctl restart asterisk
```

---

## Support & Documentation

- **Repository:** https://github.com/Kanonsarowar/Asterisk-Configuration-
- **Main README:** See `README.md` in the repo
- **Project Instructions:** See `PROJECT_INSTRUCTIONS.md` in the repo
- **Asterisk Official Docs:** https://docs.asterisk.org/
- **PJSIP Configuration:** https://wiki.asterisk.org/wiki/display/AST/Configuring+res_pjsip

---

## Next Steps

After successful deployment:

1. ✅ Verify services are running (`systemctl status`)
2. ✅ Configure suppliers and DIDs in dashboard
3. ✅ Test call routing with supplier
4. ✅ Set up automated backups
5. ✅ Monitor logs for errors
6. ✅ Implement monitoring/alerting (optional)
7. ✅ Enable MySQL integration (optional)
8. ✅ Document your custom IVR scripts (if any)

---

**Deployment Date:** 2026-05-02  
**VPS IP:** 72.60.190.132  
**Asterisk Version:** Latest (from repo)  
**Node.js:** 22.x  
**Dashboard:** IPRN Business Console

**Good luck! 🚀**
