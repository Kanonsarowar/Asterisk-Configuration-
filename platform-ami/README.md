# platform-ami

Asterisk AMI → MySQL `call_logs` only. **Does not** import `platform-api`. Run as its own process (recommended systemd unit).

## Setup

```bash
cd platform-ami
cp .env.example .env
npm install
npm run build
npm start
```

Requires Asterisk AMI (`manager.conf`) and the same `MYSQL_*` database as the API.
