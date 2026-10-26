---
title: "Rocket.Ship"
subtitle: "Product Requirements Document (PRD), Technical Specification & Developer Handover"
author: "AI Automation Labs LLP"
date: "19 October 2026"
---

**Product owner:** AI Automation Labs LLP  
**Product:** Rocket.Ship — team collaboration and external customer communication  
**Document status:** Developer handover baseline — scope and acceptance gates  
**Prepared:** 19 October 2026  
**Deadline requested:** 48 hours / 2 calendar days for the initial working MVP  
**Target initial usage:** 15 internal team members + 20 external customer users  
**Deployment preference:** Self-hosted VPS; open-source components; no mandatory per-seat software licence where avoidable

> **Critical delivery note:** A complete Slack-like product with eight external channel types, native iOS/Android/Windows/macOS clients, AI, workflow automation, task boards, and production voice/video cannot be responsibly built, integrated, security-tested, and released from scratch in 48 hours. This document therefore defines (1) a firm 48-hour MVP acceptance target and (2) a sequenced roadmap for the full product. The developer must not label unimplemented integrations or simulated features as production-ready. If every feature is required by the deadline, the only credible alternative is to configure and customise an existing mature platform rather than build the entire product from scratch.

---

# Contents {.unnumbered}

1. Executive Summary
2. Scope and Delivery Boundaries
3. Users, Roles and Permission Model
4. Functional Requirements and Acceptance Criteria
5. UI / Navigation Requirements
6. Technical Architecture
7. Data Model and Database Specification
8. Data to Be Collected and Configuration Inputs
9. API and Realtime Contract
10. Security, Privacy and Reliability
11. Deployment and Operations
12. Test Strategy and Release Gate
13. Detailed 48-Hour Timeline
14. Full-Product Roadmap After the 48-Hour MVP
15. Risks, Dependencies and Decisions
16. Definition of Done and Developer Handover
17. Official Technical References
18. Final Instruction to the Developer

# Executive Summary

Rocket.Ship is a self-hosted collaboration application for AI Automation Labs. It combines internal team messaging, customer-specific workspaces, an external customer portal, a shared inbox for external channels, project/task collaboration, AI assistance, workflow automation, and audio/video meetings.

The application must work on phone, tablet, and laptop. The initial release should prioritise a responsive web application/PWA so users can access the system quickly from iOS, Android, Windows, and macOS browsers. Native mobile and desktop packages should share the same backend and product APIs and be delivered in later milestones.

## Product goals

1. Provide a dependable, real-time internal chat tool for the company.
2. Enable external customers to sign in to an isolated customer portal and communicate with assigned AI Automation Labs personnel.
3. Create a provider-neutral integration layer for WhatsApp, website live chat, email, Instagram DMs, Telegram, Facebook Messenger, SMS, and future channels.
4. Support projects, tasks, file sharing, search, notifications, workflows, AI assistance, and calls as the platform matures.
5. Self-host the core application, retain control of company data, and avoid per-seat licensing where open-source alternatives are practical.
6. Deliver a working MVP in 48 hours, with a demonstrable user journey, source code, migrations, container setup, and test results.

## Success measures

| Measure | MVP acceptance target | Full-product direction |
|---|---|---|
| Internal users | 15 initial accounts supported | Role-based company-wide accounts |
| External users | 20 initial accounts supported | Separate customer workspaces and invited participants |
| Message persistence | Messages survive refresh and API restart | Durable history, search, retention and export |
| Realtime delivery | Connected recipients see new messages without refresh | Reliable reconnect, delivery state and notification controls |
| Tenant isolation | Customer A cannot read Customer B or internal-only records | Automated isolation tests cover every data and event path |
| Responsive access | Usable desktop and phone web experience | Native iOS/Android plus Windows/macOS packages |
| Deployment | Reproducible Docker Compose deployment | Automated releases, monitoring, restore drills and upgrade path |
| Integration integrity | Adapter contract plus documented configuration; no fake “live” integrations | Approved, tested and monitored provider integrations |

## Product principles

- Security and customer isolation are non-negotiable.
- Persisted server data, not browser state, is the source of truth.
- Every customer-facing record has explicit scope and access checks.
- Provider adapters are isolated from core messaging logic.
- External-provider credentials must never be committed to source control.
- Prefer maintained, permissively compatible open-source software, and review licence obligations before distribution.
- “Free forever” means no mandatory per-seat licence for the owned core software; it does not mean zero server, bandwidth, domain, mobile-store, AI, SMS, email, or channel-provider costs.

---

# Scope and Delivery Boundaries

## Release definitions

**Release A — 48-hour MVP (commitment target):** A working staging deployment with authentication, internal channels and direct conversations, persisted realtime text messages, customer portal login, customer-specific conversation isolation, basic admin/member/customer setup, responsive web UI/PWA baseline, initial API documentation, migrations, automated smoke/integration tests, and run instructions. A website-chat proof of concept or basic embed may be included only if the core acceptance gate is already green.

**Release B — Collaboration completion:** Attachments, search, reactions, threads, read/unread indicators, notification preferences, workspace and membership administration, audit events, full customer inbox assignment, website live-chat embed, robust invitations, email adapter, operational observability and backup restore drills.

**Release C — Channel integrations:** Official WhatsApp Business Platform, Telegram bot integration, Instagram messaging, Facebook Messenger, email inbound/outbound, SMS provider, retry/delivery tracking, templates/consent handling, channel health and provider-specific compliance. Availability depends on account ownership, API credentials, permissions, app review, provider policy and region.

**Release D — Productivity and AI:** Kanban/project boards, task management, workflow automation, audit-friendly execution history, AI summaries/drafting/knowledge retrieval and configurable AI providers.

**Release E — Calls and native clients:** Voice/video calls, screen sharing, TURN infrastructure, React Native mobile apps, packaged Windows/macOS desktop apps, push notifications, device testing, signing and app-store submissions.

## In-scope for the initial 48 hours (P0)

- Application boots locally and on a staging VPS using documented environment variables.
- Database migrations execute from a clean database.
- Seed/bootstrap flow creates the first Owner/Admin safely.
- Login/logout and session protection work.
- Users can access only workspaces/conversations for which they have membership and permission.
- Internal users can view channels/conversations and send/receive realtime text messages.
- Customer users can sign in to their dedicated workspace and send/receive messages only in their permitted customer conversation(s).
- Messages persist in PostgreSQL and are loaded on refresh using paginated history.
- Web UI is responsive for laptop and phone-sized viewports.
- Application has health/readiness endpoints and useful server logs without secrets.
- Smoke tests verify core message flow and cross-customer access denial.
- Docker Compose, `.env.example`, database migration/seed commands, deployment steps and handover notes are delivered.

## Explicitly not promised in 48 hours

- All eight external channel integrations enabled in production.
- Meta business verification, app review or permissions granted by third parties.
- Native binaries released through Apple App Store or Google Play.
- Production-grade group calling/screen sharing across restrictive corporate networks.
- Production AI features using real company knowledge, or guaranteed local model inference.
- Fully featured workflow designer, project boards, message search across all content, robust message editing/deletion history, enterprise SSO, multi-region HA or formal security certification.
- A zero-bug or production SLA guarantee without load tests, monitoring and an agreed operations budget.

