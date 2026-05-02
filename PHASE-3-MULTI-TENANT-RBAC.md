# Phase-3: Multi-Tenant Admin + Client Dashboard

## Overview

Phase-3 transforms the IPRN Dashboard into a **multi-tenant, role-based system** where:

- **One backend** manages both admin and client portals
- **One database** with tenant isolation
- **One UI** with role-based access control
- **Admin** manages suppliers, trunk, rates, clients, and applies Asterisk config
- **Clients** manage their own numbers, orders, balance, CDR, and limited features

---

## Architecture

```
Dashboard (One App)
├── /api/admin/* (Admin-only routes)
│   ├── /clients - Manage clients (CRUD)
│   ├── /numbers/assign - Assign DIDs to clients
│   ├── /rates - Set tariffs
│   ├── /suppliers - Manage SIP providers
│   ├── /trunk - Configure trunk globally
│   ├── /ivr - Create IVR slots
│   ├── /cdr - View all CDR
│   ├── /stats - Dashboard analytics
│   └── /asterisk/apply - Generate & reload config
│
├── /api/client/* (Client-only routes, tenant-isolated)
│   ├── /numbers - View assigned DIDs
│   ├── /order-numbers - Request additional numbers
│   ├── /rates - View tariffs
│   ├── /balance - Check account credit
│   ├── /cdr - View own CDR
│   ├── /live-calls - See active calls
│   ├── /ivr - Manage assigned IVR
│   ├── /subaccounts - Manage sub-users (if enabled)
│   └── /test-call - Test outbound
│
└── /auth
    ├── /login - Admin + Client login
    └── /refresh-token
```

---

## Database Schema

### Key Tables

**users** - All accounts (admin + client users)
```sql
id, username, password_hash, email, role, client_id, status, parent_user_id, balance
```

**clients** - Tenant accounts
```sql
id, name, company_name, status, credit_limit, current_balance, plan_type, admin_user_id
```

**numbers** - DID inventory with tenant ownership
```sql
id, client_id, did, country, prefix, supplier_id, ivr_id, status, rate_per_minute
```

**rates** - Tariff definitions (global)
```sql
id, country, prefix, setup_fee, monthly_fee, per_minute, active
```

**cdr** - Call detail records with tenant tracking
```sql
id, client_id, source_number, destination_number, billable_seconds, call_cost, status
```

**balances** - Client credit tracking
```sql
client_id, currency, current_balance, available_credit
```

**suppliers** - SIP providers (global, admin-only)
```sql
id, name, sip_host, ip_addresses, status, cost_per_minute
```

**trunk_config** - Global settings (admin-only)
```sql
setting_key, setting_value (sip_port, rtp_range, codecs, etc.)
```

**client_features** - Feature toggles per tenant
```sql
client_id, feature_name, enabled, parameters
```

---

## Installation

### Step 1: Setup Database

```bash
# Option A: Using MySQL (recommended for production)
mysql -u root -p iprn < dashboard/sql/phase3-schema.sql

# Option B: Using SQLite (for development)
# Schema auto-created on first run
```

### Step 2: Install Dependencies

```bash
cd /opt/asterisk-dashboard
npm install jsonwebtoken bcryptjs express-jwt
```

### Step 3: Run Phase-3 Setup Script

```bash
sudo bash phase3-setup.sh
```

### Step 4: Update Environment

```bash
# Edit /opt/asterisk-dashboard/.env
RBAC_ENABLED=1
MULTI_TENANT_MODE=1
JWT_SECRET=$(openssl rand -hex 32)
MYSQL_ENABLED=1
```

### Step 5: Restart Dashboard

```bash
sudo systemctl restart asterisk-dashboard
```

---

## API Usage

### Admin Authentication

```bash
# Login as admin
curl -X POST http://72.60.190.132:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Response:
{
  "token": "eyJhbGc...",
  "user": {"id": 1, "role": "admin"}
}

# Use token in subsequent requests
curl -X GET http://72.60.190.132:3000/api/admin/clients \
  -H "Authorization: Bearer eyJhbGc..."
```

