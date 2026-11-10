import { io, type Socket } from 'socket.io-client';

import { BASE_URL, MEDIA_BASE } from '@/services/api';
import { authStore } from '@/store/auth-store';
import { speakingStore } from '@/store/speaking-store';
import { getUserLevel } from '@/utils/userLevel';
import type { ChatMessage } from '@/screens/room-detail/room-detail.data';
import type { SeatSlot, HostStatus, IncomingSeatRequest, SeatRequestResult } from '@/hooks/useRoomSocket';

export type IncomingStageInvite = {
  slotIndex: number;
  hostSocketId: string;
  hostName: string;
  hostAvatarUrl: string | null;
};

/** Room header data (GET /rooms/:id shape) — pushed by the server on join_room. */
export type RoomInfoSnapshot = { id: string; [key: string]: unknown };

/** A running battle, as the server sends it (battle_invites row + room names). */
export type ActiveBattle = {
  id: string;
  status: string;
  from_room_id: string;
  to_room_id: string;
  from_user_id: string;
  to_user_id: string;
  from_room_name: string;
  from_room_image_url: string | null;
  to_room_name: string;
  to_room_image_url: string | null;
  started_at: string | null;
  duration_minutes: number;
  mode?: 'normal' | 'gifting';
  from_host_name?: string | null;
  from_host_username?: string | null;
  to_host_name?: string | null;
  to_host_username?: string | null;
};

export type BattleGifter = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  total_coins: number;
};

export type BattleResultSide = {
  room_id: string;
  room_name: string;
  room_image_url: string | null;
  host_user_id: string;
  host_name: string | null;
  score: number;
  /** Top 3 supporters, highest first */
  supporters: BattleGifter[];
};

/** Final battle result (battle_ended) — sent when a battle is cancelled or its time runs out. winner null = draw. */
export type BattleResult = {
  invite_id: string;
  /** 'gifting' battles get their own result layout; missing = normal. */
  mode?: 'normal' | 'gifting';
  /** 'cancelled' (a host ended it) or 'time_up' (the timer ran out) */
  reason: 'cancelled' | 'time_up' | string;
  ended_by: string | null;
  /** When it ended (ISO); missing on results from an older server. */
  ended_at?: string;
  /** How long the battle ran (its timer), in seconds. */
  played_seconds?: number;
  winner: 'from' | 'to' | null;
  from: BattleResultSide;
  to: BattleResultSide;
  /** Built on this device from the last confirmed scores while the server confirms. */
  provisional?: boolean;
};

/** left = from_room, right = to_room (server convention). */
export type BattleState = {
  battle: ActiveBattle | null;
  gifters: { left: BattleGifter[]; right: BattleGifter[] };
  scores: { left: number; right: number } | null;
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
  roomInfo: RoomInfoSnapshot | null;
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
  roomInfo: null,
};

const EMPTY_BATTLE: BattleState = { battle: null, gifters: { left: [], right: [] }, scores: null };
// Replaced (never mutated) on change, so subscribers can skip re-rendering
// when the battle hasn't changed.
let battleState: BattleState = EMPTY_BATTLE;
let battleExpiryTimer: ReturnType<typeof setTimeout> | null = null;

export function getBattleEndsAt(battle: ActiveBattle): number | null {
  if (!battle.started_at) return null;
  return new Date(battle.started_at).getTime() + (battle.duration_minutes ?? 0) * 60_000;
}

export function getBattleState(): BattleState { return battleState; }

// Result of the battle that just ended in this room, until dismissed.
let battleResult: BattleResult | null = null;
export function getBattleResult(): BattleResult | null { return battleResult; }

// The result card shows for everyone in the room for 5 seconds after a battle
// ends, then closes by itself. The 5 seconds count from when the card first
// appears for that battle — the server's final result replacing the instant
// one shown on Cancel doesn't restart them, and a result arriving after its
// 5 seconds are up isn't shown again.
const BATTLE_RESULT_SHOW_MS = 5000;
let battleResultTimer: ReturnType<typeof setTimeout> | null = null;
let battleResultShown: { id: string; at: number } | null = null;

