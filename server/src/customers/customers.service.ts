import { query, withTransaction } from '../database/db.js';
import { AuthUser } from '../auth/auth.middleware.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

export interface CreateCustomerDto {
  name: string;
  externalRef?: string;
  primaryEmail: string;
  primaryPhone?: string;
  notes?: string;
  initialPassword?: string;
}

/**
 * List all customers (restricted to internal team)
 */
export async function getCustomers(user: AuthUser) {
  const res = await query(
    `SELECT c.id, c.name, c.external_ref as "externalRef", c.status,
            c.primary_email as "primaryEmail", c.primary_phone as "primaryPhone",
            c.notes, c.created_at as "createdAt",
            w.id as "workspaceId", w.slug as "workspaceSlug",
            (SELECT COUNT(*) FROM conversations WHERE workspace_id = w.id)::int as "conversationCount",
            (SELECT COUNT(*) FROM workspace_memberships WHERE workspace_id = w.id AND status = 'active')::int as "memberCount"
     FROM customers c
     LEFT JOIN workspaces w ON w.customer_id = c.id
     ORDER BY c.created_at DESC`
  );

  return res.rows;
}

/**
 * Create a new Customer, customer workspace, and initial conversation in one atomic transaction
 */
export async function createCustomer(user: AuthUser, dto: CreateCustomerDto) {
  const name = (dto.name || '').trim();
  const email = (dto.primaryEmail || '').trim().toLowerCase();

  if (!name || !email) {
    throw { status: 400, code: 'VALIDATION_ERROR', message: 'Customer name and email are required.' };
  }

  // Get default organisation
  const orgRes = await query('SELECT id FROM organisations LIMIT 1');
  const orgId = orgRes.rows[0].id;

  const customerId = uuidv4();
  const workspaceId = uuidv4();
  const conversationId = uuidv4();
  const slug = `customer-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}`;

  const result = await withTransaction(async (client) => {
    // 1. Create Customer
    await client.query(
      `INSERT INTO customers (id, organisation_id, name, external_ref, status, primary_email, primary_phone, notes)
       VALUES ($1, $2, $3, $4, 'active', $5, $6, $7)`,
      [customerId, orgId, name, dto.externalRef || null, email, dto.primaryPhone || null, dto.notes || null]
    );

    // 2. Create Workspace
    await client.query(
      `INSERT INTO workspaces (id, organisation_id, customer_id, kind, name, slug)
       VALUES ($1, $2, $3, 'customer', $4, $5)`,
      [workspaceId, orgId, customerId, `${name} Portal`, slug]
    );

    // 3. Add creator to workspace
    await client.query(
      `INSERT INTO workspace_memberships (id, workspace_id, user_id, role, status)
       VALUES ($1, $2, $3, 'member', 'active')`,
      [uuidv4(), workspaceId, user.id]
    );

    // 4. Create user for customer if password provided or default
    let customerUserId: string | null = null;
    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length === 0) {
      customerUserId = uuidv4();
      const pwd = dto.initialPassword || 'Customer123!Secure';
      const passwordHash = await bcrypt.hash(pwd, 10);
      await client.query(
        `INSERT INTO users (id, email, display_name, password_hash, role, status)
         VALUES ($1, $2, $3, $4, 'customer_user', 'active')`,
        [customerUserId, email, `${name} Contact`, passwordHash]
      );
    } else {
      customerUserId = existingUser.rows[0].id;
    }

    // Add customer user to customer workspace
    await client.query(
      `INSERT INTO workspace_memberships (id, workspace_id, user_id, role, status)
       VALUES ($1, $2, $3, 'customer_user', 'active')
       ON CONFLICT (workspace_id, user_id) DO NOTHING`,
      [uuidv4(), workspaceId, customerUserId]
    );

    // 5. Create initial customer conversation
    await client.query(
      `INSERT INTO conversations (id, workspace_id, kind, title, channel_type, status, priority, assigned_user_id, created_by)
       VALUES ($1, $2, 'customer_portal', $3, 'portal', 'open', 'normal', $4, $5)`,
      [conversationId, workspaceId, `${name} Support & Collaboration`, user.id, customerUserId]
    );

    // Add participants
    await client.query(
      `INSERT INTO conversation_participants (id, conversation_id, user_id, role)
       VALUES 
       ($1, $2, $3, 'member'),
       ($4, $5, $6, 'customer_user')`,
      [uuidv4(), conversationId, user.id, uuidv4(), conversationId, customerUserId]
    );

    // 6. Audit Event
    await client.query(
      `INSERT INTO audit_events (id, actor_user_id, action, target_type, target_id, workspace_id, metadata_json)
       VALUES ($1, $2, 'CUSTOMER_CREATED', 'customer', $3, $4, $5)`,
      [uuidv4(), user.id, customerId, workspaceId, JSON.stringify({ name, email })]
    );

    return {
      customerId,
      workspaceId,
      conversationId,
      name,
      email,
      workspaceSlug: slug,
    };
  });

  return result;
}

