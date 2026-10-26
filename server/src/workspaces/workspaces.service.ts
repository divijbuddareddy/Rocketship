import { query, withTransaction } from '../database/db.js';
import { AuthUser } from '../auth/auth.middleware.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * List workspaces accessible by the authenticated user
 */
export async function getAccessibleWorkspaces(user: AuthUser) {
  // If user is owner or admin, they have access to internal workspace and can see all customer workspaces
  if (user.role === 'owner' || user.role === 'admin') {
    const res = await query(
      `SELECT w.id, w.name, w.slug, w.kind, w.customer_id as "customerId",
              c.name as "customerName",
              wm.role as "userRole",
              (SELECT COUNT(*) FROM conversations WHERE workspace_id = w.id)::int as "conversationCount"
       FROM workspaces w
       LEFT JOIN customers c ON c.id = w.customer_id
       LEFT JOIN workspace_memberships wm ON wm.workspace_id = w.id AND wm.user_id = $1
       ORDER BY (CASE WHEN w.kind = 'internal' THEN 0 ELSE 1 END), w.name ASC`,
      [user.id]
    );
    return res.rows;
  }

  // If user is internal member/guest, fetch internal workspace and any customer workspaces where they have active membership
  if (user.role === 'internal_member' || user.role === 'internal_guest') {
    const res = await query(
      `SELECT w.id, w.name, w.slug, w.kind, w.customer_id as "customerId",
              c.name as "customerName",
              wm.role as "userRole",
              (SELECT COUNT(*) FROM conversations WHERE workspace_id = w.id)::int as "conversationCount"
       FROM workspaces w
       JOIN workspace_memberships wm ON wm.workspace_id = w.id AND wm.user_id = $1 AND wm.status = 'active'
       LEFT JOIN customers c ON c.id = w.customer_id
       ORDER BY (CASE WHEN w.kind = 'internal' THEN 0 ELSE 1 END), w.name ASC`,
      [user.id]
    );
    return res.rows;
  }

  // If user is customer_user or customer_admin:
  // STRICT TENANT ISOLATION: They can ONLY see their own customer workspace!
  const res = await query(
    `SELECT w.id, w.name, w.slug, w.kind, w.customer_id as "customerId",
            c.name as "customerName",
            wm.role as "userRole",
            (SELECT COUNT(*) FROM conversations WHERE workspace_id = w.id)::int as "conversationCount"
     FROM workspaces w
     JOIN workspace_memberships wm ON wm.workspace_id = w.id AND wm.user_id = $1 AND wm.status = 'active'
     JOIN customers c ON c.id = w.customer_id
     WHERE w.kind = 'customer'
     ORDER BY w.name ASC`,
    [user.id]
  );

  return res.rows;
}

/**
 * Check if a user has access to a workspace
 */
export async function assertWorkspaceAccess(user: AuthUser, workspaceId: string): Promise<any> {
  const wsRes = await query(
    `SELECT w.id, w.name, w.slug, w.kind, w.customer_id as "customerId"
     FROM workspaces w
     WHERE w.id = $1`,
    [workspaceId]
  );

  if (wsRes.rows.length === 0) {
    throw { status: 404, code: 'NOT_FOUND', message: 'Workspace not found.' };
  }

  const workspace = wsRes.rows[0];

  // Owner and Admin can access any workspace
  if (user.role === 'owner' || user.role === 'admin') {
    return workspace;
  }

  // Customer users cannot access internal workspaces or other customer workspaces
  if (user.role === 'customer_user' || user.role === 'customer_admin') {
    if (workspace.kind === 'internal') {
      throw { status: 403, code: 'FORBIDDEN', message: 'You do not have access to this workspace.' };
    }
  }

  // Verify explicit membership
  const memRes = await query(
    `SELECT role FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'`,
    [workspaceId, user.id]
  );

  if (memRes.rows.length === 0) {
    throw { status: 403, code: 'FORBIDDEN', message: 'You do not have access to this workspace.' };
  }

  return workspace;
}

/**
 * List conversations in a workspace
 */
export async function getWorkspaceConversations(user: AuthUser, workspaceId: string) {
  await assertWorkspaceAccess(user, workspaceId);

  // If customer user, only list customer_portal conversations
  const isCustomer = user.role === 'customer_user' || user.role === 'customer_admin';

  const res = await query(
    `SELECT c.id, c.workspace_id as "workspaceId", c.kind, c.title, c.channel_type as "channelType",
            c.status, c.priority, c.assigned_user_id as "assignedUserId",
            u_assignee.display_name as "assignedUserName",
            c.created_at as "createdAt", c.updated_at as "updatedAt",
            (
              SELECT json_build_object(
                'id', m.id,
                'body', m.body,
                'visibility', m.visibility,
                'createdAt', m.created_at,
                'authorName', u_msg.display_name
              )
              FROM messages m
              LEFT JOIN users u_msg ON u_msg.id = m.author_user_id
              WHERE m.conversation_id = c.id
              ${isCustomer ? "AND m.visibility != 'internal'" : ''}
              ORDER BY m.created_at DESC
              LIMIT 1
            ) as "lastMessage"
     FROM conversations c
     LEFT JOIN users u_assignee ON u_assignee.id = c.assigned_user_id
     WHERE c.workspace_id = $1
     ORDER BY c.updated_at DESC, c.created_at DESC`,
    [workspaceId]
  );

  return res.rows;
}

