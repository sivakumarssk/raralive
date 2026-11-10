import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getLevelImage } from '@/screens/room-detail/components/room-level-up';
import { avatarSource } from '@/utils/default-avatar';
import type { RoomTag } from '../room-tags';
import { RoomTagChips } from './room-tag-chips';

export type MyChatRoom = {
  id: string;
  name: string;
  onlineCount: number;
  avatarUri?: string;
  /** Picks the default avatar when there's no photo, like the profile does. */
  hostGender?: string | null;
  level?: number;
  location?: string;
  tags?: RoomTag[];
};

type MyChatroomCardProps = {
  room: MyChatRoom;
  onPress?: () => void;
  onLongPress?: () => void;
};

export function MyChatroomCard({ room, onPress, onLongPress }: MyChatroomCardProps) {
  const levelImg = getLevelImage(room.level ?? 0);
  return (
    <View style={styles.wrapper}>
      <TouchableOpacity onPress={onPress} onLongPress={onLongPress} delayLongPress={400} activeOpacity={0.85} style={styles.card}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          <Image source={avatarSource(room.avatarUri, room.hostGender)} style={styles.avatar} />
          <View style={styles.avatarRing} />
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.roomName} numberOfLines={1}>{room.name}</Text>
          <View style={styles.metaRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>{room.onlineCount} online</Text>
            <Text style={styles.pipe}>|</Text>
            <ExpoImage source={levelImg} style={styles.levelImg} contentFit="contain" />
            {!!room.location && (
              <View style={styles.locationWrap}>
                <Text style={styles.pipe}>|</Text>
                <Ionicons name="location" size={12} color="#3B82F6" />
                <Text style={styles.locationText} numberOfLines={1} ellipsizeMode="tail">{room.location}</Text>
              </View>
            )}
            {!!room.tags?.length && (
              <>
                <Text style={styles.pipe}>|</Text>
                <RoomTagChips tags={room.tags} />
              </>
            )}
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
    paddingHorizontal: 12,
    paddingVertical: 9,
    shadowColor: '#7A0EED',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    gap: 12,
  },
  avatarContainer: {
    position: 'relative',
    width: 44,
    height: 44,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    margin: 2,
  },
  avatarRing: {
    position: 'absolute',
    inset: 0,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#7A0EED',
  },
  info: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  roomName: {
    fontSize: 14,
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
  locationWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
    minWidth: 0,
  },
  locationText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#60626A',
    flexShrink: 1,
    maxWidth: 90, // long city names end in …
  },
});
