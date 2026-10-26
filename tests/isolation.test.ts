import http from 'http';
import { app } from '../server/src/app.js';
import { initSocketGateway } from '../server/src/realtime/socket.gateway.js';
import { pool, query } from '../server/src/database/db.js';
import { io as ClientIO } from 'socket.io-client';

const PORT = 3099;
let server: http.Server;

interface LoginResponse {
  user: { id: string; email: string; role: string; customerId?: string };
  token: string;
}

async function request(
  method: string,
  path: string,
  body?: any,
  token?: string
): Promise<{ status: number; body: any; headers: any }> {
  const url = `http://localhost:${PORT}/api/v1${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data: any;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return {
    status: res.status,
    body: data,
    headers: res.headers,
  };
}

import { seed } from '../server/src/database/seed.js';

export async function runTests() {
  console.log('\n===============================================================');
  console.log('🧪 Starting AI Automation Labs Connect Automated Tenant Isolation & Smoke Tests');
  console.log('===============================================================\n');

  // Ensure test fixture data is available
  await seed();

  // Start test server
  server = http.createServer(app);
  initSocketGateway(server, [`http://localhost:${PORT}`]);
  await new Promise<void>((resolve) => server.listen(PORT, () => resolve()));
  console.log(`[Test Runner] Test server listening on http://localhost:${PORT}`);

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Health & Readiness Endpoints
    // -------------------------------------------------------------------------
    console.log('\n--- Group 1: Health & Operational Probes ---');
    const liveRes = await request('GET', '/health/live');
    assert(liveRes.status === 200 && liveRes.body.status === 'ok', 'GET /health/live returns 200 OK');

    const readyRes = await request('GET', '/health/ready');
    assert(readyRes.status === 200 && readyRes.body.database === 'connected', 'GET /health/ready returns 200 and database connected');

    // -------------------------------------------------------------------------
    // Authenticate 3 Principals: Internal Member, Customer A, Customer B
    // -------------------------------------------------------------------------
    console.log('\n--- Group 2: Principal Authentication & Session Protection ---');
    const sarahLogin = await request('POST', '/auth/login', {
      email: 'sarah.chen@aiautomationlabs.com',
      password: 'Password123!',
    });
    assert(sarahLogin.status === 200 && !!sarahLogin.body.token, 'Internal Member (Sarah Chen) authenticates successfully');
    const sarahToken = sarahLogin.body.token;

    const davidLogin = await request('POST', '/auth/login', {
      email: 'david@acme.com',
      password: 'Password123!',
    });
    assert(davidLogin.status === 200 && !!davidLogin.body.token, 'Customer A (David Miller, Acme Corp) authenticates successfully');
    const davidToken = davidLogin.body.token;

    const elenaLogin = await request('POST', '/auth/login', {
      email: 'elena@globex.com',
      password: 'Password123!',
    });
    assert(elenaLogin.status === 200 && !!elenaLogin.body.token, 'Customer B (Elena Rostova, Globex) authenticates successfully');
    const elenaToken = elenaLogin.body.token;

    // Reject invalid credentials
    const badLogin = await request('POST', '/auth/login', {
      email: 'sarah.chen@aiautomationlabs.com',
      password: 'WrongPassword!',
    });
    assert(badLogin.status === 401 && badLogin.body.error.code === 'INVALID_CREDENTIALS', 'Invalid credentials rejected with 401');

    // Reject unauthenticated requests to protected routes
    const anonRes = await request('GET', '/workspaces');
    assert(anonRes.status === 401, 'Anonymous request to /workspaces is rejected with 401');

    // -------------------------------------------------------------------------
    // Retrieve conversation IDs for testing
    // -------------------------------------------------------------------------
    const acmeConvRes = await query(
      `SELECT c.id FROM conversations c
       JOIN workspaces w ON w.id = c.workspace_id
       WHERE w.slug = 'customer-acme-corp' LIMIT 1`
    );
    const acmeConversationId = acmeConvRes.rows[0].id;

    const globexConvRes = await query(
      `SELECT c.id FROM conversations c
       JOIN workspaces w ON w.id = c.workspace_id
       WHERE w.slug = 'customer-globex' LIMIT 1`
    );
    const globexConversationId = globexConvRes.rows[0].id;

    const generalConvRes = await query(
      `SELECT id FROM conversations WHERE title = 'general' LIMIT 1`
    );
    const generalConversationId = generalConvRes.rows[0].id;

    // -------------------------------------------------------------------------
    // TEST 3: Tenant Isolation - Customer A cannot read Customer B conversation
    // -------------------------------------------------------------------------
    console.log('\n--- Group 3: Tenant Isolation & Adversarial Access Denial ---');

    const customerAtoB_Get = await request(
      'GET',
      `/conversations/${globexConversationId}/messages`,
      undefined,
      davidToken
    );
    assert(
      customerAtoB_Get.status === 403,
      'Customer A attempting to GET Customer B conversation is DENIED (403 Forbidden)',
      `Status: ${customerAtoB_Get.status}`
    );

    // TEST 4: Customer A cannot POST to Customer B conversation
    const customerAtoB_Post = await request(
      'POST',
      `/conversations/${globexConversationId}/messages`,
      { body: 'Exploit attempt: Customer A writing into Customer B' },
      davidToken
    );
    assert(
      customerAtoB_Post.status === 403,
      'Customer A attempting to POST to Customer B conversation is DENIED (403 Forbidden)',
      `Status: ${customerAtoB_Post.status}`
    );

    // Verify no row was inserted into database
    const forgedDbCheck = await query(
      `SELECT id FROM messages WHERE conversation_id = $1 AND body LIKE '%Exploit attempt%'`,
      [globexConversationId]
    );
    assert(
      forgedDbCheck.rows.length === 0,
      'Database integrity check: Zero unauthorized rows inserted'
    );

    // TEST 5: Customer cannot access internal-only channels
    const customerToInternalChannel = await request(
      'GET',
      `/conversations/${generalConversationId}/messages`,
      undefined,
      davidToken
    );
    assert(
      customerToInternalChannel.status === 403,
      'Customer A attempting to read internal #general channel is DENIED (403 Forbidden)'
    );

    // TEST 6: Customer A reading own conversation does NOT see internal notes
    console.log('\n--- Group 4: Internal Note Visibility Scoping ---');
    const customerA_OwnMessages = await request(
      'GET',
      `/conversations/${acmeConversationId}/messages`,
      undefined,
      davidToken
    );
    assert(customerA_OwnMessages.status === 200, 'Customer A can read own customer conversation');

    const internalNotesVisibleToCustomer = customerA_OwnMessages.body.messages.filter(
      (m: any) => m.visibility === 'internal' || m.body.includes('INTERNAL NOTE')
    );
    assert(
      internalNotesVisibleToCustomer.length === 0,
      'CONFIDENTIALITY GATE: Customer A NEVER receives internal notes (0 internal notes leaked)'
    );

    // TEST 7: Internal team member reading Customer A conversation DOES see internal notes
    const internal_CustomerMessages = await request(
      'GET',
      `/conversations/${acmeConversationId}/messages`,
      undefined,
      sarahToken
    );
    assert(internal_CustomerMessages.status === 200, 'Internal member can read Customer A conversation');

    const internalNotesVisibleToTeam = internal_CustomerMessages.body.messages.filter(
      (m: any) => m.visibility === 'internal'
    );
    assert(
      internalNotesVisibleToTeam.length > 0,
      'Internal team member sees both public messages and internal notes'
    );

    // TEST 8: Customer attempting to create an internal note is rejected
    const customerFakeNote = await request(
      'POST',
      `/conversations/${acmeConversationId}/messages`,
      { body: 'Customer attempting to post internal note', visibility: 'internal' },
      davidToken
    );
    assert(
      customerFakeNote.status === 403,
      'Customer attempting to post message with visibility: internal is REJECTED (403 Forbidden)'
    );

    // -------------------------------------------------------------------------
    // TEST 9: Idempotency Key Handling (PRD MSG-01 & MSG-03)
    // -------------------------------------------------------------------------
    console.log('\n--- Group 5: Message Idempotency & Persistence ---');
    const idempotencyKey = `idem_${Date.now()}_unique`;
    const firstSend = await request(
      'POST',
      `/conversations/${acmeConversationId}/messages`,
      {
        body: 'Idempotency test payload message',
        clientIdempotencyKey: idempotencyKey,
      },
      davidToken
    );
    assert(firstSend.status === 201, 'First message send succeeds (201 Created)');

    const secondSend = await request(
      'POST',
      `/conversations/${acmeConversationId}/messages`,
      {
        body: 'Idempotency test payload message',
        clientIdempotencyKey: idempotencyKey,
      },
      davidToken
    );
    assert(
      secondSend.status === 200 || secondSend.status === 201,
      'Second message send with same idempotency key succeeds'
    );
    assert(
      secondSend.body.message?.id === firstSend.body.message?.id || secondSend.body.id === firstSend.body.message?.id,
      'Idempotency confirmed: Server returned the same message without duplication'
    );

    // -------------------------------------------------------------------------
    // TEST 10: WebSocket Authorization & Room Denial
    // -------------------------------------------------------------------------
    console.log('\n--- Group 6: Realtime WebSocket Authorization ---');

    const socketElena = ClientIO(`http://localhost:${PORT}`, {
      auth: { token: elenaToken },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve, reject) => {
      socketElena.on('connect', () => {
        console.log('  🔌 Elena connected to test WebSocket');
        // Attempt to join Customer A's conversation room
        socketElena.emit('conversation.join', { conversationId: acmeConversationId }, (response: any) => {
          assert(
            response && !!response.error,
            'Customer B attempting to join Customer A WebSocket room is REJECTED by server'
          );
          socketElena.disconnect();
          resolve();
        });
      });
      socketElena.on('connect_error', (err) => {
        reject(err);
      });
    });

    // -------------------------------------------------------------------------
    // TEST 11: Customer Management Access Control
    // -------------------------------------------------------------------------
    console.log('\n--- Group 7: Customer Admin Role Gating ---');
    const customerTryingToGetCustomers = await request('GET', '/customers', undefined, davidToken);
    assert(
      customerTryingToGetCustomers.status === 403,
      'Customer A attempting to GET /customers is DENIED (403 Forbidden)'
    );

    const internalGettingCustomers = await request('GET', '/customers', undefined, sarahToken);
    assert(
      internalGettingCustomers.status === 200 && internalGettingCustomers.body.customers.length >= 2,
      'Internal team member can list customers and workspace metadata'
    );
  } catch (err: any) {
    console.error('[Test Execution Error]:', err);
    failed++;
  } finally {
    try {
      await query(`DELETE FROM customers WHERE name IN ('Acme Corp', 'Globex Logistics')`);
      await query(`DELETE FROM users WHERE email IN ('david@acme.com', 'elena@globex.com', 'sarah.chen@aiautomationlabs.com', 'alex.kumar@aiautomationlabs.com')`);
      await query(`DELETE FROM tasks`);
      await query(`DELETE FROM messages WHERE author_kind != 'system'`);
    } catch (cleanupErr: any) {
      console.warn('[Test Teardown] Warning cleaning fixtures:', cleanupErr.message);
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    console.log('\n===============================================================');
    console.log(`📋 Test Results Summary: ${passed} PASSED, ${failed} FAILED`);
    console.log('===============================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  }
}

runTests()
  .then(() => {
    pool.end();
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal test error:', err);
    pool.end();
    process.exit(1);
  });
