import bcrypt from 'bcryptjs';
import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../database/db.js';
import { AuthUser, signToken } from './auth.middleware.js';

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'ailabs_session';
const isProd = process.env.NODE_ENV === 'production';

/**
 * Register a new user account with duplicate credential detection
 */
export async function registerUser(
  dto: { displayName: string; email: string; password: string },
  res: Response
) {
  const normalizedEmail = (dto.email || '').toLowerCase().trim();
  const displayName = (dto.displayName || '').trim();
  const password = dto.password || '';

  if (!displayName) {
    throw { status: 400, code: 'VALIDATION_ERROR', message: 'Full name / display name is required.' };
  }
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw { status: 400, code: 'VALIDATION_ERROR', message: 'A valid email address is required.' };
  }
  if (!password || password.length < 8) {
    throw { status: 400, code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters long.' };
  }

  // Check if credentials were used to create the account earlier
  const existing = await query('SELECT id, email FROM users WHERE email = $1 LIMIT 1', [normalizedEmail]);
  if (existing.rows.length > 0) {
    throw {
      status: 409,
      code: 'EMAIL_ALREADY_REGISTERED',
      message: 'This email is already registered. These credentials were used to create an account earlier. Please sign in instead.',
    };
  }

  // Create new user account (default role: internal_member)
  const userId = uuidv4();
  const passwordHash = await bcrypt.hash(password, 12);

  await query(
    `INSERT INTO users (id, email, display_name, password_hash, role, status)
     VALUES ($1, $2, $3, $4, 'internal_member', 'active')`,
    [userId, normalizedEmail, displayName, passwordHash]
  );

  // Automatically attach new user to the internal team workspace
  const internalWsRes = await query(`SELECT id FROM workspaces WHERE kind = 'internal' LIMIT 1`);
  if (internalWsRes.rows.length > 0) {
    const wsId = internalWsRes.rows[0].id;
    await query(
      `INSERT INTO workspace_memberships (id, workspace_id, user_id, role, status)
       VALUES ($1, $2, $3, 'internal_member', 'active')
       ON CONFLICT DO NOTHING`,
      [uuidv4(), wsId, userId]
    );

    // Auto-join default core channels: #general and #announcements
    const convsRes = await query(
      `SELECT id FROM conversations WHERE workspace_id = $1 AND title IN ('general', 'announcements')`,
      [wsId]
    );
    for (const row of convsRes.rows) {
      await query(
        `INSERT INTO conversation_participants (id, conversation_id, user_id, role)
         VALUES ($1, $2, $3, 'member')
         ON CONFLICT (conversation_id, user_id) DO NOTHING`,
        [uuidv4(), row.id, userId]
      );
    }
  }

  const authUser: AuthUser = {
    id: userId,
    email: normalizedEmail,
    displayName,
    role: 'internal_member',
    status: 'active',
  };

  const token = signToken(authUser);

  // Set secure HttpOnly session cookie
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });

  return {
    user: authUser,
    token,
    message: 'Account created successfully! Welcome to AI Automation Labs Connect.',
  };
}

export async function loginUser(email: string, passwordPlain: string, res: Response) {
  const normalizedEmail = (email || '').toLowerCase().trim();

  if (!normalizedEmail || !passwordPlain) {
    throw { status: 400, code: 'VALIDATION_ERROR', message: 'Email and password are required.' };
  }

  const userRes = await query(
    `SELECT u.id, u.email, u.display_name as "displayName", u.password_hash, u.role, u.status, u.avatar_url as "avatarUrl",
            c.id as "customerId", c.name as "customerName"
     FROM users u
     LEFT JOIN workspace_memberships wm ON wm.user_id = u.id
     LEFT JOIN workspaces w ON w.id = wm.workspace_id AND w.customer_id IS NOT NULL
     LEFT JOIN customers c ON c.id = w.customer_id
     WHERE u.email = $1
     LIMIT 1`,
    [normalizedEmail]
  );

  if (userRes.rows.length === 0) {
    // Generic credential failure per PRD AUTH-01
    throw { status: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' };
  }

  const user = userRes.rows[0];

  if (user.status !== 'active') {
    throw { status: 403, code: 'ACCOUNT_DEACTIVATED', message: 'Account is deactivated. Contact administrator.' };
  }

  const isValidPassword = await bcrypt.compare(passwordPlain, user.password_hash);
  if (!isValidPassword) {
    throw { status: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' };
  }

  // Update last_login_at
  await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    avatarUrl: user.avatarUrl,
    customerId: user.customerId,
  };

  const token = signToken(authUser);

  // Set secure HttpOnly session cookie
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });

  return {
    user: authUser,
    customer: user.customerId ? { id: user.customerId, name: user.customerName } : null,
    token,
  };
}

