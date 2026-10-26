// ==============================================================================
// AI Automation Labs Connect REST API Client
// ==============================================================================

const API_BASE = '/api/v1';

export function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const token = localStorage.getItem('ailabs_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg = data.error?.message || `Request failed with status ${res.status}`;
      showToast(errMsg, 'error');
      const err = new Error(errMsg);
      err.code = data.error?.code;
      err.status = res.status;
      throw err;
    }

    return data;
  } catch (err) {
    console.error(`[API Error] ${endpoint}:`, err);
    throw err;
  }
}

export const api = {
  // Auth
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  getMe: () => request('/me'),

  // Workspaces & Channels
  getWorkspaces: () => request('/workspaces'),
  getConversations: (workspaceId) => request(`/workspaces/${workspaceId}/conversations`),
  createConversation: (workspaceId, data) => request(`/workspaces/${workspaceId}/conversations`, { method: 'POST', body: JSON.stringify(data) }),

  // Messages
  getMessages: (conversationId, cursor) => request(`/conversations/${conversationId}/messages${cursor ? `?cursor=${cursor}` : ''}`),
  sendMessage: (conversationId, body, visibility = 'all', clientIdempotencyKey = null) =>
    request(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body, visibility, clientIdempotencyKey }),
    }),
  toggleReaction: (messageId, emoji) => request(`/messages/${messageId}/reactions`, { method: 'POST', body: JSON.stringify({ emoji }) }),

  // Customers & Inbox
  // Customers & Inbox
  getCustomers: () => request('/customers'),
  createCustomer: (data) => request('/customers', { method: 'POST', body: JSON.stringify(data) }),
  updateCustomer: (customerId, data) => request(`/customers/${customerId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCustomer: (customerId) => request(`/customers/${customerId}`, { method: 'DELETE' }),
  getInbox: (filters = {}) => {
    const query = new URLSearchParams(filters).toString();
    return request(`/inbox${query ? `?${query}` : ''}`);
  },
  updateConversation: (conversationId, data) =>
    request(`/conversations/${conversationId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteConversation: (conversationId) =>
    request(`/conversations/${conversationId}`, { method: 'DELETE' }),
  assignConversation: (conversationId, assignedUserId) =>
    request(`/conversations/${conversationId}/assignment`, { method: 'PATCH', body: JSON.stringify({ assignedUserId }) }),
  updateConversationStatus: (conversationId, status) =>
    request(`/conversations/${conversationId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // Messages edit & delete
  editMessage: (messageId, body) => request(`/messages/${messageId}`, { method: 'PATCH', body: JSON.stringify({ body }) }),
  deleteMessage: (messageId) => request(`/messages/${messageId}`, { method: 'DELETE' }),

  // Tasks & Kanban
  getTasks: (workspaceId) => request(`/tasks${workspaceId ? `?workspaceId=${workspaceId}` : ''}`),
  createTask: (data) => request('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (taskId, updates) => request(`/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  deleteTask: (taskId) => request(`/tasks/${taskId}`, { method: 'DELETE' }),

  // Users Management (Owner/Admin)
  getUsers: () => request('/users'),
  updateUser: (userId, data) => request(`/users/${userId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteUser: (userId) => request(`/users/${userId}`, { method: 'DELETE' }),

  // Integrations & AI
  getIntegrations: () => request('/integrations'),
  updateIntegration: (integrationId, data) => request(`/integrations/${integrationId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteIntegration: (integrationId) => request(`/integrations/${integrationId}`, { method: 'DELETE' }),
  getAiConfig: () => request('/ai/config'),
  saveAiConfig: (data) => request('/ai/config', { method: 'POST', body: JSON.stringify(data) }),
  testAiConfig: (data) => request('/ai/test', { method: 'POST', body: JSON.stringify(data) }),
  chatWithAi: (prompt, conversationId) => request('/ai/chat', { method: 'POST', body: JSON.stringify({ prompt, conversationId }) }),
  aiAssist: (conversationId, mode) => request('/ai/assist', { method: 'POST', body: JSON.stringify({ conversationId, mode }) }),
  getMeetingToken: (roomName) => request(`/calls/token?roomName=${encodeURIComponent(roomName || 'general')}`),
};
