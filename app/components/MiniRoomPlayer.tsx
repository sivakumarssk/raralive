import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { agoraStore } from '@/store/agora-store';
import { roomStore, useMinimizedRoom } from '@/store/room-store';
import { socketStore } from '@/store/socket-store';

export function MiniRoomPlayer() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const minimized = useMinimizedRoom();

  if (!minimized) return null;

  const handleExpand = () => {
    roomStore.clear();
    router.push({ pathname: '/room/[id]', params: { id: minimized.roomId } });
  };

  const handleClose = () => {
    agoraStore.leave();
    socketStore.leave();
    roomStore.clear();
  };

  return (
    <View style={[styles.container, { bottom: insets.bottom + 72 }]}>
      <TouchableOpacity onPress={handleExpand} activeOpacity={0.9} style={styles.pill}>
        <LinearGradient
          colors={['#7A0EED', '#B50357']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}>
          {/* Avatar */}
          <View style={styles.avatarWrap}>
            {minimized.avatarUri ? (
              <Image source={{ uri: minimized.avatarUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Ionicons name="chatbubbles" size={16} color="#FFFFFF" />
              </View>
            )}
            {/* Live pulse dot */}
            <View style={styles.liveDot} />
          </View>

          {/* Room name */}
          <Text style={styles.roomName} numberOfLines={1}>{minimized.roomName}</Text>

          {/* Mic wave icon */}
          <Ionicons name="radio-outline" size={18} color="rgba(255,255,255,0.8)" />

          {/* Close */}
          <TouchableOpacity onPress={handleClose} hitSlop={8} style={styles.closeBtn}>
            <Ionicons name="close" size={16} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 999,
  },
  pill: {
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#7A0EED',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#7A0EED',
  },
  roomName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  closeBtn: {
    padding: 2,
  },
});
