import { Router, Request, Response, NextFunction } from 'express';
import { checkDatabaseHealth, query } from '../database/db.js';
import { authenticate, requireInternal, requireAdmin, requireOwner, AuthenticatedRequest } from '../auth/auth.middleware.js';
import { loginUser, registerUser, logoutUser, listUsers, updateUser, deleteUser } from '../auth/auth.service.js';
import { getAccessibleWorkspaces, getWorkspaceConversations, createConversation, updateConversation, deleteConversation } from '../workspaces/workspaces.service.js';
import { getConversationMessages, createMessage, editMessage, deleteMessage, toggleReaction } from '../messages/messages.service.js';
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from '../customers/customers.service.js';
import { getUnifiedInbox, assignConversation, updateConversationStatus } from '../inbox/inbox.service.js';
import { getTasks, createTask, updateTask, deleteTask } from '../tasks/tasks.service.js';
import { getIntegrations, handleChannelWebhook, updateIntegration, deleteIntegration } from '../integrations/integrations.service.js';
import { generateAiAssistance, getAiConfig, saveAiConfig, chatWithAi, testAiConnection } from '../ai/ai.service.js';
import { broadcastMessageCreated, broadcastMessageUpdated, broadcastMessageDeleted, broadcastConversationAssigned } from '../realtime/socket.gateway.js';

export const apiRouter = Router();

// ==========================================
// 1. Health Endpoints (PRD Section 9 & 10)
// ==========================================
apiRouter.get('/health/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'AI Automation Labs Connect API',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

apiRouter.get('/health/ready', async (req: Request, res: Response) => {
  const dbReady = await checkDatabaseHealth();
  if (dbReady) {
    res.status(200).json({
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } else {
    res.status(503).json({
      status: 'unavailable',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
    });
  }
});

// ==========================================
// 2. Authentication Endpoints
// ==========================================
apiRouter.post('/auth/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await registerUser(req.body, res);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/auth/signup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await registerUser(req.body, res);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/auth/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const result = await loginUser(email, password, res);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/auth/logout', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const result = logoutUser(res);
  res.status(200).json(result);
});

apiRouter.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    // Fetch user accessible workspaces summary
    const workspaces = await getAccessibleWorkspaces(user);
    res.status(200).json({
      user,
      workspaces,
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 3. Workspaces & Conversations Endpoints
// ==========================================
apiRouter.get('/workspaces', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const workspaces = await getAccessibleWorkspaces(req.user!);
    res.status(200).json({ workspaces });
  } catch (err) {
    next(err);
  }
});

apiRouter.get('/workspaces/:workspaceId/conversations', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.params.workspaceId as string;
    const conversations = await getWorkspaceConversations(req.user!, workspaceId);
    res.status(200).json({ conversations });
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/workspaces/:workspaceId/conversations', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.params.workspaceId as string;
    const conversation = await createConversation(req.user!, workspaceId, req.body);
    res.status(201).json({ conversation });
  } catch (err) {
    next(err);
  }
});

apiRouter.patch('/conversations/:conversationId', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const conversationId = req.params.conversationId as string;
    const conversation = await updateConversation(req.user!, conversationId, req.body);
    res.status(200).json({ conversation });
  } catch (err) {
    next(err);
  }
});

