import { PermissionsAndroid, Platform } from 'react-native';
import {
  ChannelProfileType,
  ClientRoleType,
  createAgoraRtcEngine,
} from 'react-native-agora';

import { BASE_URL } from '@/services/api';
import { authStore } from '@/store/auth-store';

const AGORA_APP_ID = '95876516c6294152abaffa43ec4bb40d';

function toAgoraUid(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (Math.imul(31, hash) + userId.charCodeAt(i)) >>> 0;
  }
  return (hash % 0xFFFFFF) + 1;
}

async function requestMicPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Microphone Permission',
        message: 'RaraLive needs microphone access for voice chat.',
        buttonPositive: 'Allow',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

async function fetchAgoraToken(channelName: string): Promise<string | null> {
  try {
    const token = authStore.getToken();
    const res = await fetch(`${BASE_URL}/agora/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ channelName, uid: 0 }),
    });
    const json = await res.json();
    if (json.success) return json.token;
    console.warn('[Agora] Token fetch failed:', json.message);
    return null;
  } catch (e) {
    console.warn('[Agora] Token fetch error:', e);
    return null;
  }
}

// Log session to backend for usage tracking
async function logSession(channelId: string, userId: string, joinedAt: number, leftAt: number) {
  const durationSeconds = Math.round((leftAt - joinedAt) / 1000);
  const joinedAtISO = new Date(joinedAt).toISOString();
  const leftAtISO = new Date(leftAt).toISOString();
  console.log(
    `[Agora] SESSION LOG | channel=${channelId} user=${userId}` +
    ` | joined=${joinedAtISO} left=${leftAtISO} duration=${durationSeconds}s`
  );
  try {
    const token = authStore.getToken();
    await fetch(`${BASE_URL}/agora/log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ channelId, userId, joinedAt: joinedAtISO, leftAt: leftAtISO, durationSeconds }),
    });
  } catch {
    // Non-fatal — log only, don't block anything
  }
}

type AgoraState = {
  engine: any | null;
  channelId: string | null;
  userId: string | null;
  uid: number | null;
  isMuted: boolean;
  joined: boolean;
  joinedAt: number | null; // timestamp when joined, for duration tracking
};

const state: AgoraState = {
  engine: null,
  channelId: null,
  userId: null,
  uid: null,
  isMuted: false,
  joined: false,
  joinedAt: null,
};

const listeners = new Set<() => void>();
function notify() { listeners.forEach(fn => fn()); }

export function subscribeAgora(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function getAgoraState() {
  return { ...state };
}

function releaseEngine() {
  if (!state.engine) return;
  const channelId = state.channelId;
  const userId = state.userId;
  const joinedAt = state.joinedAt;
  try {
    state.engine.leaveChannel();
    state.engine.unregisterEventHandler({});
    state.engine.release();
  } catch {}
  state.engine = null;
  state.joined = false;
  state.joinedAt = null;
  // Log session duration
  if (channelId && userId && joinedAt) {
    logSession(channelId, userId, joinedAt, Date.now());
  }
}

export const agoraStore = {
  async join(channelId: string, userId: string) {
    if (state.engine && state.channelId === channelId) return;

    // Leave previous channel
    if (state.engine) {
      releaseEngine();
      state.channelId = null;
      state.userId = null;
      state.uid = null;
      state.isMuted = false;
      notify();
    }

    const hasPermission = await requestMicPermission();
    if (!hasPermission) {
      console.warn('[Agora] Mic permission denied');
      return;
    }

    const uid = toAgoraUid(userId);
    const agoraToken = await fetchAgoraToken(channelId);
    if (!agoraToken) {
      console.warn('[Agora] Could not get token');
      return;
    }

    console.log(`[Agora] CONNECT | channel=${channelId} user=${userId} uid=${uid} time=${new Date().toISOString()}`);

    try {
      const engine = createAgoraRtcEngine();
      if (!engine) return;

      engine.initialize({
        appId: AGORA_APP_ID,
        channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
      });

      engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);
      engine.enableAudio();
      engine.setDefaultAudioRouteToSpeakerphone(true);

      engine.registerEventHandler({
        onJoinChannelSuccess: (_conn: any, elapsed: number) => {
          const now = Date.now();
          state.joinedAt = now;
          state.joined = true;
          console.log(`[Agora] JOINED | channel=${channelId} user=${userId} elapsed=${elapsed}ms time=${new Date(now).toISOString()}`);
          notify();
        },
        onLeaveChannel: (_conn: any, stats: any) => {
          const now = Date.now();
          console.log(`[Agora] LEFT | channel=${channelId} user=${userId} duration=${stats?.totalDuration ?? '?'}s time=${new Date(now).toISOString()}`);
          state.joined = false;
          notify();
        },
        onUserJoined: (_conn: any, remoteUid: number) => {
          console.log(`[Agora] REMOTE JOINED | channel=${channelId} remoteUid=${remoteUid}`);
        },
        onUserOffline: (_conn: any, remoteUid: number) => {
          console.log(`[Agora] REMOTE LEFT | channel=${channelId} remoteUid=${remoteUid}`);
        },
        onTokenPrivilegeWillExpire: () => {
          console.warn(`[Agora] TOKEN EXPIRING SOON | channel=${channelId} — renewing...`);
          // Auto-renew token before it expires
          fetchAgoraToken(channelId).then(newToken => {
            if (newToken) {
              state.engine?.renewToken(newToken);
              console.log(`[Agora] TOKEN RENEWED | channel=${channelId} time=${new Date().toISOString()}`);
            }
          });
        },
        onError: (err: any) => {
          console.warn(`[Agora] ERROR | code=${err} channel=${channelId} time=${new Date().toISOString()}`);
        },
      });

      engine.joinChannel(agoraToken, channelId, uid, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        publishMicrophoneTrack: true,
        autoSubscribeAudio: true,
      });

      state.engine = engine;
      state.channelId = channelId;
      state.userId = userId;
      state.uid = uid;
      state.isMuted = false;
      notify();
    } catch (e) {
      console.warn('[Agora] init failed:', e);
    }
  },

  leave() {
    if (!state.engine) return;
    const channelId = state.channelId;
    const userId = state.userId;
    console.log(`[Agora] DISCONNECT | channel=${channelId} user=${userId} time=${new Date().toISOString()}`);
    releaseEngine();
    state.channelId = null;
    state.userId = null;
    state.uid = null;
    state.isMuted = false;
    state.joined = false;
    notify();
  },

  async toggleMute() {
    if (!state.isMuted) {
      // Currently live → mute = fully leave to stop token consumption
      const channelId = state.channelId;
      const userId = state.userId;
      if (!channelId || !userId) return;
      console.log(`[Agora] MUTE (disconnect) | channel=${channelId} user=${userId} time=${new Date().toISOString()}`);
      releaseEngine();
      state.isMuted = true;
      state.joined = false;
      // Keep channelId and userId for rejoin on unmute
      notify();
    } else {
      // Currently muted → unmute = rejoin channel
      const channelId = state.channelId;
      const userId = state.userId;
      if (!channelId || !userId) return;
      console.log(`[Agora] UNMUTE (reconnect) | channel=${channelId} user=${userId} time=${new Date().toISOString()}`);
      state.isMuted = false;
      state.channelId = null; // clear so join() doesn't skip
      notify();
      await agoraStore.join(channelId, userId);
    }
  },
};
