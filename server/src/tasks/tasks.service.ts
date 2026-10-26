import { query } from '../database/db.js';
import { AuthUser } from '../auth/auth.middleware.js';
import { v4 as uuidv4 } from 'uuid';

export async function getTasks(user: AuthUser, workspaceId?: string) {
  let sql = `
    SELECT t.id, t.workspace_id as "workspaceId", t.title, t.description,
           t.status, t.priority, t.due_at as "dueAt",
           t.assignee_user_id as "assigneeUserId",
           u.display_name as "assigneeName",
           t.created_at as "createdAt", t.updated_at as "updatedAt"
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assignee_user_id
  `;

  const params: any[] = [];
  if (workspaceId) {
    params.push(workspaceId);
    sql += ` WHERE t.workspace_id = $1`;
  }

  sql += ` ORDER BY t.created_at DESC`;

  const res = await query(sql, params);
  return res.rows;
}

export async function createTask(
  user: AuthUser,
  dto: { workspaceId: string; title: string; description?: string; priority?: string; assigneeUserId?: string }
) {
  const title = (dto.title || '').trim();
  if (!title) {
    throw { status: 400, code: 'VALIDATION_ERROR', message: 'Task title is required.' };
  }

  const id = uuidv4();
  const res = await query(
    `INSERT INTO tasks (id, workspace_id, title, description, status, priority, assignee_user_id, created_by)
     VALUES ($1, $2, $3, $4, 'todo', $5, $6, $7)
     RETURNING id, workspace_id as "workspaceId", title, description, status, priority,
               assignee_user_id as "assigneeUserId", created_at as "createdAt"`,
    [
      id,
      dto.workspaceId,
      title,
      dto.description || null,
      dto.priority || 'normal',
      dto.assigneeUserId || null,
      user.id,
    ]
  );

  return res.rows[0];
}

export async function updateTask(
  user: AuthUser,
  taskId: string,
  updates: {
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    assigneeUserId?: string | null;
    dueAt?: string | null;
  }
) {
  const taskRes = await query(
    `SELECT id, workspace_id as "workspaceId", created_by as "createdBy", assignee_user_id as "assigneeUserId"
     FROM tasks WHERE id = $1`,
    [taskId]
  );
  if (taskRes.rows.length === 0) {
    throw { status: 404, code: 'NOT_FOUND', message: 'Task not found.' };
  }

  const fields: string[] = [];
  const params: any[] = [];

  if (updates.title !== undefined) {
    const cleanTitle = updates.title.trim();
    if (!cleanTitle) {
      throw { status: 400, code: 'VALIDATION_ERROR', message: 'Task title cannot be empty.' };
    }
    params.push(cleanTitle);
    fields.push(`title = $${params.length}`);
  }
  if (updates.description !== undefined) {
    params.push(updates.description ? updates.description.trim() : null);
    fields.push(`description = $${params.length}`);
  }
  if (updates.status !== undefined) {
    params.push(updates.status);
    fields.push(`status = $${params.length}`);
  }
  if (updates.priority !== undefined) {
    params.push(updates.priority);
    fields.push(`priority = $${params.length}`);
  }
  if (updates.assigneeUserId !== undefined) {
    params.push(updates.assigneeUserId || null);
    fields.push(`assignee_user_id = $${params.length}`);
  }
  if (updates.dueAt !== undefined) {
    params.push(updates.dueAt || null);
    fields.push(`due_at = $${params.length}`);
  }

  if (fields.length === 0) {
    return { taskId, updated: false };
  }

  fields.push(`updated_at = NOW()`);
  params.push(taskId);

  await query(
    `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${params.length}`,
    params
  );

  return { taskId, updated: true, ...updates };
}

/**
 * Delete a task (Owner/Admin or Creator)
 */
export async function deleteTask(user: AuthUser, taskId: string) {
  const taskRes = await query(
    `SELECT id, workspace_id as "workspaceId", created_by as "createdBy"
     FROM tasks WHERE id = $1`,
    [taskId]
  );
  if (taskRes.rows.length === 0) {
    throw { status: 404, code: 'NOT_FOUND', message: 'Task not found.' };
  }

  const isOwnerOrAdmin = user.role === 'owner' || user.role === 'admin';
  const isCreator = user.id === taskRes.rows[0].createdBy;

  if (!isOwnerOrAdmin && !isCreator) {
    throw { status: 403, code: 'FORBIDDEN', message: 'You do not have permission to delete this task.' };
  }

  await query(`DELETE FROM tasks WHERE id = $1`, [taskId]);

  return { taskId, deleted: true };
}

