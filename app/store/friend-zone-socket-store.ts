import { AppState, type AppStateStatus } from 'react-native';
import { io, type Socket } from 'socket.io-client';

import { MEDIA_BASE } from '@/services/api';
import { authStore } from '@/store/auth-store';

// Persistent, app-wide socket connection — independent of the room-scoped
// socket in socket-store.ts. Stays alive across every screen so Friend Zone
// online/offline + call-toggle state stays live regardless of what the user
// is currently viewing.

type OnlineMap = Record<string, boolean>;
type TogglesMap = Record<string, { receiveCalls?: boolean; videoCalls?: boolean }>;

export type FriendZoneCallPeer = { id: string; full_name: string | null; username: string | null; avatar_url: string | null };
export type FriendZoneCallGift = {
  callId: string; id: string; senderId: string; recipientId: string;
  giftId: string; giftName: string; giftImageUrl: string | null; coins: number; qty: number;
};
export type FriendZoneCallMessage = { callId: string; id: string; senderId: string; text: string };
export type FriendZoneCallEvent =
  | { type: 'incoming_invite'; callId: string; channelName: string; callType: 'audio' | 'video'; caller: FriendZoneCallPeer }
  | { type: 'outgoing_ringing'; callId: string; channelName: string; callType: 'audio' | 'video'; callee: FriendZoneCallPeer }
  | { type: 'accepted'; callId: string }
  | { type: 'ended'; callId: string; reason: string; durationSeconds?: number }
  | { type: 'failed'; reason: string }
  | { type: 'low_balance'; callId: string; secondsLeft: number }
  | { type: 'charged'; callId: string; coins: number; totalCoins: number }
  | { type: 'earned'; callId: string; gems: number; totalGems: number }
  | { type: 'call_gift'; gift: FriendZoneCallGift }
  | { type: 'call_message'; message: FriendZoneCallMessage }
  | { type: 'call_gift_error'; message: string };

const state = {
  socket: null as Socket | null,
  connected: false,
  online: {} as OnlineMap,
  toggles: {} as TogglesMap,
};

const callListeners = new Set<(event: FriendZoneCallEvent) => void>();
function notifyCall(event: FriendZoneCallEvent) { callListeners.forEach(fn => fn(event)); }
export function subscribeFriendZoneCallEvents(fn: (event: FriendZoneCallEvent) => void): () => void {
  callListeners.add(fn);
  return () => { callListeners.delete(fn); };
}

const listeners = new Set<() => void>();
function notify() { listeners.forEach(fn => fn()); }

