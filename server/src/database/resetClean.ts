import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { pool, query, withTransaction } from './db.js';
import { migrate } from './migrate.js';

dotenv.config();

export async function resetCleanDatabase() {
  console.log('[Clean Reset] Resetting database to pristine production state...');

  // 1. Re-run migration to ensure clean tables exist
  await migrate();

  const email = (process.env.BOOTSTRAP_OWNER_EMAIL || 'owner@aiautomationlabs.com').toLowerCase().trim();
  const name = process.env.BOOTSTRAP_OWNER_NAME || 'Owner Admin';
  const password = process.env.BOOTSTRAP_OWNER_SECRET || 'Admin123!SecurePassword';

  await withTransaction(async (client) => {
    // Truncate all tables cleanly in cascade
    await client.query(`
      TRUNCATE TABLE 
        audit_events, tasks, external_messages, external_identities, integrations,
        attachments, message_reactions, messages, conversation_participants,
        conversations, workspace_memberships, workspaces, customers, users, organisations
      CASCADE;
    `);

    // 1. Create Organization: AI Automation Labs LLP
    const orgId = uuidv4();
    await client.query(
      `INSERT INTO organisations (id, name, slug) VALUES ($1, $2, $3)`,
      [orgId, 'AI Automation Labs LLP', 'ai-automation-labs']
    );

    // 2. Create Owner User
    const ownerId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 12);
    await client.query(
      `INSERT INTO users (id, email, display_name, password_hash, role, status)
       VALUES ($1, $2, $3, $4, 'owner', 'active')`,
      [ownerId, email, name, passwordHash]
    );

    // 3. Create Default Team Workspace
    const workspaceId = uuidv4();
    await client.query(
      `INSERT INTO workspaces (id, organisation_id, kind, name, slug)
       VALUES ($1, $2, 'internal', 'AI Automation Labs Team', 'internal-team')`,
      [workspaceId, orgId]
    );

    // 4. Add Owner to Workspace
    await client.query(
      `INSERT INTO workspace_memberships (id, workspace_id, user_id, role, status)
       VALUES ($1, $2, $3, 'owner', 'active')`,
      [uuidv4(), workspaceId, ownerId]
    );

    // 5. Create Core Internal Channels
    const generalId = uuidv4();
    const announcementsId = uuidv4();
    await client.query(
      `INSERT INTO conversations (id, workspace_id, kind, title, channel_type, status, created_by)
       VALUES 
       ($1, $3, 'channel', 'general', 'internal', 'open', $4),
       ($2, $3, 'channel', 'announcements', 'internal', 'open', $4)`,
      [generalId, announcementsId, workspaceId, ownerId]
    );

    // Add Owner to channels
    await client.query(
      `INSERT INTO conversation_participants (id, conversation_id, user_id, role)
       VALUES 
       ($1, $2, $3, 'owner'),
       ($4, $5, $3, 'owner')`,
      [uuidv4(), generalId, ownerId, uuidv4(), announcementsId]
    );

    // Initial system greeting in announcements
    await client.query(
      `INSERT INTO messages (id, conversation_id, workspace_id, author_user_id, author_kind, message_type, visibility, body)
       VALUES ($1, $2, $3, $4, 'system', 'system', 'all', $5)`,
      [
        uuidv4(),
        announcementsId,
        workspaceId,
        ownerId,
        '⚡ Welcome to AI Automation Labs Connect. Team workspace is ready for real-time collaboration, customer portals, and integration workflows.'
      ]
    );

    // Insert clean production software engineering integrations
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

    // Audit Event
    await client.query(
      `INSERT INTO audit_events (id, actor_user_id, action, target_type, target_id, workspace_id, metadata_json)
       VALUES ($1, $2, 'SYSTEM_INITIALIZED', 'organisation', $3, $4, $5)`,
      [uuidv4(), ownerId, orgId, workspaceId, JSON.stringify({ initializedBy: email })]
    );
  });

  console.log('[Clean Reset] Database successfully reset to pristine state!');
  console.log(`[Admin Credentials] Email: ${email} | Password: ${password}`);
}

if (process.argv[1] && (process.argv[1].endsWith('resetClean.ts') || process.argv[1].endsWith('resetClean.js'))) {
  resetCleanDatabase()
    .then(() => {
      pool.end();
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Clean Reset Failed]:', err);
      pool.end();
      process.exit(1);
    });
}
