import { useEffect, useState } from 'react';
import {
  getLiveBroadcastAgoraState,
  liveBroadcastAgoraStore,
  subscribeLiveBroadcastAgora,
} from '@/store/live-broadcast-agora-store';

export function useLiveBroadcastAgora(channelId: string, userId: string, shouldPublish: boolean) {
  const [state, setState] = useState(getLiveBroadcastAgoraState);

  useEffect(() => {
    const unsub = subscribeLiveBroadcastAgora(() => setState(getLiveBroadcastAgoraState()));
    return () => unsub();
  }, []);

  // Everyone in the room joins the Agora channel (to subscribe to the host/co-hosts'
  // audio+video); only hosts/co-hosts actually publish their own camera+mic.
  // Re-joins when shouldPublish flips (e.g. accepted as co-host mid-broadcast) so the
  // client role and published tracks update accordingly.
  useEffect(() => {
    if (channelId && userId) {
      liveBroadcastAgoraStore.join(channelId, userId, shouldPublish);
    }
  }, [channelId, userId, shouldPublish]);

  // Leave when unmounting or switching away from this channel entirely.
  useEffect(() => {
    return () => {
      const current = getLiveBroadcastAgoraState();
      if (current.channelId === channelId) liveBroadcastAgoraStore.leave();
    };
  }, [channelId]);

  return {
    joined: state.joined,
    uid: state.uid,
    isMicMuted: state.isMicMuted,
    isCameraOff: state.isCameraOff,
    isFrontCamera: state.isFrontCamera,
    remoteUsers: state.remoteUsers,
    toggleMic: () => liveBroadcastAgoraStore.toggleMic(),
    toggleCamera: () => liveBroadcastAgoraStore.toggleCamera(),
    switchCamera: () => liveBroadcastAgoraStore.switchCamera(),
  };
}
