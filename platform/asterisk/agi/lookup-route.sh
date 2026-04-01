#!/bin/bash
# Minimal AGI helper: calls platform API and prints JSON to stdout (extend to SET VARIABLE).
# Env: IPRN_BASE=http://127.0.0.1:3010  IPRN_INTERNAL_KEY=...
set -euo pipefail
DID="${1:-}"
[ -n "$DID" ] || exit 1
curl -sS -m 3 -H "X-Internal-Key: ${IPRN_INTERNAL_KEY}" "${IPRN_BASE:-http://127.0.0.1:3010}/route/${DID}"
