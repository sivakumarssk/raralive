import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getLevelImage } from '@/screens/room-detail/components/room-level-up';

export type MyChatRoom = {
  id: string;
  name: string;
  onlineCount: number;
  avatarUri?: string;
  level?: number;
};

type MyChatroomCardProps = {
  room: MyChatRoom;
  onPress?: () => void;
};

export function MyChatroomCard({ room, onPress }: MyChatroomCardProps) {
  const levelImg = getLevelImage(room.level ?? 0);
  return (
    <View style={styles.wrapper}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.card}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {room.avatarUri ? (
            <Image source={{ uri: room.avatarUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Ionicons name="person" size={24} color="#7A0EED" />
            </View>
          )}
          <View style={styles.avatarRing} />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{room.onlineCount}</Text>
          </View>
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.roomName} numberOfLines={1}>{room.name}</Text>
          <View style={styles.metaRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>{room.onlineCount} ONLINE</Text>
            <Text style={styles.pipe}>|</Text>
            <ExpoImage source={levelImg} style={styles.levelImg} contentFit="contain" />
          </View>
        </View>

        <Ionicons name="chevron-forward" size={16} color="#ABADB2" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#7A0EED',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    gap: 13,
  },
  avatarContainer: {
    position: 'relative',
    width: 52,
    height: 52,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    margin: 2,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    margin: 2,
    backgroundColor: '#EDE8F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRing: {
    position: 'absolute',
    inset: 0,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#7A0EED',
  },
  badge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#7A0EED',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  info: {
    flex: 1,
    gap: 3,
  },
  roomName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1E22',
    letterSpacing: -0.1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#7A0EED',
  },
  onlineText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7A0EED',
    letterSpacing: 0.3,
  },
  pipe: {
    fontSize: 11,
    color: '#ABADB2',
  },
  levelImg: {
    width: 18,
    height: 18,
  },
});
