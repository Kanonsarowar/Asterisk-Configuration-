# Asterisk Grafana Monitoring

A complete Docker-based monitoring solution for Asterisk PBX with Grafana dashboards and Prometheus metrics.

## Features

✅ **Real-time Monitoring** - Live metrics from your Asterisk server
✅ **Beautiful Dashboards** - Pre-built Grafana dashboards
✅ **Docker Deployment** - One-command deployment
✅ **Automated Health Checks** - Monitor service status
✅ **Prometheus Integration** - Scalable metrics collection

## Architecture

```
┌─────────────┐
│  Asterisk   │
│    (PBX)    │
└─────────────┘
       │ (AMI)
       ▼
┌──────────────────────┐
│ Asterisk Exporter    │ :9487
└──────────────────────┘
       │ (metrics)
       ▼
┌──────────────────────┐
│   Prometheus         │ :9090
└──────────────────────┘
       │ (query)
       ▼
┌──────────────────────┐
│   Grafana            │ :3000
└──────────────────────┘
```

## Requirements

- Ubuntu 20.04+ or compatible Linux
- Docker & Docker Compose
- Asterisk with AMI enabled
- Port availability: 3000, 9090, 9487

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/Kanonsarowar/asterisk-grafana-monitoring.git
cd asterisk-grafana-monitoring
```

### 2. Configure Asterisk AMI

Edit your Asterisk `manager.conf`:

```ini
[general]
enabled = yes
port = 5038
bindaddr = 0.0.0.0

[exporteruser]
secret = exporterpass
read = all
write = all
```

Restart Asterisk:
```bash
asterisk -rx "core reload"
```

### 3. Deploy to VPS

```bash
chmod +x scripts/*.sh
./scripts/deploy.sh YOUR_VPS_IP root
```

Example:
```bash
./scripts/deploy.sh 72.60.190.132 root
```

### 4. Access Dashboard

- **Grafana**: http://YOUR_VPS_IP:3000
  - Default credentials: `admin` / `admin`
- **Prometheus**: http://YOUR_VPS_IP:9090
- **Asterisk Exporter**: http://YOUR_VPS_IP:9487/metrics

## Configuration

### Environment Variables

Edit `.env` file:

```env
AMI_HOST=asterisk
AMI_PORT=5038
AMI_USER=exporteruser
AMI_PASS=exporterpass
GF_SECURITY_ADMIN_PASSWORD=admin
GF_SECURITY_ADMIN_USER=admin
```

### Dashboard Customization

Edit `dashboards/asterisk-overview.json` to customize metrics and panels.

## Monitoring Metrics

Available metrics from Asterisk exporter:

- `asterisk_channels` - Active channels
- `asterisk_calls_processed_total` - Total calls
- `asterisk_sip_peers_registered` - SIP peers
- `asterisk_iax2_peers_online` - IAX2 peers
- `asterisk_failed_calls_total` - Failed calls
- `asterisk_uptime_seconds` - Uptime

## Operations

### Health Check

```bash
./scripts/health-check.sh YOUR_VPS_IP root
```

### View Logs

```bash
ssh root@YOUR_VPS_IP "cd /opt/asterisk-monitoring && docker-compose logs -f"
```

### Update Configuration

```bash
# Edit local files
vi config/prometheus.yml

# Redeploy
./scripts/deploy.sh YOUR_VPS_IP root
```

### Rollback

```bash
./scripts/rollback.sh YOUR_VPS_IP root
```

## Troubleshooting

### Grafana can't connect to Prometheus

1. Check if Prometheus is running:
   ```bash
   curl http://YOUR_VPS_IP:9090/-/healthy
   ```

2. Restart all containers:
   ```bash
   ssh root@YOUR_VPS_IP "cd /opt/asterisk-monitoring && docker-compose restart"
   ```

### No metrics appearing

1. Verify Asterisk AMI:
   ```bash
   asterisk -rx "manager show users"
   ```

2. Check exporter connection:
   ```bash
   curl http://YOUR_VPS_IP:9487/metrics
   ```

### Container won't start

```bash
# View container logs
ssh root@YOUR_VPS_IP "cd /opt/asterisk-monitoring && docker-compose logs"

# Restart containers
ssh root@YOUR_VPS_IP "cd /opt/asterisk-monitoring && docker-compose restart"
```

## File Structure

```
.
├── docker-compose.yml          # Main orchestration
├── config/
│   ├── prometheus.yml          # Prometheus config
│   ├── grafana-datasources.yml # Grafana data sources
│   └── grafana-dashboards.yml  # Dashboard provisioning
├── dashboards/
│   └── asterisk-overview.json  # Main dashboard
├── scripts/
│   ├── deploy.sh               # Deploy script
│   ├── rollback.sh             # Rollback script
│   └── health-check.sh         # Health check
├── .env                        # Environment variables
└── README.md                   # This file
```

## Security

⚠️ **Default Credentials**: Change default Grafana password!

```bash
# Via Grafana UI:
# 1. Login: admin/admin
# 2. Go to Settings → Preferences
# 3. Change password
```

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - See LICENSE file

## Support

For issues and questions:
- Open a GitHub issue
- Check logs: `docker-compose logs"`
- Run health check: `./scripts/health-check.sh`

---

**Made with ❤️ for Asterisk lovers**