export function logoutUser(res: Response) {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
  });
  return { success: true, message: 'Logged out successfully.' };
}

/**
 * List all users (Owner/Admin)
 */
export async function listUsers(caller: AuthUser) {
  if (caller.role !== 'owner' && caller.role !== 'admin') {
    throw { status: 403, code: 'FORBIDDEN', message: 'Only owners and administrators can list team users.' };
  }
  const res = await query(
    `SELECT DISTINCT ON (u.id) u.id, u.email, u.display_name as "displayName", u.role, u.status,
            u.created_at as "createdAt", u.last_login_at as "lastLoginAt",
            c.id as "customerId", c.name as "customerName"
     FROM users u
     LEFT JOIN workspace_memberships wm ON wm.user_id = u.id
     LEFT JOIN workspaces w ON w.id = wm.workspace_id AND w.customer_id IS NOT NULL
     LEFT JOIN customers c ON c.id = w.customer_id
     ORDER BY u.id, u.created_at ASC`
  );
  return res.rows;
}

/**
 * Edit user details (Owner/Admin)
 */
export async function updateUser(
  caller: AuthUser,
  targetUserId: string,
  dto: { displayName?: string; role?: string; status?: string }
) {
  if (caller.role !== 'owner' && caller.role !== 'admin') {
    throw { status: 403, code: 'FORBIDDEN', message: 'Only owners and administrators can edit user accounts.' };
  }

  const targetRes = await query('SELECT id, email, role FROM users WHERE id = $1', [targetUserId]);
  if (targetRes.rows.length === 0) {
    throw { status: 404, code: 'NOT_FOUND', message: 'User not found.' };
  }

  const target = targetRes.rows[0];
  if (target.role === 'owner' && caller.id !== target.id) {
    throw { status: 403, code: 'FORBIDDEN', message: 'Cannot modify primary owner account.' };
  }

  const fields: string[] = [];
  const params: any[] = [];

  if (dto.displayName !== undefined) {
    params.push(dto.displayName.trim());
    fields.push(`display_name = $${params.length}`);
  }
  if (dto.role !== undefined && caller.role === 'owner') {
    params.push(dto.role);
    fields.push(`role = $${params.length}`);
  }
  if (dto.status !== undefined) {
    if (target.role === 'owner' && dto.status !== 'active') {
      throw { status: 400, code: 'BAD_REQUEST', message: 'Primary owner account cannot be deactivated.' };
    }
    params.push(dto.status);
    fields.push(`status = $${params.length}`);
  }

  if (fields.length === 0) {
    return { targetUserId, updated: false };
  }

  fields.push('updated_at = NOW()');
  params.push(targetUserId);

  const res = await query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${params.length}
     RETURNING id, email, display_name as "displayName", role, status`,
    params
  );

  return res.rows[0];
}

/**
 * Delete a user account (Owner only)
 */
export async function deleteUser(caller: AuthUser, targetUserId: string) {
  if (caller.role !== 'owner') {
    throw { status: 403, code: 'FORBIDDEN', message: 'Only the Owner can delete user accounts.' };
  }

  const targetRes = await query('SELECT id, email, role FROM users WHERE id = $1', [targetUserId]);
  if (targetRes.rows.length === 0) {
    throw { status: 404, code: 'NOT_FOUND', message: 'User not found.' };
  }

  if (targetRes.rows[0].role === 'owner') {
    throw { status: 400, code: 'BAD_REQUEST', message: 'The primary Owner account cannot be deleted.' };
  }

  await query('DELETE FROM users WHERE id = $1', [targetUserId]);
  return { id: targetUserId, email: targetRes.rows[0].email, deleted: true };
}

