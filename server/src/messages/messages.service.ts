import { query, withTransaction } from '../database/db.js';
import { AuthUser } from '../auth/auth.middleware.js';
import { v4 as uuidv4 } from 'uuid';

export interface CreateMessageDto {
  body: string;
  clientIdempotencyKey?: string;
  parentMessageId?: string;
  visibility?: 'all' | 'customer' | 'internal';
}

/**
 * Verify user's read access to a specific conversation
 */
export async function assertConversationAccess(user: AuthUser, conversationId: string) {
  const convRes = await query(
    `SELECT c.id, c.workspace_id as "workspaceId", c.kind, c.title, c.channel_type as "channelType",
            c.status, c.priority, c.assigned_user_id as "assignedUserId",
            w.kind as "workspaceKind", w.customer_id as "customerId"
     FROM conversations c
     JOIN workspaces w ON w.id = c.workspace_id
     WHERE c.id = $1`,
    [conversationId]
  );

  if (convRes.rows.length === 0) {
    throw { status: 404, code: 'NOT_FOUND', message: 'Conversation not found.' };
  }

  const conv = convRes.rows[0];

  // Owner and Admin can access everything
  if (user.role === 'owner' || user.role === 'admin') {
    return conv;
  }

  // If customer user:
  if (user.role === 'customer_user' || user.role === 'customer_admin') {
    // 1. Cannot access internal workspaces or internal channels
    if (conv.workspaceKind === 'internal' || conv.channelType === 'internal') {
      throw { status: 403, code: 'FORBIDDEN', message: 'You do not have access to this conversation.' };
    }
    // 2. Must belong to the exact customer of this workspace
    if (user.customerId && conv.customerId !== user.customerId) {
      throw { status: 403, code: 'FORBIDDEN', message: 'You do not have access to this conversation.' };
    }
    // 3. Verify workspace membership
    const memRes = await query(
      `SELECT role FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'`,
      [conv.workspaceId, user.id]
    );
    if (memRes.rows.length === 0) {
      throw { status: 403, code: 'FORBIDDEN', message: 'You do not have access to this conversation.' };
    }
    return conv;
  }

  // If internal member/guest:
  // Must be member of the workspace, or conversation participant, or assigned user, or internal member collaborating on customer conversation
  const accessCheck = await query(
    `SELECT 1 FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'
     UNION
     SELECT 1 FROM conversation_participants WHERE conversation_id = $3 AND user_id = $2
     UNION
     SELECT 1 FROM conversations WHERE id = $3 AND assigned_user_id = $2`,
    [conv.workspaceId, user.id, conversationId]
  );

  if (accessCheck.rows.length === 0) {
    // Internal team members have access to customer support conversations
    if (conv.workspaceKind === 'customer' && (user.role === 'internal_member' || user.role === 'admin')) {
      return conv;
    }
    throw { status: 403, code: 'FORBIDDEN', message: 'You do not have access to this conversation.' };
  }

  return conv;
}

/**
 * Fetch messages for a conversation with cursor pagination and strict visibility filtering
 */
export async function getConversationMessages(
  user: AuthUser,
  conversationId: string,
  options: { cursor?: string; limit?: number } = {}
) {
  const conv = await assertConversationAccess(user, conversationId);

  const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 100);
  const isCustomer = user.role === 'customer_user' || user.role === 'customer_admin';

  let sql = `
    SELECT m.id, m.conversation_id as "conversationId", m.workspace_id as "workspaceId",
           m.author_user_id as "authorUserId", m.author_kind as "authorKind",
           m.message_type as "messageType", m.visibility, m.body,
           m.parent_message_id as "parentMessageId",
           m.client_idempotency_key as "clientIdempotencyKey",
           m.created_at as "createdAt", m.edited_at as "editedAt",
           u.display_name as "authorName", u.role as "authorRole", u.avatar_url as "authorAvatar",
           COALESCE(
             (
               SELECT json_agg(json_build_object('emoji', mr.emoji, 'userId', mr.user_id))
               FROM message_reactions mr
               WHERE mr.message_id = m.id
             ), '[]'::json
           ) as "reactions"
    FROM messages m
    LEFT JOIN users u ON u.id = m.author_user_id
    WHERE m.conversation_id = $1
      AND m.deleted_at IS NULL
  `;

  const params: any[] = [conversationId];

  // CRITICAL SECURITY RULE: Customer users can NEVER receive internal notes!
  if (isCustomer) {
    sql += ` AND m.visibility != 'internal'`;
  }

  if (options.cursor) {
    params.push(options.cursor);
    sql += ` AND m.created_at < (SELECT created_at FROM messages WHERE id = $${params.length})`;
  }

  params.push(limit);
  sql += ` ORDER BY m.created_at DESC LIMIT $${params.length}`;

  const res = await query(sql, params);

  // Return in chronological order
  const messages = res.rows.reverse();

  const nextCursor = messages.length === limit ? messages[0].id : null;

  return {
    conversation: {
      id: conv.id,
      title: conv.title,
      workspaceId: conv.workspaceId,
      channelType: conv.channelType,
      status: conv.status,
      priority: conv.priority,
      assignedUserId: conv.assignedUserId,
    },
    messages,
    nextCursor,
  };
}

