import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from './db.js';
import { bootstrapOwner } from './bootstrapOwner.js';

dotenv.config();

export async function seed() {
  console.log('[Seed] Seeding AI Automation Labs Connect demonstration data...');
  // Ensure Owner exists first
  const owner = await bootstrapOwner();

  const internalWorkspaceRes = await query(
    `SELECT id, organisation_id FROM workspaces WHERE kind = 'internal' LIMIT 1`
  );
  if (internalWorkspaceRes.rows.length === 0) {
    throw new Error('Internal workspace not found. Run bootstrap first.');
  }
  const internalWorkspaceId = internalWorkspaceRes.rows[0].id;
  const orgId = internalWorkspaceRes.rows[0].organisation_id;

  const passwordHash = await bcrypt.hash('Password123!', 10);

  await withTransaction(async (client) => {
    // 1. Create Internal Team Members: Sarah Chen & Alex Kumar
    const sarahId = uuidv4();
    const alexId = uuidv4();

    await client.query(
      `INSERT INTO users (id, email, display_name, password_hash, role, status)
       VALUES 
       ($1, 'sarah.chen@aiautomationlabs.com', 'Sarah Chen', $3, 'internal_member', 'active'),
       ($2, 'alex.kumar@aiautomationlabs.com', 'Alex Kumar', $3, 'internal_member', 'active')
       ON CONFLICT (email) DO NOTHING`,
      [sarahId, alexId, passwordHash]
    );

    // Fetch existing or newly created IDs
    const sarahRes = await client.query(`SELECT id FROM users WHERE email = 'sarah.chen@aiautomationlabs.com'`);
    const alexRes = await client.query(`SELECT id FROM users WHERE email = 'alex.kumar@aiautomationlabs.com'`);
    const finalSarahId = sarahRes.rows[0].id;
    const finalAlexId = alexRes.rows[0].id;

    // Add them to Internal Workspace
    await client.query(
      `INSERT INTO workspace_memberships (id, workspace_id, user_id, role, status)
       VALUES 
       ($1, $2, $3, 'member', 'active'),
       ($4, $2, $5, 'member', 'active')
       ON CONFLICT (workspace_id, user_id) DO NOTHING`,
      [uuidv4(), internalWorkspaceId, finalSarahId, uuidv4(), finalAlexId]
    );

    // 2. Fetch General Channel
    const generalChannelRes = await client.query(
      `SELECT id FROM conversations WHERE workspace_id = $1 AND title = 'general' LIMIT 1`,
      [internalWorkspaceId]
    );
    const generalChannelId = generalChannelRes.rows[0].id;

    // Add Sarah and Alex to General Channel participants
    await client.query(
      `INSERT INTO conversation_participants (id, conversation_id, user_id, role)
       VALUES 
       ($1, $2, $3, 'member'),
       ($4, $2, $5, 'member')
       ON CONFLICT (conversation_id, user_id) DO NOTHING`,
      [uuidv4(), generalChannelId, finalSarahId, uuidv4(), finalAlexId]
    );

    // Add seed messages in General Channel
    await client.query(
      `INSERT INTO messages (id, conversation_id, workspace_id, author_user_id, author_kind, message_type, visibility, body, created_at)
       VALUES 
       ($1, $2, $3, $4, 'user', 'text', 'all', 'Hey team! AI Automation Labs Connect MVP architecture is ready for testing.', NOW() - INTERVAL '15 minutes'),
       ($5, $2, $3, $6, 'user', 'text', 'all', 'Awesome! Checking the WebSocket gateway and tenant isolation matrix now.', NOW() - INTERVAL '10 minutes')
       ON CONFLICT DO NOTHING`,
      [uuidv4(), generalChannelId, internalWorkspaceId, finalSarahId, uuidv4(), finalAlexId]
    );

    // 3. Customer A: Acme Corp
    const acmeCustomerId = uuidv4();
    const acmeWorkspaceId = uuidv4();
    const acmeConvId = uuidv4();
    const davidUserId = uuidv4();

    await client.query(
      `INSERT INTO customers (id, organisation_id, name, external_ref, status, primary_email, primary_phone, notes)
       VALUES ($1, $2, 'Acme Corp', 'CUST-ACM-001', 'active', 'david@acme.com', '+1-555-0192', 'Enterprise client onboarding autonomous LLM agent workflow.')
       ON CONFLICT DO NOTHING`,
      [acmeCustomerId, orgId]
    );

    // Create David Miller (Customer User)
    await client.query(
      `INSERT INTO users (id, email, display_name, password_hash, role, status)
       VALUES ($1, 'david@acme.com', 'David Miller (Acme Corp)', $2, 'customer_user', 'active')
       ON CONFLICT (email) DO NOTHING`,
      [davidUserId, passwordHash]
    );
    const davidRes = await client.query(`SELECT id FROM users WHERE email = 'david@acme.com'`);
    const finalDavidId = davidRes.rows[0].id;

    // Create Acme Customer Workspace
    await client.query(
      `INSERT INTO workspaces (id, organisation_id, customer_id, kind, name, slug)
       VALUES ($1, $2, $3, 'customer', 'Acme Corp Portal', 'customer-acme-corp')
       ON CONFLICT DO NOTHING`,
      [acmeWorkspaceId, orgId, acmeCustomerId]
    );
    const acmeWsRes = await client.query(`SELECT id FROM workspaces WHERE slug = 'customer-acme-corp'`);
    const finalAcmeWsId = acmeWsRes.rows[0].id;

    // Membership: David is customer_user in Acme Workspace
    await client.query(
      `INSERT INTO workspace_memberships (id, workspace_id, user_id, role, status)
       VALUES 
       ($1, $2, $3, 'customer_user', 'active'),
       ($4, $2, $5, 'member', 'active')
       ON CONFLICT (workspace_id, user_id) DO NOTHING`,
      [uuidv4(), finalAcmeWsId, finalDavidId, uuidv4(), finalAlexId]
    );

    // Acme Customer Conversation
    await client.query(
      `INSERT INTO conversations (id, workspace_id, kind, title, channel_type, status, priority, assigned_user_id, created_by)
       VALUES ($1, $2, 'customer_portal', 'Acme Support & Project Delivery', 'portal', 'open', 'high', $3, $4)
       ON CONFLICT DO NOTHING`,
      [acmeConvId, finalAcmeWsId, finalAlexId, finalDavidId]
    );
    const acmeConvQuery = await client.query(
      `SELECT id FROM conversations WHERE workspace_id = $1 LIMIT 1`,
      [finalAcmeWsId]
    );
    const finalAcmeConvId = acmeConvQuery.rows[0].id;

    // Participants in Acme Conversation
    await client.query(
      `INSERT INTO conversation_participants (id, conversation_id, user_id, role)
       VALUES 
       ($1, $2, $3, 'customer_user'),
       ($4, $2, $5, 'member')
       ON CONFLICT (conversation_id, user_id) DO NOTHING`,
      [uuidv4(), finalAcmeConvId, finalDavidId, uuidv4(), finalAlexId]
    );

    // Messages in Acme Conversation: Customer message, Agent message, and an INTERNAL NOTE!
    await client.query(
      `INSERT INTO messages (id, conversation_id, workspace_id, author_user_id, author_kind, message_type, visibility, body, created_at)
       VALUES 
       ($1, $2, $3, $4, 'user', 'text', 'all', 'Hi AI Automation Labs team! We are looking to test the webhooks integration this week.', NOW() - INTERVAL '2 hours'),
       ($5, $2, $3, $6, 'user', 'text', 'all', 'Hi David! Alex here. We have prepared your dedicated endpoints and security secrets.', NOW() - INTERVAL '1 hour'),
       ($7, $2, $3, $6, 'user', 'text', 'internal', '🔒 INTERNAL NOTE: Sarah, please verify the rate-limit policy for Acme Corp API before we enable full throughput.', NOW() - INTERVAL '45 minutes')
       ON CONFLICT DO NOTHING`,
      [
        uuidv4(), finalAcmeConvId, finalAcmeWsId, finalDavidId,
        uuidv4(), finalAlexId,
        uuidv4()
      ]
    );

    // 4. Customer B: Globex Logistics
    const globexCustomerId = uuidv4();
    const globexWorkspaceId = uuidv4();
    const globexConvId = uuidv4();
    const elenaUserId = uuidv4();

    await client.query(
      `INSERT INTO customers (id, organisation_id, name, external_ref, status, primary_email, primary_phone, notes)
       VALUES ($1, $2, 'Globex Logistics', 'CUST-GLO-002', 'active', 'elena@globex.com', '+1-555-0841', 'Logistics dispatch bot integration with Telegram adapter.')
       ON CONFLICT DO NOTHING`,
      [globexCustomerId, orgId]
    );

    await client.query(
      `INSERT INTO users (id, email, display_name, password_hash, role, status)
       VALUES ($1, 'elena@globex.com', 'Elena Rostova (Globex)', $2, 'customer_user', 'active')
       ON CONFLICT (email) DO NOTHING`,
      [elenaUserId, passwordHash]
    );
    const elenaRes = await client.query(`SELECT id FROM users WHERE email = 'elena@globex.com'`);
    const finalElenaId = elenaRes.rows[0].id;

    await client.query(
      `INSERT INTO workspaces (id, organisation_id, customer_id, kind, name, slug)
       VALUES ($1, $2, $3, 'customer', 'Globex Logistics Portal', 'customer-globex')
       ON CONFLICT DO NOTHING`,
      [globexWorkspaceId, orgId, globexCustomerId]
    );
    const globexWsRes = await client.query(`SELECT id FROM workspaces WHERE slug = 'customer-globex'`);
    const finalGlobexWsId = globexWsRes.rows[0].id;

    await client.query(
      `INSERT INTO workspace_memberships (id, workspace_id, user_id, role, status)
       VALUES 
       ($1, $2, $3, 'customer_user', 'active'),
       ($4, $2, $5, 'member', 'active')
       ON CONFLICT (workspace_id, user_id) DO NOTHING`,
      [uuidv4(), finalGlobexWsId, finalElenaId, uuidv4(), finalAlexId]
    );

    await client.query(
      `INSERT INTO conversations (id, workspace_id, kind, title, channel_type, status, priority, assigned_user_id, created_by)
       VALUES ($1, $2, 'customer_portal', 'Globex Telegram & Dispatch Channel', 'telegram', 'open', 'normal', $3, $4)
       ON CONFLICT DO NOTHING`,
      [globexConvId, finalGlobexWsId, finalAlexId, finalElenaId]
    );
    const globexConvQuery = await client.query(
      `SELECT id FROM conversations WHERE workspace_id = $1 LIMIT 1`,
      [finalGlobexWsId]
    );
    const finalGlobexConvId = globexConvQuery.rows[0].id;

    await client.query(
      `INSERT INTO conversation_participants (id, conversation_id, user_id, role)
       VALUES 
       ($1, $2, $3, 'customer_user'),
       ($4, $2, $5, 'member')
       ON CONFLICT (conversation_id, user_id) DO NOTHING`,
      [uuidv4(), finalGlobexConvId, finalElenaId, uuidv4(), finalAlexId]
    );

    await client.query(
      `INSERT INTO messages (id, conversation_id, workspace_id, author_user_id, author_kind, message_type, visibility, body, created_at)
       VALUES 
       ($1, $2, $3, $4, 'user', 'text', 'all', 'Hello! Elena from Globex here. Can we test live Telegram dispatch updates today?', NOW() - INTERVAL '30 minutes')
       ON CONFLICT DO NOTHING`,
      [uuidv4(), finalGlobexConvId, finalGlobexWsId, finalElenaId]
    );

    // 5. Seed Tasks for Project Board
    await client.query(
      `INSERT INTO tasks (id, workspace_id, title, description, status, priority, assignee_user_id, created_by)
       VALUES 
       ($1, $2, 'Finalize Customer Isolation Automated Tests', 'Execute matrix tests verifying Customer A/B separation and note privacy.', 'in_progress', 'urgent', $3, $4),
       ($5, $2, 'Implement Website Live Chat Embed POC', 'Build embeddable script with origin validation and session handoff.', 'todo', 'high', $6, $4),
       ($7, $2, 'Postgres Row-level Security & Outbox Pattern Review', 'Audit transactional durability for high-throughput messaging.', 'done', 'normal', $3, $4)
       ON CONFLICT DO NOTHING`,
      [
        uuidv4(), internalWorkspaceId, finalSarahId, owner.id,
        uuidv4(), finalAlexId,
        uuidv4()
      ]
    );

    // 6. Seed Software Engineering Integrations
    await client.query(
      `INSERT INTO integrations (id, organisation_id, provider, display_name, status, config_public_json)
       VALUES 
       ($1, $8, 'github', 'GitHub CI/CD & Pull Requests', 'connected', '{"repo":"ai-automation-labs/core-platform","branch":"main","events":["push","pull_request","workflow_run"]}'),
       ($2, $8, 'gitlab', 'GitLab Pipelines & DevOps', 'connected', '{"projectPath":"ailabs/runners","notifyOn":["pipeline","merge_request"]}'),
       ($3, $8, 'linear', 'Linear & Jira Dev Issues', 'connected', '{"teamPrefix":"ENG","syncBacklog":true,"autoResolveOnClose":true}'),
       ($4, $8, 'sentry', 'Sentry Crash & Exception Telemetry', 'connected', '{"environment":"production","alertRateLimit":"10/min","ignoredExceptions":[]}'),
       ($5, $8, 'docker_k8s', 'Docker & Kubernetes Cluster Health', 'connected', '{"cluster":"prod-us-east-1","namespaces":["core-apps","ml-workers"]}'),
       ($6, $8, 'vercel_aws', 'Vercel & AWS Cloud Deployments', 'connected', '{"productionDomain":"https://rocketship.ailabs.dev","previewBranches":["feat/*"]}'),
       ($7, $8, 'developer_api', 'Custom Developer REST Webhooks', 'connected', '{"signatureAuth":"hmac-sha256","rateLimitRps":50,"allowedIpRanges":["*"]}')
       ON CONFLICT DO NOTHING`,
      [uuidv4(), uuidv4(), uuidv4(), uuidv4(), uuidv4(), uuidv4(), uuidv4(), orgId]
    );
  });

  console.log('[Seed] Database seed completed successfully!');
  console.log('--- Test Accounts Created ---');
  console.log('1. Owner: owner@aiautomationlabs.com (Password: Admin123!SecurePassword)');
  console.log('2. Lead Engineer: sarah.chen@aiautomationlabs.com (Password: Password123!)');
  console.log('3. Success Manager: alex.kumar@aiautomationlabs.com (Password: Password123!)');
  console.log('4. Customer A (Acme): david@acme.com (Password: Password123!)');
  console.log('5. Customer B (Globex): elena@globex.com (Password: Password123!)');
}

if (process.argv[1] && (process.argv[1].endsWith('seed.ts') || process.argv[1].endsWith('seed.js'))) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Seed] Failed:', err);
      process.exit(1);
    });
}
