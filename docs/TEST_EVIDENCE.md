# AI Automation Labs Connect — 48-Hour Acceptance Test Evidence

**Product:** AI Automation Labs Connect  
**Organization:** AI Automation Labs LLP  
**Test Suite Execution:** Passed (22/22 Tests Green)  
**Date:** 22 October 2026  

---

## 1. Automated Test Suite Output Log

```text
> ailabs-connect@1.0.0 test
> tsx tests/runner.ts

===============================================================
🧪 Starting AI Automation Labs Connect Automated Tenant Isolation & Smoke Tests
===============================================================

[Test Runner] Test server listening on http://localhost:3099

--- Group 1: Health & Operational Probes ---
  ✅ PASS: GET /health/live returns 200 OK
  ✅ PASS: GET /health/ready returns 200 and database connected

--- Group 2: Principal Authentication & Session Protection ---
  ✅ PASS: Internal Member (Sarah Chen) authenticates successfully
  ✅ PASS: Customer A (David Miller, Acme Corp) authenticates successfully
  ✅ PASS: Customer B (Elena Rostova, Globex) authenticates successfully
  ✅ PASS: Invalid credentials rejected with 401
  ✅ PASS: Anonymous request to /workspaces is rejected with 401

--- Group 3: Tenant Isolation & Adversarial Access Denial ---
  ✅ PASS: Customer A attempting to GET Customer B conversation is DENIED (403 Forbidden)
  ✅ PASS: Customer A attempting to POST to Customer B conversation is DENIED (403 Forbidden)
  ✅ PASS: Database integrity check: Zero unauthorized rows inserted
  ✅ PASS: Customer A attempting to read internal #general channel is DENIED (403 Forbidden)

--- Group 4: Internal Note Visibility Scoping ---
  ✅ PASS: Customer A can read own customer conversation
  ✅ PASS: CONFIDENTIALITY GATE: Customer A NEVER receives internal notes (0 internal notes leaked)
  ✅ PASS: Internal member can read Customer A conversation
  ✅ PASS: Internal team member sees both public messages and internal notes
  ✅ PASS: Customer attempting to post message with visibility: internal is REJECTED (403 Forbidden)

--- Group 5: Message Idempotency & Persistence ---
  ✅ PASS: First message send succeeds (201 Created)
  ✅ PASS: Second message send with same idempotency key succeeds
  ✅ PASS: Idempotency confirmed: Server returned the same message without duplication

--- Group 6: Realtime WebSocket Authorization ---
  🔌 Elena connected to test WebSocket
[Socket Denial] User elena@globex.com denied join to conversation bc5ca2b6-08f1-47d1-8d36-bc83acc46617: You do not have access to this conversation.
  ✅ PASS: Customer B attempting to join Customer A WebSocket room is REJECTED by server

--- Group 7: Customer Admin Role Gating ---
  ✅ PASS: Customer A attempting to GET /customers is DENIED (403 Forbidden)
  ✅ PASS: Internal team member can list customers and workspace metadata

===============================================================
📋 Test Results Summary: 22 PASSED, 0 FAILED
===============================================================
```

---

## 2. Interactive Browser Walkthrough Evidence

The application was run locally on `http://localhost:3000` and validated using the automated browser subagent:

1. **Internal Chat Journey**: Sarah Chen (Lead AI Engineer) posted in `#general`. The message was persisted to PostgreSQL and displayed live in the timeline.
2. **Customer Shared Inbox**: Triage view accurately aggregated customer threads across customer portals and external channels with status/priority badges.
3. **Customer Portal Isolation**: Switched persona to David Miller (Acme Corp). Verified that David Miller accesses only the Acme Corp Portal, and internal notes are absent from their view.
4. **Website Live Chat Widget POC**: Floating chat launcher opens the live chat widget with automated response capabilities.
