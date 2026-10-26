# AI Automation Labs Connect — Security, Privacy & Tenant Isolation

**Organization:** AI Automation Labs LLP  
**Document Classification:** Internal Security Policy & Validation Evidence

---

## 1. Core Threat Model & Isolation Principles

1. **Deny by Default**: Every REST endpoint and WebSocket gateway subscription strictly asserts the authenticated caller's identity, role, and workspace membership.
2. **Untrusted Client Inputs**: The client is never trusted for `authorUserId`, `workspaceId`, `role`, or `is_admin`. All scoping is derived server-side from the verified session.
3. **Strict Customer Tenant Isolation**:
   - Customer A cannot access Customer B's workspace, conversation, or messages even by guessing or brute-forcing IDs.
   - Forged `workspaceId` parameters are rejected with `403 Forbidden`.
   - Error messages never disclose cross-customer resource existence.
4. **Internal Note Confidentiality**:
   - Internal notes (`visibility: "internal"`) are completely filtered out in database queries for customer sessions.
   - Sockets belonging to customer users never receive `message.created` events for internal notes.

---

## 2. Automated Test Matrix Results

The following test matrix is executed continuously via `npm test` against a live PostgreSQL database:

| Security Test Assertion | Result | Evidence |
|---|---|---|
| Customer A attempts `GET` on Customer B conversation | **PASSED (403)** | Denied with generic 403 Forbidden |
| Customer A attempts `POST` into Customer B conversation | **PASSED (403)** | Denied; 0 rows inserted |
| Customer A attempts to read internal `#general` channel | **PASSED (403)** | Denied with 403 Forbidden |
| Customer A reads own conversation containing internal note | **PASSED** | 0 internal notes leaked in response |
| Internal member reads Customer A conversation | **PASSED** | Full visibility into conversation & internal notes |
| Customer attempts to post with `visibility: "internal"` | **PASSED (403)** | Denied; customer cannot post internal notes |
| Customer B attempts to join Customer A WebSocket room | **PASSED** | Socket rejected by server authorization check |
| Customer A attempts to access `/customers` admin list | **PASSED (403)** | Denied with 403 Forbidden |
| Idempotency key replay test | **PASSED** | Duplicate send returns existing message without duplicate row |

---

## 3. Secret Management & Compliance

- **No Secrets in Source Control**: All passwords, API tokens, and webhook secrets are sourced exclusively from environment variables.
- **Password Security**: Passwords hashed with bcrypt (salt rounds = 10-12).
- **Session Security**: Session cookies are configured with `HttpOnly`, `SameSite: Lax`, and `Secure` in production environments.