export function subscribeFriendZoneSocket(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function getFriendZoneSocketState() {
  return { connected: state.connected, online: { ...state.online }, toggles: { ...state.toggles } };
}

export const friendZoneSocketStore = {
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
      console.log('[FZ-SOCKET] connected, socket.id=', socket.id);
      // Re-request the current presence/toggle snapshot right after (re)connecting,
      // so a client that missed broadcasts while backgrounded/offline catches up.
      socket.emit('friend_zone_resync');
      notify();
    });
    socket.on('connect_error', (err) => {
      console.log('[FZ-SOCKET] connect_error:', err.message);
    });
    socket.on('disconnect', (reason) => { state.connected = false; console.log('[FZ-SOCKET] disconnected, reason=', reason); notify(); });

    socket.on('friend_zone_user_status', ({ userId, isOnline }: { userId: string; isOnline: boolean }) => {
      console.log('[FZ-SOCKET] friend_zone_user_status', userId, isOnline);
      state.online = { ...state.online, [userId]: isOnline };
      notify();
    });

    socket.on('friend_zone_toggles_changed', (data: { userId: string; receiveCalls?: boolean; videoCalls?: boolean }) => {
      state.toggles = {
        ...state.toggles,
        [data.userId]: { receiveCalls: data.receiveCalls, videoCalls: data.videoCalls },
      };
      notify();
    });

    socket.on('friend_zone_snapshot', (data: { online: OnlineMap; toggles: TogglesMap }) => {
      state.online = data.online;
      state.toggles = data.toggles;
      notify();
    });

    // ── Call signaling ────────────────────────────────────────────────────
    socket.on('friend_zone_call_invite', (data: { callId: string; channelName: string; callType: 'audio' | 'video'; caller: FriendZoneCallPeer }) => {
      notifyCall({ type: 'incoming_invite', ...data });
    });
    socket.on('friend_zone_call_ringing', (data: { callId: string; channelName: string; callType: 'audio' | 'video'; callee: FriendZoneCallPeer }) => {
      notifyCall({ type: 'outgoing_ringing', ...data });
    });
    socket.on('friend_zone_call_accepted', (data: { callId: string }) => {
      notifyCall({ type: 'accepted', ...data });
    });
    socket.on('friend_zone_call_ended', (data: { callId: string; reason: string; durationSeconds?: number }) => {
      notifyCall({ type: 'ended', ...data });
    });
    socket.on('friend_zone_call_failed', (data: { reason: string }) => {
      notifyCall({ type: 'failed', ...data });
    });
    socket.on('friend_zone_call_low_balance', (data: { callId: string; secondsLeft: number }) => {
      notifyCall({ type: 'low_balance', ...data });
    });
    socket.on('friend_zone_call_charged', (data: { callId: string; coins: number; totalCoins: number }) => {
      notifyCall({ type: 'charged', ...data });
    });
    socket.on('friend_zone_call_earned', (data: { callId: string; gems: number; totalGems: number }) => {
      notifyCall({ type: 'earned', ...data });
    });
    socket.on('friend_zone_call_gift', (data: FriendZoneCallGift) => {
      notifyCall({ type: 'call_gift', gift: data });
    });
    socket.on('friend_zone_call_message', (data: FriendZoneCallMessage) => {
      notifyCall({ type: 'call_message', message: data });
    });
    socket.on('friend_zone_call_gift_error', (data: { message: string }) => {
      notifyCall({ type: 'call_gift_error', message: data.message });
    });
  },

  // Force a fresh socket, even if the old one thinks it's still connected —
  // needed on app foreground since a suspended app's socket can go stale
  // without ever firing a 'disconnect' event.
  reconnect() {
    if (state.socket) { state.socket.disconnect(); state.socket = null; }
    state.connected = false;
    this.connect();
  },

  disconnect() {
    if (state.socket) { state.socket.disconnect(); state.socket = null; }
    state.connected = false;
    state.online = {};
    state.toggles = {};
    notify();
  },

  emitToggleUpdate(receiveCalls: boolean, videoCalls: boolean) {
    state.socket?.emit('friend_zone_toggle_update', { receiveCalls, videoCalls });
  },

  callInvite(calleeId: string, callType: 'audio' | 'video') {
    state.socket?.emit('friend_zone_call_invite', { calleeId, callType });
  },
  callAccept(callId: string) {
    state.socket?.emit('friend_zone_call_accept', { callId });
  },
  callReject(callId: string) {
    state.socket?.emit('friend_zone_call_reject', { callId });
  },
  callCancel(callId: string) {
    state.socket?.emit('friend_zone_call_cancel', { callId });
  },
  callEnd(callId: string) {
    state.socket?.emit('friend_zone_call_end', { callId });
  },
  callSendGift(callId: string, giftId: string, qty: number) {
    state.socket?.emit('friend_zone_call_send_gift', { callId, giftId, qty });
  },
  callSendMessage(callId: string, text: string) {
    state.socket?.emit('friend_zone_call_send_message', { callId, text });
  },
};

// A genuinely suspended app can lose its socket without ever firing
// 'disconnect', so passive reconnection logic never kicks in on its own —
// reconnect when the app comes back to the foreground. But AppState also
// flips background->active for things that are NOT a real suspension, most
// notably the OS permission dialog (e.g. the mic/camera prompt shown when
// starting a Friend Zone call) — the JS engine never actually stops running
// during that. Tearing down and recreating the socket in that case drops
// whatever the old socket was mid-handshake on (e.g. a call invite/accept
// in flight), which looked like the call "auto-declining." Only force a
// reconnect if the socket is actually not connected.
let appStateSub: { remove: () => void } | null = null;
let lastAppState: AppStateStatus = AppState.currentState;

export function startFriendZoneAppStateWatcher() {
  if (appStateSub) return;
  appStateSub = AppState.addEventListener('change', (next) => {
    console.log('[FZ-SOCKET] AppState change', lastAppState, '->', next);
    if (lastAppState.match(/inactive|background/) && next === 'active') {
      if (state.socket?.connected) {
        console.log('[FZ-SOCKET] foreground, socket still connected — skipping reconnect');
      } else {
        console.log('[FZ-SOCKET] forcing reconnect on foreground');
        friendZoneSocketStore.reconnect();
      }
    }
    lastAppState = next;
  });
}

export function stopFriendZoneAppStateWatcher() {
  appStateSub?.remove();
  appStateSub = null;
}