---

# Users, Roles and Permission Model

## Personas

| Persona | Primary need | Typical device |
|---|---|---|
| Owner | Full configuration, access, integration, export and recovery control | Laptop |
| Workspace Admin | Manage users, roles, workspace settings and customer accounts | Laptop |
| Internal Member | Daily chat, files, projects, tasks and customer conversations assigned to them | Phone/laptop |
| Internal Guest/Contractor | Restricted access to explicitly granted internal channels or projects | Phone/laptop |
| Customer Admin | Manage own organisation’s portal users (only if enabled) | Phone/laptop |
| Customer User | Communicate with AI Automation Labs in own customer workspace | Phone/laptop |
| Integration/Bot Account | Process webhooks and post approved automated messages within scoped permissions | Service account |

## Baseline roles

- **Owner:** All administrative controls; bootstrap owner must be protected against accidental deletion/lockout.
- **Admin:** User/customer/workspace and integration configuration; no access to secrets in plaintext.
- **Internal Member:** Read/write internal channels they belong to; access assigned customer conversations; create tasks if authorised.
- **Internal Guest:** Only named channels/projects and assigned conversations.
- **Customer Admin:** Own customer workspace members and customer-visible content only; cannot invite internal members or change global settings.
- **Customer User:** Own customer workspace and explicitly shared items only.
- **Service Account:** Token-scoped, auditable access; no interactive login.

## Authorisation requirements

1. Deny access by default.
2. Every API request checks authenticated identity, membership, workspace scope, role, and record-level permission on the server.
3. Never trust workspace IDs, customer IDs, role names or `is_admin` values supplied only by the client.
4. Re-check permissions on every WebSocket subscription and message event, not only when the socket first connects.
5. A customer cannot list, search, infer or fetch another customer’s records, even by guessing IDs.
6. Customer-visible messages, internal notes and internal-only channel messages must be distinguishable in the data model and guarded in API serializers.
7. Customer-facing notifications and emails must be built from the same access policy as the UI.
8. File download endpoints must authorise access before returning a short-lived link or streaming the file.

---

# Functional Requirements and Acceptance Criteria

Priority labels: **P0** = 48-hour MVP; **P1** = next production milestone; **P2** = full-product roadmap.

## Authentication and onboarding

| ID | Priority | Requirement | Acceptance criteria |
|---|---|---|---|
| AUTH-01 | P0 | Email/password sign-in | Valid account can sign in; invalid credentials return generic error; password is never stored/logged in plaintext. |
| AUTH-02 | P0 | Logout/session expiry | Logout invalidates session; protected routes reject unauthenticated requests. |
| AUTH-03 | P0 | First admin bootstrap | Documented one-time command/environment configuration creates Owner; does not expose default production password. |
| AUTH-04 | P1 | Invitations and password reset | Invite token is random, time-limited, single-use and stored hashed; links use configured public URL. |
| AUTH-05 | P1 | MFA and session/device management | Optional TOTP or passkey; user can revoke other sessions. |
| AUTH-06 | P2 | SSO/OIDC/SAML | Enterprise login supported only after configuration and test coverage. |

**Implementation rule:** Use secure server-managed sessions with HttpOnly, Secure and appropriate SameSite cookies for the web client. Protect mutating routes against CSRF when cookie authentication is used. Hash passwords using Argon2id or a reviewed equivalent. Do not place long-lived bearer tokens in `localStorage`.

## Workspace and member administration

| ID | Priority | Requirement | Acceptance criteria |
|---|---|---|---|
| WS-01 | P0 | Internal workspace | Owner can create/default a company workspace and channels. |
| WS-02 | P0 | Customer workspace | Admin can create customer record and dedicated customer workspace/conversation. |
| WS-03 | P0 | Membership checks | Users see only workspaces to which they have membership or explicit access. |
| WS-04 | P1 | Invite/manage users | Admin can invite, deactivate, change roles and revoke sessions. |
| WS-05 | P1 | Customer user management | Customer Admin, if enabled, can manage only members belonging to their customer. |
| WS-06 | P1 | Audit trail | Membership/role changes record actor, target, timestamp and action. |

## Messaging

| ID | Priority | Requirement | Acceptance criteria |
|---|---|---|---|
| MSG-01 | P0 | Text messages | Message is validated, persisted, timestamped and returned with stable ID. |
| MSG-02 | P0 | Realtime delivery | Author and authorised connected recipients receive message event without page refresh. |
| MSG-03 | P0 | Message history | Reload returns persistent history, sorted chronologically and paginated by cursor. |
| MSG-04 | P0 | Conversation access | Attempt to read/post in an unauthorised conversation returns 403/404 without leaking record details. |
| MSG-05 | P1 | Threads and replies | Reply references a parent message; thread participants still require workspace permission. |
| MSG-06 | P1 | Reactions and read state | Reactions and user read cursor persist; duplicate reaction handling is deterministic. |
| MSG-07 | P1 | Edit/delete | Author or permitted admin can edit/soft-delete under documented time/policy rules; audit metadata retained as configured. |
| MSG-08 | P1 | Typing and presence | Transient events expire and are never treated as authoritative permission data. |
| MSG-09 | P1 | Search | Full-text search returns only messages the user is already authorised to access. |
| MSG-10 | P1 | Attachments | Files are size/type checked, stored outside public webroot, scanned where feasible and access-controlled. |
| MSG-11 | P2 | Advanced formatting | Safe Markdown/rich-text rendering; HTML sanitisation and link validation. |

Message requirements:

- Message body must support UTF-8 text and emoji.
- Use cursor-based pagination; default 50 messages per page, configurable.
- Persist server timestamp in UTC; render in the viewer’s local timezone.
- Support client-generated idempotency key for retrying a send without duplicating a message.
- Do not emit full message content, secrets or authentication data into ordinary application logs.
- Message events include only fields needed by recipients; enforce access before room broadcast.

## Customer portal and shared inbox

| ID | Priority | Requirement | Acceptance criteria |
|---|---|---|---|
| CUST-01 | P0 | Customer sign-in | Customer can authenticate and open their workspace. |
| CUST-02 | P0 | Customer isolation | Automated test proves customer A cannot access customer B’s conversation or internal channels. |
| CUST-03 | P0 | Customer conversation | Customer and authorised internal user exchange persisted messages. |
| CUST-04 | P1 | Unified inbox | Internal users can filter conversations by status, channel, assignee, customer and priority. |
| CUST-05 | P1 | Assignment and ownership | Assignment change emits an event and is auditable. |
| CUST-06 | P1 | Internal notes | Internal notes never appear in customer API responses, exports, notifications or channel outbound adapters. |
| CUST-07 | P1 | Statuses and tags | Open/pending/resolved states and tags are searchable and permission-controlled. |
| CUST-08 | P2 | SLA and escalation | Configurable response targets and alerts; no hardcoded business-hour assumptions. |

## External channel integrations

The product must use a provider-neutral adapter contract. Do not hardwire a WhatsApp payload shape into the core Message model.

