import { io, type Socket } from 'socket.io-client';

import { MEDIA_BASE, triggerSessionRevoked, type DirectMessage } from '@/services/api';
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
  | { type: 'error'; conversationId: string; message: string }
  | { type: 'online_status'; userId: string; isOnline: boolean; lastSeenAt: string | null }
  | { type: 'block_status'; conversationId: string; blocked: boolean }
  | { type: 'live_broadcast_started'; broadcastId: string; roomId: string; hostUserId: string }
  | { type: 'live_broadcast_ended'; broadcastId: string; roomId: string; hostUserId: string }
  | { type: 'agency_wallet_balance'; agencyId: string; balance: number }
  | { type: 'moderation_warning'; id: string; message: string; createdAt: string };

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

    socket.on('connect', () => {
      state.connected = true;
      notify();
      // Warnings issued while we were offline come back on this request
      socket.emit('moderation_sync');
    });
    socket.on('disconnect', () => { state.connected = false; notify(); });
    // "Log out of all devices" from another device: told live, or refused on reconnect.
    socket.on('session_revoked', () => triggerSessionRevoked());
    socket.on('connect_error', (err) => { if (err.message === 'Session revoked') triggerSessionRevoked(); });

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
    // The other person blocked / unblocked me — the conversation screen swaps
    // its input for a "You can't send messages" bar (or back).
    socket.on('chat_block_status', (data: { conversationId: string; blocked: boolean }) => {
      notifyEvent({ type: 'block_status', ...data });
    });

    // Online status — reuses the same app-wide presence system as Friend Zone
    // (every socket already receives this broadcast; there's nothing chat-specific
    // to it). 'chat_online_status' is the one-off reply to checkOnline() below.
    socket.on('friend_zone_user_status', (data: { userId: string; isOnline: boolean }) => {
      notifyEvent({ type: 'online_status', userId: data.userId, isOnline: data.isOnline, lastSeenAt: null });
    });
    socket.on('chat_online_status', (data: { userId: string; isOnline: boolean; lastSeenAt: string | null }) => {
      notifyEvent({ type: 'online_status', ...data });
    });

    // Live Now grid — real-time add/remove as broadcasts start/end, instead of
    // relying on the user to pull-to-refresh (which left ended broadcasts
    // visible/joinable until the next manual refresh).
    socket.on('live_broadcast_started', (data: { broadcastId: string; roomId: string; hostUserId: string }) => {
      notifyEvent({ type: 'live_broadcast_started', ...data });
    });
    socket.on('live_broadcast_ended', (data: { broadcastId: string; roomId: string; hostUserId: string }) => {
      notifyEvent({ type: 'live_broadcast_ended', ...data });
    });
    // 5 different people reported this user — a warning from the server
    socket.on('moderation_warning', (data: { id: string; message: string; createdAt: string }) => {
      notifyEvent({ type: 'moderation_warning', id: data.id, message: data.message, createdAt: data.createdAt });
    });
    // Agency account: its agency's coin balance changed (credited or spent)
    socket.on('agency_wallet_balance', (data: { agencyId: string; balance: number }) => {
      notifyEvent({ type: 'agency_wallet_balance', agencyId: data.agencyId, balance: Number(data.balance) || 0 });
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
  checkOnline(userId: string) {
    state.socket?.emit('chat_check_online', { userId });
  },
};