/** Puts the result on screen (caller notifies). */
function showBattleResult(result: BattleResult) {
  const now = Date.now();
  if (battleResultShown?.id !== result.invite_id) battleResultShown = { id: result.invite_id, at: now };
  const left = BATTLE_RESULT_SHOW_MS - (now - battleResultShown.at);
  if (left <= 0) return;
  battleResult = result;
  if (battleResultTimer) clearTimeout(battleResultTimer);
  battleResultTimer = setTimeout(() => {
    battleResultTimer = null;
    if (battleResult?.invite_id === result.invite_id) {
      clearBattleResult();
      notify();
    }
  }, left);
}

function clearBattleResult() {
  if (battleResultTimer) { clearTimeout(battleResultTimer); battleResultTimer = null; }
  battleResult = null;
}

// Battle score shown = the server's confirmed totals + this user's own gifts
// that are still on their way. A sent gift adds to the score the instant it's
// tapped; the server's battle_scores that first includes it carries its
// client_gift_id, and the pending entry is removed in that same update — so
// it's counted once, never twice and never dropped. A failed gift (gift_error)
// takes its pending amount back out.
type PendingGift = { inviteId: string; side: 'left' | 'right'; coins: number; timer: ReturnType<typeof setTimeout> };
const pendingGifts = new Map<string, PendingGift>();
// Only if the server never answers (lost connection) — a reconnect re-sends battle_state.
const PENDING_GIFT_TIMEOUT_MS = 20_000;
let serverScores: { left: number; right: number } | null = null;
let serverSeq = -1;   // seq of the totals in serverScores — older updates are ignored
let giftersSeq = -1;

function clearPendingGifts() {
  pendingGifts.forEach(g => clearTimeout(g.timer));
  pendingGifts.clear();
}

function settlePendingGift(clientGiftId: string | null | undefined): boolean {
  const g = clientGiftId ? pendingGifts.get(clientGiftId) : undefined;
  if (!g) return false;
  clearTimeout(g.timer);
  pendingGifts.delete(clientGiftId!);
  return true;
}

/** Recompute the displayed scores (confirmed + pending) into a new battleState. */
function publishScores() {
  const battle = battleState.battle;
  if (!battle) return;
  let left = serverScores?.left ?? 0;
  let right = serverScores?.right ?? 0;
  let hasPending = false;
  pendingGifts.forEach(g => {
    if (g.inviteId !== battle.id) return;
    hasPending = true;
    if (g.side === 'left') left += g.coins; else right += g.coins;
  });
  battleState = { ...battleState, scores: serverScores || hasPending ? { left, right } : null };
}

function setBattle(
  battle: ActiveBattle | null,
  gifters = EMPTY_BATTLE.gifters,
  scores: BattleState['scores'] = null,
  seq = -1,
) {
  if (battleExpiryTimer) { clearTimeout(battleExpiryTimer); battleExpiryTimer = null; }
  const endsAt = battle ? getBattleEndsAt(battle) : null;
  const valid = !!battle && battle.status === 'active'
    && (battle.from_room_id === state.roomId || battle.to_room_id === state.roomId)
    && endsAt !== null && endsAt > Date.now();
  // A fresh snapshot already holds every gift the server has counted
  clearPendingGifts();
  serverScores = valid ? scores : null;
  serverSeq = valid ? seq : -1;
  giftersSeq = serverSeq;
  battleState = valid ? { battle, gifters, scores } : EMPTY_BATTLE;
  // Drop the battle once its time is up. Re-armed in ≤30s steps — RN warns
  // about (and Android may not honour) single long timers.
  if (valid) {
    const check = () => {
      const left = endsAt! - Date.now();
      if (left <= 0) { battleExpiryTimer = null; setBattle(null); return; }
      battleExpiryTimer = setTimeout(check, Math.min(left, 30_000));
    };
    check();
  }
  notify();
}

// Last-known header data per room — seeded from the room list so a room's
// name/image/level render the moment it opens, refreshed by room_info.
const roomInfoCache = new Map<string, RoomInfoSnapshot>();
export function primeRoomInfo(room: RoomInfoSnapshot) {
  roomInfoCache.set(room.id, { ...roomInfoCache.get(room.id), ...room });
}
export function getCachedRoomInfo(roomId: string): RoomInfoSnapshot | null {
  return roomInfoCache.get(roomId) ?? null;
}

