// ==============================================================================
// AI Automation Labs Connect UI Rendering & Component Controllers
// ==============================================================================

import { state } from './state.js';
import { api, showToast } from './api.js';
import { joinConversationRoom, emitTyping } from './socket.js';

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function showPromptDialog(title, promptLabel, defaultValue = '', placeholder = '') {
  return new Promise((resolve) => {
    const modal = document.getElementById('genericModal');
    const titleEl = document.getElementById('genericModalTitle');
    const bodyEl = document.getElementById('genericModalBody');
    if (!modal || !titleEl || !bodyEl) {
      const val = window.prompt(promptLabel, defaultValue);
      return resolve(val);
    }

    titleEl.textContent = title;
    bodyEl.innerHTML = `
      <form id="dialogPromptForm" style="display: flex; flex-direction: column; gap: 14px;">
        <label style="font-size: 0.85rem; color: var(--text-muted);">${escapeHtml(promptLabel)}</label>
        <input type="text" id="dialogPromptInput" value="${escapeHtml(defaultValue)}" placeholder="${escapeHtml(placeholder)}" class="auth-input" style="width: 100%; box-sizing: border-box;" required />
        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;">
          <button type="button" class="btn-pill" id="dialogPromptCancel">Cancel</button>
          <button type="submit" class="btn-pill primary" id="dialogPromptSubmit">Save Changes</button>
        </div>
      </form>
    `;

    modal.classList.add('active');
    const input = document.getElementById('dialogPromptInput');
    input?.focus();
    input?.select();

    const cleanup = () => {
      modal.classList.remove('active');
      modal.querySelector('.close-modal-btn')?.removeEventListener('click', onCancel);
    };

    const onCancel = () => {
      cleanup();
      resolve(null);
    };

    document.getElementById('dialogPromptCancel')?.addEventListener('click', onCancel);
    modal.querySelector('.close-modal-btn')?.addEventListener('click', onCancel, { once: true });

    document.getElementById('dialogPromptForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = input ? input.value : '';
      cleanup();
      resolve(val);
    });
  });
}

export function showConfirmDialog(title, message, confirmText = 'Confirm', isDanger = true) {
  return new Promise((resolve) => {
    const modal = document.getElementById('genericModal');
    const titleEl = document.getElementById('genericModalTitle');
    const bodyEl = document.getElementById('genericModalBody');
    if (!modal || !titleEl || !bodyEl) {
      const confirmed = window.confirm(message);
      return resolve(confirmed);
    }

    titleEl.textContent = title;
    bodyEl.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <p style="font-size: 0.88rem; color: var(--text-main); line-height: 1.5; margin: 0;">${escapeHtml(message)}</p>
        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px;">
          <button type="button" class="btn-pill" id="dialogConfirmCancel">Cancel</button>
          <button type="button" class="btn-pill" id="dialogConfirmAction" style="${isDanger ? 'background: #dc2626; color: #fff; border-color: #ef4444;' : 'background: var(--brand-primary); color: #fff;'}">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;

    modal.classList.add('active');

    const cleanup = () => {
      modal.classList.remove('active');
      modal.querySelector('.close-modal-btn')?.removeEventListener('click', onCancel);
    };

    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    document.getElementById('dialogConfirmCancel')?.addEventListener('click', onCancel);
    modal.querySelector('.close-modal-btn')?.addEventListener('click', onCancel, { once: true });

    document.getElementById('dialogConfirmAction')?.addEventListener('click', () => {
      cleanup();
      resolve(true);
    });
  });
}

export function renderUserBadge() {
  const container = document.getElementById('userProfileBadge');
  if (!container || !state.currentUser) return;

  const u = state.currentUser;
  const isInternal = ['owner', 'admin', 'internal_member', 'internal_guest'].includes(u.role);
  const initials = u.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  container.innerHTML = `
    <div class="avatar">${initials}</div>
    <div style="display: flex; flex-direction: column; text-align: left;">
      <span style="font-size: 0.82rem; font-weight: 600; line-height: 1.2;">${escapeHtml(u.displayName)}</span>
      <span style="font-size: 0.68rem; color: var(--text-dim); text-transform: uppercase;">
        ${isInternal ? '🛡️ ' + u.role.replace('_', ' ') : '🏢 Customer Portal'}
      </span>
    </div>
  `;

  // Hide or show internal-only navigation buttons in sidebar
  const internalNavs = document.querySelectorAll('.internal-only-nav');
  internalNavs.forEach(el => {
    el.style.display = isInternal ? 'flex' : 'none';
  });

  // Hide or show internal note toggle in composer
  const noteToggle = document.getElementById('toggleInternalNote');
  if (noteToggle) {
    noteToggle.style.display = isInternal ? 'flex' : 'none';
  }
}

export function renderWorkspaceHeader() {
  const header = document.getElementById('workspaceHeader');
  if (!header || !state.activeWorkspace) return;

  const ws = state.activeWorkspace;
  header.innerHTML = `
    <div class="ws-header-left">
      <div class="ws-avatar">${ws.kind === 'internal' ? '🏢' : '🌐'}</div>
      <div class="ws-meta">
        <div class="ws-title">${ws.kind === 'internal' ? 'Team Workspace' : escapeHtml(ws.name)}</div>
        <div class="ws-subtitle">AI Automation Labs</div>
      </div>
    </div>
    <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
      <span class="workspace-badge ${ws.kind}">${ws.kind}</span>
      <span class="ws-chevron">▾</span>
    </div>
  `;

  // Sync top-bar pill
  const pillIcon = document.getElementById('activeWorkspacePillIcon');
  const pillName = document.getElementById('activeWorkspacePillName');
  if (pillIcon) pillIcon.textContent = ws.kind === 'internal' ? '🏢' : '🌐';
  if (pillName) pillName.textContent = ws.name;
}

export function renderSidebarChannels() {
  const container = document.getElementById('sidebarConversations');
  if (!container) return;

  if (state.conversations.length === 0) {
    container.innerHTML = `<div style="padding: 8px 12px; font-size: 0.78rem; color: var(--text-dim);">No channels found.</div>`;
    return;
  }

  const isOwner = state.currentUser?.role === 'owner' || state.currentUser?.role === 'admin';

  container.innerHTML = state.conversations.map(c => {
    const isActive = state.activeConversation?.id === c.id && state.currentView === 'chat';
    const icon = c.channelType === 'internal' ? '#' : c.channelType === 'portal' ? '🌐' : c.channelType === 'whatsapp' ? '💬' : '✈️';
    const canDelete = isOwner && c.title !== 'general';
    return `
      <div class="nav-item ${isActive ? 'active' : ''}" data-conv-id="${c.id}" style="display: flex; align-items: center; justify-content: space-between;">
        <div class="nav-item-left" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">
          <span class="nav-icon">${icon}</span>
          <span>${escapeHtml(c.title)}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          ${c.status === 'open' && c.priority === 'urgent' ? '<span class="badge-pill urgent">!</span>' : ''}
          ${canDelete ? `
            <button class="btn-channel-delete-quick" data-conv-id="${c.id}" data-conv-title="${escapeHtml(c.title)}" title="Delete channel" style="background: none; border: none; cursor: pointer; font-size: 0.72rem; color: var(--text-dim); padding: 2px 4px; border-radius: 4px; opacity: 0.6;" onmouseover="this.style.opacity='1'; this.style.color='#ef4444';" onmouseout="this.style.opacity='0.6'; this.style.color='var(--text-dim)';">
              ✕
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  // Attach click listeners
  container.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', async (e) => {
      // Don't switch if delete clicked
      if (e.target.closest && e.target.closest('.btn-channel-delete-quick')) return;
      const convId = el.getAttribute('data-conv-id');
      await switchConversation(convId);
    });
  });

  // Attach delete listeners
  container.querySelectorAll('.btn-channel-delete-quick').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const convId = btn.getAttribute('data-conv-id');
      const convTitle = btn.getAttribute('data-conv-title');
      const ok = await showConfirmDialog('Delete Channel', `Are you sure you want to delete #${convTitle} and all its messages? This action cannot be undone.`, 'Delete Channel', true);
      if (ok) {
        try {
          await api.deleteConversation(convId);
          showToast(`Channel #${convTitle} deleted.`, 'info');
          const convData = await api.getConversations(state.activeWorkspace.id);
          state.conversations = convData.conversations || [];
          renderSidebarChannels();
          if (state.activeConversation?.id === convId && state.conversations.length > 0) {
            await switchConversation(state.conversations[0].id);
          }
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  });
}

