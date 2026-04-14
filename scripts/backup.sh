#!/usr/bin/env bash
# Usage: bash scripts/backup.sh
# Creates a timestamped backup of the DTSYS database

set -euo pipefail

if [ ! -f .env ]; then
  echo "Error: .env not found. Run make dev first." >&2
  exit 1
fi

set -a
source .env
set +a

BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"
FILENAME="$BACKUP_DIR/dtsys-$(date +%Y%m%d-%H%M%S).sql.gz"

docker compose -f docker-compose.dev.yml exec -T postgres \
    pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$FILENAME"

echo "Backup saved to: $FILENAME"
ls -lh "$FILENAME"