// A connected-but-not-joined socket opened ahead of time (from the room list),
// so tapping a room only has to send join_room instead of first doing the
// whole websocket + auth handshake.
let spare: { socket: Socket; token: string } | null = null;

function openSocket(token: string): Socket {
  return io(MEDIA_BASE, { auth: { token }, transports: ['websocket'] });
}

function takeSpare(token: string): Socket | null {
  const s = spare;
  spare = null;
  if (!s) return null;
  // Stale login, or the server refused it (auth errors don't auto-retry)
  if (s.token !== token || !s.socket.active) { s.socket.disconnect(); return null; }
  return s.socket;
}

function resetRoomState() {
  speakingStore.clear();
  state.roomId = null;
  state.messages = [];
  state.onlineCount = 0;
  state.connected = false;
  state.seats = [];
  state.hostStatus = { isOnline: false, userName: 'Host', avatarUrl: null };
  state.incomingRequest = null;
  state.seatRequestResult = null;
  state.incomingStageInvite = null;
  state.roomInfo = null;
  if (battleExpiryTimer) { clearTimeout(battleExpiryTimer); battleExpiryTimer = null; }
  clearPendingGifts();
  serverScores = null;
  serverSeq = -1;
  giftersSeq = -1;
  battleState = EMPTY_BATTLE;
  battleResult = null;
}

const listeners = new Set<() => void>();
function notify() { listeners.forEach(fn => fn()); }

const walletBalanceListeners = new Set<(coins: number) => void>();
const coinsGiftedListeners = new Set<(coinsGifted: number) => void>();
const giftErrorListeners = new Set<(message: string) => void>();
// Fired only for gifts arriving live (chat_message), never for chat_history replays.
const liveGiftListeners = new Set<(msg: ChatMessage) => void>();
// Someone entered the room — shown as a short welcome toast, not a chat line.
const userJoinedListeners = new Set<(msg: ChatMessage) => void>();
/** Why a room refused / removed us. kind: 'user_ban' | 'room_ban' | 'room_block'. */
export type RoomRestriction = { kind?: string; expiresAt?: string | null };
const joinBlockedListeners = new Set<(message: string, info: RoomRestriction) => void>();
const kickedListeners = new Set<(message: string, info: RoomRestriction) => void>();

/**
 * The server's restriction message, with when access comes back for a 24h ban
 * — e.g. "Your ID is banned for 24 hours" + "Access returns Oct 23, 10:30 PM".
 */
export function formatRestriction(message: string, expiresAt?: string | null): string {
  if (!expiresAt) return message;
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return message;
  const when = d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  return `${message}\n\nAccess returns ${when}`;
}
const reopenBattleListeners = new Set<() => void>();
const levelUpListeners = new Set<(level: number) => void>();
const taskCompletedListeners = new Set<(data: { task_id: string; title: string; reward_bg_url: string | null; reward_frame_url: string | null }) => void>();
/** Daily task reward visuals for the room; expires_at = when they're removed (24h after completion). */
export type RewardAppliedPayload = {
  reward_bg_url: string | null;
  reward_frame_url: string | null;
  completed_by?: string;
  task_title?: string;
  expires_at?: string | null;
};
const rewardAppliedListeners = new Set<(data: RewardAppliedPayload) => void>();

export type BattleInvitePayload = {
  invite_id: string;
  from_room_id: string;
  from_room_name: string;
  from_room_image_url: string | null;
  duration_minutes: number;
};
export type BattleInviteAcceptedPayload = { invite_id: string; to_room_name: string; battle?: ActiveBattle };
export type BattleStartedPayload = { invite_id: string; from_room_id: string; to_room_id: string; battle?: ActiveBattle };
const battleInviteListeners = new Set<(data: BattleInvitePayload) => void>();
const battleInviteAcceptedListeners = new Set<(data: BattleInviteAcceptedPayload) => void>();
const battleInviteDeclinedListeners = new Set<(data: { invite_id: string; to_room_name: string }) => void>();
const battleInviteCancelledListeners = new Set<(data: { invite_id: string; from_room_name: string }) => void>();
const battleScoresListeners = new Set<(data: { invite_id: string; left: number; right: number }) => void>();
const battleStartedListeners = new Set<(data: BattleStartedPayload) => void>();
const removedFromStageListeners = new Set<() => void>();
const forcedMuteListeners = new Set<(isMuted: boolean) => void>();
const broadcastLikesListeners = new Set<(likesCount: number) => void>();
const broadcastLikeStateListeners = new Set<(liked: boolean) => void>();
const pinnedCommentListeners = new Set<(messageId: string | null) => void>();
const commentDeletedListeners = new Set<(messageId: string) => void>();
export type ReportResult = { duplicate?: boolean; message?: string };
const reportCommentResultListeners = new Set<(ok: boolean, info: ReportResult) => void>();

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
export function onUserJoined(fn: (msg: ChatMessage) => void) {
  userJoinedListeners.add(fn);
  return () => { userJoinedListeners.delete(fn); };
}