| Channel | Planned method | Main prerequisites | Priority |
|---|---|---|---|
| Website live chat | Rocket.Ship-owned embeddable JavaScript widget + HTTPS API | Website origin allowlist, widget key, CSP/CORS rules | P1; earliest external channel |
| Email | SMTP/outbound plus inbound webhook or provider adapter | Domain DNS/SPF/DKIM/DMARC; provider/SMTP credentials | P1 |
| WhatsApp | Official WhatsApp Business Platform Cloud API | Meta business assets, phone number, access token, webhook verification, applicable messaging permissions/templates | P1/P2 depending on account readiness |
| Telegram | Official Telegram Bot API | Bot token; webhook URL or polling strategy | P1 |
| Instagram DMs | Official Meta messaging API | Eligible professional account, app configuration, required permissions and possible review | P2 |
| Facebook Messenger | Official Messenger Platform API | Page/app configuration, required permissions and possible review | P2 |
| SMS | Adapter for selected regional provider | Provider account, sender/number setup, regional compliance and budget | P2 |
| Other | Versioned adapter interface + webhook framework | Provider-specific contract and security review | P2 |

Provider adapter requirements:

- `verifyWebhook(request)` validates provider signature/token as applicable.
- `parseInbound(payload)` converts provider payload to a normalised inbound event.
- `sendMessage(conversation, message)` returns provider message ID and delivery result.
- `normaliseStatus(payload)` maps delivery/read/error status into an internal status vocabulary.
- Persist a provider event ID and idempotency key to prevent duplicate inbound messages.
- Retry transient errors with exponential backoff and jitter; send exhausted retries to a dead-letter queue or failed-event table.
- Record delivery state (`queued`, `sent`, `delivered`, `read`, `failed`, `unknown`) where provider supports it.
- Respect channel rules, consent, opt-outs, message templates and customer support windows as defined by each provider’s current terms.
- Never mark a channel “connected” until a real authenticated send and inbound webhook round trip passes.
- Store credentials in environment/secret storage or encrypted server-side; never show secret values again in admin UI.

## Tasks and project boards

**P2 product requirement (not part of the 48-hour commit):** projects contain lists/boards, tasks, status, assignee, due date, priority, description, labels, checklists, attachments, comments, created/updated timestamps, and an activity trail. Tasks may be created from a message with an explicit permission check and a source-message reference. Project members control visibility; customer-facing tasks must be explicitly shared.

## Workflow automation

**P2 product requirement:** event-condition-action workflows with versioning, trigger source, conditional branches, bounded retries, failure reporting, execution logs, pause/resume, and a manual test mode. Initial triggers: message received, conversation assigned/status changed, task created/due, webhook received, schedule. Initial actions: assign conversation, add tag, create task, send internal notification, send customer response only where channel policy and approval rules permit.

Safety guardrails:

- Avoid arbitrary code execution in user-created workflows for the initial versions.
- Bound execution time, payload size, retries and concurrency.
- Prevent loops using workflow execution IDs and event-origin metadata.
- Require approval before automations send sensitive or bulk external messages.

## AI assistant

**P2 product requirement:** configurable provider interface supporting a local model endpoint and/or hosted APIs; conversation summaries; reply drafting; action-item extraction; answer retrieval from permission-filtered knowledge; task creation suggestions; explicit user approval for outbound actions.

AI security rules:

- Retrieval/search must use the caller’s permissions before context is sent to an LLM.
- Never send internal messages into a customer conversation’s AI context unless the user is authorised and the purpose is explicitly approved.
- Treat message content, documents, webpages and tool outputs as untrusted input; resist prompt injection and unsafe tool execution.
- Store provider, model, token/usage metadata and opt-out settings; avoid retaining prompts/responses unnecessarily.
- Include clear human-review controls and provider-cost limits.

## Voice, video and screen sharing

**P2 product requirement:** use a dedicated WebRTC media service such as a self-hosted LiveKit deployment, not custom media transport written from scratch. Rocket.Ship generates short-lived room tokens only after checking workspace/conversation permissions. Test microphone/camera permission handling, TURN fallback, mobile lifecycle, network changes and reconnect behaviour. Call recording is off by default unless explicitly enabled with notice/consent and a retention policy.

## Cross-platform apps

- **P0:** responsive web app/PWA baseline; validate on phone and laptop widths and supported modern browsers.
- **P2:** React Native clients for iOS/Android; share API contracts, validation schemas and design tokens where practical.
- **P2:** Tauri-based Windows/macOS packaging after web flows stabilise. Desktop secure storage/notifications/deep links must be separately tested.
- Mobile push requires APNs/FCM setup and may require accounts/certificates. App-store publication is not a two-day deliverable.

---

# UI / Navigation Requirements

## Desktop navigation

Left sidebar:

1. Workspace switcher.
2. Search / quick switcher.
3. Internal channels.
4. Direct messages.
5. Customer inbox.
6. Projects/tasks (added in later milestone).
7. Calls/meetings.
8. Integrations and settings (role-gated).

Main area:

- Conversation header with name, members, context and permitted actions.
- Message timeline with sender, timestamp, reply/thread action where implemented.
- Composer with validation, send state and attachment control only when attachment backend is available.
- Loading, empty, offline/reconnect and error states.

## Mobile navigation

- Use a single-column layout with a clear back path between conversation list and detail.
- Composer must remain usable when the on-screen keyboard opens.
- Controls have accessible labels and touch targets.
- Avoid relying on hover, right-click or a wide desktop-only sidebar.
- Network loss should display state and retry; queued sends must use idempotency keys.

## Branding

Product name: **Rocket.Ship**. Organisation: **AI Automation Labs LLP**. Visual style: modern, crisp, professional; blue/black accents may be used, with accessible contrast and a light/dark mode architecture. Branding assets and exact logo are inputs from the product owner, not invented dependencies.

---

# Technical Architecture

## Recommended stack

| Layer | Proposed choice | Notes |
|---|---|---|
| Frontend | React + Next.js + TypeScript | Responsive web/PWA; do not duplicate business logic in the client. |
| Backend | NestJS + TypeScript | Modular REST API, guards, validation, WebSocket gateway and integration modules. |
| API contract | REST + OpenAPI; WebSocket events | Document schemas and error responses; version public APIs (`/api/v1`). |
| Database | PostgreSQL | Source of truth for users, memberships, messages, customers and audit records. |
| ORM/migrations | Prisma or reviewed TypeScript ORM | Use committed migrations; no auto-sync schema mutation in production. |
| Realtime | Socket.IO/WebSocket | Authenticated connection; authorise every room subscription and event. |
| Jobs/cache | Redis + BullMQ | Use for external delivery/retries and scheduled jobs; not source of truth for messages. |
| Object storage | S3-compatible abstraction | MVP can defer binary attachment implementation; production option must be access-controlled. Review licence and maintenance status of any self-hosted object store. |
| Reverse proxy/TLS | Caddy or NGINX | HTTPS only in staging/production; rate limiting and request size limits. |
| Deployment | Docker Compose initially | Single VPS for pilot; split database/media service when load/availability needs justify it. |
| Calls | Self-hosted LiveKit or equivalent | Later milestone; requires UDP/TCP/TURN and firewall configuration. |
| Desktop/mobile | Tauri + React Native | Later milestone; shared API and design system. |