export async function switchConversation(convId) {
  state.currentView = 'chat';
  const conv = state.conversations.find(c => c.id === convId);
  if (!conv) return;

  state.activeConversation = conv;
  joinConversationRoom(conv.id);

  // Update view visibility
  document.getElementById('chatView').style.display = 'flex';
  document.getElementById('inboxView').style.display = 'none';
  document.getElementById('kanbanView').style.display = 'none';
  document.getElementById('integrationsView').style.display = 'none';
  document.getElementById('meetingsView').style.display = 'none';

  renderSidebarChannels();
  renderConversationHeader();

  // Fetch messages
  try {
    const data = await api.getMessages(conv.id);
    state.messages = data.messages || [];
    state.nextCursor = data.nextCursor;
    renderMessagesTimeline();
  } catch (err) {
    showToast('Failed to load messages: ' + err.message, 'error');
  }
}

export function renderConversationHeader() {
  const container = document.getElementById('conversationHeader');
  if (!container || !state.activeConversation) return;

  const conv = state.activeConversation;
  const isInternal = ['owner', 'admin', 'internal_member', 'internal_guest'].includes(state.currentUser?.role);

  // Sync breadcrumb in top bar
  const topbarBreadcrumb = document.getElementById('topbarChannelBreadcrumb');
  if (topbarBreadcrumb) {
    topbarBreadcrumb.textContent = `${conv.channelType === 'internal' ? '#' : '🌐'} ${conv.title}`;
  }

  container.innerHTML = `
    <div class="conv-header-info">
      <button class="mobile-menu-btn" id="mobileMenuBtn">☰</button>
      <div class="conv-title">
        <span>${conv.channelType === 'internal' ? '#' : '🌐'}</span>
        <span>${escapeHtml(conv.title)}</span>
        <span class="badge-pill ${conv.status}">${conv.status}</span>
        ${conv.priority !== 'normal' ? `<span class="badge-pill ${conv.priority}">${conv.priority}</span>` : ''}
      </div>
    </div>
    <div class="conv-actions">
      <button class="btn-pill ai-sparkle" id="btnAiSummarize">
        ✨ AI Summary
      </button>
      ${isInternal ? `
        <button class="btn-pill" id="btnAssignLead">
          👤 ${conv.assignedUserName ? escapeHtml(conv.assignedUserName) : 'Assign Lead'}
        </button>
        <button class="btn-pill primary" id="btnToggleStatus">
          ${conv.status === 'open' ? 'Resolve' : 'Re-open'}
        </button>
      ` : ''}
      ${['owner', 'admin'].includes(state.currentUser?.role) ? `
        <button class="btn-pill" id="btnEditChannel" title="Rename or update channel">
          ✏️ Edit Channel
        </button>
        ${conv.title !== 'general' ? `
          <button class="btn-pill" id="btnDeleteChannel" title="Delete Channel" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.3);">
            🗑️ Delete
          </button>
        ` : ''}
      ` : ''}
    </div>
  `;

  // Mobile menu button
  const mobileBtn = document.getElementById('mobileMenuBtn');
  if (mobileBtn) {
    mobileBtn.addEventListener('click', () => {
      document.querySelector('.app-sidebar').classList.toggle('open');
    });
  }

  // AI Summary button
  const aiBtn = document.getElementById('btnAiSummarize');
  if (aiBtn) {
    aiBtn.addEventListener('click', async () => {
      openAiModal(conv.id);
    });
  }

  // Assign Lead button
  const assignBtn = document.getElementById('btnAssignLead');
  if (assignBtn && isInternal) {
    assignBtn.addEventListener('click', async () => {
      try {
        await api.assignConversation(conv.id, state.currentUser.id);
        conv.assignedUserName = state.currentUser.displayName;
        conv.assignedUserId = state.currentUser.id;
        renderConversationHeader();
        showToast('Assigned to you successfully', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // Toggle status button
  const statusBtn = document.getElementById('btnToggleStatus');
  if (statusBtn && isInternal) {
    statusBtn.addEventListener('click', async () => {
      const nextStatus = conv.status === 'open' ? 'resolved' : 'open';
      try {
        await api.updateConversationStatus(conv.id, nextStatus);
        conv.status = nextStatus;
        renderConversationHeader();
        showToast(`Conversation marked as ${nextStatus}`, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // Edit Channel button
  const editChannelBtn = document.getElementById('btnEditChannel');
  if (editChannelBtn) {
    editChannelBtn.addEventListener('click', async () => {
      const newTitle = await showPromptDialog('Rename Channel', 'Enter new channel name:', conv.title, 'e.g. engineering');
      if (newTitle !== null && newTitle.trim() && newTitle.trim() !== conv.title) {
        try {
          const updated = await api.updateConversation(conv.id, { title: newTitle.trim() });
          conv.title = updated.conversation.title;
          showToast(`Channel renamed to #${conv.title}`, 'success');
          renderConversationHeader();
          const convData = await api.getConversations(state.activeWorkspace.id);
          state.conversations = convData.conversations || [];
          renderSidebarChannels();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  }

  // Delete Channel button
  const deleteChannelBtn = document.getElementById('btnDeleteChannel');
  if (deleteChannelBtn) {
    deleteChannelBtn.addEventListener('click', async () => {
      const ok = await showConfirmDialog('Delete Channel', `Are you sure you want to delete channel #${conv.title} and all messages? This action cannot be undone.`, 'Delete Channel', true);
      if (ok) {
        try {
          await api.deleteConversation(conv.id);
          showToast(`Channel #${conv.title} deleted`, 'info');
          const convData = await api.getConversations(state.activeWorkspace.id);
          state.conversations = convData.conversations || [];
          renderSidebarChannels();
          if (state.conversations.length > 0) {
            await switchConversation(state.conversations[0].id);
          }
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  }
}

export function renderMessagesTimeline() {
  const container = document.getElementById('messagesTimeline');
  if (!container) return;

  if (state.messages.length === 0) {
    const conv = state.activeConversation;
    container.innerHTML = `
      <div class="empty-timeline-state">
        <div class="channel-hero-icon">${conv?.channelType === 'internal' ? '#' : '🌐'}</div>
        <h2 class="channel-hero-title">Welcome to #${escapeHtml(conv?.title || 'general')}!</h2>
        <p class="channel-hero-desc">
          This is the beginning of the <strong>#${escapeHtml(conv?.title || 'general')}</strong> channel. All team messages are synced in real-time with full history, thread search, and AI assistant actions.
        </p>
        <div class="channel-hero-badges">
          <span class="badge-pill open">● Live Channel</span>
          <span class="badge-pill normal">🛡️ Encrypted Realtime Stream</span>
          <span class="badge-pill high">✨ AI Assistant Ready</span>
        </div>
      </div>
    `;
    return;
  }

  const currentUserId = state.currentUser?.id;

  const conv = state.activeConversation;
  const channelHeaderHtml = `
    <div class="channel-start-header">
      <div class="channel-start-icon">${conv?.channelType === 'internal' ? '#' : '🌐'}</div>
      <div class="channel-start-info">
        <h3 class="channel-start-title">Welcome to #${escapeHtml(conv?.title || 'general')}</h3>
        <p class="channel-start-desc">This is the official beginning of the #${escapeHtml(conv?.title || 'general')} channel for ${escapeHtml(state.activeWorkspace?.name || 'the team')}. All messages are synchronized in real-time.</p>
      </div>
    </div>
    <div class="timeline-date-divider"><span>Today</span></div>
  `;

  const isOwner = state.currentUser?.role === 'owner' || state.currentUser?.role === 'admin';

  const messagesHtml = state.messages.map(m => {
    const isOwn = m.authorUserId === currentUserId;
    const isInternalNote = m.visibility === 'internal';
    const canManage = isOwner || isOwn;
    const initials = (m.authorName || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

    // Group reactions
    const reactionCounts = {};
    (m.reactions || []).forEach(r => {
      reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1;
    });

    return `
      <div class="message-card ${isOwn ? 'own' : ''} ${isInternalNote ? 'internal-note' : ''}" id="msg-${m.id}">
        <div class="avatar" style="${isInternalNote ? 'background: #f59e0b;' : ''}">${initials}</div>
        <div class="msg-body-wrapper">
          <div class="msg-meta" style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="msg-author-name">${escapeHtml(m.authorName || 'Unknown')}</span>
              ${m.authorRole?.includes('customer') ? '<span class="badge-pill low">Customer</span>' : ''}
              <span>${formatTime(m.createdAt)}</span>
              ${m.editedAt ? '<span style="font-size: 0.7rem; color: var(--text-dim); font-style: italic;">(edited)</span>' : ''}
            </div>
            ${canManage ? `
              <div class="msg-actions" style="display: flex; gap: 6px; align-items: center;">
                <button class="btn-msg-edit" data-msg-id="${m.id}" title="Edit message" style="background: none; border: none; cursor: pointer; font-size: 0.76rem; color: var(--text-muted); padding: 1px 4px; border-radius: 4px; opacity: 0.7;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'">✏️</button>
                <button class="btn-msg-delete" data-msg-id="${m.id}" title="Delete message" style="background: none; border: none; cursor: pointer; font-size: 0.76rem; color: #ef4444; padding: 1px 4px; border-radius: 4px; opacity: 0.7;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'">🗑️</button>
              </div>
            ` : ''}
          </div>

          <div class="message-bubble">
            ${isInternalNote ? `
              <div class="internal-note-badge">
                🔒 Internal Note (Only visible to AI Automation Labs team)
              </div>
            ` : ''}
            <div class="msg-content-text" id="msg-text-${m.id}">${escapeHtml(m.body)}</div>
          </div>

          <div class="reactions-tray">
            ${Object.entries(reactionCounts).map(([emoji, count]) => `
              <button class="reaction-pill" data-msg-id="${m.id}" data-emoji="${emoji}">
                ${emoji} ${count}
              </button>
            `).join('')}
            <button class="reaction-pill add-reaction" data-msg-id="${m.id}" data-emoji="👍">+</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = channelHeaderHtml + messagesHtml;

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;

  // Reaction click listeners
  container.querySelectorAll('.reaction-pill').forEach(btn => {
    btn.addEventListener('click', async () => {
      const msgId = btn.getAttribute('data-msg-id');
      const emoji = btn.getAttribute('data-emoji') || '👍';
      try {
        await api.toggleReaction(msgId, emoji);
        // Refresh messages
        const data = await api.getMessages(state.activeConversation.id);
        state.messages = data.messages || [];
        renderMessagesTimeline();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  // Edit Message listeners
  container.querySelectorAll('.btn-msg-edit').forEach(btn => {
    btn.addEventListener('click', async () => {
      const msgId = btn.getAttribute('data-msg-id');
      const msg = state.messages.find(m => m.id === msgId);
      if (!msg) return;
      const newText = await showPromptDialog('Edit Message', 'Modify message content:', msg.body, 'Type message...');
      if (newText !== null && newText.trim() && newText.trim() !== msg.body) {
        try {
          const res = await api.editMessage(msgId, newText.trim());
          msg.body = res.message.body;
          msg.editedAt = res.message.editedAt;
          renderMessagesTimeline();
          showToast('Message updated', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  });

  // Delete Message listeners
  container.querySelectorAll('.btn-msg-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const msgId = btn.getAttribute('data-msg-id');
      const ok = await showConfirmDialog('Delete Message', 'Are you sure you want to delete this message? This action will remove it for everyone in real time.', 'Delete Message', true);
      if (ok) {
        try {
          await api.deleteMessage(msgId);
          state.messages = state.messages.filter(m => m.id !== msgId);
          renderMessagesTimeline();
          showToast('Message deleted', 'info');
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  });
}

export function appendMessage(message) {
  if (!state.activeConversation || message.conversationId !== state.activeConversation.id) {
    return;
  }
  // Check if message is already in list (idempotency)
  if (state.messages.some(m => m.id === message.id)) {
    return;
  }
  state.messages.push(message);
  renderMessagesTimeline();
}

// ==============================================================================
// Shared Inbox View Renderer
// ==============================================================================
export async function renderInboxView() {
  state.currentView = 'inbox';
  document.getElementById('chatView').style.display = 'none';
  document.getElementById('inboxView').style.display = 'flex';
  document.getElementById('kanbanView').style.display = 'none';
  document.getElementById('integrationsView').style.display = 'none';
  document.getElementById('meetingsView').style.display = 'none';

  // Highlight active nav in sidebar
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById('navSharedInbox')?.classList.add('active');

  const container = document.getElementById('inboxListContainer');
  if (!container) return;

  container.innerHTML = `<div style="padding: 20px; color: var(--text-muted);">Loading Customer Inbox...</div>`;

  try {
    const data = await api.getInbox();
    state.inboxItems = data.conversations || [];

    // Dynamically update inbox count badge
    const badge = document.getElementById('inboxCountBadge');
    if (badge) {
      const openCount = state.inboxItems.filter(i => i.status === 'open').length;
      if (openCount > 0) {
        badge.textContent = openCount;
        badge.style.display = 'inline-flex';
      } else {
        badge.style.display = 'none';
      }
    }

    if (state.inboxItems.length === 0) {
      container.innerHTML = `
        <div class="empty-timeline-state">
          <div class="empty-icon">📥</div>
          <div class="empty-title">Customer Shared Inbox is Clear</div>
          <div class="empty-desc">
            All customer inquiries from WhatsApp, Telegram, Website Live Chat, and dedicated Customer Portals stream directly into this unified triage queue.
          </div>
          <div style="margin-top: 18px; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
            <button class="btn-pill primary" id="emptyInboxProvisionBtn">➕ Provision Customer Portal</button>
            <button class="btn-pill" id="emptyInboxOpenChatBtn">💬 Open Live Chat Test Widget</button>
          </div>
        </div>
      `;

      document.getElementById('emptyInboxProvisionBtn')?.addEventListener('click', () => {
        document.getElementById('btnAddCustomer')?.click();
      });

      document.getElementById('emptyInboxOpenChatBtn')?.addEventListener('click', () => {
        const launcher = document.getElementById('liveChatLauncher');
        launcher?.click();
      });

      return;
    }

    container.innerHTML = state.inboxItems.map(item => `
      <div class="inbox-card" data-conv-id="${item.id}" data-ws-id="${item.workspaceId}">
        <div class="inbox-card-left">
          <div class="avatar">${item.customerName.slice(0, 2).toUpperCase()}</div>
          <div>
            <div class="inbox-card-title">
              <span>${escapeHtml(item.customerName)}</span>
              <span class="badge-pill ${item.channelType}">${item.channelType}</span>
              <span class="badge-pill ${item.priority}">${item.priority}</span>
              <span class="badge-pill ${item.status}">${item.status}</span>
            </div>
            <div class="inbox-preview">
              ${item.lastMessage ? `<strong>${escapeHtml(item.lastMessage.authorName)}:</strong> ${escapeHtml(item.lastMessage.body)}` : 'No messages yet'}
            </div>
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 0.76rem; color: var(--text-dim);">${formatTime(item.updatedAt)}</div>
          <div style="font-size: 0.76rem; color: var(--brand-primary); margin-top: 4px;">
            👤 ${item.assignedUserName ? escapeHtml(item.assignedUserName) : 'Unassigned'}
          </div>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.inbox-card').forEach(card => {
      card.addEventListener('click', async () => {
        const convId = card.getAttribute('data-conv-id');
        const wsId = card.getAttribute('data-ws-id');
        // Switch active workspace if needed
        const ws = state.workspaces.find(w => w.id === wsId);
        if (ws) {
          state.activeWorkspace = ws;
          renderWorkspaceHeader();
          const convsData = await api.getConversations(ws.id);
          state.conversations = convsData.conversations || [];
          renderSidebarChannels();
        }
        await switchConversation(convId);
      });
    });
  } catch (err) {
    container.innerHTML = `<div style="padding: 20px; color: var(--status-busy);">Failed to load inbox: ${escapeHtml(err.message)}</div>`;
  }
}

// ==============================================================================
// Kanban Board Renderer
// ==============================================================================
export async function renderKanbanView() {
  state.currentView = 'kanban';
  document.getElementById('chatView').style.display = 'none';
  document.getElementById('inboxView').style.display = 'none';
  document.getElementById('kanbanView').style.display = 'flex';
  document.getElementById('integrationsView').style.display = 'none';
  document.getElementById('meetingsView').style.display = 'none';

  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById('navKanban')?.classList.add('active');

  const container = document.getElementById('kanbanBoardContainer');
  if (!container) return;

  try {
    const data = await api.getTasks();
    state.tasks = data.tasks || [];

    const columns = [
      { id: 'todo', title: 'To Do', icon: '📝' },
      { id: 'in_progress', title: 'In Progress', icon: '⚡' },
      { id: 'review', title: 'Review / QA', icon: '🔍' },
      { id: 'done', title: 'Completed', icon: '✅' },
    ];

    container.innerHTML = columns.map(col => {
      const colTasks = state.tasks.filter(t => t.status === col.id);
      return `
        <div class="kanban-column" data-status="${col.id}">
          <div class="kanban-col-header">
            <span>${col.icon} ${col.title}</span>
            <span class="badge-pill normal">${colTasks.length}</span>
          </div>
          <div class="kanban-cards-list">
            ${colTasks.length === 0 ? `
              <div style="padding: 28px 12px; border: 1px dashed var(--border-subtle); border-radius: 8px; text-align: center; color: var(--text-dim); font-size: 0.78rem;">
                <div style="margin-bottom: 6px; font-size: 1.2rem; opacity: 0.6;">${col.icon}</div>
                <div style="margin-bottom: 8px;">No tasks in ${escapeHtml(col.title)}</div>
                <button class="btn-pill add-column-task-btn" data-status="${col.id}" style="font-size: 0.72rem; padding: 4px 10px; margin: 0 auto;">
                  + Add Task
                </button>
              </div>
            ` : colTasks.map(t => `
              <div class="kanban-card" data-task-id="${t.id}">
                <div class="kanban-card-title">${escapeHtml(t.title)}</div>
                ${t.description ? `<div class="kanban-card-desc">${escapeHtml(t.description)}</div>` : ''}
                <div class="kanban-card-footer" style="display: flex; justify-content: space-between; align-items: center;">
                  <span class="badge-pill ${t.priority}">${t.priority}</span>
                  <div style="display: flex; gap: 6px; align-items: center;">
                    <span style="font-size: 0.72rem; color: var(--text-dim);">👤 ${escapeHtml(t.assigneeName || 'Unassigned')}</span>
                    <button class="btn-card-edit" data-task-id="${t.id}" title="Edit Task" style="background: none; border: none; cursor: pointer; font-size: 0.76rem; padding: 1px 3px; border-radius: 3px;" onmouseover="this.style.color='#38bdf8'">✏️</button>
                    <button class="btn-card-delete" data-task-id="${t.id}" data-task-title="${escapeHtml(t.title)}" title="Delete Task" style="background: none; border: none; cursor: pointer; font-size: 0.76rem; color: #ef4444; padding: 1px 3px; border-radius: 3px;">🗑️</button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');

    // Column "+ Add Task" button listeners
    container.querySelectorAll('.add-column-task-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const status = btn.getAttribute('data-status');
        if (typeof window.openCreateTaskModal === 'function') {
          window.openCreateTaskModal(status);
        }
      });
    });

    // Delete task listener
    container.querySelectorAll('.btn-card-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const taskId = btn.getAttribute('data-task-id');
        const taskTitle = btn.getAttribute('data-task-title');
        const ok = await showConfirmDialog('Delete Task', `Are you sure you want to permanently delete task "${taskTitle}"?`, 'Delete Task', true);
        if (ok) {
          try {
            await api.deleteTask(taskId);
            showToast('Task deleted successfully', 'info');
            await renderKanbanView();
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
      });
    });

    // Edit task listener
    container.querySelectorAll('.btn-card-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const taskId = btn.getAttribute('data-task-id');
        const task = state.tasks.find(t => t.id === taskId);
        if (task && typeof window.openEditTaskModal === 'function') {
          window.openEditTaskModal(task);
        }
      });
    });

    // Click card to advance status
    container.querySelectorAll('.kanban-card').forEach(card => {
      card.addEventListener('click', async (e) => {
        if (e.target.closest && (e.target.closest('.btn-card-edit') || e.target.closest('.btn-card-delete'))) return;
        const taskId = card.getAttribute('data-task-id');
        const task = state.tasks.find(t => t.id === taskId);
        if (!task) return;

        const nextStatus = task.status === 'todo' ? 'in_progress' : task.status === 'in_progress' ? 'review' : task.status === 'review' ? 'done' : 'todo';
        try {
          await api.updateTask(taskId, { status: nextStatus });
          showToast(`Task moved to ${nextStatus.replace('_', ' ')}`, 'info');
          await renderKanbanView();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  } catch (err) {
    container.innerHTML = `<div style="color: var(--status-busy);">Failed to load tasks: ${escapeHtml(err.message)}</div>`;
  }
}

// ==============================================================================
// Integrations View Renderer
// ==============================================================================
export function openEditIntegrationModal(item) {
  const modal = document.getElementById('genericModal');
  const title = document.getElementById('genericModalTitle');
  const body = document.getElementById('genericModalBody');
  if (!modal || !title || !body) return;

  title.textContent = `Configure ${item.displayName}`;
  const configStr = JSON.stringify(item.configPublic || {}, null, 2);

  body.innerHTML = `
    <form id="editIntegrationForm">
      <div class="form-group">
        <label class="form-label" for="intDisplayName">Tool Display Name</label>
        <input type="text" class="form-input" id="intDisplayName" value="${escapeHtml(item.displayName)}" required />
      </div>
      <div class="form-group">
        <label class="form-label" for="intStatus">Webhook Ingestion Status</label>
        <select class="form-input" id="intStatus">
          <option value="connected" ${item.status === 'connected' ? 'selected' : ''}>Connected (Active Ingestion)</option>
          <option value="standby" ${item.status === 'standby' ? 'selected' : ''}>Standby (Paused)</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="intConfigJson">Public Configuration (JSON)</label>
        <textarea class="form-input" id="intConfigJson" rows="5" style="font-family: var(--font-mono); font-size: 0.78rem;">${escapeHtml(configStr)}</textarea>
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px;">
        <button type="button" class="btn-pill" id="btnCancelEditInt">Cancel</button>
        <button type="submit" class="btn-pill primary">Save Configuration</button>
      </div>
    </form>
  `;

  modal.classList.add('active');

  document.getElementById('btnCancelEditInt')?.addEventListener('click', () => {
    modal.classList.remove('active');
  });

  document.getElementById('editIntegrationForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newName = document.getElementById('intDisplayName').value.trim();
    const newStatus = document.getElementById('intStatus').value;
    let newConfig = {};
    try {
      newConfig = JSON.parse(document.getElementById('intConfigJson').value);
    } catch (err) {
      showToast('Invalid JSON in configuration field: ' + err.message, 'error');
      return;
    }

    try {
      await api.updateIntegration(item.id, {
        displayName: newName,
        status: newStatus,
        configPublic: newConfig,
      });
      showToast('Integration configuration updated!', 'success');
      modal.classList.remove('active');
      await renderIntegrationsView();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ==============================================================================
// Integrations View Renderer (Software Engineering & DevOps Hub)
// ==============================================================================
export async function renderIntegrationsView() {
  state.currentView = 'integrations';
  document.getElementById('chatView').style.display = 'none';
  document.getElementById('inboxView').style.display = 'none';
  document.getElementById('kanbanView').style.display = 'none';
  document.getElementById('integrationsView').style.display = 'flex';
  document.getElementById('meetingsView').style.display = 'none';

  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById('navIntegrations')?.classList.add('active');

  const container = document.getElementById('integrationsContainer');
  if (!container) return;

  try {
    const data = await api.getIntegrations();
    state.integrations = data.integrations || [];

    const toolMeta = {
      github: { icon: '🐙', badge: 'Version Control & CI/CD', bg: 'rgba(255,255,255,0.08)' },
      gitlab: { icon: '🦊', badge: 'DevOps & Pipelines', bg: 'rgba(252,109,38,0.15)' },
      linear: { icon: '📐', badge: 'Sprint & Issue Tracking', bg: 'rgba(94,106,210,0.15)' },
      sentry: { icon: '🚨', badge: 'Observability & APM', bg: 'rgba(235,87,87,0.15)' },
      docker_k8s: { icon: '🐳', badge: 'Cloud Infrastructure', bg: 'rgba(14,165,233,0.15)' },
      vercel_aws: { icon: '▲', badge: 'Deployments & Edge', bg: 'rgba(255,255,255,0.08)' },
      developer_api: { icon: '🚀', badge: 'API & Microservices', bg: 'rgba(16,185,129,0.15)' },
    };

    const isOwner = ['owner', 'admin'].includes(state.currentUser?.role);

    container.innerHTML = state.integrations.map(item => {
      const meta = toolMeta[item.provider] || { icon: '⚡', badge: 'Engineering Tool', bg: 'rgba(255,255,255,0.05)' };
      const configSummary = item.configPublic ? Object.entries(item.configPublic).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).slice(0, 2).join(' • ') : '';

      return `
        <div class="integration-card" data-provider="${item.provider}">
          <div>
            <div class="integration-header">
              <div class="integration-icon" style="background: ${meta.bg};">${meta.icon}</div>
              <div style="flex: 1; min-width: 0;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                  <div class="integration-title" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(item.displayName)}</div>
                  <span class="badge-pill ${item.status === 'connected' ? 'open' : 'low'}" style="flex-shrink: 0;">
                    ${item.status === 'connected' ? '● Active' : '○ Standby'}
                  </span>
                </div>
                <div style="display: flex; gap: 6px; align-items: center; margin-top: 2px;">
                  <span style="font-size: 0.68rem; color: var(--brand-primary); font-weight: 600; text-transform: uppercase;">${meta.badge}</span>
                </div>
              </div>
            </div>

            <div class="integration-desc" style="margin-top: 14px;">
              ${configSummary ? `<div style="font-size: 0.74rem; color: var(--text-dim); margin-bottom: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">⚙️ ${escapeHtml(configSummary)}</div>` : ''}
              <div style="font-size: 0.73rem; color: var(--text-muted); margin-bottom: 4px;">Webhook Endpoint:</div>
              <code style="display: block; font-family: var(--font-mono); font-size: 0.72rem; background: rgba(0,0,0,0.35); padding: 5px 8px; border-radius: 6px; border: 1px solid var(--border-subtle); overflow-x: auto; white-space: nowrap;">/api/v1/integrations/webhooks/${item.provider}</code>
            </div>
          </div>

          <div style="display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap;">
            <button class="btn-pill copy-webhook-btn" data-url="${window.location.origin}/api/v1/integrations/webhooks/${item.provider}" style="flex: 1; font-size: 0.74rem; justify-content: center; min-width: 100px;">
              📋 Copy URL
            </button>
            <button class="btn-pill primary test-webhook-btn" data-provider="${item.provider}" style="flex: 1; font-size: 0.74rem; justify-content: center; min-width: 110px;">
              ⚡ Test Dispatch
            </button>
            ${isOwner ? `
              <button class="btn-pill config-int-btn" data-int-id="${item.id}" title="Configure Integration" style="padding: 4px 8px; font-size: 0.76rem;">
                ⚙️
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Copy Webhook URL
    container.querySelectorAll('.copy-webhook-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.getAttribute('data-url');
        navigator.clipboard?.writeText(url);
        showToast('Webhook endpoint copied to clipboard!', 'success');
      });
    });

    // Configure Integration (Owner / Admin)
    container.querySelectorAll('.config-int-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const intId = btn.getAttribute('data-int-id');
        const item = state.integrations.find(i => i.id === intId);
        if (item) {
          openEditIntegrationModal(item);
        }
      });
    });

    // Test Inbound Software Webhook
    container.querySelectorAll('.test-webhook-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const provider = btn.getAttribute('data-provider');
        let payload = {};

        if (provider === 'github') {
          payload = {
            action: 'opened',
            pull_request: {
              number: Math.floor(Math.random() * 50) + 12,
              title: 'feat(ai-pipeline): automated agentic code generation & CI tests',
              html_url: 'https://github.com/ai-automation-labs/core-platform/pull/42',
              user: { login: 'sarah-chen' },
              head: { ref: 'feature/ai-pipeline' },
            },
          };
        } else if (provider === 'gitlab') {
          payload = {
            object_kind: 'pipeline',
            object_attributes: {
              id: Math.floor(Math.random() * 900) + 1040,
              status: 'passed',
              ref: 'main',
              duration: 164,
            },
          };
        } else if (provider === 'linear') {
          payload = {
            action: 'create',
            data: {
              identifier: 'ENG-' + (Math.floor(Math.random() * 300) + 100),
              title: 'Scale PostgreSQL connection pool for high-throughput AI embeddings',
              state: { name: 'In Progress' },
              priority: 1,
            },
          };
        } else if (provider === 'sentry') {
          payload = {
            project_name: 'core-platform-api',
            event: {
              event_id: 'sentry_' + Date.now(),
              title: 'PostgreSQLConnectionTimeout: connection pool max limit reached during batch inference',
              culprit: 'server/src/database/pool.ts:42',
            },
          };
        } else if (provider === 'docker_k8s') {
          payload = {
            event: 'deployment.scaled',
            cluster: 'prod-us-east-1',
            deployment: 'rocketship-api',
            replicas: '8/8 Pods Ready & Passing Probes',
          };
        } else if (provider === 'vercel_aws') {
          payload = {
            target: 'production',
            commit: '9c8a14b',
            url: 'https://rocketship.ailabs.dev',
            payload: { branch: 'main', duration: '44s' },
          };
        } else {
          payload = {
            source: 'Automated-CI-Suite',
            service: 'IntegrationMatrixRunner',
            status: 'passed',
            message: '22/22 Tenant Isolation & Smoke Tests verified with zero errors.',
          };
        }

        try {
          btn.disabled = true;
          const res = await fetch(`/api/v1/integrations/webhooks/${provider}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const resData = await res.json();
          if (res.ok) {
            showToast(`⚡ ${resData.summary || `Dispatched to ${provider} successfully!`}`, 'success');
          } else {
            showToast(resData.error?.message || 'Webhook failed', 'error');
          }
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          btn.disabled = false;
        }
      });
    });
  } catch (err) {
    container.innerHTML = `<div style="color: var(--status-busy);">Failed to load integrations: ${escapeHtml(err.message)}</div>`;
  }
}

// ==============================================================================
// Video / Audio Meetings View Renderer (LiveKit)
// ==============================================================================
export async function renderMeetingsView() {
  state.currentView = 'meetings';
  document.getElementById('chatView').style.display = 'none';
  document.getElementById('inboxView').style.display = 'none';
  document.getElementById('kanbanView').style.display = 'none';
  document.getElementById('integrationsView').style.display = 'none';
  document.getElementById('meetingsView').style.display = 'flex';

  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById('navMeetings')?.classList.add('active');

  const container = document.getElementById('meetingRoomContainer');
  if (!container) return;

  const roomName = 'ailabs-sync-room';
  const meetingData = await api.getMeetingToken(roomName);

  container.innerHTML = `
    <div class="meeting-room-container">
      <div class="video-grid">
        <div class="video-tile" style="min-height: 280px;">
          <div class="video-avatar">${state.currentUser?.displayName.slice(0, 2).toUpperCase()}</div>
          <div class="video-name-tag">👤 ${escapeHtml(state.currentUser?.displayName)} (Host)</div>
          <div style="position: absolute; top: 12px; right: 12px; background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color: #10b981; font-size: 0.72rem; padding: 3px 8px; border-radius: 12px;">
            ● Active Media Stream
          </div>
        </div>
        <div class="video-tile" style="background: rgba(15, 23, 42, 0.6); border: 1px dashed var(--border-subtle); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; text-align: center;">
          <div style="font-size: 2.2rem; margin-bottom: 12px;">👥</div>
          <div style="font-weight: 600; font-size: 0.95rem; margin-bottom: 6px;">Waiting for Team or Clients</div>
          <p style="font-size: 0.78rem; color: var(--text-dim); max-width: 260px; line-height: 1.4; margin-bottom: 16px;">
            Share this secure room link with participants. WebRTC audio/video connects automatically upon joining.
          </p>
          <button class="btn-pill primary" id="btnCopyInviteLink" style="font-size: 0.78rem; padding: 6px 12px;">
            📋 Copy Meeting Link
          </button>
        </div>
      </div>
      <div class="call-controls">
        <button class="call-btn" id="btnToggleMic" title="Toggle Mic">🎤</button>
        <button class="call-btn" id="btnToggleCam" title="Toggle Camera">📹</button>
        <button class="call-btn" id="btnShareScreen" title="Share Screen">🖥️</button>
        <button class="call-btn end-call" id="btnEndCall" title="Leave Meeting">📞</button>
      </div>
    </div>
  `;

  document.getElementById('btnCopyInviteLink')?.addEventListener('click', () => {
    const link = `${window.location.origin}/#meeting/${roomName}`;
    navigator.clipboard?.writeText(link);
    showToast('Meeting link copied to clipboard!', 'success');
  });

  document.getElementById('btnToggleMic')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    btn.classList.toggle('muted');
    showToast('Microphone toggled', 'info');
  });

  document.getElementById('btnToggleCam')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    btn.classList.toggle('muted');
    showToast('Camera toggled', 'info');
  });

  document.getElementById('btnShareScreen')?.addEventListener('click', () => showToast('Screen sharing requested', 'info'));
  document.getElementById('btnEndCall')?.addEventListener('click', () => {
    showToast('Left meeting room', 'info');
    renderInboxView();
  });
}

// ==============================================================================
// AI Assistant & Owner API Key Management Modal
// ==============================================================================
export async function openAiModal(conversationId, defaultTab = 'chat') {
  const modal = document.getElementById('aiModal');
  const body = document.getElementById('aiModalContent');
  if (!modal || !body) return;

  const card = modal.querySelector('.modal-card');
  if (card) card.classList.add('ai-modal-card');

  modal.classList.add('active');
  body.innerHTML = `<div style="text-align: center; padding: 30px; color: var(--text-muted);">
    <div style="font-size: 1.5rem; margin-bottom: 8px;">✨</div>
    Loading AI Engine & Configuration...
  </div>`;

  const isOwner = ['owner', 'admin'].includes(state.currentUser?.role);
  let config = { configured: false, provider: 'openai', model: 'gpt-4o-mini', maskedKey: null, systemPrompt: '' };

  try {
    config = await api.getAiConfig();
  } catch (err) {
    console.warn('Failed to load AI config:', err);
  }

  // If no key is configured and user is owner, default to settings tab to prompt them to enter key
  const activeTab = (!config.configured && isOwner) ? 'config' : defaultTab;

  function renderView(tab) {
    body.innerHTML = `
      <div class="ai-tab-header">
        <button class="ai-tab-btn ${tab === 'chat' ? 'active' : ''}" id="tabBtnChat">
          <span>🤖</span>
          <span>AI Chatbot & Copilot</span>
        </button>
        ${isOwner ? `
          <button class="ai-tab-btn ${tab === 'config' ? 'active' : ''}" id="tabBtnConfig">
            <span>⚙️</span>
            <span>Owner API Key Settings</span>
            ${config.configured ? `<span style="font-size: 0.68rem; background: rgba(34,197,94,0.2); color: #4ade80; padding: 2px 6px; border-radius: 8px;">Active</span>` : `<span style="font-size: 0.68rem; background: rgba(239,68,68,0.2); color: #f87171; padding: 2px 6px; border-radius: 8px;">Key Needed</span>`}
          </button>
        ` : ''}
      </div>

      <div id="aiTabContent"></div>
    `;

    document.getElementById('tabBtnChat')?.addEventListener('click', () => renderView('chat'));
    document.getElementById('tabBtnConfig')?.addEventListener('click', () => renderView('config'));

    if (tab === 'chat') {
      renderChatTab();
    } else {
      renderConfigTab();
    }
  }

  function renderChatTab() {
    const tabContainer = document.getElementById('aiTabContent');
    if (!tabContainer) return;

    tabContainer.innerHTML = `
      <div class="ai-chat-container">
        <!-- Quick action pills -->
        <div class="ai-quick-pills">
          <button class="ai-pill-btn" id="pillSummarize">📋 Summarize Channel</button>
          <button class="ai-pill-btn" id="pillDraftReply">✍️ Draft Reply</button>
          <button class="ai-pill-btn" id="pillExtractTasks">📌 Extract Tasks</button>
          <button class="ai-pill-btn" id="pillHelp">💡 Capabilities</button>
        </div>

        <!-- Chat history stream -->
        <div class="ai-chat-messages" id="aiChatStream">
          ${!config.configured ? `
            <div class="ai-msg assistant">
              <div class="ai-msg-avatar">✨</div>
              <div class="ai-msg-body" style="border-left: 3px solid #ef4444;">
                <strong>⚠️ AI API Key Needed</strong><br>
                The live chatbot requires an OpenAI, Google Gemini, or Anthropic API Key.<br><br>
                ${isOwner ? `<button class="btn-pill primary" id="btnGoToConfig" style="font-size: 0.78rem; padding: 4px 10px;">👉 Enter API Key in Settings</button>` : `Please notify your workspace administrator to enter the AI API Key.`}
              </div>
            </div>
          ` : `
            <div class="ai-msg assistant">
              <div class="ai-msg-avatar">✨</div>
              <div class="ai-msg-body">
                👋 Hello! I am your AI Assistant powered by <strong>${escapeHtml(config.provider.toUpperCase())}</strong> (<code>${escapeHtml(config.model)}</code>).<br>
                How can I assist your team or customer communication today?
              </div>
            </div>
          `}
        </div>

        <!-- Chat input bar -->
        <div class="ai-chat-input-bar">
          <input type="text" id="aiChatInputField" class="form-input" placeholder="Type a message or question for AI Assistant..." style="flex: 1;" />
          <button class="btn-pill primary" id="btnAiSendChat" style="padding: 0 16px;">
            <span>Send 🚀</span>
          </button>
        </div>
      </div>
    `;

    document.getElementById('btnGoToConfig')?.addEventListener('click', () => renderView('config'));

    const chatStream = document.getElementById('aiChatStream');
    const inputField = document.getElementById('aiChatInputField');
    const sendBtn = document.getElementById('btnAiSendChat');

    async function sendPrompt(text) {
      const prompt = (text || inputField.value || '').trim();
      if (!prompt) return;

      if (inputField) inputField.value = '';

      // Append user bubble
      const userBubble = document.createElement('div');
      userBubble.className = 'ai-msg user';
      userBubble.innerHTML = `
        <div class="ai-msg-body">${escapeHtml(prompt)}</div>
        <div class="ai-msg-avatar">👤</div>
      `;
      chatStream.appendChild(userBubble);

      // Append thinking bubble
      const thinkingBubble = document.createElement('div');
      thinkingBubble.className = 'ai-msg assistant';
      thinkingBubble.id = 'aiThinkingBubble';
      thinkingBubble.innerHTML = `
        <div class="ai-msg-avatar">✨</div>
        <div class="ai-msg-body" style="color: var(--text-muted); font-style: italic;">
          Thinking...
        </div>
      `;
      chatStream.appendChild(thinkingBubble);
      chatStream.scrollTop = chatStream.scrollHeight;

      try {
        const res = await api.chatWithAi(prompt, conversationId);
        thinkingBubble.remove();

        const assistantBubble = document.createElement('div');
        assistantBubble.className = 'ai-msg assistant';
        assistantBubble.innerHTML = `
          <div class="ai-msg-avatar">✨</div>
          <div class="ai-msg-body">
            ${escapeHtml(res.response)}
            ${res.configured === false && isOwner ? `
              <div style="margin-top: 8px;">
                <button class="btn-pill primary btn-open-config" style="font-size: 0.74rem; padding: 4px 8px;">Configure API Key</button>
              </div>
            ` : ''}
          </div>
        `;
        chatStream.appendChild(assistantBubble);
        assistantBubble.querySelector('.btn-open-config')?.addEventListener('click', () => renderView('config'));
      } catch (err) {
        thinkingBubble.remove();
        const errBubble = document.createElement('div');
        errBubble.className = 'ai-msg assistant';
        errBubble.innerHTML = `
          <div class="ai-msg-avatar">⚠️</div>
          <div class="ai-msg-body" style="color: #f87171;">
            Failed to generate response: ${escapeHtml(err.message)}
          </div>
        `;
        chatStream.appendChild(errBubble);
      }
      chatStream.scrollTop = chatStream.scrollHeight;
    }

    sendBtn?.addEventListener('click', () => sendPrompt());
    inputField?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendPrompt();
      }
    });

    document.getElementById('pillSummarize')?.addEventListener('click', () => sendPrompt('Please summarize the current channel conversation with key bullet points.'));
    document.getElementById('pillDraftReply')?.addEventListener('click', () => sendPrompt('Draft a clear, professional response to the customer in this channel.'));
    document.getElementById('pillExtractTasks')?.addEventListener('click', () => sendPrompt('Extract actionable tasks and next milestones from this conversation.'));
    document.getElementById('pillHelp')?.addEventListener('click', () => sendPrompt('What automated assistance and capabilities can you provide for AI Automation Labs?'));
  }

  function renderConfigTab() {
    const tabContainer = document.getElementById('aiTabContent');
    if (!tabContainer) return;

    tabContainer.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px; padding: 4px;">
        <div style="background: rgba(0,0,0,0.25); border: 1px solid var(--border-subtle); border-radius: 10px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between;">
          <div>
            <div style="font-size: 0.88rem; font-weight: 600;">AI Engine Status</div>
            <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">
              ${config.configured ? `Configured with ${escapeHtml(config.provider.toUpperCase())} (${escapeHtml(config.maskedKey)})` : 'No API key configured. Enter credentials below.'}
            </div>
          </div>
          <span class="ai-key-status-badge ${config.configured ? 'active' : 'inactive'}">
            ${config.configured ? '🟢 Active & Ready' : '🔴 Key Required'}
          </span>
        </div>

        <form id="aiConfigForm" style="display: flex; flex-direction: column; gap: 14px;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">AI Provider</label>
            <select id="cfgProvider" class="form-input">
              <option value="openai" ${config.provider === 'openai' ? 'selected' : ''}>OpenAI (GPT-4o, GPT-4o-mini)</option>
              <option value="gemini" ${config.provider === 'gemini' ? 'selected' : ''}>Google Gemini (Gemini 1.5 Pro / Flash)</option>
              <option value="anthropic" ${config.provider === 'anthropic' ? 'selected' : ''}>Anthropic Claude (Claude 3.5 Sonnet)</option>
              <option value="openrouter" ${config.provider === 'openrouter' ? 'selected' : ''}>OpenRouter (Universal Router)</option>
            </select>
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="display: flex; justify-content: space-between;">
              <span>API Secret Key</span>
              ${config.maskedKey ? `<span style="color: var(--text-dim); font-size: 0.74rem;">Current: ${escapeHtml(config.maskedKey)}</span>` : ''}
            </label>
            <div style="position: relative; display: flex; align-items: center;">
              <input type="password" id="cfgApiKey" class="form-input" placeholder="${config.configured ? 'Leave blank to retain current saved key, or enter new key' : 'Enter API Key (e.g. sk-proj-... / AIzaSy...)'}" style="padding-right: 40px;" />
              <button type="button" id="btnToggleKeyVisibility" style="position: absolute; right: 10px; background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 1rem;">👁️</button>
            </div>
            <div style="font-size: 0.74rem; color: var(--text-dim); margin-top: 4px;">
              Keys are encrypted in the local PostgreSQL database and strictly restricted to Owner/Admin roles.
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Model Identifier</label>
            <input type="text" id="cfgModel" class="form-input" value="${escapeHtml(config.model || 'gpt-4o-mini')}" placeholder="gpt-4o-mini / gemini-1.5-flash / claude-3-5-sonnet-20241022" />
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">System Prompt / Instructions</label>
            <textarea id="cfgSystemPrompt" class="form-input" rows="2" style="resize: vertical; font-size: 0.82rem;">${escapeHtml(config.systemPrompt || '')}</textarea>
          </div>

          <div id="aiTestFeedback" style="display: none; padding: 10px 14px; border-radius: 8px; font-size: 0.82rem;"></div>

          <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 6px;">
            <button type="button" class="btn-pill" id="btnTestAiConnection" style="background: rgba(255,255,255,0.08);">
              <span>⚡ Test Connection</span>
            </button>
            <button type="submit" class="btn-pill primary" id="btnSaveAiConfig">
              <span>💾 Save API Key</span>
            </button>
          </div>
        </form>
      </div>
    `;

    // Toggle password eye
    const keyInput = document.getElementById('cfgApiKey');
    const eyeBtn = document.getElementById('btnToggleKeyVisibility');
    eyeBtn?.addEventListener('click', () => {
      if (keyInput.type === 'password') {
        keyInput.type = 'text';
        eyeBtn.textContent = '🔒';
      } else {
        keyInput.type = 'password';
        eyeBtn.textContent = '👁️';
      }
    });

    // Auto-update default model suggestion on provider change
    const providerSelect = document.getElementById('cfgProvider');
    const modelInput = document.getElementById('cfgModel');
    providerSelect?.addEventListener('change', () => {
      const val = providerSelect.value;
      if (val === 'gemini') modelInput.value = 'gemini-1.5-flash';
      else if (val === 'anthropic') modelInput.value = 'claude-3-5-sonnet-20241022';
      else if (val === 'openrouter') modelInput.value = 'openai/gpt-4o-mini';
      else modelInput.value = 'gpt-4o-mini';
    });

    // Test Connection Handler
    document.getElementById('btnTestAiConnection')?.addEventListener('click', async () => {
      const testBtn = document.getElementById('btnTestAiConnection');
      const feedback = document.getElementById('aiTestFeedback');
      testBtn.disabled = true;
      testBtn.innerHTML = `<span>Testing...</span>`;
      feedback.style.display = 'block';
      feedback.style.background = 'rgba(56, 189, 248, 0.1)';
      feedback.style.border = '1px solid rgba(56, 189, 248, 0.3)';
      feedback.style.color = '#38bdf8';
      feedback.textContent = 'Sending ping to AI provider...';

      try {
        const testRes = await api.testAiConfig({
          provider: providerSelect.value,
          apiKey: keyInput.value,
          model: modelInput.value,
        });
        feedback.style.background = 'rgba(34, 197, 94, 0.15)';
        feedback.style.border = '1px solid rgba(34, 197, 94, 0.4)';
        feedback.style.color = '#4ade80';
        feedback.textContent = `✅ Connection Verified: "${testRes.message}"`;
        showToast('AI Connection successful!', 'success');
      } catch (testErr) {
        feedback.style.background = 'rgba(239, 68, 68, 0.15)';
        feedback.style.border = '1px solid rgba(239, 68, 68, 0.4)';
        feedback.style.color = '#f87171';
        feedback.textContent = `❌ Connection Failed: ${testErr.message}`;
        showToast('AI Connection failed', 'error');
      } finally {
        testBtn.disabled = false;
        testBtn.innerHTML = `<span>⚡ Test Connection</span>`;
      }
    });

    // Save Config Handler
    document.getElementById('aiConfigForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById('btnSaveAiConfig');
      saveBtn.disabled = true;
      saveBtn.innerHTML = `<span>Saving...</span>`;

      try {
        const saved = await api.saveAiConfig({
          provider: providerSelect.value,
          apiKey: keyInput.value,
          model: modelInput.value,
          systemPrompt: document.getElementById('cfgSystemPrompt')?.value,
        });

        config.configured = true;
        config.provider = saved.provider;
        config.model = saved.model;
        config.maskedKey = saved.maskedKey;

        // Update topbar indicator dot
        const topDot = document.getElementById('aiKeyIndicatorDot');
        if (topDot) {
          topDot.style.background = '#22c55e';
          topDot.title = `Active Key: ${saved.maskedKey}`;
        }

        showToast('AI Configuration and API Key saved successfully!', 'success');
        renderView('chat');
      } catch (saveErr) {
        showToast('Save failed: ' + saveErr.message, 'error');
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<span>💾 Save API Key</span>`;
      }
    });
  }

  renderView(activeTab);
}
