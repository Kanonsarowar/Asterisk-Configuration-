# Asterisk Configuration (Inbound IP Auth + IVR + DID Routing)

This repository now includes a working base configuration for your requirement:

- Inbound SIP calls from provider to your server IP
- IP-to-IP authentication (no username/password registration)
- Auto-answer inbound call in dialplan
- Route calls by DID number
- Send routed calls to IVR menus

## Files

- `asterisk/pjsip.conf`  
  PJSIP transport + provider trunk using `identify` by source IP.

- `asterisk/extensions.conf`  
  Dialplan that:
  - receives inbound calls in `from-supplier-ip`
  - extracts DID from `${EXTEN}` or `To:` header
  - routes DID in `[did-routing]`
  - runs IVR in `[ivr-main]` and `[ivr-sales]`

## Replace placeholders before use

In `asterisk/pjsip.conf`:

- `SUPPLIER_IP` -> provider SIP IP
- `YOUR_PUBLIC_IP` -> your VPS public IP

In `asterisk/extensions.conf`:

- Replace sample DIDs:
  - `12025550100`
  - `12025550101`
  - `12025550102`
- Replace agent extensions:
  - `2000` / `2001` / `2002`
- Upload IVR audio files:
  - `/var/lib/asterisk/sounds/custom/main-menu.wav`
  - `/var/lib/asterisk/sounds/custom/sales-menu.wav`

## Deploy on Asterisk server

Copy files:

```bash
sudo cp asterisk/pjsip.conf /etc/asterisk/pjsip.conf
sudo cp asterisk/extensions.conf /etc/asterisk/extensions.conf
```

Reload:

```bash
sudo asterisk -rx "pjsip reload"
sudo asterisk -rx "dialplan reload"
```

## Quick test

```bash
sudo asterisk -rx "pjsip show endpoint supplier-trunk"
sudo asterisk -rx "dialplan show from-supplier-ip"
sudo asterisk -rvvvvv
```

Then call one of your configured DIDs and verify the call goes to IVR.