/**
 * Create a new message with idempotency, validation, and visibility checks
 */
export async function createMessage(
  user: AuthUser,
  conversationId: string,
  dto: CreateMessageDto
) {
  const conv = await assertConversationAccess(user, conversationId);

  const body = (dto.body || '').trim();
  if (!body) {
    throw { status: 400, code: 'VALIDATION_ERROR', message: 'Message body cannot be empty.' };
  }
  if (body.length > 10000) {
    throw { status: 400, code: 'PAYLOAD_TOO_LARGE', message: 'Message exceeds 10,000 character limit.' };
  }

  // Idempotency check: if client supplied an idempotency key and it already exists, return existing message
  if (dto.clientIdempotencyKey) {
    const existing = await query(
      `SELECT m.id, m.conversation_id as "conversationId", m.workspace_id as "workspaceId",
              m.author_user_id as "authorUserId", m.author_kind as "authorKind",
              m.message_type as "messageType", m.visibility, m.body,
              m.client_idempotency_key as "clientIdempotencyKey",
              m.created_at as "createdAt",
              u.display_name as "authorName", u.role as "authorRole", u.avatar_url as "authorAvatar"
       FROM messages m
       LEFT JOIN users u ON u.id = m.author_user_id
       WHERE m.conversation_id = $1 AND m.client_idempotency_key = $2`,
      [conversationId, dto.clientIdempotencyKey]
    );

    if (existing.rows.length > 0) {
      return existing.rows[0];
    }
  }

  // Visibility check: Customer users CANNOT create internal notes!
  const isCustomer = user.role === 'customer_user' || user.role === 'customer_admin';
  let visibility = dto.visibility || 'all';
  if (isCustomer && visibility === 'internal') {
    throw { status: 403, code: 'FORBIDDEN', message: 'Customer users cannot create internal notes.' };
  }

  const messageId = uuidv4();
  const authorKind = isCustomer ? 'external' : 'user';

  const res = await withTransaction(async (client) => {
    const insertRes = await client.query(
      `INSERT INTO messages (
        id, conversation_id, workspace_id, author_user_id, author_kind,
        message_type, visibility, body, parent_message_id, client_idempotency_key
      )
      VALUES ($1, $2, $3, $4, $5, 'text', $6, $7, $8, $9)
      RETURNING id, conversation_id as "conversationId", workspace_id as "workspaceId",
                author_user_id as "authorUserId", author_kind as "authorKind",
                message_type as "messageType", visibility, body,
                parent_message_id as "parentMessageId",
                client_idempotency_key as "clientIdempotencyKey",
                created_at as "createdAt"`,
      [
        messageId,
        conversationId,
        conv.workspaceId,
        user.id,
        authorKind,
        visibility,
        body,
        dto.parentMessageId || null,
        dto.clientIdempotencyKey || null,
      ]
    );

    // Update conversation timestamp
    await client.query(
      `UPDATE conversations SET updated_at = NOW() WHERE id = $1`,
      [conversationId]
    );

    return insertRes.rows[0];
  });

  return {
    ...res,
    authorName: user.displayName,
    authorRole: user.role,
    authorAvatar: user.avatarUrl,
    reactions: [],
  };
}

/**
 * Toggle emoji reaction on a message
 */
