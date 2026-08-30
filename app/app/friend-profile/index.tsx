import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Friend } from '@/screens/chat-rooms/components/friend-zone-screen';
import { FriendProfileScreen } from '@/screens/friend-profile/friend-profile-screen';
import { friendZoneCallSessionStore } from '@/store/friend-zone-call-session-store';

export default function FriendProfilePage() {
  const router = useRouter();
  const { friend: friendParam } = useLocalSearchParams<{ friend?: string }>();

  const friend = useMemo<Friend | null>(() => {
    if (!friendParam) return null;
    try { return JSON.parse(friendParam); } catch { return null; }
  }, [friendParam]);

  if (!friend) {
    return <View style={s.center} />;
  }

  return (
    <FriendProfileScreen
      friend={friend}
      onBack={() => router.back()}
      onAudioCall={() => friendZoneCallSessionStore.startCall(
        friend.id, { id: friend.id, full_name: friend.name, username: null, avatar_url: friend.avatarUri ?? null }, 'audio',
      )}
      onVideoCall={() => friendZoneCallSessionStore.startCall(
        friend.id, { id: friend.id, full_name: friend.name, username: null, avatar_url: friend.avatarUri ?? null }, 'video',
      )}
      onFollow={() => {}}
    />
  );
}

const s = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#FFFFFF' },
});
