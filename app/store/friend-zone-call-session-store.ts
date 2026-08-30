import { router } from 'expo-router';

import { authStore } from '@/store/auth-store';
import { friendZoneCallStore } from '@/store/friend-zone-call-store';
import {
  friendZoneSocketStore,
  subscribeFriendZoneCallEvents,
  type FriendZoneCallPeer,
} from '@/store/friend-zone-socket-store';
import { startRingtone, stopRingtone } from '@/utils/call-ringtone';

const RING_TIMEOUT_MS = 60 * 1000;
const ENDED_AUTO_RESET_MS = 5000;

// Coordinates Friend Zone call signaling (friend-zone-socket-store) with the
// Agora media engine (friend-zone-call-store) into one state machine so the
// incoming-call overlay and in-call screen just render `state.phase`.

export type CallPhase = 'idle' | 'outgoing_ringing' | 'incoming_ringing' | 'connecting' | 'active' | 'ended';

type SessionState = {
  phase: CallPhase;
  callId: string | null;
  channelName: string | null;
  callType: 'audio' | 'video' | null;
  peer: FriendZoneCallPeer | null;
  isIncoming: boolean;
  lowBalanceWarning: boolean;
  endReason: string | null;
};

const state: SessionState = {
  phase: 'idle',
  callId: null,
  channelName: null,
  callType: null,
  peer: null,
  isIncoming: false,
  lowBalanceWarning: false,
  endReason: null,
};

const listeners = new Set<() => void>();
// useSyncExternalStore requires getSnapshot to return a referentially
// stable value when nothing has changed — allocating a fresh object on
// every call makes React think the store changes on every render, which
// causes an infinite re-render loop ("Maximum update depth exceeded").
// Cache the snapshot and only replace it when notify() actually fires.
let snapshot: SessionState = { ...state };

// Ringtone + 1-minute ring timeout both key off phase — centralized here
// (rather than at every call site that changes phase) so neither can be
// forgotten on any transition in or out of a ringing state.
let isCurrentlyRinging = false;
let ringTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
// The 'ended' summary UI (call screen / whatever's showing it) is expected
// to auto-dismiss after a few seconds, but that dismiss previously lived
// only in the call-screen route component's own effect — if the call never
// reached 'ended' while that screen was mounted (e.g. the ring timeout
// fired while only the global IncomingCallOverlay was visible, or the
// backend's 'ended'/'failed' events landed with no screen open at all),
// phase got stuck at 'ended' forever. Since state.phase !== 'idle' blocks
// all future incoming invites (see the 'incoming_invite' case below), a
// stuck 'ended' state silently killed every call after it — the receiver
// never saw a ring again. Centralizing the auto-reset here guarantees it
// always fires, regardless of what's on screen.
let endedAutoResetTimer: ReturnType<typeof setTimeout> | null = null;

// When the local timeout sets endReason itself (see below), the reject/
// cancel it sends still round-trips through the backend and comes back as
// its own 'ended' event — without this guard that echo would overwrite the
// locally-set 'not_answered' reason with the backend's generic one.
let locallyEndedCallId: string | null = null;