export async function toggleReaction(user: AuthUser, messageId: string, emoji: string) {
  const cleanEmoji = emoji.trim();
  if (!cleanEmoji) {
    throw { status: 400, code: 'VALIDATION_ERROR', message: 'Emoji is required.' };
  }

  // Verify access to the message's conversation
  const msgRes = await query(
    `SELECT conversation_id as "conversationId" FROM messages WHERE id = $1`,
    [messageId]
  );
  if (msgRes.rows.length === 0) {
    throw { status: 404, code: 'NOT_FOUND', message: 'Message not found.' };
  }

  await assertConversationAccess(user, msgRes.rows[0].conversationId);

  const existing = await query(
    `SELECT id FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
    [messageId, user.id, cleanEmoji]
  );

  if (existing.rows.length > 0) {
    await query(`DELETE FROM message_reactions WHERE id = $1`, [existing.rows[0].id]);
    return { added: false, emoji: cleanEmoji, messageId };
  } else {
    await query(
      `INSERT INTO message_reactions (id, message_id, user_id, emoji) VALUES ($1, $2, $3, $4)`,
      [uuidv4(), messageId, user.id, cleanEmoji]
    );
    return { added: true, emoji: cleanEmoji, messageId };
  }
}

/**
 * Edit an existing message (Owner/Admin or Author)
 */
export async function editMessage(user: AuthUser, messageId: string, newBody: string) {
  const cleanBody = (newBody || '').trim();
  if (!cleanBody) {
    throw { status: 400, code: 'VALIDATION_ERROR', message: 'Message body cannot be empty.' };
  }
  if (cleanBody.length > 10000) {
    throw { status: 400, code: 'PAYLOAD_TOO_LARGE', message: 'Message exceeds 10,000 character limit.' };
  }

  const msgRes = await query(
    `SELECT m.id, m.conversation_id as "conversationId", m.author_user_id as "authorUserId",
            m.workspace_id as "workspaceId", m.deleted_at, m.visibility,
            u.display_name as "authorName", u.role as "authorRole", u.avatar_url as "authorAvatar"
     FROM messages m
     LEFT JOIN users u ON u.id = m.author_user_id
     WHERE m.id = $1`,
    [messageId]
  );

  if (msgRes.rows.length === 0 || msgRes.rows[0].deleted_at) {
    throw { status: 404, code: 'NOT_FOUND', message: 'Message not found.' };
  }

  const msg = msgRes.rows[0];

  // Owner and Admin can edit ANY message! Author can edit their own message.
  const isOwnerOrAdmin = user.role === 'owner' || user.role === 'admin';
  const isAuthor = user.id === msg.authorUserId;

  if (!isOwnerOrAdmin && !isAuthor) {
    throw { status: 403, code: 'FORBIDDEN', message: 'You do not have permission to edit this message.' };
  }

  const updateRes = await query(
    `UPDATE messages
     SET body = $1, edited_at = NOW()
     WHERE id = $2
     RETURNING id, conversation_id as "conversationId", workspace_id as "workspaceId",
               author_user_id as "authorUserId", author_kind as "authorKind",
               message_type as "messageType", visibility, body,
               parent_message_id as "parentMessageId",
               client_idempotency_key as "clientIdempotencyKey",
               created_at as "createdAt", edited_at as "editedAt"`,
    [cleanBody, messageId]
  );

  return {
    ...updateRes.rows[0],
    authorName: msg.authorName,
    authorRole: msg.authorRole,
    authorAvatar: msg.authorAvatar,
  };
}

/**
 * Delete a message (Owner/Admin or Author)
 */
export async function deleteMessage(user: AuthUser, messageId: string) {
  const msgRes = await query(
    `SELECT m.id, m.conversation_id as "conversationId", m.author_user_id as "authorUserId",
            m.workspace_id as "workspaceId", m.deleted_at
     FROM messages m WHERE m.id = $1`,
    [messageId]
  );

  if (msgRes.rows.length === 0 || msgRes.rows[0].deleted_at) {
    throw { status: 404, code: 'NOT_FOUND', message: 'Message not found.' };
  }

  const msg = msgRes.rows[0];

  // Owner and Admin can delete ANY message! Author can delete their own message.
  const isOwnerOrAdmin = user.role === 'owner' || user.role === 'admin';
  const isAuthor = user.id === msg.authorUserId;

  if (!isOwnerOrAdmin && !isAuthor) {
    throw { status: 403, code: 'FORBIDDEN', message: 'You do not have permission to delete this message.' };
  }

  // Perform soft delete
  await query(
    `UPDATE messages SET deleted_at = NOW() WHERE id = $1`,
    [messageId]
  );

  return {
    id: messageId,
    conversationId: msg.conversationId,
    deleted: true,
  };
}

