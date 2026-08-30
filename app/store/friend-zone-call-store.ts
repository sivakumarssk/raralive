import { PermissionsAndroid, Platform } from 'react-native';
import {
  ChannelProfileType,
  ClientRoleType,
  createAgoraRtcEngine,
} from 'react-native-agora';

import { BASE_URL } from '@/services/api';
import { authStore } from '@/store/auth-store';

// Friend Zone 1:1 audio/video calling — a separate Agora engine instance from
// agora-store.ts (which is tuned for room broadcasting: LiveBroadcasting
// profile, single global channel). A friend-zone call can happen while the
// user is also in a room, so the two must not share state or fight over the
// one Agora engine a device can realistically run at a time — callers are
// expected to leave the room stage before/while in a Friend Zone call.

const AGORA_APP_ID = '95876516c6294152abaffa43ec4bb40d';

function toAgoraUid(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (Math.imul(31, hash) + userId.charCodeAt(i)) >>> 0;
  }
  return (hash % 0xFFFFFF) + 1;
}

async function requestCallPermissions(callType: 'audio' | 'video'): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const perms = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
    if (callType === 'video') perms.push(PermissionsAndroid.PERMISSIONS.CAMERA);
    const granted = await PermissionsAndroid.requestMultiple(perms);
    console.log('[FZ-Call] permissions result:', granted);
    return Object.values(granted).every(v => v === PermissionsAndroid.RESULTS.GRANTED);
  } catch (e) {
    console.warn('[FZ-Call] permission request error:', e);
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
    console.warn('[FZ-Call] Token fetch failed:', json.message);
    return null;
  } catch (e) {
    console.warn('[FZ-Call] Token fetch error:', e);
    return null;
  }
}

type FriendZoneCallState = {
  engine: any | null;
  channelId: string | null;
  callType: 'audio' | 'video' | null;
  uid: number | null;
  joined: boolean;
  remoteUid: number | null;
  isMicMuted: boolean;
  isCameraOff: boolean;
  isSpeakerOn: boolean;
};

const state: FriendZoneCallState = {
  engine: null,
  channelId: null,
  callType: null,
  uid: null,
  joined: false,
  remoteUid: null,
  isMicMuted: false,
  isCameraOff: false,
  isSpeakerOn: true,
};

const listeners = new Set<() => void>();
// useSyncExternalStore needs a referentially stable snapshot between
// notify() calls — see the matching comment in friend-zone-call-session-store.ts.
let snapshot: FriendZoneCallState = { ...state };
function notify() {
  snapshot = { ...state };
  listeners.forEach(fn => fn());
}

export function subscribeFriendZoneCall(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function getFriendZoneCallState() {
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
    onJoinChannelSuccess: (conn: any, elapsed: number) => {
      console.log('[FZ-Call] onJoinChannelSuccess', conn, elapsed);
      state.joined = true;
      notify();
    },
    onLeaveChannel: () => {
      console.log('[FZ-Call] onLeaveChannel');
      state.joined = false;
      notify();
    },
    onUserJoined: (_conn: any, remoteUid: number) => {
      console.log('[FZ-Call] onUserJoined — remote peer connected, remoteUid=', remoteUid);
      state.remoteUid = remoteUid;
      notify();
    },
    onUserOffline: (_conn: any, remoteUid: number, reason: any) => {
      console.log('[FZ-Call] onUserOffline', remoteUid, reason);
      if (state.remoteUid === remoteUid) state.remoteUid = null;
      notify();
    },
    onRemoteAudioStateChanged: (_conn: any, remoteUid: number, state_: any, reason: any) => {
      console.log('[FZ-Call] onRemoteAudioStateChanged remoteUid=', remoteUid, 'state=', state_, 'reason=', reason);
    },
    onLocalAudioStateChanged: (_conn: any, state_: any, error: any) => {
      console.log('[FZ-Call] onLocalAudioStateChanged state=', state_, 'error=', error);
    },
    onConnectionStateChanged: (_conn: any, connState: any, reason: any) => {
      console.log('[FZ-Call] onConnectionStateChanged state=', connState, 'reason=', reason);
    },
    onTokenPrivilegeWillExpire: () => {
      fetchAgoraToken(channelId).then(newToken => {
        if (newToken) state.engine?.renewToken(newToken);
      });
    },
    onError: (err: any, msg: any) => {
      console.warn('[FZ-Call] onError code=', err, 'msg=', msg);
    },
  });
}