function syncRingingSideEffects() {
  const shouldRing = state.phase === 'outgoing_ringing' || state.phase === 'incoming_ringing';
  // Only the callee's phone should actually play a ringtone — the caller
  // hears their own device's normal call-progress state (nothing here),
  // not the same alert sound as the person being called.
  const shouldPlayRingtone = state.phase === 'incoming_ringing';

  if (shouldPlayRingtone && !isCurrentlyRinging) {
    isCurrentlyRinging = true;
    startRingtone();
  } else if (!shouldPlayRingtone && isCurrentlyRinging) {
    isCurrentlyRinging = false;
    stopRingtone();
  }

  if (shouldRing && !ringTimeoutTimer) {
    const callId = state.callId;
    const wasIncoming = state.isIncoming;
    ringTimeoutTimer = setTimeout(() => {
      ringTimeoutTimer = null;
      if (state.callId !== callId || !callId) return;
      // Whichever side the 1-minute timeout fires on, tell the backend via
      // the action that side is actually authorized to take (only the
      // caller can cancel; only the callee can reject), then show "not
      // answered" locally on both ends instead of the screen just vanishing.
      locallyEndedCallId = callId;
      if (wasIncoming) {
        friendZoneSocketStore.callReject(callId);
      } else {
        friendZoneSocketStore.callCancel(callId);
      }
      state.phase = 'ended';
      state.endReason = 'not_answered';
      notify();
    }, RING_TIMEOUT_MS);
  } else if (!shouldRing && ringTimeoutTimer) {
    clearTimeout(ringTimeoutTimer);
    ringTimeoutTimer = null;
  }

  const isEnded = state.phase === 'ended';
  if (isEnded && !endedAutoResetTimer) {
    const callId = state.callId;
    endedAutoResetTimer = setTimeout(() => {
      endedAutoResetTimer = null;
      if (state.callId !== callId || state.phase !== 'ended') return;
      reset();
    }, ENDED_AUTO_RESET_MS);
  } else if (!isEnded && endedAutoResetTimer) {
    clearTimeout(endedAutoResetTimer);
    endedAutoResetTimer = null;
  }
}

function notify() {
  snapshot = { ...state };
  syncRingingSideEffects();
  listeners.forEach(fn => fn());
}

