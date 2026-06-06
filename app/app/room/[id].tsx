import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { RoomDetailScreen } from '@/screens/room-detail/room-detail-screen';
import { BASE_URL } from '@/services/api';

export default function RoomDetailPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  // If id looks like a room code (RM-XXXXXX), resolve it to a UUID first
  const isRoomCode = id?.startsWith('RM-');
  const [resolvedId, setResolvedId] = useState<string | null>(isRoomCode ? null : (id ?? null));

  useEffect(() => {
    if (!isRoomCode || !id) return;
    fetch(`${BASE_URL}/rooms/by-code/${encodeURIComponent(id)}`)
      .then(r => r.json())
      .then(json => {
        if (json.success) setResolvedId(json.data.id);
        else router.back();
      })
      .catch(() => router.back());
  }, [id, isRoomCode]);

  if (!resolvedId) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#7A0EED" />
      </View>
    );
  }

  return (
    <RoomDetailScreen
      roomId={resolvedId}
      onBack={() => router.back()}
    />
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
});