### Admin: Create Client

```bash
curl -X POST http://72.60.190.132:3000/api/admin/clients \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Customer ABC",
    "company_name": "ABC Corp",
    "plan_type": "premium",
    "credit_limit": 1000.00,
    "contact_email": "admin@abc.com"
  }'
```

### Admin: Assign Numbers to Client

```bash
curl -X POST http://72.60.190.132:3000/api/admin/numbers/assign \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": 2,
    "did_start": "441234567890",
    "did_end": "441234567999",
    "country": "UK",
    "supplier_id": 1,
    "rate_per_minute": 0.05
  }'
```

### Admin: Set Rates

```bash
curl -X POST http://72.60.190.132:3000/api/admin/rates \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "country": "United Kingdom",
    "prefix": "44",
    "setup_fee": 5.00,
    "monthly_fee": 10.00,
    "per_minute": 0.05
  }'
```

### Client Authentication

```bash
# Login as client
curl -X POST http://72.60.190.132:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"client_user","password":"password123"}'

# Response includes client_id in token
{
  "token": "eyJhbGc...",
  "user": {"id": 5, "role": "client_user", "client_id": 2}
}
```

### Client: View My Numbers

```bash
curl -X GET http://72.60.190.132:3000/api/client/numbers \
  -H "Authorization: Bearer TOKEN"

# Response - ONLY their assigned numbers
[
  {
    "id": 1,
    "did": "441234567890",
    "country": "UK",
    "status": "active",
    "rate_per_minute": 0.05
  }
]
```

### Client: Check Balance

```bash
curl -X GET http://72.60.190.132:3000/api/client/balance \
  -H "Authorization: Bearer TOKEN"

# Response
{
  "client_id": 2,
  "currency": "USD",
  "current_balance": 850.00,
  "available_credit": 850.00
}
```

### Client: View CDR (Own Calls Only)

```bash
curl -X GET "http://72.60.190.132:3000/api/client/cdr?start_date=2026-05-01&limit=50" \
  -H "Authorization: Bearer TOKEN"

# Response - ONLY their calls
[
  {
    "id": 1001,
    "source_number": "441234567890",
    "destination_number": "+15551234567",
    "billable_seconds": 120,
    "call_cost": 0.10,
    "status": "completed"
  }
]
```

### Client: Order Numbers

```bash
curl -X POST http://72.60.190.132:3000/api/client/order-numbers \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requested_country": "USA",
    "requested_quantity": 10,
    "requested_features": ["sms", "ivr"]
  }'

# Response
{
  "id": 101,
  "message": "Number request submitted - awaiting admin approval",
  "status": "pending"
}
```

---

## UI Views

### Admin Dashboard

**Menu Items:**
- Dashboard (stats, analytics)
- Clients (list, create, edit, view balance)
- Numbers (assign, revoke, search)
- Rates (set tariffs per country)
- Suppliers (manage SIP providers)
- Trunk Config (global settings)
- IVR Slots (admin-created slots)
- CDR (all calls, search, export)
- Live Calls (monitor active calls)
- Reports (usage, revenue, etc.)
- Settings (admin users, system config)

### Client Portal

**Menu Items:**
- Dashboard (balance, quick stats)
- My Numbers (list assigned DIDs)
- Order Numbers (request additional, view requests)
- Rates (view tariffs)
- My Calls (own CDR)
- Live Calls (see their active calls) [if enabled]
- Test Panel (test outbound) [if enabled]
- IVR (manage assigned slots) [if enabled]
- Sub-Accounts (create sub-users) [if enabled]
- Account Settings (password, profile)

---

## Role-Based Access Control (RBAC)

### Roles & Permissions

