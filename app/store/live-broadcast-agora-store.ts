import { PermissionsAndroid, Platform } from 'react-native';
import {
  ChannelProfileType,
  ClientRoleType,
  createAgoraRtcEngine,
} from 'react-native-agora';

import { BASE_URL } from '@/services/api';
import { authStore } from '@/store/auth-store';

// Video-capable Agora engine for the multi-host live broadcast room (host +
// up to 3 co-hosts, all publishing camera+mic). A separate engine instance
// from agora-store.ts (audio-only room stage) and friend-zone-call-store.ts
// (1:1 calls) — see the matching comment in friend-zone-call-store.ts for
// why these can't share one engine.

const AGORA_APP_ID = '95876516c6294152abaffa43ec4bb40d';

function toAgoraUid(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (Math.imul(31, hash) + userId.charCodeAt(i)) >>> 0;
  }
  return (hash % 0xFFFFFF) + 1;
}

async function requestBroadcastPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      PermissionsAndroid.PERMISSIONS.CAMERA,
    ]);
    return Object.values(granted).every(v => v === PermissionsAndroid.RESULTS.GRANTED);
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
    console.warn('[LiveBroadcast] Token fetch failed:', json.message);
    return null;
  } catch (e) {
    console.warn('[LiveBroadcast] Token fetch error:', e);
    return null;
  }
}

export type RemoteVideoUser = {
  uid: number;
  hasVideo: boolean;
  hasAudio: boolean;
};

type LiveBroadcastAgoraState = {
  engine: any | null;
  channelId: string | null;
  uid: number | null;
  joined: boolean;
  isPublishing: boolean;
  isMicMuted: boolean;
  isCameraOff: boolean;
  isFrontCamera: boolean;
  remoteUsers: RemoteVideoUser[];
};

const state: LiveBroadcastAgoraState = {
  engine: null,
  channelId: null,
  uid: null,
  joined: false,
  isPublishing: false,
  isMicMuted: false,
  isCameraOff: false,
  isFrontCamera: true,
  remoteUsers: [],
};

const listeners = new Set<() => void>();
let snapshot: LiveBroadcastAgoraState = { ...state, remoteUsers: [] };
function notify() {
  snapshot = { ...state, remoteUsers: [...state.remoteUsers] };
  listeners.forEach(fn => fn());
}

export function subscribeLiveBroadcastAgora(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function getLiveBroadcastAgoraState() {
  return snapshot;
}

function releaseEngine() {
  if (!state.engine) return;
  try {
    state.engine.leaveChannel();
    state.engine.unregisterEventHandler({});
    state.engine.release();
  } catch {}
  state.engine = null;
}

function registerHandlers(engine: any, channelId: string) {
  engine.registerEventHandler({
    onJoinChannelSuccess: () => {
      state.joined = true;
      notify();
    },
    onLeaveChannel: () => {
      state.joined = false;
      state.remoteUsers = [];
      notify();
    },
    onUserJoined: (_conn: any, remoteUid: number) => {
      if (!state.remoteUsers.some(u => u.uid === remoteUid)) {
        state.remoteUsers = [...state.remoteUsers, { uid: remoteUid, hasVideo: true, hasAudio: true }];
        notify();
      }
    },
    onUserOffline: (_conn: any, remoteUid: number) => {
      state.remoteUsers = state.remoteUsers.filter(u => u.uid !== remoteUid);
      notify();
    },
    onRemoteVideoStateChanged: (_conn: any, remoteUid: number, videoState: number) => {
      // videoState: 0 = stopped, 1/2 = starting/decoding (has video)
      const hasVideo = videoState !== 0;
      state.remoteUsers = state.remoteUsers.map(u => u.uid === remoteUid ? { ...u, hasVideo } : u);
      notify();
    },
    onRemoteAudioStateChanged: (_conn: any, remoteUid: number, audioState: number) => {
      const hasAudio = audioState !== 0;
      state.remoteUsers = state.remoteUsers.map(u => u.uid === remoteUid ? { ...u, hasAudio } : u);
      notify();
    },
    onTokenPrivilegeWillExpire: () => {
      fetchAgoraToken(channelId).then(newToken => {
        if (newToken) state.engine?.renewToken(newToken);
      });
    },
    onError: (err: any) => {
      console.warn('[LiveBroadcast] Agora error:', err);
    },
  });
}

export const liveBroadcastAgoraStore = {
  // shouldPublish=false joins as a pure viewer (ClientRoleAudience, no camera/mic
  // requested or published) — still subscribes to every publisher's audio+video.
  // Without this, a plain audience member never even joins the Agora channel and
  // sees/hears nothing, regardless of what the host is publishing.
  async join(channelId: string, userId: string, shouldPublish: boolean): Promise<boolean> {
    if (state.engine && state.channelId === channelId && state.isPublishing === shouldPublish) return true;
    if (state.engine) liveBroadcastAgoraStore.leave();

    if (shouldPublish) {
      const hasPermission = await requestBroadcastPermissions();
      if (!hasPermission) {
        console.warn('[LiveBroadcast] Mic/camera permission denied');
        return false;
      }
    }

    const uid = toAgoraUid(userId);
    const agoraToken = await fetchAgoraToken(channelId);
    if (!agoraToken) return false;

    try {
      const engine = createAgoraRtcEngine();
      if (!engine) return false;

      const clientRole = shouldPublish ? ClientRoleType.ClientRoleBroadcaster : ClientRoleType.ClientRoleAudience;
      engine.initialize({ appId: AGORA_APP_ID, channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting });
      engine.setClientRole(clientRole);
      engine.enableAudio();
      engine.enableVideo();
      if (shouldPublish) engine.startPreview();
      engine.setDefaultAudioRouteToSpeakerphone(true);

      registerHandlers(engine, channelId);

      engine.joinChannel(agoraToken, channelId, uid, {
        clientRoleType: clientRole,
        publishMicrophoneTrack: shouldPublish,
        publishCameraTrack: shouldPublish,
        autoSubscribeAudio: true,
        autoSubscribeVideo: true,
        enableAudioRecordingOrPlayout: true,
      });

      state.engine = engine;
      state.channelId = channelId;
      state.uid = uid;
      state.isPublishing = shouldPublish;
      state.isMicMuted = false;
      state.isCameraOff = false;
      state.isFrontCamera = true;
      state.remoteUsers = [];
      notify();
      return true;
    } catch (e) {
      console.warn('[LiveBroadcast] init failed:', e);
      return false;
    }
  },

  leave() {
    if (!state.engine) return;
    releaseEngine();
    state.channelId = null;
    state.uid = null;
    state.joined = false;
    state.isPublishing = false;
    state.isMicMuted = false;
    state.isCameraOff = false;
    state.isFrontCamera = true;
    state.remoteUsers = [];
    notify();
  },

  toggleMic() {
    if (!state.engine) return;
    state.isMicMuted = !state.isMicMuted;
    state.engine.muteLocalAudioStream(state.isMicMuted);
    notify();
  },

  toggleCamera() {
    if (!state.engine) return;
    state.isCameraOff = !state.isCameraOff;
    state.engine.muteLocalVideoStream(state.isCameraOff);
    notify();
  },

  switchCamera() {
    if (!state.engine) return;
    state.engine.switchCamera();
    state.isFrontCamera = !state.isFrontCamera;
    notify();
  },
};