## Architecture rules

- Use a modular monolith for the initial API; do not prematurely split every feature into microservices.
- Keep clear module boundaries: Auth, Users, Workspaces, Memberships, Conversations, Messages, Customers, Inbox, Integrations, Notifications, Projects, Tasks, Workflows, AI, Calls, Admin/Audit.
- Isolate provider adapters and media services behind interfaces.
- Use database transactions when membership changes, message writes or idempotency records must be consistent.
- Use an outbox pattern (or equivalent durable event dispatch) before relying on asynchronous side effects for important message delivery.
- Use UTC timestamps; generate IDs server-side (UUID/ULID acceptable) and never use sequential customer IDs in public URLs if avoidable.
- Keep schema migrations under version control and apply them explicitly during deploy.
- Never commit `.env`, tokens, webhook secrets or production database dumps.

## Suggested repository layout

```text
rocket-ship/
  apps/
    web/                 # Next.js responsive web app / PWA
    api/                 # NestJS REST + WebSocket API
    widget/              # Website-chat embed (later milestone)
    mobile/              # React Native app (later milestone)
    desktop/             # Tauri shell (later milestone)
  packages/
    contracts/           # Shared DTOs, schemas and API types
    ui/                  # Shared UI primitives/design tokens where suitable
    config/              # Linting, TypeScript and formatting configs
  infra/
    docker-compose.yml
    Caddyfile
    scripts/
    backups/
  docs/
    PRD.md
    API.md
    RUNBOOK.md
    SECURITY.md
  .env.example
  pnpm-workspace.yaml
  README.md
```

The exact monorepo tooling may vary, but avoid creating separate incompatible contracts for each client.

---

# Data Model and Database Specification

The following is a minimum logical model. The developer may adjust physical schemas if integrity and isolation guarantees are preserved.

## Core entities

| Entity | Key fields | Notes / constraints |
|---|---|---|
| `users` | `id`, `email`, `display_name`, `password_hash`, `status`, `created_at`, `updated_at`, `last_login_at` | Unique normalised email within the account model; no plaintext password; disabled users cannot authenticate. |
| `organisations` | `id`, `name`, `slug`, `created_at` | Initial organisation is AI Automation Labs LLP. |
| `customers` | `id`, `organisation_id`, `name`, `external_ref`, `status`, `primary_email`, `primary_phone`, `notes`, timestamps | Store only fields needed to operate the relationship; customer notes are internal-only. |
| `workspaces` | `id`, `organisation_id`, `customer_id` nullable, `kind`, `name`, `slug`, `created_at` | `kind` is `internal` or `customer`; enforce customer workspace relationship. |
| `workspace_memberships` | `id`, `workspace_id`, `user_id`, `role`, `status`, `joined_at`, `invited_by` | Unique active membership per workspace/user. |
| `conversations` | `id`, `workspace_id`, `kind`, `title`, `channel_type`, `status`, `priority`, `assigned_user_id`, `created_by`, timestamps | `channel_type` can be `internal`, `portal`, or provider key. Customer-visible vs internal-only scope must be explicit. |
| `conversation_participants` | `conversation_id`, `user_id`, `role`, `last_read_message_id`, `joined_at` | Enforce membership policy before participant addition. |
| `messages` | `id`, `conversation_id`, `workspace_id`, `author_user_id` nullable, `author_kind`, `message_type`, `visibility`, `body`, `parent_message_id` nullable, `client_idempotency_key`, timestamps, `edited_at`, `deleted_at` | Index conversation/time; unique author/idempotency key where appropriate; `visibility` distinguishes customer-visible content from internal notes. |
| `message_reactions` | `id`, `message_id`, `user_id`, `emoji`, `created_at` | Unique `(message_id,user_id,emoji)`. P1. |
| `attachments` | `id`, `message_id`, `storage_key`, `original_name`, `mime_type`, `size_bytes`, `checksum`, `scan_status`, `created_by`, `created_at` | Store metadata and private object key; do not expose bucket URLs directly. P1. |
| `integrations` | `id`, `organisation_id`, `provider`, `display_name`, `status`, `config_public_json`, `secret_ref`, `created_at`, `updated_at` | `secret_ref` points to secret manager/env-backed secret; never include secret material in returned JSON. |
| `external_identities` | `id`, `integration_id`, `customer_id`, `provider_user_id`, `provider_contact`, `display_name`, timestamps | Maps provider identities to internal contacts. Encrypt where appropriate; avoid logging private contact data. |
| `external_messages` | `id`, `integration_id`, `conversation_id`, `provider_message_id`, `provider_event_id`, `direction`, `status`, `payload_hash`, `sent_at`, `delivered_at`, `error_code` | Unique provider/event IDs for idempotency; raw payload storage should be limited, redacted and retention-controlled. |
| `invitations` | `id`, `email`, `workspace_id`, `role`, `token_hash`, `expires_at`, `used_at`, `invited_by` | Store token hash, not raw token. P1. |
| `audit_events` | `id`, `actor_user_id`, `action`, `target_type`, `target_id`, `workspace_id`, `ip_hash_or_policy_value`, `metadata_json`, `created_at` | Append-only intent; do not store passwords, tokens or complete message bodies in audit metadata. |
| `notifications` | `id`, `user_id`, `type`, `resource_type`, `resource_id`, `read_at`, `created_at` | Notification API must apply the same record access rules. P1. |
| `tasks` | `id`, `workspace_id`, `project_id`, `title`, `description`, `status`, `priority`, `assignee_user_id`, `due_at`, `created_by`, timestamps | P2. Explicit sharing flag/scope for customer workspaces. |
| `projects` | `id`, `workspace_id`, `name`, `description`, `visibility`, `created_by`, timestamps | P2. |
| `workflow_definitions` | `id`, `workspace_id`, `name`, `version`, `enabled`, `trigger_json`, `conditions_json`, `actions_json`, `created_by`, timestamps | P2. Validate against a strict schema; prohibit arbitrary code at first. |
| `workflow_runs` | `id`, `workflow_id`, `event_id`, `status`, `attempt`, `started_at`, `finished_at`, `error_code`, `safe_summary_json` | P2; do not log secrets or full private payloads. |
| `ai_usage_events` | `id`, `user_id`, `workspace_id`, `provider`, `model`, `usage_json`, `estimated_cost`, `created_at` | P2; usage fields depend on provider. Avoid storing prompts/responses unless needed and disclosed. |
| `calls` | `id`, `workspace_id`, `conversation_id`, `provider_room_id`, `created_by`, `started_at`, `ended_at`, `status` | P2; recording metadata only when recording is explicitly enabled. |

## Required database indexes and constraints