| Feature | Admin | Client Admin | Client User | Subuser |
|---------|-------|-------------|------------|---------|
| Manage Clients | ✓ | — | — | — |
| View All Numbers | ✓ | — | — | — |
| Assign Numbers | ✓ | — | — | — |
| View Own Numbers | ✓ | ✓ | ✓ | ✓ |
| Order Numbers | — | ✓ | ✓ | — |
| Set Rates | ✓ | — | — | — |
| View All CDR | ✓ | — | — | — |
| View Own CDR | — | ✓ | ✓ | ✓ |
| Manage Suppliers | ✓ | — | — | — |
| Manage Trunk | ✓ | — | — | — |
| Apply Asterisk Config | ✓ | — | — | — |
| Create Sub-Users | — | ✓ | — | — |
| Manage Sub-Accounts | — | ✓ | — | — |
| Live Calls | ✓ | ✓* | ✓* | — |
| Test Panel | ✓ | ✓* | ✓* | — |
| IVR Management | ✓ | ✓* | ✓* | — |

*Only if feature enabled for that client

---

## Tenant Isolation

All queries are automatically scoped:

```javascript
// Admin sees all
GET /api/admin/cdr → returns ALL calls

// Client sees only their data
GET /api/client/cdr → returns only WHERE client_id = current_user.client_id

// Middleware enforces this at every endpoint
```

---

## Feature Toggles

Admins can enable/disable features per client:

```sql
-- Enable sub-accounts for client 2
INSERT INTO client_features (client_id, feature_name, enabled)
VALUES (2, 'subaccounts', 1);

-- Disable live calls for client 3
INSERT INTO client_features (client_id, feature_name, enabled)
VALUES (3, 'live_calls', 0);
```

---

## Asterisk Integration

When admin clicks "Apply & Reload":

1. Backend queries all active clients + their numbers
2. Generates unified `extensions.conf` with:
   - `from-supplier-ip` (for all suppliers)
   - `did-routing` context (routes DIDs to correct client IVR)
3. Generates `pjsip.conf` with supplier transports
4. Generates `acl.conf` with supplier IPs
5. Copies configs to `/etc/asterisk/`
6. Reloads Asterisk
7. **Result:** All clients instantly see their numbers active

---

## Migration from Phase-2

If you have an existing Phase-2 installation:

```bash
# 1. Backup existing db.json
cp /opt/asterisk-dashboard/data/db.json ~/db-backup-phase2.json

# 2. Run phase3-setup.sh (handles migration)
sudo bash phase3-setup.sh

# 3. Create default client
# Admin can now create new clients via /api/admin/clients

# 4. Migrate existing DIDs to new client
# Use bulk import or /api/admin/numbers/assign
```

---

## Monitoring & Logs

### Check Service

```bash
sudo systemctl status asterisk-dashboard
sudo journalctl -u asterisk-dashboard -f
```

### View Audit Log

```sql
SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 100;
```

### Check Tenant Isolation

```sql
-- Verify client 2 can only see own numbers
SELECT * FROM numbers WHERE client_id = 2;

-- Verify client 2's balance
SELECT * FROM balances WHERE client_id = 2;

-- Verify client 2's CDR
SELECT * FROM cdr WHERE client_id = 2;
```

---

## Next Steps

1. ✅ Install Phase-3 schema (`phase3-setup.sh`)
2. ✅ Create first client via `/api/admin/clients`
3. ✅ Create client user account
4. ✅ Assign numbers via `/api/admin/numbers/assign`
5. ✅ Set rates via `/api/admin/rates`
6. ✅ Login as client and verify isolation
7. ✅ Test client features
8. ✅ Enable/disable features per client
9. ✅ Run admin "Apply & Reload Asterisk"
10. ✅ Monitor CDR and billing

---

## Troubleshooting

**Q: Client can see other client's numbers?**
A: Tenant isolation middleware not applied. Check middleware in server.js.

**Q: Token expiration errors?**
A: Set JWT_SECRET and JWT_EXPIRY in .env

**Q: Admin "Apply & Reload" not working?**
A: Check Asterisk integration in config-generator.js

**Q: Sub-accounts not appearing?**
A: Verify feature enabled in client_features table

---

**Phase-3 Status:** Ready for deployment  
**Date:** 2026-05-02  
**VPS:** 72.60.190.132

