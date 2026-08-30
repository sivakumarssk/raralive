import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

import { resolveImageUrl } from '@/services/api';
import { FriendZoneCallScreen } from '@/screens/friend-zone-call/friend-zone-call-screen';
import { authStore } from '@/store/auth-store';
import {
  friendZoneCallSessionStore,
  getFriendZoneCallSessionState,
  subscribeFriendZoneCallSession,
} from '@/store/friend-zone-call-session-store';
import {
  friendZoneCallStore,
  getFriendZoneCallState,
  subscribeFriendZoneCall,
} from '@/store/friend-zone-call-store';

export default function FriendZoneCallPage() {
  const router = useRouter();
  const session = useSyncExternalStore(subscribeFriendZoneCallSession, getFriendZoneCallSessionState);
  const call = useSyncExternalStore(subscribeFriendZoneCall, getFriendZoneCallState);
  const currentUser = authStore.getUser();
  const self = {
    name: currentUser?.fullName || currentUser?.username || 'You',
    avatarUri: currentUser?.avatarUrl ? resolveImageUrl(currentUser.avatarUrl) : undefined,
  };

  // The call screen can be reached from wherever an incoming call happened
  // to interrupt. Trying to force-navigate to a specific nested tab route
  // (e.g. '/(tabs)/live') via router.replace crashes — expo-router's REPLACE
  // action doesn't resolve nested tab routes that way. router.back() is the
  // reliable option; ChatRoomsScreen's own focus effect
  // (consumePendingReturnToFriendZone) switches to the Friend Zone sub-tab
  // whenever the user is next on the Live tab, even if back() doesn't land
  // there immediately.
  const leaveCallScreen = useCallback(() => {
    router.back();
  }, [router]);

  // Every path that ends a call (manual reject/cancel, the 'ended'/'failed'
  // socket events, or the ring timeout) eventually resets phase back to
  // 'idle' — the session store itself now guarantees this with its own
  // auto-reset timer for the 'ended' summary state, so it fires even if
  // this screen was never mounted (e.g. a call declined from the global
  // IncomingCallOverlay alone). This effect just needs to leave the screen
  // once that reset reaches this component, if it's still on screen.
  const wasActiveRef = useRef(false);
  useEffect(() => {
    if (session.phase !== 'idle') wasActiveRef.current = true;
    else if (wasActiveRef.current) {
      wasActiveRef.current = false;
      leaveCallScreen();
    }
  }, [session.phase, leaveCallScreen]);

  return (
    <FriendZoneCallScreen
      phase={session.phase}
      callId={session.callId}
      callType={session.callType}
      peer={session.peer}
      self={self}
      isIncoming={session.isIncoming}
      lowBalanceWarning={session.lowBalanceWarning}
      endReason={session.endReason}
      localUid={call.uid}
      remoteUid={call.remoteUid}
      isMicMuted={call.isMicMuted}
      isCameraOff={call.isCameraOff}
      isSpeakerOn={call.isSpeakerOn}
      onEnd={() => friendZoneCallSessionStore.endActive()}
      onCancel={() => (session.isIncoming ? friendZoneCallSessionStore.rejectIncoming() : friendZoneCallSessionStore.cancelOutgoing())}
      onToggleMic={() => friendZoneCallStore.toggleMic()}
      onToggleCamera={() => friendZoneCallStore.toggleCamera()}
      onSwitchCamera={() => friendZoneCallStore.switchCamera()}
      onToggleSpeaker={() => friendZoneCallStore.toggleSpeaker()}
      onRecharge={() => router.push('/wallet' as any)}
      onDismissEnded={() => {
        friendZoneCallSessionStore.dismissEnded();
        leaveCallScreen();
      }}
    />
  );
}