apiRouter.delete('/conversations/:conversationId', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const conversationId = req.params.conversationId as string;
    const result = await deleteConversation(req.user!, conversationId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 4. Messages Endpoints (Realtime + Scoped)
// ==========================================
apiRouter.get('/conversations/:conversationId/messages', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const conversationId = req.params.conversationId as string;
    const { cursor, limit } = req.query;
    const result = await getConversationMessages(req.user!, conversationId, {
      cursor: cursor as string,
      limit: limit ? parseInt(limit as string, 10) : 50,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/conversations/:conversationId/messages', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const conversationId = req.params.conversationId as string;
    const message = await createMessage(req.user!, conversationId, req.body);

    // Broadcast to authorised WebSocket room participants
    await broadcastMessageCreated(conversationId, message);

    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/messages/:messageId/reactions', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const messageId = req.params.messageId as string;
    const { emoji } = req.body;
    const result = await toggleReaction(req.user!, messageId, emoji);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

apiRouter.patch('/messages/:messageId', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const messageId = req.params.messageId as string;
    const { body } = req.body;
    const message = await editMessage(req.user!, messageId, body);
    broadcastMessageUpdated(message.conversationId, message);
    res.status(200).json({ message });
  } catch (err) {
    next(err);
  }
});

apiRouter.delete('/messages/:messageId', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const messageId = req.params.messageId as string;
    const result = await deleteMessage(req.user!, messageId);
    broadcastMessageDeleted(result.conversationId, messageId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 5. Customers & Shared Inbox (Internal Only)
// ==========================================
apiRouter.get('/customers', authenticate, requireInternal, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const customers = await getCustomers(req.user!);
    res.status(200).json({ customers });
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/customers', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await createCustomer(req.user!, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

apiRouter.patch('/customers/:customerId', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const customerId = req.params.customerId as string;
    const customer = await updateCustomer(req.user!, customerId, req.body);
    res.status(200).json({ customer });
  } catch (err) {
    next(err);
  }
});

apiRouter.delete('/customers/:customerId', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const customerId = req.params.customerId as string;
    const result = await deleteCustomer(req.user!, customerId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

apiRouter.get('/inbox', authenticate, requireInternal, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const conversations = await getUnifiedInbox(req.user!, {
      status: req.query.status as string,
      channelType: req.query.channelType as string,
      assignedUserId: req.query.assignedUserId as string,
      customerId: req.query.customerId as string,
      priority: req.query.priority as string,
    });
    res.status(200).json({ conversations });
  } catch (err) {
    next(err);
  }
});

apiRouter.patch('/conversations/:conversationId/assignment', authenticate, requireInternal, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const conversationId = req.params.conversationId as string;
    const { assignedUserId } = req.body;
    const result = await assignConversation(req.user!, conversationId, assignedUserId);
    broadcastConversationAssigned(conversationId, assignedUserId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

apiRouter.patch('/conversations/:conversationId/status', authenticate, requireInternal, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const conversationId = req.params.conversationId as string;
    const { status } = req.body;
    const result = await updateConversationStatus(req.user!, conversationId, status);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 6. Tasks & Kanban Board
// ==========================================
apiRouter.get('/tasks', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tasks = await getTasks(req.user!, req.query.workspaceId as string);
    res.status(200).json({ tasks });
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/tasks', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const task = await createTask(req.user!, req.body);
    res.status(201).json({ task });
  } catch (err) {
    next(err);
  }
});

apiRouter.patch('/tasks/:taskId', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const taskId = req.params.taskId as string;
    const result = await updateTask(req.user!, taskId, req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

apiRouter.delete('/tasks/:taskId', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const taskId = req.params.taskId as string;
    const result = await deleteTask(req.user!, taskId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 7. Integrations & Webhooks
// ==========================================
apiRouter.get('/integrations', authenticate, requireInternal, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const integrations = await getIntegrations(req.user!);
    res.status(200).json({ integrations });
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/integrations/webhooks/:provider', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const provider = req.params.provider as string;
    const result = await handleChannelWebhook(provider, req.headers as Record<string, string>, req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

apiRouter.patch('/integrations/:integrationId', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const integrationId = req.params.integrationId as string;
    const updated = await updateIntegration(req.user!, integrationId, req.body);
    res.status(200).json({ integration: updated });
  } catch (err) {
    next(err);
  }
});

apiRouter.delete('/integrations/:integrationId', authenticate, requireOwner, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const integrationId = req.params.integrationId as string;
    const result = await deleteIntegration(req.user!, integrationId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 8. AI Assistant & Owner Key Configuration
// ==========================================
apiRouter.get('/ai/config', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const config = await getAiConfig();
    res.status(200).json(config);
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/ai/config', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await saveAiConfig(req.user!, req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/ai/test', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await testAiConnection(req.user!, req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/ai/chat', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { prompt, conversationId } = req.body;
    const result = await chatWithAi(req.user!, prompt, conversationId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/ai/assist', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { conversationId, mode } = req.body;
    const result = await generateAiAssistance(req.user!, conversationId, mode || 'summarize');
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 9. Audio/Video Meetings (LiveKit Token Generator)
// ==========================================
apiRouter.get('/calls/token', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const roomName = (req.query.roomName as string) || 'general-meeting';
  res.status(200).json({
    room: roomName,
    serverUrl: process.env.LIVEKIT_URL || 'wss://livekit.aiautomationlabs.com',
    participantToken: `demo_token_${req.user!.id}_${Date.now()}`,
    status: 'ready',
  });
});

// ==========================================
// 10. User & Member Administration (Owner/Admin)
// ==========================================
apiRouter.get('/users', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const users = await listUsers(req.user!);
    res.status(200).json({ users });
  } catch (err) {
    next(err);
  }
});

apiRouter.patch('/users/:userId', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.userId as string;
    const user = await updateUser(req.user!, userId, req.body);
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
});

apiRouter.delete('/users/:userId', authenticate, requireOwner, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.userId as string;
    const result = await deleteUser(req.user!, userId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

