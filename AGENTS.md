# AGENTS.md

## Cursor Cloud specific instructions

This repository contains **Asterisk PBX configuration files** (not a buildable application). The two config files live under `asterisk/`:

- `asterisk/pjsip.conf` – PJSIP transport & IP-authenticated trunk
- `asterisk/extensions.conf` – Dialplan with DID routing, IVR menus, and ring groups

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
