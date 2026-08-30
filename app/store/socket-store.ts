import { io, type Socket } from 'socket.io-client';

import { BASE_URL, MEDIA_BASE } from '@/services/api';
import { authStore } from '@/store/auth-store';
import { getUserLevel } from '@/utils/userLevel';
import type { ChatMessage } from '@/screens/room-detail/room-detail.data';
import type { SeatSlot, HostStatus, IncomingSeatRequest, SeatRequestResult } from '@/hooks/useRoomSocket';

export type IncomingStageInvite = {
  slotIndex: number;
  hostSocketId: string;
  hostName: string;
  hostAvatarUrl: string | null;
};

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
  incomingStageInvite: IncomingStageInvite | null;
  roomLevel: number;
  myCoinsSpent: number;
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
  incomingStageInvite: null,
  roomLevel: 0,
  myCoinsSpent: 0,
};

const listeners = new Set<() => void>();
function notify() { listeners.forEach(fn => fn()); }

const walletBalanceListeners = new Set<(coins: number) => void>();
const coinsGiftedListeners = new Set<(coinsGifted: number) => void>();
const giftErrorListeners = new Set<(message: string) => void>();
const joinBlockedListeners = new Set<(message: string) => void>();
const kickedListeners = new Set<(message: string) => void>();
const reopenBattleListeners = new Set<() => void>();
const levelUpListeners = new Set<(level: number) => void>();
const taskCompletedListeners = new Set<(data: { task_id: string; title: string; reward_bg_url: string | null; reward_frame_url: string | null }) => void>();
const rewardAppliedListeners = new Set<(data: { reward_bg_url: string | null; reward_frame_url: string | null; completed_by?: string; task_title?: string }) => void>();

export type BattleInvitePayload = {
  invite_id: string;
  from_room_id: string;
  from_room_name: string;
  from_room_image_url: string | null;
  duration_minutes: number;
};
const battleInviteListeners = new Set<(data: BattleInvitePayload) => void>();
const battleInviteAcceptedListeners = new Set<(data: { invite_id: string; to_room_name: string }) => void>();
const battleInviteDeclinedListeners = new Set<(data: { invite_id: string; to_room_name: string }) => void>();
const battleInviteCancelledListeners = new Set<(data: { invite_id: string; from_room_name: string }) => void>();
const battleScoresListeners = new Set<(data: { invite_id: string; left: number; right: number }) => void>();
const battleStartedListeners = new Set<(data: { invite_id: string; from_room_id: string; to_room_id: string }) => void>();
const removedFromStageListeners = new Set<() => void>();
const broadcastLikesListeners = new Set<(likesCount: number) => void>();
const broadcastLikeStateListeners = new Set<(liked: boolean) => void>();
const pinnedCommentListeners = new Set<(messageId: string | null) => void>();
const commentDeletedListeners = new Set<(messageId: string) => void>();
const reportCommentResultListeners = new Set<(ok: boolean) => void>();

export function onWalletUpdate(fn: (coins: number) => void) {
  walletBalanceListeners.add(fn);
  return () => walletBalanceListeners.delete(fn);
}
export function onCoinsGiftedUpdate(fn: (coinsGifted: number) => void) {
  coinsGiftedListeners.add(fn);
  return () => coinsGiftedListeners.delete(fn);
}
export function getMyCoinsGifted() { return state.myCoinsSpent; }
export function onGiftError(fn: (message: string) => void) {
  giftErrorListeners.add(fn);
  return () => { giftErrorListeners.delete(fn); };
}
export function onJoinBlocked(fn: (message: string) => void) {
  joinBlockedListeners.add(fn);
  return () => { joinBlockedListeners.delete(fn); };
}
export function onKickedFromRoom(fn: (message: string) => void) {
  kickedListeners.add(fn);
  return () => { kickedListeners.delete(fn); };
}
export function onReopenBattle(fn: () => void) {
  reopenBattleListeners.add(fn);
  return () => { reopenBattleListeners.delete(fn); };
}
export function triggerReopenBattle() {
  reopenBattleListeners.forEach(fn => fn());
}
export function onLevelUp(fn: (level: number) => void) {
  levelUpListeners.add(fn);
  return () => { levelUpListeners.delete(fn); };
}
export function onTaskCompleted(fn: (data: { task_id: string; title: string; reward_bg_url: string | null; reward_frame_url: string | null }) => void) {
  taskCompletedListeners.add(fn);
  return () => { taskCompletedListeners.delete(fn); };
}
export function onRewardApplied(fn: (data: { reward_bg_url: string | null; reward_frame_url: string | null; completed_by?: string; task_title?: string }) => void) {
  rewardAppliedListeners.add(fn);
  return () => { rewardAppliedListeners.delete(fn); };
}
export function onBattleInvite(fn: (data: BattleInvitePayload) => void) {
  battleInviteListeners.add(fn);
  return () => { battleInviteListeners.delete(fn); };
}
export function onBattleInviteAccepted(fn: (data: { invite_id: string; to_room_name: string }) => void) {
  battleInviteAcceptedListeners.add(fn);
  return () => { battleInviteAcceptedListeners.delete(fn); };
}
export function onBattleInviteDeclined(fn: (data: { invite_id: string; to_room_name: string }) => void) {
  battleInviteDeclinedListeners.add(fn);
  return () => { battleInviteDeclinedListeners.delete(fn); };
}
export function onBattleInviteCancelled(fn: (data: { invite_id: string; from_room_name: string }) => void) {
  battleInviteCancelledListeners.add(fn);
  return () => { battleInviteCancelledListeners.delete(fn); };
}
export function onBattleScores(fn: (data: { invite_id: string; left: number; right: number }) => void) {
  battleScoresListeners.add(fn);
  return () => { battleScoresListeners.delete(fn); };
}
export function onBattleStarted(fn: (data: { invite_id: string; from_room_id: string; to_room_id: string }) => void) {
  battleStartedListeners.add(fn);
  return () => { battleStartedListeners.delete(fn); };
}
export function onRemovedFromStage(fn: () => void) {
  removedFromStageListeners.add(fn);
  return () => { removedFromStageListeners.delete(fn); };
}
export function onBroadcastLikesUpdate(fn: (likesCount: number) => void) {
  broadcastLikesListeners.add(fn);
  return () => { broadcastLikesListeners.delete(fn); };
}
export function onBroadcastLikeState(fn: (liked: boolean) => void) {
  broadcastLikeStateListeners.add(fn);
  return () => { broadcastLikeStateListeners.delete(fn); };
}
export function onPinnedCommentUpdate(fn: (messageId: string | null) => void) {
  pinnedCommentListeners.add(fn);
  return () => { pinnedCommentListeners.delete(fn); };
}
export function onCommentDeleted(fn: (messageId: string) => void) {
  commentDeletedListeners.add(fn);
  return () => { commentDeletedListeners.delete(fn); };
}
export function onReportCommentResult(fn: (ok: boolean) => void) {
  reportCommentResultListeners.add(fn);
  return () => { reportCommentResultListeners.delete(fn); };
}

function resolveAvatarUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${MEDIA_BASE}/${url.replace(/^\//, '')}`;
}

const GIFT_RE = /^__gift__(.+)__to__(.+)__img__(.*)__bg__([^_]*)(.*)$/;

async function fetchMyCoinsSpent() {
  const token = authStore.getToken();
  if (!token) return;
  try {
    const res = await fetch(`${BASE_URL}/wallet/me`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    console.log('[Socket] /wallet/me response:', JSON.stringify(json?.data));
    if (json.success) {
      const d = json.data;
      const spent = d.coins_gifted ?? d.coins_spent ?? d.coinsSpent ?? 0;
      console.log('[Socket] coins_gifted:', d.coins_gifted, 'resolved:', spent, '→ level:', getUserLevel(spent));
      setMyCoinsSpent(spent);
    }
  } catch (e) {
    console.log('[Socket] fetchMyCoinsSpent error:', e);
  }
}

export function setMyCoinsSpent(coins: number) {
  state.myCoinsSpent = coins;
  const myId = authStore.getUserId();
  const myUser = authStore.getUser();
  const myNames = [myUser?.fullName, myUser?.username].filter(Boolean);
  const myLevel = getUserLevel(coins);
  console.log('[Socket] setMyCoinsSpent:', coins, '→ level:', myLevel, 'myNames:', myNames);
  // Re-patch level on ALL existing messages from current user
  state.messages = state.messages.map(m => {
    const isMe = (m.user?.id && m.user.id === myId) ||
                 (!m.user?.id && !!m.user?.name && myNames.includes(m.user.name));
    return isMe ? { ...m, user: { ...m.user!, level: myLevel } } : m;
  });
  // Notify all useUserLevel hooks
  coinsGiftedListeners.forEach(fn => fn(coins));
  notify();
}

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
      fetchMyCoinsSpent();
      notify();
    });

    socket.on('disconnect', () => {
      state.connected = false;
      notify();
    });

    socket.on('join_blocked', ({ message }: { message: string }) => {
      joinBlockedListeners.forEach(fn => fn(message));
    });

    socket.on('kicked_from_room', ({ message }: { message: string }) => {
      kickedListeners.forEach(fn => fn(message));
    });

    socket.on('chat_history', (history: ChatMessage[]) => {
      const resolved = history.map(resolveMessageAvatar);
      // Deduplicate by ID
      const seen = new Set<string>();
      state.messages = resolved.filter(m => {
        if (!m.id || seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
      notify();
    });

    socket.on('chat_message', (msg: ChatMessage) => {
      // Deduplicate — skip if message ID already exists
      if (msg.id && state.messages.some(m => m.id === msg.id)) return;

      let resolved = resolveMessageAvatar(msg);
      const myId = authStore.getUserId();
      const myUser = authStore.getUser();
      const myNames = [myUser?.fullName, myUser?.username].filter(Boolean);
      const isMe = (resolved.user?.id && resolved.user.id === myId) ||
                   (!resolved.user?.id && !!resolved.user?.name && myNames.includes(resolved.user.name));
      if (isMe) {
        const myLevel = getUserLevel(state.myCoinsSpent);
        resolved = { ...resolved, user: { ...resolved.user!, level: myLevel } };
      }
      state.messages = [...state.messages, resolved];
      notify();
    });

    socket.on('wallet_update', ({ coins }: { coins: number }) => {
      walletBalanceListeners.forEach(fn => fn(coins));
      // Re-fetch coins_gifted so level updates in real-time after every gift
      fetchMyCoinsSpent();
    });

    socket.on('user_level_update', ({ coins_spent }: { coins_spent: number }) => {
      setMyCoinsSpent(coins_spent);
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

    socket.on('reward_applied', (data: { reward_bg_url: string | null; reward_frame_url: string | null; completed_by?: string; task_title?: string }) => {
      rewardAppliedListeners.forEach(fn => fn(data));
    });

    socket.on('battle_invite', (data: BattleInvitePayload) => {
      battleInviteListeners.forEach(fn => fn(data));
    });

    socket.on('battle_invite_accepted', (data: { invite_id: string; to_room_name: string }) => {
      battleInviteAcceptedListeners.forEach(fn => fn(data));
    });

    socket.on('battle_invite_declined', (data: { invite_id: string; to_room_name: string }) => {
      battleInviteDeclinedListeners.forEach(fn => fn(data));
    });

    socket.on('battle_invite_cancelled', (data: { invite_id: string; from_room_name: string }) => {
      battleInviteCancelledListeners.forEach(fn => fn(data));
    });

    socket.on('battle_scores', (data: { invite_id: string; left: number; right: number }) => {
      battleScoresListeners.forEach(fn => fn(data));
    });

    socket.on('battle_started', (data: { invite_id: string; from_room_id: string; to_room_id: string }) => {
      battleStartedListeners.forEach(fn => fn(data));
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

    socket.on('incoming_stage_invite', (invite: IncomingStageInvite) => {
      state.incomingStageInvite = invite;
      notify();
    });

    socket.on('removed_from_stage', () => {
      removedFromStageListeners.forEach(fn => fn());
    });

    socket.on('broadcast_likes_update', ({ likesCount }: { roomId: string; likesCount: number }) => {
      broadcastLikesListeners.forEach(fn => fn(likesCount));
    });

    socket.on('broadcast_like_state', ({ liked }: { roomId: string; liked: boolean }) => {
      broadcastLikeStateListeners.forEach(fn => fn(liked));
    });

    socket.on('pinned_comment_update', ({ messageId }: { roomId: string; messageId: string | null }) => {
      pinnedCommentListeners.forEach(fn => fn(messageId));
    });

    socket.on('comment_deleted', ({ messageId }: { roomId: string; messageId: string }) => {
      state.messages = state.messages.filter(m => m.id !== messageId);
      notify();
      commentDeletedListeners.forEach(fn => fn(messageId));
    });

    socket.on('report_comment_result', ({ ok }: { ok: boolean }) => {
      reportCommentResultListeners.forEach(fn => fn(ok));
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
    state.incomingStageInvite = null;
    notify();
  },

  emitMuteState(isMuted: boolean) {
    const roomId = state.roomId;
    if (!roomId) return;
    state.socket?.emit('user_mute', { roomId, isMuted });
  },

  likeBroadcast(roomId: string) {
    state.socket?.emit('like_broadcast', { roomId });
  },

  pinComment(roomId: string, messageId: string) {
    state.socket?.emit('pin_comment', { roomId, messageId });
  },

  unpinComment(roomId: string) {
    state.socket?.emit('unpin_comment', { roomId });
  },

  deleteComment(roomId: string, messageId: string) {
    state.socket?.emit('delete_comment', { roomId, messageId });
  },

  reportComment(roomId: string, messageId: string, messageText: string, reportedUserId?: string, reason?: string) {
    state.socket?.emit('report_comment', { roomId, messageId, messageText, reportedUserId, reason });
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

  inviteToStage(roomId: string, toUserId: string, slotIndex: number) {
    state.socket?.emit('invite_to_stage', { roomId, toUserId, slotIndex });
  },

  acceptStageInvite(roomId: string, slotIndex: number, hostSocketId: string) {
    state.socket?.emit('accept_stage_invite', { roomId, slotIndex, hostSocketId });
    state.incomingStageInvite = null;
    notify();
  },

  rejectStageInvite(roomId: string, hostSocketId: string) {
    state.socket?.emit('reject_stage_invite', { roomId, hostSocketId });
    state.incomingStageInvite = null;
    notify();
  },

  clearStageInvite() {
    state.incomingStageInvite = null;
    notify();
  },

  leaveStage(roomId: string) {
    state.socket?.emit('leave_stage', { roomId });
  },

  removeFromStage(roomId: string, slotIndex: number) {
    state.socket?.emit('remove_from_stage', { roomId, slotIndex });
  },

  clearSeatRequestResult() {
    state.seatRequestResult = null;
    notify();
  },
};