export function onLiveGift(fn: (msg: ChatMessage) => void) {
  liveGiftListeners.add(fn);
  return () => { liveGiftListeners.delete(fn); };
}
export function onJoinBlocked(fn: (message: string, info: RoomRestriction) => void) {
  joinBlockedListeners.add(fn);
  return () => { joinBlockedListeners.delete(fn); };
}
export function onKickedFromRoom(fn: (message: string, info: RoomRestriction) => void) {
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
export function onRewardApplied(fn: (data: RewardAppliedPayload) => void) {
  rewardAppliedListeners.add(fn);
  return () => { rewardAppliedListeners.delete(fn); };
}
export function onBattleInvite(fn: (data: BattleInvitePayload) => void) {
  battleInviteListeners.add(fn);
  return () => { battleInviteListeners.delete(fn); };
}
export function onBattleInviteAccepted(fn: (data: BattleInviteAcceptedPayload) => void) {
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
export function onBattleStarted(fn: (data: BattleStartedPayload) => void) {
  battleStartedListeners.add(fn);
  return () => { battleStartedListeners.delete(fn); };
}
export function onRemovedFromStage(fn: () => void) {
  removedFromStageListeners.add(fn);
  return () => { removedFromStageListeners.delete(fn); };
}
export function onForcedMute(fn: (isMuted: boolean) => void) {
  forcedMuteListeners.add(fn);
  return () => { forcedMuteListeners.delete(fn); };
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
export function onReportCommentResult(fn: (ok: boolean, info: ReportResult) => void) {
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
      const giftIdMatch = tail.match(/__giftid__([^_]+)/);
      const forMatch   = tail.match(/__giftfor__([^_]+)/);
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
        giftId: giftIdMatch ? giftIdMatch[1] : undefined,
        giftForId: forMatch ? forMatch[1] : undefined,
      };
    }
  }
  return resolved;
}

