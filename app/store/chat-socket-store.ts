import { io, type Socket } from 'socket.io-client';

import { MEDIA_BASE, type DirectMessage } from '@/services/api';
import { authStore } from '@/store/auth-store';

// Persistent, app-wide socket for 1:1 direct-message chat — independent of
// the room-scoped socket in socket-store.ts, mirrors friend-zone-socket-store.ts.
// Kept alive at the app root so incoming messages/requests can be observed
// (e.g. for unread badges) regardless of which screen is active.

export type ChatSocketEvent =
  | { type: 'message'; conversationId: string; message: DirectMessage }
  | { type: 'typing'; conversationId: string; userId: string; isTyping: boolean }
  | { type: 'read'; conversationId: string; readBy: string }
  | { type: 'request_accepted'; conversationId: string }
  | { type: 'request_rejected'; conversationId: string }
  | { type: 'error'; conversationId: string; message: string };

const state = {
  socket: null as Socket | null,
  connected: false,
};

const listeners = new Set<() => void>();
function notify() { listeners.forEach(fn => fn()); }
export function subscribeChatSocket(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
export function getChatSocketState() {
  return { connected: state.connected };
}

const eventListeners = new Set<(event: ChatSocketEvent) => void>();
export function subscribeChatEvents(fn: (event: ChatSocketEvent) => void): () => void {
  eventListeners.add(fn);
  return () => { eventListeners.delete(fn); };
}
function notifyEvent(event: ChatSocketEvent) { eventListeners.forEach(fn => fn(event)); }

export const chatSocketStore = {
  connect() {
    if (state.socket?.connected) return;
    const token = authStore.getToken();
    if (!token) return;

    if (state.socket) { state.socket.disconnect(); state.socket = null; }

    const socket = io(MEDIA_BASE, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
    });
    state.socket = socket;

    socket.on('connect', () => { state.connected = true; notify(); });
    socket.on('disconnect', () => { state.connected = false; notify(); });

    socket.on('chat_message', (data: { conversationId: string; message: DirectMessage }) => {
      notifyEvent({ type: 'message', ...data });
    });
    socket.on('chat_typing', (data: { conversationId: string; userId: string; isTyping: boolean }) => {
      notifyEvent({ type: 'typing', ...data });
    });
    socket.on('chat_read', (data: { conversationId: string; readBy: string }) => {
      notifyEvent({ type: 'read', ...data });
    });
    socket.on('chat_request_accepted', (data: { conversationId: string }) => {
      notifyEvent({ type: 'request_accepted', ...data });
    });
    socket.on('chat_request_rejected', (data: { conversationId: string }) => {
      notifyEvent({ type: 'request_rejected', ...data });
    });
    socket.on('chat_error', (data: { conversationId: string; message: string }) => {
      notifyEvent({ type: 'error', ...data });
    });
  },

  reconnect() {
    if (state.socket) { state.socket.disconnect(); state.socket = null; }
    state.connected = false;
    this.connect();
  },

  disconnect() {
    if (state.socket) { state.socket.disconnect(); state.socket = null; }
    state.connected = false;
    notify();
  },

  sendMessage(conversationId: string, text: string) {
    state.socket?.emit('chat_send_message', { conversationId, text, type: 'text' });
  },
  sendSticker(conversationId: string, stickerId: string) {
    state.socket?.emit('chat_send_message', { conversationId, type: 'sticker', stickerId });
  },
  setTyping(conversationId: string, isTyping: boolean) {
    state.socket?.emit('chat_typing', { conversationId, isTyping });
  },
};
