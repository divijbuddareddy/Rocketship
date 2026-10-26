import { query } from '../database/db.js';
import { AuthUser } from '../auth/auth.middleware.js';
import { v4 as uuidv4 } from 'uuid';

export interface InboxFilters {
  status?: string;
  channelType?: string;
  assignedUserId?: string;
  customerId?: string;
  priority?: string;
}

/**
 * Fetch unified inbox for internal team
 */
export async function getUnifiedInbox(user: AuthUser, filters: InboxFilters) {
  let sql = `
    SELECT c.id, c.title, c.kind, c.channel_type as "channelType",
           c.status, c.priority, c.assigned_user_id as "assignedUserId",
           u_assignee.display_name as "assignedUserName",
           c.created_at as "createdAt", c.updated_at as "updatedAt",
           w.id as "workspaceId", w.name as "workspaceName",
           cust.id as "customerId", cust.name as "customerName",
           (
             SELECT json_build_object(
               'id', m.id,
               'body', m.body,
               'visibility', m.visibility,
               'authorName', u_msg.display_name,
               'createdAt', m.created_at
             )
             FROM messages m
             LEFT JOIN users u_msg ON u_msg.id = m.author_user_id
             WHERE m.conversation_id = c.id
             ORDER BY m.created_at DESC
             LIMIT 1
           ) as "lastMessage",
           (
             SELECT COUNT(*)
             FROM messages m
             WHERE m.conversation_id = c.id
           )::int as "messageCount"
    FROM conversations c
    JOIN workspaces w ON w.id = c.workspace_id
    JOIN customers cust ON cust.id = w.customer_id
    LEFT JOIN users u_assignee ON u_assignee.id = c.assigned_user_id
    WHERE w.kind = 'customer'
  `;

  const params: any[] = [];

  if (filters.status && filters.status !== 'all') {
    params.push(filters.status);
    sql += ` AND c.status = $${params.length}`;
  }

  if (filters.channelType && filters.channelType !== 'all') {
    params.push(filters.channelType);
    sql += ` AND c.channel_type = $${params.length}`;
  }

  if (filters.priority && filters.priority !== 'all') {
    params.push(filters.priority);
    sql += ` AND c.priority = $${params.length}`;
  }

  if (filters.assignedUserId) {
    if (filters.assignedUserId === 'unassigned') {
      sql += ` AND c.assigned_user_id IS NULL`;
    } else {
      params.push(filters.assignedUserId);
      sql += ` AND c.assigned_user_id = $${params.length}`;
    }
  }

  if (filters.customerId) {
    params.push(filters.customerId);
    sql += ` AND cust.id = $${params.length}`;
  }

  sql += ` ORDER BY c.updated_at DESC`;

  const res = await query(sql, params);
  return res.rows;
}

/**
 * Assign conversation to an internal member
 */
export async function assignConversation(
  user: AuthUser,
  conversationId: string,
  assigneeUserId: string | null
) {
  // Verify conversation exists
  const convRes = await query('SELECT id, workspace_id as "workspaceId", title FROM conversations WHERE id = $1', [conversationId]);
  if (convRes.rows.length === 0) {
    throw { status: 404, code: 'NOT_FOUND', message: 'Conversation not found.' };
  }

  if (assigneeUserId) {
    // Verify assignee exists
    const assigneeRes = await query('SELECT id, display_name FROM users WHERE id = $1', [assigneeUserId]);
    if (assigneeRes.rows.length === 0) {
      throw { status: 400, code: 'INVALID_ASSIGNEE', message: 'Assigned user does not exist.' };
    }
  }

  await query(
    `UPDATE conversations SET assigned_user_id = $1, updated_at = NOW() WHERE id = $2`,
    [assigneeUserId, conversationId]
  );

  // Log audit event
  await query(
    `INSERT INTO audit_events (id, actor_user_id, action, target_type, target_id, workspace_id, metadata_json)
     VALUES ($1, $2, 'CONVERSATION_ASSIGNED', 'conversation', $3, $4, $5)`,
    [uuidv4(), user.id, conversationId, convRes.rows[0].workspaceId, JSON.stringify({ assignedUserId: assigneeUserId })]
  );

  return { conversationId, assignedUserId: assigneeUserId };
}

/**
 * Update conversation status (open, pending, resolved, closed)
 */
export async function updateConversationStatus(
  user: AuthUser,
  conversationId: string,
  status: 'open' | 'pending' | 'resolved' | 'closed'
) {
  const allowed = ['open', 'pending', 'resolved', 'closed'];
  if (!allowed.includes(status)) {
    throw { status: 400, code: 'INVALID_STATUS', message: `Status must be one of: ${allowed.join(', ')}` };
  }

  await query(
    `UPDATE conversations SET status = $1, updated_at = NOW() WHERE id = $2`,
    [status, conversationId]
  );

  return { conversationId, status };
}
