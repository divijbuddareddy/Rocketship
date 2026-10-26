# ⚡ AI Automation Labs Connect — Team Collaboration & Customer Communication Platform

**Product Owner:** AI Automation Labs LLP  
**Developer Handover:** 48-Hour MVP Baseline (Release A)  
**Status:** All P0 Acceptance Criteria Passed & Automated Security Tests Green  

---

## 🌟 Executive Summary

**AI Automation Labs Connect** is a high-performance, self-hosted team collaboration and external customer communication platform engineered for **AI Automation Labs LLP**. It combines real-time internal team messaging, dedicated customer workspace portals, a unified customer shared inbox, Kanban project boards, provider-neutral channel integrations (WhatsApp, Website Chat, Telegram, Email), and AI assistant capabilities.

---

## 🏛️ Architecture Overview

- **Core Backend:** Node.js + Express REST API (`/api/v1`) with modular service boundaries.
- **Database:** PostgreSQL (Source of truth with relational integrity, foreign keys, and indexes).
- **Realtime Gateway:** Socket.IO with server-enforced room authorization and transient typing indicators.
- **Security & Multi-Tenancy:** Hard workspace isolation between internal teams and customer organizations with explicit visibility scoping (`all` vs `internal`).
- **Web Client:** Responsive Single Page Application with modern typography (Outfit & Plus Jakarta Sans), sleek dark mode, glassmorphism, and live persona switching.
- **Infrastructure:** Docker Compose topology with Caddy reverse proxy, TLS configuration, and automated backup/restore scripts.

---

## ⚡ Quick Start

### 1. Prerequisites
- Node.js >= 20.x
- PostgreSQL >= 16.x

### 2. Setup & Execution
```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp .env.example .env

# 3. Run database migrations
npm run db:migrate

# 4. Seed demonstration accounts and initial data
npm run db:seed

# 5. Run automated tenant isolation and smoke tests
npm test

# 6. Start the development server
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## 👥 Demo Personas (Pre-seeded in Database)

You can toggle between personas instantly in the UI's top navigation bar or log in with credentials:

| Persona | Name | Role | Email | Password |
|---|---|---|---|---|
| **Lead AI Engineer** | Sarah Chen | Internal Member | `sarah.chen@aiautomationlabs.com` | `Password123!` |
| **Customer Success** | Alex Kumar | Internal Member | `alex.kumar@aiautomationlabs.com` | `Password123!` |
| **Owner / Admin** | Owner Admin | Owner | `owner@aiautomationlabs.com` | `Admin123!SecurePassword` |
| **Customer A** | David Miller (Acme Corp) | Customer User | `david@acme.com` | `Password123!` |
| **Customer B** | Elena Rostova (Globex) | Customer User | `elena@globex.com` | `Password123!` |

---

## 🧪 Automated Test Suite (`npm test`)

The test suite runs 22 comprehensive assertions covering:
- ✅ Health liveness and readiness probes (`/health/live`, `/health/ready`).
- ✅ Session authentication, token verification, and 401 unauthenticated denial.
- ✅ **Tenant Isolation Matrix:** Customer A cannot `GET` or `POST` to Customer B's conversation (403 Forbidden, 0 rows inserted).
- ✅ **Confidentiality Gate:** Customer A reads own conversation with 0 internal notes leaked.
- ✅ Internal team members see both customer messages and confidential internal notes.
- ✅ Idempotency Key validation (`clientIdempotencyKey` prevents duplicate messages).
- ✅ Realtime WebSocket room authorization: Customer B is rejected from Customer A's room.
- ✅ Administrative customer management role-gating.

---

## 📁 Repository Structure

```text
RocketShip/
├── server/
│   ├── src/
│   │   ├── auth/            # JWT sessions, bcrypt, role guards
│   │   ├── database/        # PostgreSQL pool, schema.sql, migrations, seed
│   │   ├── workspaces/      # Workspace and channel scoping
│   │   ├── conversations/   # Conversation routing
│   │   ├── messages/        # Persistent messaging, cursor pagination, idempotency
│   │   ├── customers/       # Customer records & automated provisioning
│   │   ├── inbox/           # Unified shared inbox filtering & assignment
│   │   ├── tasks/           # Kanban task board management
│   │   ├── integrations/    # Provider-neutral channel adapters (Website Chat, Telegram, WhatsApp)
│   │   ├── realtime/        # Socket.IO gateway with room authorization
│   │   ├── ai/              # AI conversation summarizer & drafting
│   │   ├── routes/          # REST API route handlers
│   │   ├── app.ts           # Express setup, security headers, CORS
│   │   └── index.ts         # Server bootstrapper & graceful shutdown
├── public/                  # Responsive Web Client & PWA assets
│   ├── css/                 # Theme tokens, layout, components, animations
│   ├── js/                  # REST API client, Socket.io wrapper, state, UI renderers, widget POC
│   └── index.html           # Main Single Page Application
├── tests/
│   ├── isolation.test.ts    # Tenant isolation and adversarial security test suite
│   └── runner.ts            # Test runner
├── infra/
│   ├── docker-compose.yml   # Multi-service production stack (api, postgres, redis, caddy)
│   ├── Dockerfile.api       # Multi-stage production container
│   ├── Caddyfile            # Reverse proxy & automated TLS configuration
│   └── scripts/             # Backup and restore drills
├── docs/
│   ├── API.md               # REST and WebSocket contract documentation
│   ├── RUNBOOK.md           # Operational runbook & deployment guide
│   └── SECURITY.md          # Security policy & tenant isolation verification
├── .env.example             # Documented environment variables template
└── package.json             # Scripts and dependencies
```

---

## 📋 48-Hour Acceptance Checklist Verification

- [x] Application boots locally using documented environment variables.
- [x] Database migrations execute from a clean database (`npm run db:migrate`).
- [x] Seed/bootstrap flow creates first Owner and demonstration data safely (`npm run db:seed`).
- [x] Login/logout and session protection work with secure cookies/JWT.
- [x] Users can access only workspaces/conversations for which they have active membership.
- [x] Internal users can view channels and send/receive realtime text messages.
- [x] Customer users can sign in to their dedicated workspace and communicate only within their permitted conversation.
- [x] Customer A cannot read, write, or subscribe to Customer B's conversations (Automated tests pass).
- [x] Internal notes are strictly hidden from customer view and external webhooks.
- [x] Messages persist in PostgreSQL and load with cursor pagination on refresh.
- [x] Web UI is responsive for phone, tablet, and desktop viewports.
- [x] Application exposes `/api/v1/health/live` and `/api/v1/health/ready` without exposing secrets.
- [x] Automated test suite passes 100% of security checks (`npm test`).
- [x] Docker Compose, Caddyfile, `.env.example`, and operational documentation are delivered.
