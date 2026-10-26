import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { query } from '../database/db.js';

const JWT_SECRET = process.env.SESSION_SECRET || 'dev-ailabs-secret-key-change-in-production-min-32-chars';
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'ailabs_session';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: string; // 'owner' | 'admin' | 'internal_member' | 'internal_guest' | 'customer_admin' | 'customer_user'
  status: string;
  avatarUrl?: string;
  customerId?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

/**
 * Sign JWT token for user session
 */
export function signToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
      customerId: user.customerId,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}

/**
 * Express middleware to authenticate session from HttpOnly Cookie or Bearer Authorization header
 */
export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token = req.cookies?.[SESSION_COOKIE_NAME];

  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentication session required. Please sign in.',
      },
    });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired session token.',
      },
    });
  }

  // Verify user still exists and is active in database
  const userRes = await query(
    `SELECT u.id, u.email, u.display_name as "displayName", u.role, u.status, u.avatar_url as "avatarUrl",
            c.id as "customerId"
     FROM users u
     LEFT JOIN workspace_memberships wm ON wm.user_id = u.id
     LEFT JOIN workspaces w ON w.id = wm.workspace_id AND w.customer_id IS NOT NULL
     LEFT JOIN customers c ON c.id = w.customer_id
     WHERE u.id = $1 AND u.status = 'active'
     LIMIT 1`,
    [payload.id]
  );

  if (userRes.rows.length === 0) {
    return res.status(401).json({
      error: {
        code: 'ACCOUNT_INACTIVE',
        message: 'User account is deactivated or not found.',
      },
    });
  }

  req.user = userRes.rows[0];
  next();
}

/**
 * Require internal roles (owner, admin, internal_member)
 */
export function requireInternal(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in required.' } });
  }

  const internalRoles = ['owner', 'admin', 'internal_member', 'internal_guest'];
  if (!internalRoles.includes(req.user.role)) {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Access restricted to internal AI Automation Labs team members.',
      },
    });
  }
  next();
}

/**
 * Require administrative roles (owner, admin)
 */
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in required.' } });
  }

  if (req.user.role !== 'owner' && req.user.role !== 'admin') {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Administrative privileges required.',
      },
    });
  }
  next();
}

/**
 * Require Owner role exclusively
 */
export function requireOwner(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in required.' } });
  }

  if (req.user.role !== 'owner') {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Owner privileges required.',
      },
    });
  }
  next();
}

