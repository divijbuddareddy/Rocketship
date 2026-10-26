// ==============================================================================
// AI Automation Labs Connect — Application Bootstrap & Orchestration
// ==============================================================================

import { state } from './state.js';
import { api, showToast } from './api.js';
import { connectSocket, emitTyping } from './socket.js';
import {
  renderUserBadge,
  renderWorkspaceHeader,
  renderSidebarChannels,
  switchConversation,
  renderInboxView,
  renderKanbanView,
  renderIntegrationsView,
  renderMeetingsView,
  appendMessage,
  openAiModal,
  showPromptDialog,
  showConfirmDialog,
} from './ui.js';
import { initLiveChatWidget } from './widget.js';

/**
 * Initialize user session
 */
async function initSession() {
  const authScreen = document.getElementById('authScreen');
  const token = localStorage.getItem('ailabs_token');

  if (!token) {
    if (authScreen) authScreen.style.display = 'flex';
    return;
  }

  try {
    const meData = await api.getMe();
    state.currentUser = meData.user;
    state.workspaces = meData.workspaces || [];

    if (authScreen) authScreen.style.display = 'none';

    setupSocket(token);
    await loadInitialWorkspace();
  } catch (err) {
    console.warn('[Auth] Session invalid or expired. Prompting sign in.');
    localStorage.removeItem('ailabs_token');
    if (authScreen) authScreen.style.display = 'flex';
  }
}

/**
 * Connect realtime socket with authenticated session
 */
function setupSocket(token) {
  connectSocket(token, {
    onMessageCreated: (message) => {
      appendMessage(message);
    },
    onMessageUpdated: (message) => {
      const idx = state.messages.findIndex(m => m.id === message.id);
      if (idx !== -1) {
        state.messages[idx] = { ...state.messages[idx], ...message };
        renderMessagesTimeline();
      }
    },
    onMessageDeleted: (data) => {
      state.messages = state.messages.filter(m => m.id !== data.messageId);
      renderMessagesTimeline();
    },
    onTypingUpdated: (data) => {
      const bar = document.getElementById('typingBar');
      if (!bar || !state.activeConversation || data.conversationId !== state.activeConversation.id) return;
      if (data.isTyping && data.userId !== state.currentUser?.id) {
        bar.innerHTML = `
          <span class="typing-dots">
            <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>
          </span>
          <span>${data.userName} is typing...</span>
        `;
      } else {
        bar.innerHTML = '';
      }
    },
    onConversationAssigned: () => {
      showToast('A customer conversation was assigned.', 'info');
    },
  });
}

/**
 * Load initial workspace and select default channel
 */
async function loadInitialWorkspace() {
  renderUserBadge();

  if (state.workspaces.length === 0) {
    const wsData = await api.getWorkspaces();
    state.workspaces = wsData.workspaces || [];
  }

  if (state.workspaces.length === 0) {
    showToast('No workspaces accessible.', 'error');
    return;
  }

  // If customer user, automatically select their customer workspace
  if (state.currentUser.role.includes('customer')) {
    state.activeWorkspace = state.workspaces.find(w => w.kind === 'customer') || state.workspaces[0];
  } else {
    // Default to internal workspace for team members
    state.activeWorkspace = state.workspaces.find(w => w.kind === 'internal') || state.workspaces[0];
  }

  renderWorkspaceHeader();

  // Fetch channels in active workspace
  const convData = await api.getConversations(state.activeWorkspace.id);
  state.conversations = convData.conversations || [];
  renderSidebarChannels();

  // Auto-select first channel
  if (state.conversations.length > 0) {
    await switchConversation(state.conversations[0].id);
  } else {
    document.getElementById('messagesTimeline').innerHTML = `
      <div class="empty-timeline-state">
        <div class="empty-title">Welcome to ${state.activeWorkspace.name}</div>
        <div class="empty-desc">Create your first channel to begin messaging.</div>
      </div>
    `;
  }

  // Update AI Key Indicator status in topbar
  updateAiKeyStatus();
}

export async function updateAiKeyStatus() {
  try {
    const config = await api.getAiConfig();
    const dot = document.getElementById('aiKeyIndicatorDot');
    if (dot) {
      if (config.configured) {
        dot.style.background = '#22c55e';
        dot.title = `Active AI Key (${config.provider.toUpperCase()} - ${config.maskedKey})`;
      } else {
        dot.style.background = '#ef4444';
        dot.title = 'AI API Key Required';
      }
    }
  } catch {}
}

