// ==============================================================================
// AI Automation Labs Connect Realtime Socket.IO Client Wrapper
// ==============================================================================

let socket = null;
let currentJoinedRoom = null;

export function connectSocket(token, callbacks = {}) {
  if (socket) {
    socket.disconnect();
  }

  // Use global io from socket.io.js
  const ioFn = window.io;
  if (!ioFn) {
    console.warn('[Socket] Socket.IO library not loaded yet.');
    return;
  }

  socket = ioFn({
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected with id:', socket.id);
    const dot = document.getElementById('statusDot');
    const label = document.getElementById('statusText');
    if (dot) dot.classList.remove('disconnected');
    if (label) label.textContent = 'Live';

    // Rejoin current active conversation room if set
    if (currentJoinedRoom) {
      joinConversationRoom(currentJoinedRoom);
    }
  });

  socket.on('disconnect', () => {
    console.log('[Socket] Disconnected.');
    const dot = document.getElementById('statusDot');
    const label = document.getElementById('statusText');
    if (dot) dot.classList.add('disconnected');
    if (label) label.textContent = 'Reconnecting...';
  });

  socket.on('message.created', (message) => {
    console.log('[Socket] message.created received:', message);
    if (callbacks.onMessageCreated) {
      callbacks.onMessageCreated(message);
    }
  });

  socket.on('message.updated', (message) => {
    console.log('[Socket] message.updated received:', message);
    if (callbacks.onMessageUpdated) {
      callbacks.onMessageUpdated(message);
    }
  });

  socket.on('message.deleted', (data) => {
    console.log('[Socket] message.deleted received:', data);
    if (callbacks.onMessageDeleted) {
      callbacks.onMessageDeleted(data);
    }
  });

  socket.on('typing.updated', (data) => {
    if (callbacks.onTypingUpdated) {
      callbacks.onTypingUpdated(data);
    }
  });

  socket.on('read.updated', (data) => {
    if (callbacks.onReadUpdated) {
      callbacks.onReadUpdated(data);
    }
  });

  socket.on('conversation.assigned', (data) => {
    if (callbacks.onConversationAssigned) {
      callbacks.onConversationAssigned(data);
    }
  });

  return socket;
}

export function joinConversationRoom(conversationId) {
  if (!socket || !socket.connected) {
    currentJoinedRoom = conversationId;
    return;
  }

  if (currentJoinedRoom && currentJoinedRoom !== conversationId) {
    socket.emit('conversation.leave', { conversationId: currentJoinedRoom });
  }

  currentJoinedRoom = conversationId;
  socket.emit('conversation.join', { conversationId }, (res) => {
    if (res?.error) {
      console.warn('[Socket Join Error]', res.error);
    } else {
      console.log('[Socket] Joined conversation room:', conversationId);
    }
  });
}

export function emitTyping(conversationId, isTyping) {
  if (!socket || !socket.connected) return;
  socket.emit(isTyping ? 'typing.start' : 'typing.stop', { conversationId });
}
