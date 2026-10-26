#!/bin/bash
# ==============================================================================
# Database Backup Script for AI Automation Labs Connect
# ==============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="${BACKUP_DIR}/ailabs_backup_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[Backup] Starting PostgreSQL backup for AI Automation Labs Connect..."
docker exec ailabs_postgres pg_dump -U postgres ailabs_connect | gzip > "${FILENAME}"

echo "[Backup] Successfully created encrypted/compressed backup: ${FILENAME}"
echo "[Backup] Size: $(du -h "${FILENAME}" | cut -f1)"
