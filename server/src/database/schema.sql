-- ==============================================================================
-- AI Automation Labs Connect — PostgreSQL Database Schema
-- Organisation: AI Automation Labs LLP
-- ==============================================================================

-- 1. Organisations Table
CREATE TABLE IF NOT EXISTS organisations (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'internal_member',
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- 3. Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id VARCHAR(36) PRIMARY KEY,
  organisation_id VARCHAR(36) NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  external_ref VARCHAR(100),
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  primary_email VARCHAR(255),
  primary_phone VARCHAR(50),
  notes TEXT, -- Strictly internal notes, never exposed to external customers
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Workspaces Table
CREATE TABLE IF NOT EXISTS workspaces (
  id VARCHAR(36) PRIMARY KEY,
  organisation_id VARCHAR(36) NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  customer_id VARCHAR(36) REFERENCES customers(id) ON DELETE CASCADE,
  kind VARCHAR(50) NOT NULL DEFAULT 'internal', -- 'internal' or 'customer'
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Workspace Memberships Table
CREATE TABLE IF NOT EXISTS workspace_memberships (
  id VARCHAR(36) PRIMARY KEY,
  workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'member', -- 'owner', 'admin', 'member', 'guest', 'customer_admin', 'customer_user'
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  invited_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT uq_workspace_user UNIQUE (workspace_id, user_id)
);

-- 6. Conversations Table
CREATE TABLE IF NOT EXISTS conversations (
  id VARCHAR(36) PRIMARY KEY,
  workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind VARCHAR(50) NOT NULL DEFAULT 'channel', -- 'channel', 'direct', 'customer_portal'
  title VARCHAR(255) NOT NULL,
  channel_type VARCHAR(50) NOT NULL DEFAULT 'internal', -- 'internal', 'portal', 'website_chat', 'whatsapp', 'telegram', 'email'
  status VARCHAR(50) NOT NULL DEFAULT 'open', -- 'open', 'pending', 'resolved', 'closed'
  priority VARCHAR(50) NOT NULL DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
  assigned_user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  created_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Conversation Participants Table
CREATE TABLE IF NOT EXISTS conversation_participants (
  id VARCHAR(36) PRIMARY KEY,
  conversation_id VARCHAR(36) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  last_read_message_id VARCHAR(36),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_conv_user UNIQUE (conversation_id, user_id)
);

-- 8. Messages Table
CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(36) PRIMARY KEY,
  conversation_id VARCHAR(36) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  author_user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  author_kind VARCHAR(50) NOT NULL DEFAULT 'user', -- 'user', 'system', 'bot', 'external'
  message_type VARCHAR(50) NOT NULL DEFAULT 'text', -- 'text', 'system', 'action'
  visibility VARCHAR(50) NOT NULL DEFAULT 'all', -- 'all', 'customer', 'internal'
  body TEXT NOT NULL,
  parent_message_id VARCHAR(36) REFERENCES messages(id) ON DELETE SET NULL,
  client_idempotency_key VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_conversation_idempotency UNIQUE (conversation_id, client_idempotency_key)
);

-- 9. Message Reactions Table
CREATE TABLE IF NOT EXISTS message_reactions (
  id VARCHAR(36) PRIMARY KEY,
  message_id VARCHAR(36) NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_msg_user_emoji UNIQUE (message_id, user_id, emoji)
);

-- 10. Attachments Table
CREATE TABLE IF NOT EXISTS attachments (
  id VARCHAR(36) PRIMARY KEY,
  message_id VARCHAR(36) REFERENCES messages(id) ON DELETE CASCADE,
  storage_key VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes BIGINT NOT NULL,
  checksum VARCHAR(100),
  scan_status VARCHAR(50) NOT NULL DEFAULT 'clean',
  created_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Integrations Table
CREATE TABLE IF NOT EXISTS integrations (
  id VARCHAR(36) PRIMARY KEY,
  organisation_id VARCHAR(36) NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- 'website_chat', 'whatsapp', 'telegram', 'email', 'instagram', 'sms'
  display_name VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'disconnected', -- 'connected', 'disconnected', 'error'
  config_public_json JSONB NOT NULL DEFAULT '{}',
  secret_ref VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. External Identities Table
CREATE TABLE IF NOT EXISTS external_identities (
  id VARCHAR(36) PRIMARY KEY,
  integration_id VARCHAR(36) NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  customer_id VARCHAR(36) REFERENCES customers(id) ON DELETE CASCADE,
  provider_user_id VARCHAR(255) NOT NULL,
  provider_contact VARCHAR(255),
  display_name VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. External Messages Table
CREATE TABLE IF NOT EXISTS external_messages (
  id VARCHAR(36) PRIMARY KEY,
  integration_id VARCHAR(36) NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  conversation_id VARCHAR(36) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  provider_message_id VARCHAR(255),
  provider_event_id VARCHAR(255) UNIQUE,
  direction VARCHAR(20) NOT NULL, -- 'inbound', 'outbound'
  status VARCHAR(50) NOT NULL DEFAULT 'received',
  payload_hash VARCHAR(100),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  error_code VARCHAR(100)
);

-- 14. Tasks & Kanban Table (P2 feature foundational schema)
CREATE TABLE IF NOT EXISTS tasks (
  id VARCHAR(36) PRIMARY KEY,
  workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id VARCHAR(36),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'todo', -- 'todo', 'in_progress', 'review', 'done'
  priority VARCHAR(50) NOT NULL DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
  assignee_user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  due_at TIMESTAMPTZ,
  created_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. Audit Events Table
CREATE TABLE IF NOT EXISTS audit_events (
  id VARCHAR(36) PRIMARY KEY,
  actor_user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id VARCHAR(255) NOT NULL,
  workspace_id VARCHAR(36),
  ip_hash_or_policy_value VARCHAR(100),
  metadata_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. AI Settings Table (Owner AI API Key & Provider Configuration)
CREATE TABLE IF NOT EXISTS ai_settings (
  id VARCHAR(36) PRIMARY KEY,
  organisation_id VARCHAR(36) NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL DEFAULT 'openai',
  api_key VARCHAR(500) NOT NULL,
  model VARCHAR(100) NOT NULL DEFAULT 'gpt-4o-mini',
  system_prompt TEXT DEFAULT 'You are the intelligent AI Assistant for AI Automation Labs Connect. You assist with customer communication, internal summaries, reply drafting, and task management.',
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_ai_settings_org UNIQUE (organisation_id)
);

-- Performance and Isolation Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_messages_pagination ON messages(conversation_id, created_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_workspaces_customer ON workspaces(customer_id);
CREATE INDEX IF NOT EXISTS idx_memberships_lookup ON workspace_memberships(user_id, workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_inbox ON conversations(workspace_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_assignment ON conversations(assigned_user_id, status);
