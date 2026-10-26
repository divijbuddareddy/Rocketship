# AI Automation Labs Connect — API & Realtime Specification

**Base URL:** `/api/v1`  
**Protocol:** HTTP/1.1 & HTTP/2 + WebSocket (Socket.IO)  
**Authentication:** Cookie-based HttpOnly Session or Bearer JWT token (`Authorization: Bearer <token>`)

---

## 1. Health & Operational Endpoints

### `GET /health/live`
Process liveness probe for load balancers.
- **Response `200 OK`**:
```json
{
  "status": "ok",
  "service": "AI Automation Labs Connect API",
  "uptimeSeconds": 1420,
  "timestamp": "2026-10-22T12:00:00.000Z"
}
```

### `GET /health/ready`
Database and dependency readiness check.
- **Response `200 OK`**:
```json
{
  "status": "ready",
  "database": "connected",
  "timestamp": "2026-10-22T12:00:00.000Z"
}
```

---

## 2. Authentication Endpoints

### `POST /auth/login`
Authenticates user and sets HttpOnly cookie.
- **Request Body**:
```json
{
  "email": "sarah.chen@aiautomationlabs.com",
  "password": "Password123!"
}
```
- **Response `200 OK`**:
```json
{
  "user": {
    "id": "uuid",
    "email": "sarah.chen@aiautomationlabs.com",
    "displayName": "Sarah Chen",
    "role": "internal_member",
    "status": "active"
  },
  "customer": null,
  "token": "eyJhbGciOi..."
}
```

### `POST /auth/logout`
Revokes session and clears cookie.

### `GET /me`
Returns current authenticated user profile and accessible workspaces summary.

---

## 3. Workspaces & Conversations

### `GET /workspaces`
Returns workspaces accessible strictly to the caller:
- Internal members see Internal Workspace + assigned customer workspaces.
- Customer users see **only** their dedicated customer workspace.

### `GET /workspaces/:workspaceId/conversations`
Returns channels/conversations within the permitted workspace.

### `POST /workspaces/:workspaceId/conversations`
Creates a channel or conversation.
- **Request Body**:
```json
{
  "title": "sprint-24-delivery",
  "kind": "channel",
  "priority": "normal"
}
```

---

## 4. Messages & Realtime Chat

### `GET /conversations/:conversationId/messages?cursor=...&limit=50`
Fetches paginated chronological messages.
- **Confidentiality Gate**: If the caller is a customer user, internal notes (`visibility: "internal"`) are strictly filtered out by the database engine and are never transmitted.

### `POST /conversations/:conversationId/messages`
Creates a new message.
- **Request Body**:
```json
{
  "body": "Hello team, deployment is proceeding.",
  "visibility": "all",
  "clientIdempotencyKey": "unique-client-guid"
}
```
- **Idempotency**: Submitting the same `clientIdempotencyKey` returns the previously created message without creating duplicates.
- **Internal Note Guard**: Only internal team members may specify `"visibility": "internal"`.

### `POST /messages/:messageId/reactions`
Toggles an emoji reaction.
- **Request Body**:
```json
{
  "emoji": "👍"
}
```

---

## 5. Customer Management & Shared Inbox

### `GET /customers`
*(Internal roles only)* Lists customers and workspace metrics.

### `POST /customers`
*(Admin/Owner only)* Provisions customer, customer workspace, and initial support channel in an atomic transaction.

### `GET /inbox`
*(Internal roles only)* Unified inbox with query filters:
- `status`: `open`, `pending`, `resolved`
- `priority`: `urgent`, `high`, `normal`
- `channelType`: `portal`, `website_chat`, `whatsapp`, `telegram`

### `PATCH /conversations/:conversationId/assignment`
Assigns an internal owner to a customer conversation.

---

## 6. WebSocket Events Specification

| Event Name | Direction | Payload | Server Authorization |
|---|---|---|---|
| `conversation.join` | Client → Server | `{ conversationId }` | Server validates caller membership and tenant isolation before adding socket to room. |
| `message.created` | Server → Room | Full Message DTO | If `visibility: "internal"`, event is routed exclusively to internal member sockets. |
| `typing.start` / `stop` | Client ↔ Server | `{ conversationId }` | Debounced transient typing notification. |
| `read.updated` | Client → Server | `{ conversationId, messageId }` | Updates last-read marker. |
| `conversation.assigned` | Server → Team | `{ conversationId, assignee }` | Internal notification of ownership change. |
