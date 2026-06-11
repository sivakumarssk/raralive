import { io, type Socket } from 'socket.io-client';

import { MEDIA_BASE } from '@/services/api';
import { authStore } from '@/store/auth-store';
import type { ChatMessage } from '@/screens/room-detail/room-detail.data';
import type { SeatSlot, HostStatus, IncomingSeatRequest, SeatRequestResult } from '@/hooks/useRoomSocket';

type SocketState = {
  socket: Socket | null;
  roomId: string | null;
  messages: ChatMessage[];
  onlineCount: number;
  connected: boolean;
  seats: SeatSlot[];
  hostStatus: HostStatus;
  incomingRequest: IncomingSeatRequest | null;
  seatRequestResult: SeatRequestResult | null;
  roomLevel: number;
};

const state: SocketState = {
  socket: null,
  roomId: null,
  messages: [],
  onlineCount: 0,
  connected: false,
  seats: [],
  hostStatus: { isOnline: false, userName: 'Host', avatarUrl: null },
  incomingRequest: null,
  seatRequestResult: null,
  roomLevel: 0,
};

const listeners = new Set<() => void>();
function notify() { listeners.forEach(fn => fn()); }

const walletBalanceListeners = new Set<(coins: number) => void>();
const giftErrorListeners = new Set<(message: string) => void>();
const levelUpListeners = new Set<(level: number) => void>();
const taskCompletedListeners = new Set<(data: { task_id: string; title: string; reward_bg_url: string | null; reward_frame_url: string | null }) => void>();
const rewardAppliedListeners = new Set<(data: { reward_bg_url: string | null; reward_frame_url: string | null }) => void>();

export function onWalletUpdate(fn: (coins: number) => void) {
  walletBalanceListeners.add(fn);
  return () => walletBalanceListeners.delete(fn);
}
export function onGiftError(fn: (message: string) => void) {
  giftErrorListeners.add(fn);
  return () => { giftErrorListeners.delete(fn); };
}
export function onLevelUp(fn: (level: number) => void) {
  levelUpListeners.add(fn);
  return () => { levelUpListeners.delete(fn); };
}
export function onTaskCompleted(fn: (data: { task_id: string; title: string; reward_bg_url: string | null; reward_frame_url: string | null }) => void) {
  taskCompletedListeners.add(fn);
  return () => { taskCompletedListeners.delete(fn); };
}
export function onRewardApplied(fn: (data: { reward_bg_url: string | null; reward_frame_url: string | null }) => void) {
  rewardAppliedListeners.add(fn);
  return () => { rewardAppliedListeners.delete(fn); };
}

function resolveAvatarUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${MEDIA_BASE}/${url.replace(/^\//, '')}`;
}

const GIFT_RE = /^__gift__(.+)__to__(.+)__img__(.*)__bg__([^_]*)(.*)$/;

function resolveMessageAvatar(msg: ChatMessage): ChatMessage {
  const resolved = msg.user
    ? { ...msg, user: { ...msg.user, avatarUri: resolveAvatarUrl(msg.user.avatarUri) } }
    : msg;

  // Parse gift messages encoded as plain text
  if (resolved.type === 'message' && resolved.text) {
    const m = resolved.text.match(GIFT_RE);
    if (m) {
      const tail = m[5] ?? '';
      const coinsMatch = tail.match(/__coins__(\d+)/);
      const qtyMatch   = tail.match(/__qty__(\d+)/);
      const recipMatch = tail.match(/__recipientid__([^_]+)/);
      const coins = coinsMatch ? parseInt(coinsMatch[1], 10) : 0;
      const qty   = qtyMatch   ? parseInt(qtyMatch[1],   10) : 1;
      return {
        ...resolved,
        type: 'gift',
        text: undefined,
        giftName: m[1],
        giftTo: m[2],
        giftImageUrl: m[3] || null,
        giftBgColor: m[4] || '#FFE9D4',
        giftCoins: coins,
        giftQty: qty,
        giftRecipientId: recipMatch ? recipMatch[1] : undefined,
      };
    }
  }
  return resolved;
}

export function subscribeSocket(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function getSocketState(): SocketState {
  return { ...state, messages: [...state.messages], seats: [...state.seats] };
}

export const socketStore = {
  requestRoomState(roomId: string) {
    // Re-request room state without rejoining — triggers server to re-broadcast host_status, seats, online_count
    if (state.socket?.connected && state.roomId === roomId) {
      state.socket.emit('join_room', { roomId });
    }
  },

  join(roomId: string) {
    // Already in this room with active socket — do nothing
    if (state.socket?.connected && state.roomId === roomId) return;

    // Clean up previous socket if different room
    if (state.socket) {
      state.socket.disconnect();
      state.socket = null;
    }

    const token = authStore.getToken();
    if (!token) return;

    const socket = io(MEDIA_BASE, {
      auth: { token },
      transports: ['websocket'],
    });

    state.socket = socket;
    state.roomId = roomId;

    socket.on('connect', () => {
      state.connected = true;
      socket.emit('join_room', { roomId });
      notify();
    });

    socket.on('disconnect', () => {
      state.connected = false;
      notify();
    });

    socket.on('chat_history', (history: ChatMessage[]) => {
      state.messages = history.map(resolveMessageAvatar);
      notify();
    });

    socket.on('chat_message', (msg: ChatMessage) => {
      state.messages = [...state.messages, resolveMessageAvatar(msg)];
      notify();
    });

    socket.on('wallet_update', ({ coins }: { coins: number }) => {
      walletBalanceListeners.forEach(fn => fn(coins));
    });

    socket.on('gift_error', ({ message }: { message: string }) => {
      giftErrorListeners.forEach(fn => fn(message));
    });

    socket.on('room_level_up', ({ level }: { level: number }) => {
      state.roomLevel = level;
      levelUpListeners.forEach(fn => fn(level));
      notify();
    });

    socket.on('task_completed', (data: { task_id: string; title: string; reward_bg_url: string | null; reward_frame_url: string | null }) => {
      console.log('[SOCKET] task_completed received:', JSON.stringify(data));
      taskCompletedListeners.forEach(fn => fn(data));
    });

    socket.on('reward_applied', (data: { reward_bg_url: string | null; reward_frame_url: string | null }) => {
      console.log('[SOCKET] reward_applied received:', JSON.stringify(data));
      rewardAppliedListeners.forEach(fn => fn(data));
    });

    socket.on('online_count', ({ count }: { count: number }) => {
      state.onlineCount = count;
      notify();
    });

    socket.on('seats_update', (updatedSeats: SeatSlot[]) => {
      state.seats = updatedSeats;
      notify();
    });

    socket.on('host_status', (status: HostStatus) => {
      state.hostStatus = status;
      notify();
    });

    socket.on('incoming_seat_request', (req: IncomingSeatRequest) => {
      state.incomingRequest = req;
      notify();
    });

    socket.on('seat_request_result', (result: SeatRequestResult) => {
      state.seatRequestResult = result;
      notify();
    });
  },

  leave() {
    if (state.socket) {
      state.socket.disconnect();
      state.socket = null;
    }
    state.roomId = null;
    state.messages = [];
    state.onlineCount = 0;
    state.connected = false;
    state.seats = [];
    state.hostStatus = { isOnline: false, userName: 'Host', avatarUrl: null };
    state.incomingRequest = null;
    state.seatRequestResult = null;
    notify();
  },

  sendMessage(roomId: string, text: string) {
    state.socket?.emit('send_message', { roomId, text });
  },

  requestSeat(roomId: string, slotIndex: number) {
    state.socket?.emit('request_seat', { roomId, slotIndex });
  },

  acceptSeatRequest(roomId: string, req: IncomingSeatRequest) {
    state.socket?.emit('accept_seat', {
      roomId,
      slotIndex: req.slotIndex,
      toUserId: req.fromUserId,
      toSocketId: req.fromSocketId,
      toUserName: req.fromUserName,
      toAvatarUrl: req.fromAvatarUrl,
    });
    state.incomingRequest = null;
    notify();
  },

  rejectSeatRequest(roomId: string, req: IncomingSeatRequest) {
    state.socket?.emit('reject_seat', {
      roomId,
      slotIndex: req.slotIndex,
      toSocketId: req.fromSocketId,
    });
    state.incomingRequest = null;
    notify();
  },

  clearSeatRequestResult() {
    state.seatRequestResult = null;
    notify();
  },
};