export const friendZoneCallStore = {
  async join(channelId: string, userId: string, callType: 'audio' | 'video') {
    console.log('[FZ-Call] join() called', { channelId, userId, callType });
    if (state.engine && state.channelId === channelId) {
      console.log('[FZ-Call] already joined this channel, skipping');
      return true;
    }
    if (state.engine) friendZoneCallStore.leave();

    const hasPermission = await requestCallPermissions(callType);
    if (!hasPermission) {
      console.warn('[FZ-Call] Permission denied — mic/camera will not work');
      return false;
    }

    const uid = toAgoraUid(userId);
    console.log('[FZ-Call] derived uid', uid, 'for userId', userId);
    const agoraToken = await fetchAgoraToken(channelId);
    if (!agoraToken) {
      console.warn('[FZ-Call] Could not get token — aborting join');
      return false;
    }
    console.log('[FZ-Call] got token, joining channel', channelId, 'as uid', uid);

    try {
      const engine = createAgoraRtcEngine();
      if (!engine) {
        console.warn('[FZ-Call] createAgoraRtcEngine() returned null/undefined');
        return false;
      }

      engine.initialize({ appId: AGORA_APP_ID, channelProfile: ChannelProfileType.ChannelProfileCommunication });
      engine.enableAudio();
      if (callType === 'video') { engine.enableVideo(); engine.startPreview(); }
      engine.setDefaultAudioRouteToSpeakerphone(true);

      registerHandlers(engine, channelId);

      const joinResult = engine.joinChannel(agoraToken, channelId, uid, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        publishMicrophoneTrack: true,
        publishCameraTrack: callType === 'video',
        autoSubscribeAudio: true,
        autoSubscribeVideo: true,
        // Required for the engine to actually record/play audio — without
        // this, publishMicrophoneTrack/autoSubscribeAudio are set but no
        // real audio I/O happens on either side of the call.
        enableAudioRecordingOrPlayout: true,
      });
      console.log('[FZ-Call] engine.joinChannel call result:', joinResult);

      state.engine = engine;
      state.channelId = channelId;
      state.callType = callType;
      state.uid = uid;
      state.isMicMuted = false;
      state.isCameraOff = false;
      state.isSpeakerOn = true;
      notify();
      return true;
    } catch (e) {
      console.warn('[FZ-Call] init failed:', e);
      return false;
    }
  },

  leave() {
    if (!state.engine) return;
    releaseEngine();
    state.channelId = null;
    state.callType = null;
    state.uid = null;
    state.joined = false;
    state.remoteUid = null;
    state.isMicMuted = false;
    state.isCameraOff = false;
    state.isSpeakerOn = true;
    notify();
  },

  toggleMic() {
    if (!state.engine) return;
    state.isMicMuted = !state.isMicMuted;
    state.engine.muteLocalAudioStream(state.isMicMuted);
    notify();
  },

  toggleSpeaker() {
    if (!state.engine) return;
    state.isSpeakerOn = !state.isSpeakerOn;
    state.engine.setEnableSpeakerphone(state.isSpeakerOn);
    notify();
  },

  toggleCamera() {
    if (!state.engine || state.callType !== 'video') return;
    state.isCameraOff = !state.isCameraOff;
    state.engine.muteLocalVideoStream(state.isCameraOff);
    notify();
  },

  switchCamera() {
    if (!state.engine || state.callType !== 'video') return;
    state.engine.switchCamera();
  },
};
