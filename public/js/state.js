// ==============================================================================
// AI Automation Labs Connect Global State Store
// ==============================================================================

export const state = {
  currentUser: null,
  workspaces: [],
  activeWorkspace: null,
  activeConversation: null,
  conversations: [],
  messages: [],
  nextCursor: null,
  currentView: 'chat', // 'chat' | 'inbox' | 'kanban' | 'integrations' | 'meeting'
  isInternalNoteActive: false,
  typingTimeout: null,
  tasks: [],
  inboxItems: [],
  integrations: [],
};