export function subscribeFriendZoneCallSession(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function getFriendZoneCallSessionState() {
  return snapshot;
}

// Set whenever a call ends so the Friend Zone tab (nested inside the Live
// tab, not its own route) can pre-select itself the next time the user is
// on the Live tab — ChatRoomsScreen consumes this on focus.
let pendingReturnToFriendZone = false;
export function consumePendingReturnToFriendZone(): boolean {
  const value = pendingReturnToFriendZone;
  pendingReturnToFriendZone = false;
  return value;
}

function reset() {
  state.phase = 'idle';
  state.callId = null;
  state.channelName = null;
  state.callType = null;
  state.peer = null;
  state.isIncoming = false;
  state.lowBalanceWarning = false;
  state.endReason = null;
  pendingReturnToFriendZone = true;
  notify();
}

let initialized = false;

export function initFriendZoneCallSession() {
  if (initialized) return;
  initialized = true;

  subscribeFriendZoneCallEvents((event) => {
    switch (event.type) {
      case 'incoming_invite': {
        // A leftover 'ended' summary from a call this device just finished
        // (e.g. it declined the previous call seconds ago) shouldn't block
        // a brand new incoming call — without this, a caller who redials
        // right after being declined gets silently auto-rejected again
        // because the receiver's own state hadn't reset yet, with no ring
        // ever showing on their screen.
        if (state.phase === 'ended') reset();
        if (state.phase !== 'idle') {
          // Genuinely already on a call — silently decline, mirrors
          // backend's busy check.
          friendZoneSocketStore.callReject(event.callId);
          return;
        }
        state.phase = 'incoming_ringing';
        state.callId = event.callId;
        state.channelName = event.channelName;
        state.callType = event.callType;
        state.peer = event.caller;
        state.isIncoming = true;
        notify();
        break;
      }
      case 'outgoing_ringing': {
        state.phase = 'outgoing_ringing';
        state.callId = event.callId;
        state.channelName = event.channelName;
        state.callType = event.callType;
        state.peer = event.callee;
        state.isIncoming = false;
        notify();
        break;
      }
      case 'accepted': {
        if (state.callId !== event.callId) return;
        state.phase = 'connecting';
        notify();
        (async () => {
          const userId = authStore.getUserId();
          const callId = state.callId;
          if (!userId || !state.channelName || !state.callType) return;
          const ok = await friendZoneCallStore.join(state.channelName, userId, state.callType);
          if (state.callId !== callId) return;
          if (ok) {
            state.phase = 'active';
            notify();
          } else {
            // Mic/camera permission denied, or the Agora engine otherwise
            // failed to join — end the call for both sides instead of
            // leaving the other party stuck talking to no one.
            friendZoneSocketStore.callEnd(callId!);
            state.phase = 'ended';
            state.endReason = 'media_permission_denied';
            notify();
          }
        })();
        router.push('/friend-zone-call' as any);
        break;
      }
      case 'ended': {
        if (state.callId !== event.callId) return;
        friendZoneCallStore.leave();
        state.phase = 'ended';
        // Don't let the backend's echo of our own timeout-triggered
        // reject/cancel clobber the more specific 'not_answered' reason
        // already shown locally.
        if (locallyEndedCallId !== event.callId) state.endReason = event.reason;
        locallyEndedCallId = null;
        notify();
        break;
      }
      case 'failed': {
        state.phase = 'ended';
        state.endReason = event.reason;
        notify();
        break;
      }
      case 'low_balance': {
        if (state.callId !== event.callId) return;
        state.lowBalanceWarning = true;
        notify();
        break;
      }
      case 'charged': {
        if (state.callId !== event.callId) return;
        state.lowBalanceWarning = false;
        notify();
        break;
      }
      case 'earned': {
        // Callee-side gem credit per minute — no live in-call display for
        // this yet; the wallet and call history reflect it once refetched.
        break;
      }
    }
  });
}

export const friendZoneCallSessionStore = {
  // UI-only test path — jumps straight to the active call screen with a fake
  // peer, no signaling, no Agora join. Lets the gift bar / chat feed / call
  // controls be checked on-device without needing two real accounts and a
  // live channel. Remove once the call UI itself is fully verified.
  startUiPreviewCall(callType: 'audio' | 'video') {
    if (state.phase === 'ended') reset();
    if (state.phase !== 'idle') return;
    state.phase = 'active';
    state.callId = `preview_${Date.now()}`;
    state.channelName = null;
    state.callType = callType;
    state.peer = { id: 'preview-peer', full_name: 'Preview Friend', username: 'preview', avatar_url: null };
    state.isIncoming = false;
    state.lowBalanceWarning = false;
    state.endReason = null;
    notify();
    router.push('/friend-zone-call' as any);
  },

  startCall(calleeId: string, calleeInfo: FriendZoneCallPeer, callType: 'audio' | 'video') {
    // A leftover 'ended' summary from the previous call (still showing
    // until its own auto-reset timer fires) would otherwise silently block
    // a redial here — the tap would no-op and the user just stares at the
    // stale "declined" screen until the timer catches up. Clear it
    // immediately so a redial always starts a fresh call right away.
    if (state.phase === 'ended') reset();
    if (state.phase !== 'idle') return;
    state.peer = calleeInfo;
    state.callType = callType;
    state.isIncoming = false;
    friendZoneSocketStore.callInvite(calleeId, callType);
    router.push('/friend-zone-call' as any);
  },

  acceptIncoming() {
    if (state.phase !== 'incoming_ringing' || !state.callId) return;
    const callId = state.callId;
    friendZoneSocketStore.callAccept(callId);
    state.phase = 'connecting';
    notify();
    (async () => {
      const userId = authStore.getUserId();
      if (!userId || !state.channelName || !state.callType) return;
      const ok = await friendZoneCallStore.join(state.channelName, userId, state.callType);
      if (state.callId !== callId) return;
      if (ok) {
        state.phase = 'active';
        notify();
      } else {
        // Mic/camera permission denied, or the Agora engine otherwise
        // failed to join — end the call for both sides instead of leaving
        // the caller stuck thinking the call connected.
        friendZoneSocketStore.callEnd(callId);
        state.phase = 'ended';
        state.endReason = 'media_permission_denied';
        notify();
      }
    })();
    router.push('/friend-zone-call' as any);
  },

  rejectIncoming() {
    if (state.phase !== 'incoming_ringing' || !state.callId) return;
    friendZoneSocketStore.callReject(state.callId);
    reset();
  },

  cancelOutgoing() {
    if (state.phase !== 'outgoing_ringing' || !state.callId) return;
    friendZoneSocketStore.callCancel(state.callId);
    reset();
  },

  endActive() {
    if (state.callId && (state.phase === 'active' || state.phase === 'connecting')) {
      friendZoneSocketStore.callEnd(state.callId);
    }
    friendZoneCallStore.leave();
    reset();
  },

  dismissEnded() {
    reset();
  },
};
