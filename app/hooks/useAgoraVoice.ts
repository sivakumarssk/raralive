import { useEffect, useState } from 'react';
import { agoraStore, getAgoraState, subscribeAgora } from '@/store/agora-store';

export function useAgoraVoice(channelId: string, userId: string, isOnStage: boolean) {
  const [state, setState] = useState(getAgoraState);

  // Subscribe to global agora state changes
  useEffect(() => {
    const unsub = subscribeAgora(() => setState(getAgoraState()));
    return () => unsub();
  }, []);

  // Join when on stage, leave when off stage
  useEffect(() => {
    if (channelId && userId && isOnStage) {
      agoraStore.join(channelId, userId);
    } else if (!isOnStage) {
      // Only leave if we're in this specific channel
      const current = getAgoraState();
      if (current.channelId === channelId) {
        agoraStore.leave();
      }
    }
  }, [channelId, userId, isOnStage]);

  return {
    joined: state.joined,
    isMuted: state.isMuted,
    toggleMute: () => { agoraStore.toggleMute(); },
  };
}
