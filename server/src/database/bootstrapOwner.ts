import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from './db.js';

dotenv.config();

export async function bootstrapOwner() {
  const email = (process.env.BOOTSTRAP_OWNER_EMAIL || 'owner@aiautomationlabs.com').toLowerCase().trim();
  const name = process.env.BOOTSTRAP_OWNER_NAME || 'Owner Admin';
  const password = process.env.BOOTSTRAP_OWNER_SECRET || 'Admin123!SecurePassword';

  console.log(`[Bootstrap] Checking for Owner account: ${email}...`);

  const existing = await query('SELECT id, email, role FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    console.log(`[Bootstrap] Owner account already exists with ID: ${existing.rows[0].id}. Skipping creation.`);
    return existing.rows[0];
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const userId = uuidv4();
  const orgId = uuidv4();
  const workspaceId = uuidv4();
  const generalChannelId = uuidv4();
  const announcementsChannelId = uuidv4();
  const supportChannelId = uuidv4();

  await withTransaction(async (client) => {
    // 1. Create or get Organisation
    let orgRes = await client.query('SELECT id FROM organisations WHERE slug = $1', ['ai-automation-labs']);
    let finalOrgId = orgId;
    if (orgRes.rows.length === 0) {
      await client.query(
        'INSERT INTO organisations (id, name, slug) VALUES ($1, $2, $3)',
        [finalOrgId, 'AI Automation Labs LLP', 'ai-automation-labs']
      );
    } else {
      finalOrgId = orgRes.rows[0].id;
    }

    // 2. Create Owner User
    await client.query(
      `INSERT INTO users (id, email, display_name, password_hash, role, status)
       VALUES ($1, $2, $3, $4, 'owner', 'active')`,
      [userId, email, name, passwordHash]
    );

    // 3. Create Default Internal Workspace
    await client.query(
      `INSERT INTO workspaces (id, organisation_id, kind, name, slug)
       VALUES ($1, $2, 'internal', 'AI Automation Labs Team', 'internal-team')`,
      [workspaceId, finalOrgId]
    );

    // 4. Create Owner Membership
    await client.query(
      `INSERT INTO workspace_memberships (id, workspace_id, user_id, role, status)
       VALUES ($1, $2, $3, 'owner', 'active')`,
      [uuidv4(), workspaceId, userId]
    );

    // 5. Create Default Channels
    await client.query(
      `INSERT INTO conversations (id, workspace_id, kind, title, channel_type, status, created_by)
       VALUES 
       ($1, $4, 'channel', 'general', 'internal', 'open', $5),
       ($2, $4, 'channel', 'announcements', 'internal', 'open', $5),
       ($3, $4, 'channel', 'support-team', 'internal', 'open', $5)`,
      [generalChannelId, announcementsChannelId, supportChannelId, workspaceId, userId]
    );

    // 6. Add Owner as participant to general channel
    await client.query(
      `INSERT INTO conversation_participants (id, conversation_id, user_id, role)
       VALUES ($1, $2, $3, 'owner')`,
      [uuidv4(), generalChannelId, userId]
    );

    // 7. Insert Welcome Message
    await client.query(
      `INSERT INTO messages (id, conversation_id, workspace_id, author_user_id, author_kind, message_type, visibility, body)
       VALUES ($1, $2, $3, $4, 'system', 'system', 'all', $5)`,
      [
        uuidv4(),
        generalChannelId,
        workspaceId,
        userId,
        '⚡ Welcome to AI Automation Labs Connect! The secure, self-hosted team collaboration & customer communication platform for AI Automation Labs LLP.'
      ]
    );

    // 8. Audit event
    await client.query(
      `INSERT INTO audit_events (id, actor_user_id, action, target_type, target_id, workspace_id, metadata_json)
       VALUES ($1, $2, 'BOOTSTRAP_OWNER_CREATED', 'user', $2, $3, $4)`,
      [uuidv4(), userId, workspaceId, JSON.stringify({ email, org: 'AI Automation Labs LLP' })]
    );
  });

  console.log(`[Bootstrap] Successfully created Owner account for ${email}!`);
  return { id: userId, email, role: 'owner' };
}

if (process.argv[1] && (process.argv[1].endsWith('bootstrapOwner.ts') || process.argv[1].endsWith('bootstrapOwner.js'))) {
  bootstrapOwner()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Bootstrap] Failed:', err);
      process.exit(1);
    });
}
