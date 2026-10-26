import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { verifyToken, AuthUser } from '../auth/auth.middleware.js';
import { assertConversationAccess } from '../messages/messages.service.js';
import { query } from '../database/db.js';

interface AuthenticatedSocket extends Socket {
  user?: AuthUser;
}

let ioInstance: SocketIOServer | null = null;

export function initSocketGateway(httpServer: HttpServer, corsOrigins: string[]) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: corsOrigins,
      credentials: true,
    },
    pingTimeout: 20000,
    pingInterval: 10000,
  });

  ioInstance = io;

  // Handshake Authentication
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.cookie
        ?.split('; ')
        .find(row => row.startsWith(process.env.SESSION_COOKIE_NAME || 'ailabs_session'))
        ?.split('=')[1];

      if (!token) {
        return next(new Error('Authentication session required for WebSocket connection'));
      }

      const decoded = verifyToken(token);
      if (!decoded) {
        return next(new Error('Invalid WebSocket session token'));
      }

      // Re-fetch current user info
      const userRes = await query(
        `SELECT u.id, u.email, u.display_name as "displayName", u.role, u.status,
                c.id as "customerId"
         FROM users u
         LEFT JOIN workspace_memberships wm ON wm.user_id = u.id
         LEFT JOIN workspaces w ON w.id = wm.workspace_id AND w.customer_id IS NOT NULL
         LEFT JOIN customers c ON c.id = w.customer_id
         WHERE u.id = $1 AND u.status = 'active'
         LIMIT 1`,
        [decoded.id]
      );

      if (userRes.rows.length === 0) {
        return next(new Error('User inactive or deleted'));
      }

      socket.user = userRes.rows[0];
      next();
    } catch (err: any) {
      next(new Error('Authentication failed: ' + err.message));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const user = socket.user!;
    console.log(`[Socket] Connected: user=${user.email} (${user.role}), socket=${socket.id}`);

    // Join personal notification room
    socket.join(`user:${user.id}`);

    // conversation.join - Strict permission assertion on server!
    socket.on('conversation.join', async (data: { conversationId: string }, callback?: (res: any) => void) => {
      try {
        if (!data?.conversationId) {
          if (callback) callback({ error: 'conversationId required' });
          return;
        }

        // Server checks current membership and read permission before room join!
        await assertConversationAccess(user, data.conversationId);

        const room = `conv:${data.conversationId}`;
        socket.join(room);
        if (callback) callback({ status: 'ok', room });
      } catch (err: any) {
        console.warn(`[Socket Denial] User ${user.email} denied join to conversation ${data?.conversationId}: ${err.message}`);
        if (callback) callback({ error: 'Access denied: ' + (err.message || 'Forbidden') });
      }
    });

    // conversation.leave
    socket.on('conversation.leave', (data: { conversationId: string }) => {
      if (data?.conversationId) {
        socket.leave(`conv:${data.conversationId}`);
      }
    });

    // typing.start
    socket.on('typing.start', async (data: { conversationId: string }) => {
      try {
        if (!data?.conversationId) return;
        await assertConversationAccess(user, data.conversationId);
        socket.to(`conv:${data.conversationId}`).emit('typing.updated', {
          conversationId: data.conversationId,
          userId: user.id,
          userName: user.displayName,
          isTyping: true,
        });
      } catch {}
    });

    // typing.stop
    socket.on('typing.stop', (data: { conversationId: string }) => {
      if (!data?.conversationId) return;
      socket.to(`conv:${data.conversationId}`).emit('typing.updated', {
        conversationId: data.conversationId,
        userId: user.id,
        userName: user.displayName,
        isTyping: false,
      });
    });

    // read.updated
    socket.on('read.updated', async (data: { conversationId: string; messageId: string }) => {
      try {
        if (!data?.conversationId || !data?.messageId) return;
        await assertConversationAccess(user, data.conversationId);
        await query(
          `UPDATE conversation_participants
           SET last_read_message_id = $1
           WHERE conversation_id = $2 AND user_id = $3`,
          [data.messageId, data.conversationId, user.id]
        );
        socket.to(`conv:${data.conversationId}`).emit('read.updated', {
          conversationId: data.conversationId,
          userId: user.id,
          messageId: data.messageId,
        });
      } catch {}
    });

    socket.on('disconnect', () => {
      // transient presence cleanup
    });
  });

  return io;
}

/**
 * Broadcast message.created with strict visibility protection!
 */
export async function broadcastMessageCreated(conversationId: string, message: any) {
  if (!ioInstance) return;

  const room = `conv:${conversationId}`;

  // If this message is an internal note, only broadcast to sockets belonging to internal team members!
  if (message.visibility === 'internal') {
    const sockets = await ioInstance.in(room).fetchSockets();
    for (const s of sockets) {
      const user = (s as any).user as AuthUser | undefined;
      const internalRoles = ['owner', 'admin', 'internal_member', 'internal_guest'];
      if (user && internalRoles.includes(user.role)) {
        s.emit('message.created', message);
      }
    }
  } else {
    // Normal message: broadcast to all authorized participants in the room
    ioInstance.to(room).emit('message.created', message);
  }
}

/**
 * Broadcast conversation assignment
 */
export function broadcastConversationAssigned(conversationId: string, assignee: any) {
  if (!ioInstance) return;
  ioInstance.emit('conversation.assigned', { conversationId, assignee });
}

/**
 * Broadcast message update (edit)
 */
export function broadcastMessageUpdated(conversationId: string, message: any) {
  if (!ioInstance) return;
  ioInstance.to(`conv:${conversationId}`).emit('message.updated', message);
}

/**
 * Broadcast message deletion
 */
export function broadcastMessageDeleted(conversationId: string, messageId: string) {
  if (!ioInstance) return;
  ioInstance.to(`conv:${conversationId}`).emit('message.deleted', { conversationId, messageId });
}

