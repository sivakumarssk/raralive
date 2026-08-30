import { authStore } from '@/store/auth-store';
import {
  friendZoneSocketStore,
  subscribeFriendZoneCallEvents,
  type FriendZoneCallGift,
  type FriendZoneCallMessage,
} from '@/store/friend-zone-socket-store';

// In-call gifting + chat, scoped to whichever Friend Zone call is currently
// active. Independent of the call signaling/billing in
// friend-zone-call-session-store.ts — this only tracks the feed of gift and
// chat events for the active callId, reset whenever the call changes.

export type CallChatRow =
  | { kind: 'message'; id: string; senderId: string; text: string; isSelf: boolean }
  | { kind: 'gift'; id: string; senderId: string; recipientId: string; giftName: string; giftImageUrl: string | null; coins: number; qty: number; isSelf: boolean };

const state = {
  callId: null as string | null,
  rows: [] as CallChatRow[],
  giftError: null as string | null,
};

let snapshot = { ...state, rows: [...state.rows] };
const listeners = new Set<() => void>();
function notify() {
  snapshot = { ...state, rows: [...state.rows] };
  listeners.forEach(fn => fn());
}

export function subscribeFriendZoneCallChat(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function getFriendZoneCallChatState() {
  return snapshot;
}

let initialized = false;

export function initFriendZoneCallChat() {
  if (initialized) return;
  initialized = true;

  subscribeFriendZoneCallEvents((event) => {
    if (event.type === 'call_message') {
      const msg: FriendZoneCallMessage = event.message;
      if (state.callId !== msg.callId) return;
      const selfId = authStore.getUserId();
      state.rows.push({ kind: 'message', id: msg.id, senderId: msg.senderId, text: msg.text, isSelf: msg.senderId === selfId });
      notify();
    } else if (event.type === 'call_gift') {
      const gift: FriendZoneCallGift = event.gift;
      if (state.callId !== gift.callId) return;
      const selfId = authStore.getUserId();
      state.rows.push({
        kind: 'gift', id: gift.id, senderId: gift.senderId, recipientId: gift.recipientId,
        giftName: gift.giftName, giftImageUrl: gift.giftImageUrl, coins: gift.coins, qty: gift.qty,
        isSelf: gift.senderId === selfId,
      });
      notify();
    } else if (event.type === 'call_gift_error') {
      state.giftError = event.message;
      notify();
    }
  });
}

export const friendZoneCallChatStore = {
  attach(callId: string) {
    if (state.callId === callId) return;
    state.callId = callId;
    state.rows = [];
    state.giftError = null;
    notify();
  },
  detach() {
    state.callId = null;
    state.rows = [];
    state.giftError = null;
    notify();
  },
  sendMessage(text: string) {
    if (!state.callId || !text.trim()) return;
    friendZoneSocketStore.callSendMessage(state.callId, text.trim());
  },
  sendGift(giftId: string, qty: number) {
    if (!state.callId) return;
    friendZoneSocketStore.callSendGift(state.callId, giftId, qty);
  },
  clearGiftError() {
    state.giftError = null;
    notify();
  },
};
