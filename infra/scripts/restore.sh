#!/bin/bash
# ==============================================================================
# Database Restore Rehearsal Script for AI Automation Labs Connect
# ==============================================================================
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <path_to_backup_file.sql.gz>"
  exit 1
fi

BACKUP_FILE="$1"
if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Error: Backup file '${BACKUP_FILE}' not found."
  exit 1
fi

echo "[Restore] Restoring database from: ${BACKUP_FILE}..."
gunzip -c "${BACKUP_FILE}" | docker exec -i ailabs_postgres psql -U postgres -d ailabs_connect

echo "[Restore] Database restore completed successfully."