export function subscribeSocket(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** The room the room socket is in (null when none) — cheap, no state copy. */
export function getActiveRoomId(): string | null {
  return state.roomId;
}

export function getSocketState(): SocketState {
  return { ...state, messages: [...state.messages], seats: [...state.seats] };
}

/** What the room profile card shows about someone (see get_profile_card). */
export type ProfileCard = {
  username: string | null;
  cover_url: string | null;
  followers_count: number;
  /** Lifetime coins gifted — their ID level. */
  coins_gifted: number;
  room_sent: number;
  room_received: number;
  is_following: boolean;
};

export const socketStore = {
  /** Profile card over the room socket; null when the socket isn't connected or doesn't answer. */
  requestProfileCard(roomId: string, userId: string): Promise<ProfileCard | null> {
    return new Promise(resolve => {
      const s = state.socket;
      if (!s?.connected) { resolve(null); return; }
      s.timeout(5000).emit('get_profile_card', { roomId, userId }, (err: Error | null, res?: { ok: boolean; card?: ProfileCard }) => {
        resolve(!err && res?.ok && res.card ? res.card : null);
      });
    });
  },

  /** "Refresh Room": re-sync chat, seats and host status without re-joining. */
  refreshRoom(roomId: string) {
    if (state.roomId !== roomId || !state.socket) return;
    if (state.socket.connected) state.socket.emit('refresh_room', { roomId });
    else state.socket.connect(); // reconnect re-joins and re-sends everything
  },

  requestRoomState(roomId: string) {
    // Re-request room state without rejoining — the server re-sends seats,
    // host status, chat, battle and room info (no join notice / toast).
    if (state.socket?.connected && state.roomId === roomId) {
      state.socket.emit('refresh_room', { roomId });
    }
  },

  /** Open a socket ahead of time so the next join() skips the handshake. */
  prewarm() {
    const token = authStore.getToken();
    if (spare && spare.token === token && spare.socket.active) return;
    if (spare) { spare.socket.disconnect(); spare = null; }
    if (!token) return;
    spare = { socket: openSocket(token), token };
  },

  join(roomId: string) {
    // Already in this room with active socket — do nothing
    if (state.socket?.connected && state.roomId === roomId) return;

    // Clean up previous socket if different room
    if (state.socket) {
      state.socket.disconnect();
      state.socket = null;
    }
    // Switching straight to another room (e.g. the battle opponent's) —
    // don't show the previous room's chat/seats/battle while the new one loads.
    if (state.roomId !== roomId) resetRoomState();

    const token = authStore.getToken();
    if (!token) return;

    const socket = takeSpare(token) ?? openSocket(token);

    state.socket = socket;
    state.roomId = roomId;

    // Cached header data (room list / last visit) until room_info arrives
    state.roomInfo = roomInfoCache.get(roomId) ?? null;

    const onConnect = () => {
      state.connected = true;
      socket.emit('join_room', { roomId });
      fetchMyCoinsSpent();
      notify();
    };
    socket.on('connect', onConnect);

    socket.on('disconnect', () => {
      state.connected = false;
      notify();
    });

    // Entry refused: blocked by the host, or a 24h report ban (ID or room)
    socket.on('join_blocked', ({ message, kind, expiresAt }: { message: string; kind?: string; expiresAt?: string | null }) => {
      joinBlockedListeners.forEach(fn => fn(message, { kind, expiresAt }));
    });

    socket.on('kicked_from_room', ({ message, kind, expiresAt }: { message: string; kind?: string; expiresAt?: string | null }) => {
      kickedListeners.forEach(fn => fn(message, { kind, expiresAt }));
    });

    socket.on('chat_history', (history: ChatMessage[]) => {
      const resolved = history.map(resolveMessageAvatar);
      // Deduplicate by ID
      const seen = new Set<string>();
      state.messages = resolved.filter(m => {
        // Join notices are transient (welcome toast) — never kept in the feed
        if (m.type === 'join') return false;
        if (!m.id || seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
      notify();
    });

    socket.on('chat_message', (msg: ChatMessage) => {
      // Direct messages (1:1 chat) are emitted on the same 'chat_message' event as
      // { conversationId, message } — those belong to chat-socket-store, not the
      // room chat. Without this guard they landed in the room feed with no
      // user/id and crashed ChatBubble.
      if (!msg || (msg as any).conversationId || !msg.type) return;
      // Deduplicate — skip if message ID already exists
      if (msg.id && state.messages.some(m => m.id === msg.id)) return;

      let resolved = resolveMessageAvatar(msg);
      if (resolved.type === 'join') {
        userJoinedListeners.forEach(fn => fn(resolved));
        return;
      }
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
      if (resolved.type === 'gift') liveGiftListeners.forEach(fn => fn(resolved));
    });

    socket.on('wallet_update', ({ coins }: { coins: number }) => {
      walletBalanceListeners.forEach(fn => fn(coins));
      // Re-fetch coins_gifted so level updates in real-time after every gift
      fetchMyCoinsSpent();
    });

    socket.on('user_level_update', ({ coins_spent }: { coins_spent: number }) => {
      setMyCoinsSpent(coins_spent);
    });

    socket.on('gift_error', ({ message, client_gift_id }: { message: string; client_gift_id?: string | null }) => {
      // Not paid for — take its optimistic battle score back out
      if (settlePendingGift(client_gift_id)) { publishScores(); notify(); }
      giftErrorListeners.forEach(fn => fn(message));
    });

    // Server finished with one of our gifts. Normally battle_scores already
    // settled it; this covers a gift that wasn't counted (e.g. battle just ended).
    socket.on('gift_ack', ({ client_gift_id }: { client_gift_id: string }) => {
      if (settlePendingGift(client_gift_id)) { publishScores(); notify(); }
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

    socket.on('reward_applied', (data: RewardAppliedPayload) => {
      rewardAppliedListeners.forEach(fn => fn(data));
    });

    socket.on('battle_invite', (data: BattleInvitePayload) => {
      battleInviteListeners.forEach(fn => fn(data));
    });

    socket.on('battle_invite_accepted', (data: BattleInviteAcceptedPayload) => {
      battleInviteAcceptedListeners.forEach(fn => fn(data));
    });

    socket.on('battle_invite_declined', (data: { invite_id: string; to_room_name: string }) => {
      battleInviteDeclinedListeners.forEach(fn => fn(data));
    });

    socket.on('battle_invite_cancelled', (data: { invite_id: string; from_room_name: string }) => {
      battleInviteCancelledListeners.forEach(fn => fn(data));
    });

    // Sent the moment any gift in either battle room is paid for. Totals are
    // cumulative; client_gift_id names the gift that produced this update.
    socket.on('battle_scores', (data: { invite_id: string; left: number; right: number; seq?: number; client_gift_id?: string | null }) => {
      if (battleState.battle?.id === data.invite_id) {
        // These totals include our pending gift → swap it for the confirmed
        // amount in one step, so the score never dips or double-counts.
        const settled = settlePendingGift(data.client_gift_id);
        const fresh = data.seq == null || data.seq >= serverSeq;
        if (fresh) {
          serverScores = { left: data.left, right: data.right };
          if (data.seq != null) serverSeq = data.seq;
        }
        if (fresh || settled) { publishScores(); notify(); }
      }
      battleScoresListeners.forEach(fn => fn(data));
    });

    socket.on('battle_gifters', (data: { invite_id: string; left: BattleGifter[]; right: BattleGifter[]; seq?: number }) => {
      if (battleState.battle?.id !== data.invite_id) return;
      if (data.seq != null) {
        if (data.seq < giftersSeq) return;
        giftersSeq = data.seq;
      }
      battleState = { ...battleState, gifters: { left: data.left ?? [], right: data.right ?? [] } };
      notify();
    });

    // Snapshot sent with join_room / refresh_room: the room's running battle or null
    socket.on('battle_state', (data: { roomId: string; battle: ActiveBattle | null; gifters?: BattleState['gifters']; scores?: BattleState['scores']; seq?: number }) => {
      if (data.roomId !== state.roomId) return;
      setBattle(data.battle, data.gifters ?? EMPTY_BATTLE.gifters, data.scores ?? null, data.seq ?? -1);
    });

    socket.on('battle_started', (data: BattleStartedPayload) => {
      if (data.battle) setBattle(data.battle);
      battleStartedListeners.forEach(fn => fn(data));
    });

    // A battle involving this room was cancelled — close it and show the result.
    socket.on('battle_ended', (result: BattleResult) => {
      if (result.from?.room_id !== state.roomId && result.to?.room_id !== state.roomId) return;
      if (battleState.battle?.id === result.invite_id) setBattle(null);
      showBattleResult({ ...result, provisional: false });
      notify();
    });

    socket.on('room_info', (info: RoomInfoSnapshot) => {
      if (!info?.id || info.id !== state.roomId) return;
      primeRoomInfo(info);
      state.roomInfo = roomInfoCache.get(info.id) ?? info;
      notify();
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

    socket.on('forced_mute', ({ isMuted }: { roomId: string; isMuted: boolean }) => {
      forcedMuteListeners.forEach(fn => fn(isMuted));
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

    socket.on('speaking_level', ({ userId, level }: { userId: string; level: number }) => {
      if (userId) speakingStore.setLevel(userId, level);
    });

    socket.on('comment_deleted', ({ messageId }: { roomId: string; messageId: string }) => {
      state.messages = state.messages.filter(m => m.id !== messageId);
      notify();
      commentDeletedListeners.forEach(fn => fn(messageId));
    });

    socket.on('report_comment_result', ({ ok, duplicate, message }: { ok: boolean; duplicate?: boolean; message?: string }) => {
      reportCommentResultListeners.forEach(fn => fn(ok, { duplicate, message }));
    });

    // A pre-warmed socket has already fired 'connect' — join right away.
    if (socket.connected) onConnect();
    else notify();
  },

  leave() {
    if (state.socket) {
      state.socket.disconnect();
      state.socket = null;
    }
    resetRoomState();
    notify();
    // Ready for the next room (no-op once logged out — also drops a stale spare)
    socketStore.prewarm();
  },

  /** Own mic level for the stage voice waves (sent only while on a seat). */
  emitSpeakingLevel(level: number) {
    const roomId = state.roomId;
    if (!roomId || !state.socket?.connected) return;
    state.socket.emit('speaking_level', { roomId, level });
  },

  emitMuteState(isMuted: boolean) {
    const roomId = state.roomId;
    if (!roomId) return;
    state.socket?.emit('user_mute', { roomId, isMuted });
  },

  forceMuteUser(targetUserId: string, isMuted: boolean) {
    const roomId = state.roomId;
    if (!roomId) return;
    state.socket?.emit('force_mute_user', { roomId, targetUserId, isMuted });
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

  /**
   * Send an encoded gift message. During a battle the gift's coins are added
   * to this room's battle score immediately (see pendingGifts) and swapped for
   * the server's confirmed total when it arrives.
   */
  sendGift(roomId: string, text: string, coins: number) {
    if (!state.socket) return;
    const clientGiftId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    const battle = battleState.battle;
    if (battle && state.roomId === roomId && coins > 0) {
      const timer = setTimeout(() => {
        if (settlePendingGift(clientGiftId)) { publishScores(); notify(); }
      }, PENDING_GIFT_TIMEOUT_MS);
      pendingGifts.set(clientGiftId, {
        inviteId: battle.id,
        side: roomId === battle.from_room_id ? 'left' : 'right',
        coins,
        timer,
      });
      publishScores();
      notify();
    }
    state.socket.emit('send_message', { roomId, text, clientGiftId });
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

  hostLeaveStage(roomId: string) {
    state.socket?.emit('host_leave_stage', { roomId });
  },

  hostReturnStage(roomId: string) {
    state.socket?.emit('host_return_stage', { roomId });
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

  /**
   * Cancel the running battle (either host). The battle closes and the result
   * shows straight away from the last confirmed scores; the server's
   * battle_ended then replaces it with the final result. If the server
   * refuses, the room is re-synced so the battle comes back.
   */
  cancelBattle(): Promise<{ ok: boolean; message?: string }> {
    const { battle, gifters } = battleState;
    const socket = state.socket;
    if (!battle || !socket?.connected) {
      return Promise.resolve({ ok: false, message: 'Not connected. Please try again.' });
    }
    // Confirmed totals only — our own gifts still on their way don't decide it
    const left = serverScores?.left ?? 0;
    const right = serverScores?.right ?? 0;
    const side = (prefix: 'from' | 'to', score: number, supporters: BattleGifter[]): BattleResultSide => ({
      room_id: battle[`${prefix}_room_id`],
      room_name: battle[`${prefix}_room_name`] ?? '',
      room_image_url: battle[`${prefix}_room_image_url`] ?? null,
      host_user_id: battle[`${prefix}_user_id`],
      host_name: battle[`${prefix}_host_name`] || battle[`${prefix}_host_username`] || null,
      score,
      supporters: supporters.slice(0, 3),
    });
    showBattleResult({
      invite_id: battle.id,
      mode: battle.mode,
      reason: 'cancelled',
      ended_by: authStore.getUserId(),
      winner: left > right ? 'from' : right > left ? 'to' : null,
      from: side('from', left, gifters.left),
      to: side('to', right, gifters.right),
      provisional: true,
    });
    setBattle(null); // notifies

    return new Promise(resolve => {
      socket.timeout(10_000).emit('cancel_battle', { inviteId: battle.id }, (err: Error | null, res?: { ok: boolean; message?: string; result?: BattleResult }) => {
        if (!err && res?.ok) {
          // battle_ended normally lands first; this covers it arriving late
          if (res.result && battleResult?.invite_id === battle.id && battleResult.provisional) {
            showBattleResult({ ...res.result, provisional: false });
            notify();
          }
          resolve({ ok: true });
          return;
        }
        if (battleResult?.invite_id === battle.id && battleResult.provisional) clearBattleResult();
        notify();
        // Get the real state back (battle still running, or ended elsewhere)
        if (state.roomId && socket.connected) socket.emit('refresh_room', { roomId: state.roomId });
        resolve({ ok: false, message: res?.message ?? 'Could not cancel the battle. Please try again.' });
      });
    });
  },

  /** Closed early (tap outside the card / back). */
  dismissBattleResult() {
    clearBattleResult();
    notify();
  },
};