- Unique index on normalised user email according to selected sign-up/account policy.
- Index messages by `(conversation_id, created_at, id)` for history pagination.
- Index memberships by `(user_id, workspace_id, status)` and `(workspace_id, user_id)`.
- Index conversations by `(workspace_id, status, updated_at)` and assignment fields for inbox filters.
- Unique index for provider event/message IDs and idempotency keys where supported.
- Foreign keys and restrictive delete behaviour for message authorship, conversation membership and tenant boundaries.
- Use soft-delete/status fields for users and important records when auditability matters; documented hard deletion/anonymisation process for personal data requests.

## Tenancy model decision

For this version, use a single organisation boundary for AI Automation Labs and separate customer workspaces within it. Do not treat customer workspaces as independent tenants with global admin rights by default. For every query involving a workspace-scoped record, derive accessible workspace IDs from the authenticated principal on the server; do not accept arbitrary client IDs as authority. PostgreSQL row-level security may be added as defence-in-depth, but it does not replace application-layer checks and carefully set session context.

---

# Data to Be Collected and Configuration Inputs

Collect only data necessary for account security, collaboration and channel delivery. Mark optional fields clearly. Agree retention periods before production launch.

## One-time owner/project inputs

| Input | Required? | Who supplies it | Notes |
|---|---|---|---|
| Production/staging domain and DNS access | Required for public staging | Product owner / DevOps | Needed for HTTPS, webhook callbacks and invite links. |
| VPS IP, SSH access method and OS | Required for deployment | DevOps | Use a restricted SSH user/key; do not share root password in chat. |
| First Owner email and display name | Required | Product owner | Temporary credential or one-time bootstrap; force password change if password bootstrapping is used. |
| Company name and logo/brand assets | Name required; logo optional | Product owner | Company is AI Automation Labs LLP; product is Rocket.Ship. |
| Public app URL, API URL and widget origin list | Required when using public clients | Product owner / DevOps | Maintain separate staging/production settings. |
| Backup destination and retention | Required for production | Product owner / DevOps | Prefer off-server encrypted backup. |
| Support/incident contact | Required for production launch | Product owner | Display in admin runbook. |
| Desired data retention and deletion policy | Required before real customer data | Product owner/legal advisor | Define message, file, audit and backup retention. |
| Public code licence decision | Required before publishing as open source | Product owner | Proposed Apache-2.0; review legal/commercial implications before public release. |

## Provider-specific integration inputs

| Provider | Data/credentials to request securely | Important cautions |
|---|---|---|
| Website widget | Allowed domains/origins, public widget ID, widget theme, escalation hours, spam/rate-limit thresholds | Public widget ID is not a secret. Use origin allowlist, abuse controls and server-side customer/session validation. |
| Email | From address, SMTP/API host, port, username, secret, TLS mode; inbound webhook details or mailbox/provider integration; DNS access | Verify SPF, DKIM and DMARC. Store secrets outside source control. Test bounce and complaint handling. |
| WhatsApp | Meta Business Portfolio/WABA details, phone-number ID, business phone, access token or system-user token, app secret, verify token, webhook subscriptions, templates/opt-in process | Collect only through a secure configuration process. Never put token in issue tracker or developer chat. Test a real inbound/outbound round trip. |
| Telegram | Bot token, webhook secret/path, allowed bot behaviour and command list | Bot must only access intended chats; protect webhook path/secret. |
| Instagram | Meta app details, eligible professional account, required permissions, callback/verify configuration, review status | Capability is limited by Meta eligibility, policies, permissions and review. |
| Facebook Messenger | App/Page IDs, Page access token, required permissions, webhook callback and review status | Verify signature and subscribe only required events. |
| SMS | Provider name, API credentials, sender/number, region, delivery webhook and monthly cap | Country-specific requirements, sender registration and per-message charges may apply. |
| AI provider/local model | Provider endpoint, API key if hosted, approved model list, data processing decision, per-user/org budgets | Prefer secret manager; define which messages may leave the VPS; configure limits and human review. |
| Voice/video | Media server URL, API key/secret, TURN domain/certificates and firewall access | Generate short-lived room tokens after authorisation; never expose server secret to clients. |

## User profile data

Required: email, display name, role, account status, created timestamp, workspace memberships. Optional: avatar, timezone, locale, notification preferences. Do not require a phone number for internal users unless it is necessary for MFA or a chosen integration.

## Customer record data

Minimum: customer/company name, status, primary contact name/email (if needed), assigned internal owner, workspace ID, created/updated timestamps. Optional: phone, company website, tags, service/project references and internal notes. Do not collect identity documents, payment credentials or unrelated sensitive data in chat profiles.

## Message and conversation data

Collect message body and metadata needed for delivery, authorship, replies, visibility, timestamps, edit/delete states and provider IDs where applicable. Use internal notes only when enabled and clearly labelled. Avoid duplicating complete provider raw payloads; if raw payload retention is required for debugging, redact and expire it under an agreed policy.

## Operational data

Collect application health, latency, error code, request correlation ID, job state, failed-delivery metadata, CPU/RAM/disk metrics, and backup/restore results. Logs should not normally contain message content, session cookies, passwords, tokens, full webhook bodies or private attachments.

## Retention baseline to approve

The following are **proposed defaults to confirm**, not legal advice: audit logs 180 days; failed webhook payloads 7–30 days with redaction; operational logs 30 days; message/file retention configured by policy; backups retained for 14–30 days encrypted and access-restricted. Define deletion and legal hold behaviour before production launch. Backups may outlive deletions until their expiry; communicate that clearly.

---

# API and Realtime Contract

Use `/api/v1` for REST endpoints. Publish an OpenAPI document and keep request/response schemas versioned.

## MVP REST endpoints

| Method | Endpoint | Purpose | Access requirement |
|---|---|---|---|
| `GET` | `/api/v1/health/live` | Process liveness | Public or internal probe; no secrets in response |
| `GET` | `/api/v1/health/ready` | DB/dependency readiness | Restricted detail; only health status externally |
| `POST` | `/api/v1/auth/login` | Sign in | Rate limited; generic credential failure |
| `POST` | `/api/v1/auth/logout` | End session | Authenticated |
| `GET` | `/api/v1/me` | Current profile and roles | Authenticated |
| `GET` | `/api/v1/workspaces` | Accessible workspaces | Authenticated; server derives membership |
| `GET` | `/api/v1/workspaces/:workspaceId/conversations` | List accessible conversations | Workspace membership required |
| `POST` | `/api/v1/workspaces/:workspaceId/conversations` | Create conversation | Permission and scope checked |
| `GET` | `/api/v1/conversations/:conversationId/messages?cursor=...&limit=50` | Paginated message history | Conversation access required |
| `POST` | `/api/v1/conversations/:conversationId/messages` | Create message | Conversation write permission; payload validation and idempotency |
| `GET` | `/api/v1/customers` | List customers | Admin/authorised internal role only |
| `POST` | `/api/v1/customers` | Create customer + workspace | Admin only |
| `GET` | `/api/v1/inbox` | Assigned/eligible customer conversations | Internal role only; filters are permission-scoped |
| `PATCH` | `/api/v1/conversations/:conversationId/assignment` | Assign conversation | Internal role with assignment permission |
| `POST` | `/api/v1/integrations/webhooks/:provider` | Provider callback | Signature/verification + replay/idempotency protection; no cookie auth assumption |

