# platform-db

SQL schemas and reference migrations for the carrier stack. **No runtime code.**

- Apply manually with `mysql`, or reference from ops docs.
- `platform-ami` applies idempotent `call_logs` AMI columns at startup (same DDL intent).

## Layout

```
platform-db/sql/
```