/**
 * Create a new conversation in a workspace
 */
export async function createConversation(
  user: AuthUser,
  workspaceId: string,
  data: { title: string; kind?: string; channelType?: string; priority?: string }
) {
  const ws = await assertWorkspaceAccess(user, workspaceId);

  if (user.role === 'customer_user') {
    throw { status: 403, code: 'FORBIDDEN', message: 'Customer users cannot create new channels directly.' };
  }

  const id = uuidv4();
  const title = (data.title || '').trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
  if (!title) {
    throw { status: 400, code: 'VALIDATION_ERROR', message: 'A valid channel title is required.' };
  }

  const kind = data.kind || 'channel';
  const channelType = data.channelType || 'internal';
  const priority = data.priority || 'normal';

  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO conversations (id, workspace_id, kind, title, channel_type, status, priority, created_by)
       VALUES ($1, $2, $3, $4, $5, 'open', $6, $7)`,
      [id, workspaceId, kind, title, channelType, priority, user.id]
    );

    await client.query(
      `INSERT INTO conversation_participants (id, conversation_id, user_id, role)
       VALUES ($1, $2, $3, 'owner')`,
      [uuidv4(), id, user.id]
    );
  });

  return { id, workspaceId, title, kind, channelType, priority, status: 'open' };
}

/**
 * Edit channel or conversation (Owner/Admin)
 */
export async function updateConversation(
  user: AuthUser,
  conversationId: string,
  data: { title?: string; priority?: string; status?: string }
) {
  if (user.role !== 'owner' && user.role !== 'admin') {
    throw { status: 403, code: 'FORBIDDEN', message: 'Only owners and administrators can edit conversations.' };
  }

  const convRes = await query(`SELECT id, title, channel_type as "channelType" FROM conversations WHERE id = $1`, [conversationId]);
  if (convRes.rows.length === 0) {
    throw { status: 404, code: 'NOT_FOUND', message: 'Conversation not found.' };
  }

  const fields: string[] = [];
  const params: any[] = [];

  if (data.title !== undefined) {
    const cleanTitle = data.title.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    if (!cleanTitle) {
      throw { status: 400, code: 'VALIDATION_ERROR', message: 'Channel title cannot be empty.' };
    }
    params.push(cleanTitle);
    fields.push(`title = $${params.length}`);
  }
  if (data.priority !== undefined) {
    params.push(data.priority);
    fields.push(`priority = $${params.length}`);
  }
  if (data.status !== undefined) {
    params.push(data.status);
    fields.push(`status = $${params.length}`);
  }

  if (fields.length === 0) {
    return { conversationId, updated: false };
  }

  fields.push('updated_at = NOW()');
  params.push(conversationId);

  const res = await query(
    `UPDATE conversations
     SET ${fields.join(', ')}
     WHERE id = $${params.length}
     RETURNING id, workspace_id as "workspaceId", kind, title, channel_type as "channelType",
               status, priority, updated_at as "updatedAt"`,
    params
  );

  return res.rows[0];
}

/**
 * Delete a channel or conversation (Owner/Admin)
 */
export async function deleteConversation(user: AuthUser, conversationId: string) {
  if (user.role !== 'owner' && user.role !== 'admin') {
    throw { status: 403, code: 'FORBIDDEN', message: 'Only owners and administrators can delete channels.' };
  }

  const convRes = await query(
    `SELECT id, title, channel_type as "channelType", workspace_id as "workspaceId"
     FROM conversations WHERE id = $1`,
    [conversationId]
  );
  if (convRes.rows.length === 0) {
    throw { status: 404, code: 'NOT_FOUND', message: 'Conversation not found.' };
  }

  const conv = convRes.rows[0];

  // Protect core #general channel from accidental deletion
  if (conv.title === 'general' && conv.channelType === 'internal') {
    throw { status: 400, code: 'PROTECTED_RESOURCE', message: 'The primary #general channel cannot be deleted.' };
  }

  // Delete conversation (cascades participants, messages, and attachments)
  await query(`DELETE FROM conversations WHERE id = $1`, [conversationId]);

  return { conversationId, title: conv.title, deleted: true };
}