A route can be omitted from the MVP if the equivalent capability is safely handled in the initial UI/admin command, but it must be documented. Never create an unprotected “temporary” admin route for convenience.

## Standard message request

```json
{
  "body": "Hello from Rocket.Ship",
  "clientIdempotencyKey": "client-generated-unique-value",
  "parentMessageId": null
}
```

The server determines `authorUserId`, `workspaceId`, `visibility`, `createdAt` and permissions. The client must not set them authoritatively. Server response includes stable message ID, server timestamp, author summary, body, visibility if permitted, parent reference and delivery/creation status.

## Common error contract

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have access to this resource.",
    "requestId": "correlation-id"
  }
}
```

Use appropriate HTTP codes: `400` validation, `401` unauthenticated, `403` forbidden, `404` not found where hiding existence is appropriate, `409` idempotency/conflict, `413` payload too large, `429` rate limit, `500` unexpected server error. Do not reveal cross-customer resource existence in error details.

## WebSocket events

| Event | Direction | Minimum payload | Rule |
|---|---|---|---|
| `conversation.join` | Client → server | `conversationId` | Server verifies current membership and read permission before joining room. |
| `message.created` | Server → authorised room | Normalised message DTO | Authorise before broadcast; do not trust client-supplied workspace ID. |
| `message.updated` | Server → authorised room | Message ID + permitted updated fields | Re-check access; do not broadcast internal notes to customer room. |
| `typing.start` / `typing.stop` | Client ↔ server | Conversation ID, short TTL | Validate membership; debounce and expire transient state. |
| `read.updated` | Client → server; server → authorised users | Conversation ID, last-read message ID | Validate message belongs to conversation and user is a participant. |
| `conversation.assigned` | Server → authorised internal listeners | Conversation ID, assignee ID | Internal-only; never sent to customer unless product explicitly exposes ownership. |
| `presence.updated` | Server → permitted scope | User ID/status | Avoid leaking internal presence to external customers by default. |

WebSocket handshake auth is not sufficient by itself. Check permissions when joining rooms and when executing each sensitive client event; disconnect or downgrade sessions when credentials are revoked.

---

# Security, Privacy and Reliability

## Mandatory security controls

- HTTPS enforced in staging/production; HSTS after HTTPS setup is validated.
- Secrets supplied by environment/secret manager; `.env` ignored by Git and `.env.example` contains placeholders only.
- Password hashing with a modern password hash; brute-force/rate limits on login and invitation acceptance.
- Server-side validation for all DTOs and webhook payloads; reject unexpected fields where practical.
- CSRF mitigation for cookie-authenticated mutations; secure cookie settings and trusted-origin allowlist.
- Output encoding and sanitisation; protect against XSS, SQL injection, SSRF, insecure direct object references, CSRF and unsafe file upload.
- CORS allowlist; do not use `*` with credentials.
- Per-user/IP rate limits for login, message posting, widget sessions and webhooks.
- Content size limits, MIME-type allowlist, filename sanitisation, private file storage and malware scanning where feasible.
- Webhook signature verification, replay/idempotency handling and provider-specific verification challenge.
- Audit logs for privileged actions; secrets and session IDs must be redacted.
- Dependency lockfile, vulnerability scan and pinned production images; no unreviewed `latest` tags for production.
- Database least-privilege account; automated encrypted off-server backups and tested restore.
- Admin actions require explicit confirmation for destructive operations; owner account recovery procedure documented.

## Tenant-isolation test matrix

Every relevant test must be run with at least three principals: internal member, customer A and customer B.

- Customer A attempts to GET customer B's conversation by guessed ID → denied without sensitive metadata.
- Customer A attempts to POST to customer B's conversation → denied and no DB row created.
- Customer B subscribes to customer A's WebSocket room → denied.
- Customer B sends a forged `workspaceId`/`customerId` → server ignores/rejects it.
- Customer-facing API loads a conversation containing an internal note → note is absent from output.
- Internal-only notes never reach provider outbound senders or customer notifications.
- Search results, unread counts, push payloads, file links and exports are tested for scope leakage.
- Removed membership loses access on subsequent requests and realtime events.
- Service accounts cannot access endpoints outside their scopes.

## Reliability objectives for pilot

| Area | Initial target |
|---|---|
| API latency | p95 under 500 ms for routine non-provider API calls in test environment, excluding cold start and external provider latency |
| Realtime message display | Under 1 second on the same deployment/network under basic pilot load; measure rather than guarantee across arbitrary internet conditions |
| Active usage test | Demonstrate 35 authenticated accounts and a small concurrency test; plan for 50 concurrent sessions as a near-term design target |
| Backups | Daily database backup at minimum; off-server encrypted copy; test restore before production launch |
| Recovery | Initial target RPO <= 24 hours and RTO <= 4 hours, subject to owner approval and backup infrastructure |
| Availability | No formal SLA until monitored production operation and redundancy plan exist |
| Monitoring | Health checks, disk alerts, job failure alerts, delivery failure counts and log rotation |

---

# Deployment and Operations

## Initial topology

For a 15-internal/20-customer pilot, use Docker Compose on a single VPS only if its current CPU/RAM/storage and network policy are adequate. A previously discussed candidate was a Contabo VPS with 8 vCPU, 24 GB RAM and 200 GB NVMe-class storage; verify actual configuration and available disk/traffic before deployment. Calls, AI inference and file traffic may require separate resources.

Services:

- `web`: Next.js frontend.
- `api`: NestJS backend / WebSocket gateway.
- `postgres`: durable database volume and regular backups.
- `redis`: cache/queue, persistence policy configured as appropriate.
- `proxy`: Caddy/NGINX with valid TLS.
- `worker`: background task process if separated from API.
- Optional later: S3-compatible object storage and LiveKit/TURN media services.

## Environment variables

Provide `.env.example` with descriptions for at least:

```text
NODE_ENV=
PUBLIC_APP_URL=
PUBLIC_API_URL=
DATABASE_URL=
REDIS_URL=
SESSION_SECRET=
SESSION_COOKIE_NAME=
TRUSTED_ORIGINS=
BOOTSTRAP_OWNER_EMAIL=
BOOTSTRAP_OWNER_NAME=
BOOTSTRAP_OWNER_SECRET=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
FILE_STORAGE_DRIVER=
FILE_STORAGE_BUCKET=
FILE_STORAGE_ENDPOINT=
FILE_STORAGE_ACCESS_KEY=
FILE_STORAGE_SECRET_KEY=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_APP_SECRET=
WHATSAPP_VERIFY_TOKEN=
TELEGRAM_BOT_TOKEN=
META_APP_ID=
META_APP_SECRET=
SMS_PROVIDER=
SMS_API_KEY=
AI_PROVIDER=
AI_API_KEY=
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
```

Only P0-required settings should be mandatory for boot. Missing optional providers should show “not configured,” not cause app startup failure. Never populate `.env.example` with real values.

## Deployment runbook

1. Provision Ubuntu LTS VPS, restricted SSH access, updates, firewall and a non-root deployment user.
2. Point staging DNS records at the VPS; issue HTTPS certificates.
3. Configure secrets out of band; validate `.env` permissions.
4. Check out a tagged/committed revision; build pinned images.
5. Run database migrations as a separate deployment step; do not run destructive migration automatically at every app startup.
6. Execute seed/bootstrap procedure once; rotate bootstrap secret and disable bootstrap mode.
7. Run health checks and smoke tests.
8. Verify internal message send/receive and customer-isolation test with distinct accounts.
9. Confirm backup job and perform a restore rehearsal into a non-production database.
10. Document rollback command and database compatibility for the previous application revision.

## Backups and updates

- Back up database and object storage metadata/files consistently.
- Encrypt backup artifacts and restrict access separately from the VPS.
- Record backup timestamp, status and restore-test status.
- Define RPO/RTO with owner; daily backup alone does not provide zero data loss.
- Test migrations on a restored copy before release.
- Maintain a security update process for operating system, container images, Node packages and provider SDKs.

---

# Test Strategy and Release Gate

## Test types

- **Unit:** permissions/policies, message validation, visibility, idempotency, webhook parsers.
- **Integration:** API + PostgreSQL, session creation/revocation, message create/read, customer workspace membership, provider adapter contract.
- **Realtime:** authorised client receives event, unauthorised socket does not, reconnect does not duplicate messages.
- **End-to-end:** internal sign-in → channel → send/receive message; customer sign-in → own conversation → reply; access-denial attempts.
- **Security:** IDOR/tenant leakage, session/CSRF, XSS in message body, rate limit, secret redaction, webhook forgery/replay.
- **Responsive UI:** laptop viewport and phone viewport; keyboard navigation for important actions.
- **Deployment smoke:** fresh VPS compose up, migration, bootstrap owner, health check, login, message send and backup.

## 48-hour acceptance checklist

Every P0 item must be demonstrated on the shared staging deployment; a local-only screenshot does not count as deployed acceptance.

- [ ] `docker compose up` succeeds from documented instructions on a clean environment.
- [ ] Migrations run from an empty database and seed/bootstrap path is documented.
- [ ] Owner/Admin can sign in and sign out.
- [ ] Internal user can access authorised internal workspace and send a text message.
- [ ] Second internal user receives the message in realtime and sees it after refresh.
- [ ] Customer A can sign in and message an authorised internal user in Customer A’s workspace.
- [ ] Customer B cannot read, write, search or subscribe to Customer A’s conversation.
- [ ] Customer cannot access internal-only channel or note.
- [ ] API rejects unauthenticated protected calls and invalid payloads.
- [ ] Health and readiness endpoints work without exposing secrets.
- [ ] Tests and lint/typecheck commands are documented and pass for the committed revision.
- [ ] No production secrets are committed; `.env.example` is safe.
- [ ] Handover includes repository, deployed URL, admin bootstrap path, known limitations and backlog.

**Acceptance evidence:** demo recording or live walkthrough, tested staging URL, Git commit SHA/tag, test output, migration status, and known-issues list.

---

# Detailed 48-Hour Timeline

## Staffing assumption

This schedule assumes a small delivery pod of **2 developers plus 1 DevOps/QA-capable person** working in parallel across two full working days, with the repository/server/domain decisions available at the start. If only one developer is available, reduce the 48-hour scope further; do not silently omit testing or security checks to preserve the feature list. Clock time below is elapsed project time; workstreams can overlap.

### Day 1 — Foundation and internal messaging

| Time | Owner | Work | Exit evidence |
|---|---|---|---|
| H0-H2 | Lead + DevOps | Confirm repo, stack, domain/staging host, env/secrets, threat boundaries, code style and task ownership. Create README and `.env.example`. | Repo builds; documented bootstrap and branch strategy. |
| H2-H4 | Backend | Create NestJS modules, config validation, database connection, schema/migration setup, health endpoints. | API starts; migration runs on empty DB. |
| H2-H5 | Frontend | Create Next.js app shell, design tokens, responsive layout, login/loading/error states. | UI builds at desktop and phone widths. |
| H4-H7 | Backend | Users, organisation/workspace memberships, first-owner bootstrap, secure session login/logout, guards and DTO validation. | Auth tests pass; protected route blocks anonymous user. |
| H5-H8 | DevOps/QA | PostgreSQL/Redis Docker Compose, HTTPS/staging, log redaction and health checks. | Clean deploy path works; secrets are not in Git. |
| H7-H10 | Backend | Conversation and message schema, authorised list/history/send endpoints, cursor pagination, idempotency. | API round-trip and persistence tests pass. |
| H7-H11 | Frontend | Login view, workspace/channel list, conversation timeline, composer and loading/error states. | User can navigate and send request to backend. |
| H10-H12 | Backend + Frontend | WebSocket auth, conversation-room authorisation, `message.created` delivery. | Two authorised users exchange realtime messages. |
| H11-H12 | QA | Initial unit/integration smoke tests; fix P0 blockers only. | Day 1 demo: authenticated internal channel chat persists and updates live. |

**Day 1 checkpoint:** if the two-user internal text messaging path does not work end-to-end, stop adding features and repair it. Do not move to provider integrations while the core security model is broken.

### Day 2 — Customer isolation, deploy and acceptance

| Time | Owner | Work | Exit evidence |
|---|---|---|---|
| H12-H15 | Backend | Customer record, customer workspace creation, explicit roles/memberships, customer conversation provisioning. | Customer/workspace API and constraints pass. |
| H12-H16 | Frontend | Customer portal route/state; internal/customer navigation and permission-aware empty states. | Customer user can sign in to own workspace. |
| H15-H18 | Backend + Frontend | Customer-to-agent message flow; internal vs customer-visible message visibility; assignment baseline if time allows. | Customer A exchanges messages with assigned internal user. |
| H16-H19 | QA/Security | Cross-customer API/WebSocket/notes tests, forged ID tests, session/permission regression. | Automated isolation suite passes; bugs fixed before release. |
| H18-H21 | DevOps | Deploy tagged build to staging, migrations and bootstrap, domain/TLS, health/readiness, resource/log checks. | Deployed staging URL works from external network. |
| H19-H22 | Frontend + Backend | UX fixes, mobile responsive pass, reconnect/loading/error states, basic channel adapter interface and provider-config placeholders. | Responsive smoke pass; integration capability not falsely marked live. |
| H22-H24 | Whole team | Run full P0 acceptance checklist, backup/restore sanity check, handover and known-issues review. | Commit SHA, test output, runbook, access handover and demo. |

## Two-day stretch tasks (only after all P0 checks pass)

1. Website chat widget proof of concept with origin allowlist and server-side session validation.
2. Basic file attachments with private storage and download authorisation.
3. Simple reactions/unread marker.
4. SMTP test for invitation email.

Do not include any stretch task in the completion promise until the P0 gate is green. WhatsApp, Meta DMs, SMS, native mobile stores, AI and WebRTC remain later milestones unless reusable, already-approved provider systems are already available.

---

# Full-Product Roadmap After the 48-Hour MVP

This is an indicative plan for a small capable team of 2–3 engineers plus QA/DevOps support. It is not a fixed delivery guarantee; provider approvals, mobile-store review, design scope, and production hardening may change dates.

| Phase | Indicative duration | Deliverables / exit gate |
|---|---|---|
| 0. Two-day MVP | Days 1-2 | Internal real-time text chat, customer portal conversation, hard workspace isolation, staging, migrations and smoke tests. |
| 1. Collaboration hardening | Week 1 after MVP | Threads, reactions, read state, member/invite management, audit logs, search baseline, notifications, attachment storage and responsive QA. |
| 2. Customer inbox + website chat/email | Weeks 2-3 | Assignee/status/tags, embeddable website widget, SMTP/outbound email plus inbound adapter, retry/error queue, domain deliverability tests. |
| 3. WhatsApp + Telegram | Weeks 3-5, subject to credentials | Official API webhook verification, outbound/inbound round trip, delivery status, idempotency, opt-in/template handling and operational dashboard. |
| 4. Instagram + Facebook + SMS | Weeks 4-7, provider dependent | Official Meta API support/permissions and SMS adapter, region-specific setup, retry and compliance checks. |
| 5. Tasks & workflows | Weeks 4-7 | Projects, Kanban, tasks, rules, versioned workflows, run log and failure handling. |
| 6. AI assistant | Weeks 6-8 | Provider interface, scoped knowledge retrieval, summary/drafting, usage controls, human approvals and AI evaluation tests. |
| 7. Calls & screen share | Weeks 6-9 | Self-hosted media server, room tokens, TURN/TLS, permissions, reconnect/device testing and basic operational monitoring. |
| 8. Native clients | Weeks 7-10+ | React Native iOS/Android, push, Tauri Windows/macOS packaging, signing and device-specific QA. Store approvals may extend release dates. |
| 9. Production hardening | Ongoing / 1-2 weeks before broad rollout | Load test, penetration-test remediation, restore drill, observability, runbooks, accessibility and release rollback. |

**Planning note:** phases may overlap with parallel staff, but do not skip acceptance gates. Full-product timing is likely measured in weeks, not days. External API accounts, certificates, legal/privacy review and store approvals are critical path dependencies outside the developer’s direct control.

---

# Risks, Dependencies and Decisions

| Risk/dependency | Impact | Mitigation / owner |
|---|---|---|
| Only 48 hours available | Feature and QA scope must be limited | Product owner accepts Release A scope; lead protects P0 acceptance. |
| Provider API credentials/approvals unavailable | Real channel integration cannot be completed | Owner secures credentials early; build adapter contract first; never fake successful production sends. |
| Single developer only | Timeline too aggressive for all P0 items | Reduce scope to internal chat + isolation core; identify staffing before kickoff. |
| Tenant isolation flaw | Severe confidentiality incident | Backend policy layer and adversarial tests are release blockers. |
| Unclear retention/privacy policy | Legal and operational risk | Owner approves retention, deletion and consent policy before real customer data. |
| VPS firewall/UDP or provider network restrictions | Calls and webhook delivery fail | Calls are later milestone; network test and TURN setup required. |
| High attachment/AI/media usage | Resource exhaustion | Set limits, observe actual load, separate media/AI/storage when appropriate. |
| Open-source licences | Distribution/compliance risk | Audit dependency licences and notices; confirm Rocket.Ship licence before public release. |
| Mobile app distribution | Release may be delayed by signing/review | Deliver responsive PWA first, then mobile builds and store submission. |

### Decisions to default unless the owner changes them

- Product name: Rocket.Ship.
- Organisation: AI Automation Labs LLP.
- Initial cohort: 15 internal + 20 external users.
- Hosting: self-managed VPS with Docker Compose for pilot.
- Core: React/Next.js + TypeScript frontend; NestJS + TypeScript backend; PostgreSQL; Redis; WebSocket; REST/OpenAPI.
- Customer access: both customer portal and external communication channels.
- Initial channel order: customer portal and website widget first; then email/WhatsApp/Telegram; Meta DMs/SMS after accounts and permissions are verified.
- 48-hour milestone: core working MVP, not all product-roadmap features.
- Licence: proposed Apache-2.0 if publishing the source; confirm with owner before public release.

---

# Definition of Done and Developer Handover

A feature is done only when the implementation, authorisation rules, tests, error handling, documentation and deployment behaviour are present. A frontend mockup or hardcoded JSON is not a completed feature.

At the 48-hour handover, the developer must provide:

1. Git repository URL or source bundle and a stable commit SHA/tag.
2. Working staging URL and steps to log in with test accounts; credentials transmitted securely, not embedded in this document.
3. `README.md` with prerequisites, local setup, migrations, seed/bootstrap, tests and deployment instructions.
4. `.env.example` with every required variable described and no real secrets.
5. Docker Compose and pinned dependency/image versions for the MVP services.
6. Database migrations and safe bootstrap/seed commands.
7. OpenAPI specification or equivalent route documentation and WebSocket event list.
8. Unit/integration/smoke test commands plus their results for the handed-over commit.
9. Automated test evidence for customer A/B isolation and internal-note visibility.
10. Deployment/runbook, rollback notes, backup process, monitoring/health-check route and restoration procedure.
11. Known limitations, deferred features, integration credentials still required, and next sprint backlog.
12. List of third-party components, licences and any paid/external service dependencies.

### Handover sign-off

- [ ] Product owner accepts the two-day scope boundary.
- [ ] All P0 acceptance tests passed on staging.
- [ ] Security/isolation tests passed.
- [ ] No production secrets in repository/logs/document.
- [ ] Owner has repository, server and DNS access.
- [ ] Backup and rollback expectations documented.
- [ ] Known issues and post-MVP plan reviewed.

---

# Official Technical References

Use official documentation as the source of truth, and re-check current versions, API permissions, pricing and provider policies at implementation time. The URLs below are starting points, not a guarantee that a particular account is eligible for every feature.

- **Next.js App Router:** https://nextjs.org/docs/app
- **NestJS authentication/security:** https://docs.nestjs.com/security/authentication
- **LiveKit self-hosting:** https://docs.livekit.io/transport/self-hosting/
- **LiveKit VM deployment / network requirements:** https://docs.livekit.io/transport/self-hosting/vm/
- **Meta WhatsApp Business Platform API collection:** https://www.postman.com/meta/whatsapp-business-platform/overview
- **Telegram Bot API:** https://core.telegram.org/bots/api
- **Meta Messenger Platform:** https://developers.facebook.com/docs/messenger-platform/
- **Meta Instagram Messaging:** https://developers.facebook.com/docs/messenger-platform/instagram/
- **React Native documentation:** https://reactnative.dev/docs/getting-started
- **Tauri v2 documentation:** https://v2.tauri.app/start/

---

# Final Instruction to the Developer

Build the smallest secure product that proves the architectural foundation: an internal user can sign in, exchange persistent realtime messages, and a customer can sign in and exchange messages only within the customer’s own workspace. Deploy it, test it, demonstrate it, and hand over the repository and runbook within the agreed 48-hour window. Then extend the same maintainable foundation through the roadmap. Do not sacrifice authorisation, persistence, reproducibility or release evidence to create the appearance of a larger but non-functional feature set.