/**
 * Set up application event listeners
 */
function setupEventListeners() {
  // 1. Sign In & Sign Up Auth System
  const authScreen = document.getElementById('authScreen');
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const loginSubmitBtn = document.getElementById('loginSubmitBtn');
  const signupSubmitBtn = document.getElementById('signupSubmitBtn');
  const tabSignIn = document.getElementById('tabSignIn');
  const tabSignUp = document.getElementById('tabSignUp');
  const authSubtitle = document.getElementById('authSubtitle');
  const authSwitchPromptText = document.getElementById('authSwitchPromptText');
  const authSwitchBtn = document.getElementById('authSwitchBtn');
  const signupAlert = document.getElementById('signupAlert');

  function setAuthMode(mode) {
    if (signupAlert) {
      signupAlert.className = 'signup-alert-box';
      signupAlert.innerHTML = '';
    }

    if (mode === 'signup') {
      tabSignUp?.classList.add('active');
      tabSignIn?.classList.remove('active');
      if (loginForm) loginForm.style.display = 'none';
      if (signupForm) signupForm.style.display = 'flex';
      if (authSubtitle) authSubtitle.textContent = 'Create your enterprise collaboration credentials';
      if (authSwitchPromptText) authSwitchPromptText.textContent = 'Already have an account?';
      if (authSwitchBtn) authSwitchBtn.textContent = 'Sign In';
      document.getElementById('signupName')?.focus();
    } else {
      tabSignIn?.classList.add('active');
      tabSignUp?.classList.remove('active');
      if (loginForm) loginForm.style.display = 'flex';
      if (signupForm) signupForm.style.display = 'none';
      if (authSubtitle) authSubtitle.textContent = 'Sign in to your collaboration workspace';
      if (authSwitchPromptText) authSwitchPromptText.textContent = "Don't have an account?";
      if (authSwitchBtn) authSwitchBtn.textContent = 'Create one';
      document.getElementById('loginEmail')?.focus();
    }
  }

  tabSignIn?.addEventListener('click', () => setAuthMode('signin'));
  tabSignUp?.addEventListener('click', () => setAuthMode('signup'));
  authSwitchBtn?.addEventListener('click', () => {
    const isSignup = tabSignUp?.classList.contains('active');
    setAuthMode(isSignup ? 'signin' : 'signup');
  });

  // Sign In Form Handler
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail')?.value;
    const password = document.getElementById('loginPassword')?.value;

    if (!email || !password) return;

    if (loginSubmitBtn) {
      loginSubmitBtn.disabled = true;
      loginSubmitBtn.innerHTML = `<span>Signing in...</span>`;
    }

    try {
      const res = await api.login(email, password);
      localStorage.setItem('ailabs_token', res.token);
      state.currentUser = res.user;

      if (authScreen) authScreen.style.display = 'none';
      showToast(`Welcome back, ${res.user.displayName}!`, 'success');

      setupSocket(res.token);
      await loadInitialWorkspace();
    } catch (err) {
      showToast(err.message || 'Invalid credentials. Please verify your email and password.', 'error');
    } finally {
      if (loginSubmitBtn) {
        loginSubmitBtn.disabled = false;
        loginSubmitBtn.innerHTML = `<span>Sign In</span><span>➤</span>`;
      }
    }
  });

  // Sign Up Form Handler with Duplicate Credential Detection
  signupForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('signupName')?.value?.trim();
    const email = document.getElementById('signupEmail')?.value?.trim();
    const password = document.getElementById('signupPassword')?.value;
    const passwordConfirm = document.getElementById('signupPasswordConfirm')?.value;

    if (signupAlert) {
      signupAlert.className = 'signup-alert-box';
      signupAlert.innerHTML = '';
    }

    if (!name || !email || !password) {
      showToast('Please fill out all required fields.', 'error');
      return;
    }

    if (password !== passwordConfirm) {
      if (signupAlert) {
        signupAlert.className = 'signup-alert-box show';
        signupAlert.innerHTML = '<strong>Passwords do not match.</strong> Please ensure both passwords match identically.';
      }
      showToast('Passwords do not match.', 'error');
      document.getElementById('signupPasswordConfirm')?.focus();
      return;
    }

    if (signupSubmitBtn) {
      signupSubmitBtn.disabled = true;
      signupSubmitBtn.innerHTML = `<span>Creating Account...</span>`;
    }

    try {
      const res = await api.register({ displayName: name, email, password });
      localStorage.setItem('ailabs_token', res.token);
      state.currentUser = res.user;

      if (authScreen) authScreen.style.display = 'none';
      showToast(res.message || `Welcome to AI Labs Connect, ${res.user.displayName}!`, 'success');

      setupSocket(res.token);
      await loadInitialWorkspace();
    } catch (err) {
      const isDuplicate = err.code === 'EMAIL_ALREADY_REGISTERED' || err.status === 409 || (err.message && err.message.toLowerCase().includes('already registered'));

      if (isDuplicate && signupAlert) {
        signupAlert.className = 'signup-alert-box show';
        signupAlert.innerHTML = `
          <div style="display: flex; align-items: flex-start; gap: 8px;">
            <span style="font-size: 1.1rem; line-height: 1;">⚠️</span>
            <div>
              <div style="font-weight: 600; margin-bottom: 2px;">Account Already Exists</div>
              <div>This email is already registered. These credentials were used to create an account earlier.</div>
              <div style="margin-top: 6px;">
                <button type="button" id="alertSwitchToSignInBtn" style="background: none; border: none; color: #38bdf8; font-weight: 600; text-decoration: underline; cursor: pointer; padding: 0;">Sign in with these credentials →</button>
              </div>
            </div>
          </div>
        `;

        document.getElementById('alertSwitchToSignInBtn')?.addEventListener('click', () => {
          setAuthMode('signin');
          const loginEmailInput = document.getElementById('loginEmail');
          if (loginEmailInput) {
            loginEmailInput.value = email;
          }
          document.getElementById('loginPassword')?.focus();
        });
      } else if (signupAlert) {
        signupAlert.className = 'signup-alert-box show';
        signupAlert.textContent = err.message || 'Registration failed. Please try again.';
      }

      showToast(err.message || 'Registration failed.', 'error');
    } finally {
      if (signupSubmitBtn) {
        signupSubmitBtn.disabled = false;
        signupSubmitBtn.innerHTML = `<span>Create Account</span><span>➤</span>`;
      }
    }
  });

  // 2. Sign Out Button Handler
  document.getElementById('btnSignOut')?.addEventListener('click', async () => {
    try {
      await api.logout();
    } catch {}
    localStorage.removeItem('ailabs_token');
    state.currentUser = null;
    state.workspaces = [];
    state.conversations = [];
    state.messages = [];
    if (authScreen) authScreen.style.display = 'flex';
    showToast('Signed out successfully.', 'info');
  });

  // 3. Navigation Hub Items
  document.getElementById('navSharedInbox')?.addEventListener('click', () => renderInboxView());
  document.getElementById('navKanban')?.addEventListener('click', () => renderKanbanView());
  document.getElementById('navIntegrations')?.addEventListener('click', () => renderIntegrationsView());
  document.getElementById('navMeetings')?.addEventListener('click', () => renderMeetingsView());

  // 4. Workspace Switcher Header & Top Pill
  document.getElementById('workspaceHeader')?.addEventListener('click', () => openWorkspaceSwitchModal());
  document.getElementById('activeWorkspacePill')?.addEventListener('click', () => openWorkspaceSwitchModal());

  // 5. Toggle Internal Note Button in Composer
  const noteBtn = document.getElementById('toggleInternalNote');
  if (noteBtn) {
    noteBtn.addEventListener('click', () => {
      state.isInternalNoteActive = !state.isInternalNoteActive;
      noteBtn.classList.toggle('active', state.isInternalNoteActive);
      const composerBox = document.querySelector('.composer-box');
      if (composerBox) {
        if (state.isInternalNoteActive) {
          composerBox.style.borderColor = 'var(--internal-note-border)';
          composerBox.style.boxShadow = '0 0 12px rgba(245, 158, 11, 0.25)';
        } else {
          composerBox.style.borderColor = 'var(--border-subtle)';
          composerBox.style.boxShadow = 'none';
        }
      }
    });
  }

  // 6. Send Message Handler
  const sendBtn = document.getElementById('btnSendMessage');
  const composerInput = document.getElementById('composerInput');

  const handleSend = async () => {
    if (!state.activeConversation) return;
    const body = (composerInput.value || '').trim();
    if (!body) return;

    const visibility = state.isInternalNoteActive ? 'internal' : 'all';
    const idempotencyKey = `web_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    composerInput.value = '';
    emitTyping(state.activeConversation.id, false);

    try {
      const res = await api.sendMessage(state.activeConversation.id, body, visibility, idempotencyKey);
      appendMessage(res.message);
    } catch (err) {
      showToast('Send failed: ' + err.message, 'error');
    }
  };

  sendBtn?.addEventListener('click', handleSend);

  // Enter to send, Shift+Enter for newline
  composerInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else {
      if (state.activeConversation) {
        emitTyping(state.activeConversation.id, true);
        clearTimeout(state.typingTimeout);
        state.typingTimeout = setTimeout(() => {
          emitTyping(state.activeConversation.id, false);
        }, 1500);
      }
    }
  });

  // 7. Modal Close Buttons
  document.querySelectorAll('.close-modal-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal-overlay')?.classList.remove('active');
    });
  });

  // 8. Help / Guide Modal Button
  document.getElementById('btnHelpGuide')?.addEventListener('click', () => openHelpGuideModal());

  // 8b. AI Copilot Trigger Button (Top Bar)
  document.getElementById('btnAiCopilotTrigger')?.addEventListener('click', () => {
    openAiModal(state.activeConversation?.id);
  });

  // 9. Create Task Button in Kanban View
  document.getElementById('btnCreateTask')?.addEventListener('click', () => openCreateTaskModal());

  // 10. Refresh Inbox Button
  document.getElementById('btnRefreshInbox')?.addEventListener('click', () => renderInboxView());

  // 11. Add Channel Button
  document.getElementById('btnAddChannel')?.addEventListener('click', () => openAddChannelModal());

  // 12. Add Customer Button (Admin Only)
  document.getElementById('btnAddCustomer')?.addEventListener('click', () => openAddCustomerModal());

  // 13. Floating Website Live Chat Widget
  initLiveChatWidget();
}

/**
 * Switch Workspace Modal
 */
function openWorkspaceSwitchModal() {
  const modal = document.getElementById('genericModal');
  const title = document.getElementById('genericModalTitle');
  const body = document.getElementById('genericModalBody');
  if (!modal || !title || !body) return;

  title.textContent = 'Switch Workspace';
  body.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 8px;">
      ${state.workspaces.map(w => `
        <div class="nav-item ${state.activeWorkspace?.id === w.id ? 'active' : ''}" data-target-ws="${w.id}" style="padding: 12px; border: 1px solid var(--border-subtle); border-radius: 8px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.2rem;">${w.kind === 'internal' ? '🏢' : '🌐'}</span>
            <div>
              <div style="font-weight: 600;">${w.name}</div>
              <div style="font-size: 0.72rem; color: var(--text-dim); text-transform: uppercase;">${w.kind} Workspace</div>
            </div>
          </div>
          <span class="badge-pill ${w.kind}">${w.kind}</span>
        </div>
      `).join('')}
    </div>
  `;

  modal.classList.add('active');

  body.querySelectorAll('[data-target-ws]').forEach(item => {
    item.addEventListener('click', async () => {
      const wsId = item.getAttribute('data-target-ws');
      const ws = state.workspaces.find(w => w.id === wsId);
      if (ws) {
        state.activeWorkspace = ws;
        renderWorkspaceHeader();
        modal.classList.remove('active');
        const convData = await api.getConversations(ws.id);
        state.conversations = convData.conversations || [];
        renderSidebarChannels();
        if (state.conversations.length > 0) {
          await switchConversation(state.conversations[0].id);
        }
      }
    });
  });
}

