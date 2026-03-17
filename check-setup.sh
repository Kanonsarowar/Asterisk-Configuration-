#!/bin/bash
# ============================================
# IPRN Asterisk - Full Setup Verification
# Run on VPS: sudo bash check-setup.sh
# ============================================
set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok() { echo -e "${GREEN}[OK]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

echo "============================================"
echo "  IPRN Asterisk Setup Check"
echo "============================================"
echo ""

# 1. Asterisk running?
echo "--- 1. Asterisk Service ---"
if systemctl is-active --quiet asterisk; then
  ok "Asterisk is running"
else
  fail "Asterisk is NOT running"
  echo "  Fix: sudo systemctl start asterisk"
fi

# 2. Dashboard running?
echo "--- 2. Dashboard Service ---"
if systemctl is-active --quiet asterisk-dashboard; then
  ok "Dashboard is running on port 3000"
else
  fail "Dashboard is NOT running"
  echo "  Fix: sudo systemctl restart asterisk-dashboard"
fi

# 3. Port 5060 listening?
echo "--- 3. SIP Port 5060 ---"
if ss -ulnp | grep -q ':5060'; then
  ok "Port 5060 is listening (UDP)"
else
  fail "Port 5060 is NOT listening"
  echo "  Fix: sudo asterisk -rx 'module load res_pjsip.so'"
fi

# 4. PJSIP endpoint loaded?
echo "--- 4. PJSIP Endpoint ---"
EP=$(sudo asterisk -rx "pjsip show endpoint supplier-trunk" 2>/dev/null | head -1)
if echo "$EP" | grep -q "Endpoint"; then
  ok "supplier-trunk endpoint loaded"
else
  fail "supplier-trunk endpoint NOT loaded"
  echo "  Fix: Apply changes from dashboard, then: sudo asterisk -rx 'pjsip reload'"
fi

# 5. Identify sections loaded?
echo "--- 5. IP Identify Sections ---"
ID_COUNT=$(sudo asterisk -rx "pjsip show identifies" 2>/dev/null | grep -c "Identify:" || echo 0)
if [ "$ID_COUNT" -gt 0 ]; then
  ok "$ID_COUNT identify sections loaded (supplier IP matching)"
else
  fail "No identify sections loaded - calls won't be accepted"
fi

# 6. Dialplan loaded?
echo "--- 6. Dialplan ---"
DID_COUNT=$(sudo asterisk -rx "dialplan show did-routing" 2>/dev/null | grep -c "exten =>" || echo 0)
if [ "$DID_COUNT" -gt 0 ]; then
  ok "$DID_COUNT extensions in did-routing context"
else
  fail "did-routing context is empty"
  echo "  Fix: Apply changes from dashboard"
fi

IVR_CHECK=$(sudo asterisk -rx "dialplan show ivr-1" 2>/dev/null | grep -c "Answer" || echo 0)
if [ "$IVR_CHECK" -gt 0 ]; then
  ok "IVR-1 context exists and has Answer()"
else
  fail "IVR-1 context missing"
fi

# 7. Firewall check
echo "--- 7. Firewall (iptables) ---"
SUPPLIER_IPS="108.61.70.46 157.90.193.196 51.77.77.223 95.217.90.21 52.28.165.40 52.57.172.184 35.156.119.128 149.12.160.10 93.94.120.49 185.209.147.14"

for IP in $SUPPLIER_IPS; do
  if iptables -L INPUT -n 2>/dev/null | grep -q "$IP.*5060"; then
    ok "Supplier $IP allowed on port 5060"
  else
    fail "Supplier $IP NOT in firewall - calls will be blocked!"
    echo "  Fix: sudo iptables -I INPUT -s $IP -p udp --dport 5060 -j ACCEPT"
    echo "       sudo iptables -I INPUT -s $IP -p udp --dport 10000:20000 -j ACCEPT"
  fi
done

# Check if DROP rule exists for 5060
if iptables -L INPUT -n 2>/dev/null | grep -q "DROP.*udp dpt:5060"; then
  ok "DROP rule active for unknown IPs on port 5060"
else
  warn "No DROP rule for port 5060 - unknown IPs can reach Asterisk"
fi

# 8. RTP ports
echo "--- 8. RTP Ports ---"
if iptables -L INPUT -n 2>/dev/null | grep -q "10000:20000"; then
  ok "RTP ports 10000-20000 have firewall rules"
else
  warn "No RTP rules found - audio may not work"
  echo "  Fix: sudo iptables -I INPUT -p udp --dport 10000:20000 -j ACCEPT"
fi

# 9. DigitalOcean cloud firewall check
echo "--- 9. DigitalOcean Cloud Firewall ---"
echo "  Cannot check from inside the VPS."
echo "  Go to: https://cloud.digitalocean.com/networking/firewalls"
echo "  Make sure NO cloud firewall is attached to this droplet."
echo "  If one exists, add these inbound rules:"
echo "    - UDP 5060 from: 108.61.70.46,157.90.193.196,51.77.77.223,95.217.90.21,52.28.165.40,52.57.172.184,35.156.119.128,149.12.160.10,93.94.120.49,185.209.147.14"
echo "    - UDP 10000-20000 from anywhere"
echo "    - TCP 3000 from anywhere (dashboard)"
echo "    - TCP 22 from anywhere (SSH)"

# 10. Test SIP connectivity
echo ""
echo "--- 10. Quick SIP Test ---"
echo "  Testing if supplier 157.90.193.196 can reach port 5060..."
# We can't test from inside, but we can check if any recent SIP traffic exists
RECENT=$(sudo asterisk -rx "pjsip show endpoint supplier-trunk" 2>/dev/null | grep -i "status\|contact" | head -3)
echo "  $RECENT"

echo ""
echo "============================================"
echo "  Summary"
echo "============================================"
echo ""
echo "  Dashboard: http://167.172.170.88:3000"
echo "  SIP Port:  167.172.170.88:5060 (UDP)"
echo ""
echo "  If calls still don't work:"
echo "  1. Check DigitalOcean cloud firewall (step 9 above)"
echo "  2. Ask provider: 'What exact IP do you send SIP from?'"
echo "  3. Run: sudo tcpdump -n -i any port 5060 -c 20"
echo "     to see if ANY packets arrive when provider sends call"
echo "============================================"
