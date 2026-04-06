#!/usr/bin/env bash
# Daily backup: MySQL, Asterisk config, deploy env (adjust paths).
# Cron: 0 3 * * * /path/to/repo/deploy/scripts/backup.sh
set -euo pipefail

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/telecom}"
mkdir -p "$BACKUP_ROOT/$STAMP"

# --- MySQL (set in environment or edit) ---
: "${MYSQL_DATABASE:?Set MYSQL_DATABASE}"
: "${MYSQL_USER:?Set MYSQL_USER}"
MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
DUMP_FILE="$BACKUP_ROOT/$STAMP/mysql-${MYSQL_DATABASE}.sql.gz"
mysqldump -h"$MYSQL_HOST" -u"$MYSQL_USER" -p"${MYSQL_PASSWORD:-}" \
  --single-transaction --routines --triggers "$MYSQL_DATABASE" | gzip >"$DUMP_FILE"
echo "Wrote $DUMP_FILE"

# --- Asterisk config ---
AST_CFG="${ASTERISK_CONFIG_DIR:-/etc/asterisk}"
if [[ -d "$AST_CFG" ]]; then
  tar czf "$BACKUP_ROOT/$STAMP/asterisk-config.tar.gz" -C "$(dirname "$AST_CFG")" "$(basename "$AST_CFG")"
  echo "Wrote asterisk-config.tar.gz"
fi

# --- API .env (no secrets in git) ---
API_ENV="${API_ENV_FILE:-$(dirname "$0")/../../platform/api/.env}"
if [[ -f "$API_ENV" ]]; then
  install -m 600 "$API_ENV" "$BACKUP_ROOT/$STAMP/api.env"
fi

# --- Optional: generated configs ---
GEN_DIR="${ASTERISK_GENERATED_DIR:-}"
if [[ -n "$GEN_DIR" && -d "$GEN_DIR" ]]; then
  tar czf "$BACKUP_ROOT/$STAMP/asterisk-generated.tar.gz" -C "$(dirname "$GEN_DIR")" "$(basename "$GEN_DIR")"
fi

echo "Backup complete: $BACKUP_ROOT/$STAMP"
find "$BACKUP_ROOT" -maxdepth 1 -type d -name '20*' -mtime +14 -exec rm -rf {} + 2>/dev/null || true
