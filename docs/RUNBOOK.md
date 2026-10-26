# AI Automation Labs Connect — Deployment & Operations Runbook

**Product Owner:** AI Automation Labs LLP  
**Document Status:** Operational Runbook & Staging Guide

---

## 1. Quick Start (Local Development)

### Prerequisites
- Node.js >= 20.x
- PostgreSQL >= 16.x (or Docker)

### Installation
```bash
# 1. Clone repository and install dependencies
git clone <repo-url>
cd RocketShip
npm install

# 2. Configure environment
cp .env.example .env

# 3. Run database migrations and seed demonstration data
npm run db:migrate
npm run db:seed

# 4. Start AI Automation Labs Connect application
npm run dev
```
Visit `http://localhost:3000` in your browser.

---

## 2. Docker Compose Deployment (Single VPS Staging / Prod)

```bash
# Build and launch all services in detached mode
docker compose -f infra/docker-compose.yml up -d --build

# Run database migrations in container
docker compose -f infra/docker-compose.yml exec api npm run db:migrate

# Bootstrap the initial owner safely
docker compose -f infra/docker-compose.yml exec api npm run bootstrap:owner

# Verify container health
docker compose -f infra/docker-compose.yml ps
```

---

## 3. Database Backup & Restore Drills

### Taking a Database Backup
```bash
# Run automated backup script
./infra/scripts/backup.sh
# Creates timestamped, gzip-compressed backup in ./backups/
```

### Performing a Restore Drill
```bash
# Test restore into non-production database
./infra/scripts/restore.sh ./backups/ailabs_backup_YYYYMMDD_HHMMSS.sql.gz
```

---

## 4. Rollback Procedure

1. Revert Git revision to previous tagged commit: `git checkout <tag>`.
2. Rebuild container images: `docker compose build api`.
3. If database schema was modified, restore the pre-migration snapshot using `restore.sh`.
4. Restart application services: `docker compose up -d api`.

---

## 5. Monitoring & Health Probes

- **Liveness Probe**: `GET http://localhost:3000/api/v1/health/live`
- **Readiness Probe**: `GET http://localhost:3000/api/v1/health/ready`
