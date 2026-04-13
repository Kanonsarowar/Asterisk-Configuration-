# platform-db

SQL schemas and reference migrations for the carrier stack. **No runtime code.**

- Apply manually with `mysql`, or reference from ops docs.
- `platform-ami` applies idempotent `call_logs` AMI columns at startup (same DDL intent).

## Layout

```
platform-db/sql/
```

See **`iprn_audio_ivr_core.sql`** for IPRN audio IVR supplemental tables (`platform_users`, `user_dids`, `audio_map`, `audio_files`, `billing_accounts`, `invoices`, `audit_logs`). The API applies compatible `call_logs` columns at startup when possible.