/**
 * Create Channel Modal
 */
function openAddChannelModal() {
  const modal = document.getElementById('genericModal');
  const title = document.getElementById('genericModalTitle');
  const body = document.getElementById('genericModalBody');
  if (!modal || !title || !body) return;

  title.textContent = 'Create Channel';
  body.innerHTML = `
    <form id="newChannelForm">
      <div class="form-group">
        <label class="form-label" for="newChannelTitle">Channel Name</label>
        <input type="text" class="form-input" id="newChannelTitle" placeholder="e.g. project-apollo, general-ops" required />
      </div>
      <div class="form-group">
        <label class="form-label" for="newChannelPriority">Priority</label>
        <select class="form-input" id="newChannelPriority">
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px;">
        <button type="submit" class="btn-pill primary">Create Channel</button>
      </div>
    </form>
  `;

  modal.classList.add('active');

  document.getElementById('newChannelForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const titleVal = document.getElementById('newChannelTitle').value;
    const priorityVal = document.getElementById('newChannelPriority').value;

    try {
      const res = await api.createConversation(state.activeWorkspace.id, {
        title: titleVal,
        priority: priorityVal,
      });
      showToast('Channel created successfully', 'success');
      modal.classList.remove('active');

      const convData = await api.getConversations(state.activeWorkspace.id);
      state.conversations = convData.conversations || [];
      renderSidebarChannels();
      await switchConversation(res.conversation.id);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

/**
 * Provision New Customer & Customer Management Modal
 */
async function openAddCustomerModal() {
  const modal = document.getElementById('genericModal');
  const title = document.getElementById('genericModalTitle');
  const body = document.getElementById('genericModalBody');
  if (!modal || !title || !body) return;

  let customers = [];
  try {
    const custData = await api.getCustomers();
    customers = custData.customers || [];
  } catch {}

  const isOwner = state.currentUser?.role === 'owner' || state.currentUser?.role === 'admin';

  title.textContent = 'Customer Management & Provisioning';
  body.innerHTML = `
    <div style="max-height: 75vh; overflow-y: auto; padding-right: 4px;">
      <div style="background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 8px; padding: 12px; margin-bottom: 16px;">
        <div style="font-weight: 600; font-size: 0.9rem; margin-bottom: 4px;">➕ Provision New Customer Portal</div>
        <p style="font-size: 0.78rem; color: var(--text-muted); margin: 0;">
          Automatically provisions an isolated customer workspace, client user login, and initial support channel.
        </p>
      </div>

      <form id="newCustomerForm" style="margin-bottom: 24px;">
        <div class="form-group">
          <label class="form-label" for="newCustName">Customer / Company Name</label>
          <input type="text" class="form-input" id="newCustName" placeholder="e.g. Apex Global Logistics" required />
        </div>
        <div class="form-group">
          <label class="form-label" for="newCustEmail">Primary Contact Email</label>
          <input type="email" class="form-input" id="newCustEmail" placeholder="client@apexlogistics.com" required />
        </div>
        <div class="form-group">
          <label class="form-label" for="newCustNotes">Internal Notes (Confidential to AI Automation Labs)</label>
          <input type="text" class="form-input" id="newCustNotes" placeholder="e.g. Key client, priority SLA" />
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px;">
          <button type="submit" class="btn-pill primary">Provision Workspace</button>
        </div>
      </form>

      <div style="border-top: 1px solid var(--border-subtle); padding-top: 16px;">
        <div style="font-weight: 600; font-size: 0.9rem; margin-bottom: 12px;">🏢 Existing Customers (${customers.length})</div>
        ${customers.length === 0 ? `
          <div style="padding: 16px; text-align: center; color: var(--text-dim); font-size: 0.8rem; border: 1px dashed var(--border-subtle); border-radius: 6px;">
            No customer accounts provisioned yet.
          </div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${customers.map(c => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-subtle); border-radius: 6px;">
                <div>
                  <div style="font-weight: 600; font-size: 0.86rem;">${escapeHtml(c.name)}</div>
                  <div style="font-size: 0.76rem; color: var(--text-dim);">${escapeHtml(c.primaryEmail || 'No email')} • ${escapeHtml(c.workspaceSlug || 'portal')}</div>
                </div>
                ${isOwner ? `
                  <div style="display: flex; gap: 6px;">
                    <button class="btn-pill edit-cust-btn" data-cust-id="${c.id}" data-cust-name="${escapeHtml(c.name)}" data-cust-email="${escapeHtml(c.primaryEmail || '')}" data-cust-notes="${escapeHtml(c.notes || '')}" style="font-size: 0.72rem; padding: 3px 8px;">✏️ Edit</button>
                    <button class="btn-pill delete-cust-btn" data-cust-id="${c.id}" data-cust-name="${escapeHtml(c.name)}" style="font-size: 0.72rem; padding: 3px 8px; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);">🗑️ Delete</button>
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        `}
      </div>
    </div>
  `;

  modal.classList.add('active');

  // Customer form submit listener
  document.getElementById('newCustomerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('newCustName').value;
    const email = document.getElementById('newCustEmail').value;
    const notes = document.getElementById('newCustNotes').value;

    try {
      await api.createCustomer({ name, primaryEmail: email, notes });
      showToast(`Customer workspace for ${name} provisioned!`, 'success');
      modal.classList.remove('active');

      const wsData = await api.getWorkspaces();
      state.workspaces = wsData.workspaces || [];
      renderWorkspaceHeader();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Edit customer listener
  modal.querySelectorAll('.edit-cust-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const custId = btn.getAttribute('data-cust-id');
      const custName = btn.getAttribute('data-cust-name') || '';
      const custEmail = btn.getAttribute('data-cust-email') || '';
      const custNotes = btn.getAttribute('data-cust-notes') || '';
      openEditCustomerModal({ id: custId, name: custName, primaryEmail: custEmail, notes: custNotes });
    });
  });

  // Delete customer listener
  modal.querySelectorAll('.delete-cust-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const custId = btn.getAttribute('data-cust-id');
      const custName = btn.getAttribute('data-cust-name') || 'Customer';
      const ok = await showConfirmDialog('Delete Customer', `Are you sure you want to delete "${custName}" and their entire dedicated workspace? This action cannot be undone.`, 'Delete Customer', true);
      if (ok) {
        try {
          await api.deleteCustomer(custId);
          showToast(`Customer "${custName}" deleted.`, 'info');
          const wsData = await api.getWorkspaces();
          state.workspaces = wsData.workspaces || [];
          renderWorkspaceHeader();
          openAddCustomerModal();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  });
}

/**
 * Edit Customer Dedicated Modal
 */
export function openEditCustomerModal(customer) {
  const modal = document.getElementById('genericModal');
  const title = document.getElementById('genericModalTitle');
  const body = document.getElementById('genericModalBody');
  if (!modal || !title || !body) return;

  title.textContent = `Edit Customer: ${customer.name}`;
  body.innerHTML = `
    <form id="editCustomerForm">
      <div class="form-group">
        <label class="form-label" for="editCustName">Organization / Company Name</label>
        <input type="text" class="form-input" id="editCustName" value="${escapeHtml(customer.name)}" required />
      </div>
      <div class="form-group">
        <label class="form-label" for="editCustEmail">Primary Contact Email</label>
        <input type="email" class="form-input" id="editCustEmail" value="${escapeHtml(customer.primaryEmail)}" required />
      </div>
      <div class="form-group">
        <label class="form-label" for="editCustNotes">Internal Confidential Notes</label>
        <textarea class="form-input" id="editCustNotes" rows="3" placeholder="SLA tiers, enterprise requirements, NDA details...">${escapeHtml(customer.notes || '')}</textarea>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 20px;">
        <button type="button" class="btn-pill" id="btnDeleteCustomerModal" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.4);">
          🗑️ Delete Customer
        </button>
        <div style="display: flex; gap: 8px;">
          <button type="button" class="btn-pill" id="btnCancelEditCust">Cancel</button>
          <button type="submit" class="btn-pill primary">Save Changes</button>
        </div>
      </div>
    </form>
  `;

  modal.classList.add('active');

  document.getElementById('btnCancelEditCust')?.addEventListener('click', () => {
    openAddCustomerModal();
  });

  document.getElementById('btnDeleteCustomerModal')?.addEventListener('click', async () => {
    const ok = await showConfirmDialog('Delete Customer', `Are you sure you want to delete customer "${customer.name}" and all associated workspaces, channels, and portals?`, 'Delete Customer', true);
    if (ok) {
      try {
        await api.deleteCustomer(customer.id);
        showToast(`Customer "${customer.name}" deleted.`, 'info');
        const wsData = await api.getWorkspaces();
        state.workspaces = wsData.workspaces || [];
        renderWorkspaceHeader();
        openAddCustomerModal();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  });

  document.getElementById('editCustomerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newName = document.getElementById('editCustName').value.trim();
    const newEmail = document.getElementById('editCustEmail').value.trim();
    const newNotes = document.getElementById('editCustNotes').value.trim();

    try {
      await api.updateCustomer(customer.id, {
        name: newName,
        primaryEmail: newEmail,
        notes: newNotes,
      });
      showToast('Customer updated successfully!', 'success');
      const wsData = await api.getWorkspaces();
      state.workspaces = wsData.workspaces || [];
      renderWorkspaceHeader();
      openAddCustomerModal();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

/**
 * Edit Task Modal
 */
export function openEditTaskModal(task) {
  const modal = document.getElementById('genericModal');
  const title = document.getElementById('genericModalTitle');
  const body = document.getElementById('genericModalBody');
  if (!modal || !title || !body) return;

  const isOwner = state.currentUser?.role === 'owner' || state.currentUser?.role === 'admin';

  title.textContent = 'Edit Task Details';
  body.innerHTML = `
    <form id="editTaskForm">
      <div class="form-group">
        <label class="form-label" for="editTaskTitle">Task Title</label>
        <input type="text" class="form-input" id="editTaskTitle" value="${escapeHtml(task.title || '')}" required />
      </div>
      <div class="form-group">
        <label class="form-label" for="editTaskDesc">Description</label>
        <textarea class="form-input" id="editTaskDesc" rows="3">${escapeHtml(task.description || '')}</textarea>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div class="form-group">
          <label class="form-label" for="editTaskPriority">Priority</label>
          <select class="form-input" id="editTaskPriority">
            <option value="normal" ${task.priority === 'normal' ? 'selected' : ''}>Normal</option>
            <option value="high" ${task.priority === 'high' ? 'selected' : ''}>High</option>
            <option value="urgent" ${task.priority === 'urgent' ? 'selected' : ''}>Urgent</option>
            <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Low</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="editTaskStatus">Column / Status</label>
          <select class="form-input" id="editTaskStatus">
            <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>To Do</option>
            <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
            <option value="review" ${task.status === 'review' ? 'selected' : ''}>Review / QA</option>
            <option value="done" ${task.status === 'done' ? 'selected' : ''}>Completed</option>
          </select>
        </div>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 20px;">
        ${isOwner ? `
          <button type="button" class="btn-pill" id="btnDeleteTaskModal" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.4);">
            🗑️ Delete Task
          </button>
        ` : '<div></div>'}
        <div style="display: flex; gap: 8px;">
          <button type="button" class="btn-pill" id="btnCancelEditTask">Cancel</button>
          <button type="submit" class="btn-pill primary">Save Changes</button>
        </div>
      </div>
    </form>
  `;

  modal.classList.add('active');

  document.getElementById('btnCancelEditTask')?.addEventListener('click', () => {
    modal.classList.remove('active');
  });

  document.getElementById('btnDeleteTaskModal')?.addEventListener('click', async () => {
    const ok = await showConfirmDialog('Delete Task', `Are you sure you want to delete task "${task.title}"?`, 'Delete Task', true);
    if (ok) {
      try {
        await api.deleteTask(task.id);
        modal.classList.remove('active');
        showToast('Task deleted successfully', 'info');
        await renderKanbanView();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  });

  document.getElementById('editTaskForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newTitle = document.getElementById('editTaskTitle').value;
    const newDesc = document.getElementById('editTaskDesc').value;
    const newPriority = document.getElementById('editTaskPriority').value;
    const newStatus = document.getElementById('editTaskStatus').value;

    try {
      await api.updateTask(task.id, {
        title: newTitle,
        description: newDesc,
        priority: newPriority,
        status: newStatus,
      });
      showToast('Task updated successfully!', 'success');
      modal.classList.remove('active');
      await renderKanbanView();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}
window.openEditTaskModal = openEditTaskModal;

/**
 * Create Task Modal
 */
export function openCreateTaskModal(defaultStatus = 'todo') {
  const modal = document.getElementById('genericModal');
  const title = document.getElementById('genericModalTitle');
  const body = document.getElementById('genericModalBody');
  if (!modal || !title || !body) return;

  title.textContent = 'Create New Task';
  body.innerHTML = `
    <form id="newTaskForm">
      <div class="form-group">
        <label class="form-label" for="newTaskTitle">Task Title</label>
        <input type="text" class="form-input" id="newTaskTitle" placeholder="e.g. Configure SSL reverse proxy for client portal" required />
      </div>
      <div class="form-group">
        <label class="form-label" for="newTaskDesc">Description (Optional)</label>
        <textarea class="form-input" id="newTaskDesc" rows="3" placeholder="Add detailed requirements or checklist..."></textarea>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div class="form-group">
          <label class="form-label" for="newTaskPriority">Priority</label>
          <select class="form-input" id="newTaskPriority">
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="newTaskStatus">Column / Status</label>
          <select class="form-input" id="newTaskStatus">
            <option value="todo" ${defaultStatus === 'todo' ? 'selected' : ''}>To Do</option>
            <option value="in_progress" ${defaultStatus === 'in_progress' ? 'selected' : ''}>In Progress</option>
            <option value="review" ${defaultStatus === 'review' ? 'selected' : ''}>Review / QA</option>
            <option value="done" ${defaultStatus === 'done' ? 'selected' : ''}>Completed</option>
          </select>
        </div>
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px;">
        <button type="submit" class="btn-pill primary">Create Task</button>
      </div>
    </form>
  `;

  modal.classList.add('active');

  document.getElementById('newTaskForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const taskTitle = document.getElementById('newTaskTitle').value;
    const desc = document.getElementById('newTaskDesc').value;
    const priority = document.getElementById('newTaskPriority').value;
    const taskStatus = document.getElementById('newTaskStatus').value;

    try {
      await api.createTask({
        workspaceId: state.activeWorkspace?.id,
        title: taskTitle,
        description: desc,
        priority: priority,
        status: taskStatus,
      });
      showToast('Task created successfully!', 'success');
      modal.classList.remove('active');
      await renderKanbanView();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}
window.openCreateTaskModal = openCreateTaskModal;

/**
 * Platform Architecture & How-It-Works Guide Modal
 */
function openHelpGuideModal() {
  const modal = document.getElementById('genericModal');
  const title = document.getElementById('genericModalTitle');
  const body = document.getElementById('genericModalBody');
  if (!modal || !title || !body) return;

  title.textContent = 'Platform Guide & Clean Architecture';
  body.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 14px; font-size: 0.86rem; line-height: 1.5; max-height: 70vh; overflow-y: auto; padding-right: 4px;">
      <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 10px; padding: 14px;">
        <div style="font-weight: 700; color: var(--brand-primary); margin-bottom: 4px;">⚡ AI Automation Labs Connect Architecture</div>
        <p style="margin: 0; color: var(--text-muted); font-size: 0.82rem;">
          Clean, enterprise-grade collaboration platform for internal team coordination and client portals.
        </p>
      </div>

      <div style="display: flex; gap: 12px; align-items: flex-start;">
        <div style="font-size: 1.3rem;">🏢</div>
        <div>
          <div style="font-weight: 600;">1. Workspace & Multi-Tenant Isolation</div>
          <div style="color: var(--text-muted); font-size: 0.8rem;">
            The <strong>Internal Team Workspace</strong> hosts company discussions (#general, #announcements). When you click <strong>Provision Customer</strong>, a dedicated, isolated customer portal is created. Clients log in to see only their workspace with zero exposure to internal channels.
          </div>
        </div>
      </div>

      <div style="display: flex; gap: 12px; align-items: flex-start;">
        <div style="font-size: 1.3rem;">🔒</div>
        <div>
          <div style="font-weight: 600;">2. Internal Confidential Notes</div>
          <div style="color: var(--text-muted); font-size: 0.8rem;">
            In any customer conversation, toggle the <strong>🔒 Internal Note</strong> button in the composer. Messages sent as internal notes have a yellow highlight and are filtered out by server-side SQL queries for any customer user.
          </div>
        </div>
      </div>

      <div style="display: flex; gap: 12px; align-items: flex-start;">
        <div style="font-size: 1.3rem;">📥</div>
        <div>
          <div style="font-weight: 600;">3. Unified Customer Inbox & External Integrations</div>
          <div style="color: var(--text-muted); font-size: 0.8rem;">
            Inquiries arriving via Website Live Chat, WhatsApp Cloud API, Telegram, and Customer Portals stream into the <strong>Customer Inbox</strong>. Team members can claim conversations, assign leads, and mark issues resolved.
          </div>
        </div>
      </div>

      <div style="display: flex; gap: 12px; align-items: flex-start;">
        <div style="font-size: 1.3rem;">📊</div>
        <div>
          <div style="font-weight: 600;">4. Tasks & Kanban Board</div>
          <div style="color: var(--text-muted); font-size: 0.8rem;">
            Track work items with customizable priorities (Normal, High, Urgent). Click any task card to advance it through stages from To Do to Done.
          </div>
        </div>
      </div>

      <div style="display: flex; gap: 12px; align-items: flex-start;">
        <div style="font-size: 1.3rem;">✨</div>
        <div>
          <div style="font-weight: 600;">5. AI Collaboration Assistant</div>
          <div style="color: var(--text-muted); font-size: 0.8rem;">
            Click <strong>✨ AI Summary</strong> inside any conversation to instantly generate a bulleted thread summary, draft contextual replies, or extract action items.
          </div>
        </div>
      </div>
    </div>
  `;

  modal.classList.add('active');
}

// Kickoff on DOM Load
window.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await initSession();
});