/**
 * Edit Customer details (Owner/Admin)
 */
export async function updateCustomer(
  user: AuthUser,
  customerId: string,
  dto: {
    name?: string;
    primaryEmail?: string;
    primaryPhone?: string;
    notes?: string;
    status?: string;
    externalRef?: string;
  }
) {
  if (user.role !== 'owner' && user.role !== 'admin') {
    throw { status: 403, code: 'FORBIDDEN', message: 'Only owners and administrators can edit customer accounts.' };
  }

  const fields: string[] = [];
  const params: any[] = [];

  if (dto.name !== undefined) {
    const cleanName = dto.name.trim();
    if (!cleanName) {
      throw { status: 400, code: 'VALIDATION_ERROR', message: 'Customer name cannot be empty.' };
    }
    params.push(cleanName);
    fields.push(`name = $${params.length}`);
  }
  if (dto.primaryEmail !== undefined) {
    const cleanEmail = dto.primaryEmail.trim().toLowerCase();
    params.push(cleanEmail || null);
    fields.push(`primary_email = $${params.length}`);
  }
  if (dto.primaryPhone !== undefined) {
    params.push(dto.primaryPhone ? dto.primaryPhone.trim() : null);
    fields.push(`primary_phone = $${params.length}`);
  }
  if (dto.externalRef !== undefined) {
    params.push(dto.externalRef ? dto.externalRef.trim() : null);
    fields.push(`external_ref = $${params.length}`);
  }
  if (dto.notes !== undefined) {
    params.push(dto.notes || null);
    fields.push(`notes = $${params.length}`);
  }
  if (dto.status !== undefined) {
    params.push(dto.status);
    fields.push(`status = $${params.length}`);
  }

  if (fields.length === 0) {
    return { customerId, updated: false };
  }

  fields.push('updated_at = NOW()');
  params.push(customerId);

  const res = await query(
    `UPDATE customers
     SET ${fields.join(', ')}
     WHERE id = $${params.length}
     RETURNING id, name, status, external_ref as "externalRef",
               primary_email as "primaryEmail", primary_phone as "primaryPhone",
               notes, updated_at as "updatedAt"`,
    params
  );

  if (res.rows.length === 0) {
    throw { status: 404, code: 'NOT_FOUND', message: 'Customer not found.' };
  }

  return res.rows[0];
}

/**
 * Delete Customer and cascade to their workspace (Owner/Admin)
 */
export async function deleteCustomer(user: AuthUser, customerId: string) {
  if (user.role !== 'owner' && user.role !== 'admin') {
    throw { status: 403, code: 'FORBIDDEN', message: 'Only owners and administrators can delete customer accounts.' };
  }

  const custRes = await query(`SELECT id, name FROM customers WHERE id = $1`, [customerId]);
  if (custRes.rows.length === 0) {
    throw { status: 404, code: 'NOT_FOUND', message: 'Customer not found.' };
  }

  // Delete customer; cascading foreign keys will remove workspace, conversations, messages, memberships
  await query(`DELETE FROM customers WHERE id = $1`, [customerId]);

  return { customerId, name: custRes.rows[0].name, deleted: true };
}

