import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { LiveBroadcastScreen } from '@/screens/live-broadcast/live-broadcast-screen';

export default function LiveBroadcastPage() {
  const { id, channel } = useLocalSearchParams<{ id: string; channel: string }>();

  if (!id || !channel) {
    return <View style={s.root} />;
  }

  return <LiveBroadcastScreen roomId={id} channelName={channel} />;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#100C1E' },
});
