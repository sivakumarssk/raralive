import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getLevelImage } from '@/screens/room-detail/components/room-level-up';

export type PopularRoom = {
  id: string;
  name: string;
  onlineCount: number;
  memberCount: number;
  imageUri?: string;
  category?: string;
  level?: number;
};

type PopularRoomItemProps = {
  room: PopularRoom;
  onPress?: () => void;
};

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export function PopularRoomItem({ room, onPress }: PopularRoomItemProps) {
  const isHighOnline = room.onlineCount >= 100;
  const levelImg = getLevelImage(room.level ?? 0);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.container}>
      {/* Avatar */}
      <View style={styles.imageContainer}>
        {room.imageUri ? (
          <Image source={{ uri: room.imageUri }} style={styles.image} />
        ) : (
          <View style={styles.imageFallback}>
            <Ionicons name="chatbubbles" size={24} color="#7A0EED" />
          </View>
        )}
        <View style={styles.memberBadge}>
          <Text style={styles.memberBadgeText}>{formatCount(room.memberCount)}</Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.roomName} numberOfLines={1}>{room.name}</Text>
        <View style={styles.metaRow}>
          <Text style={[styles.onlineText, isHighOnline && styles.onlineHigh]}>
            {formatCount(room.onlineCount)} ONLINE
          </Text>
          <Text style={styles.pipe}>|</Text>
          <ExpoImage source={levelImg} style={styles.levelImg} contentFit="contain" />
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color="#ABADB2" />

      {/* Row divider */}
      <View style={styles.divider} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 13,
    backgroundColor: '#FAFAFA',
  },
  imageContainer: {
    position: 'relative',
    width: 52,
    height: 52,
  },
  image: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  imageFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EDE8F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberBadge: {
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
    borderColor: '#FAFAFA',
  },
  memberBadgeText: {
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
    fontWeight: '600',
    color: '#1C1E22',
    letterSpacing: -0.1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  onlineText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#60626A',
    letterSpacing: 0.3,
  },
  onlineHigh: {
    color: '#7A0EED',
  },
  pipe: {
    fontSize: 11,
    color: '#ABADB2',
  },
  levelImg: {
    width: 18,
    height: 18,
  },
  divider: {
    position: 'absolute',
    bottom: 0,
    left: 81,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#EFEFEF',
  },
});
