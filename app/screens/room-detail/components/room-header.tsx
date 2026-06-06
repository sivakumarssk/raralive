import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getLevelImage } from './room-level-up';

type RoomHeaderProps = {
  name: string;
  agencyName?: string;
  memberCount: number;
  level?: number;
  roomId?: string;
  totalCoins?: number;
  onBack: () => void;
  onShare?: () => void;
  onMore?: () => void;
};

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function RoomHeader({ name, agencyName, memberCount, level = 1, roomId, totalCoins = 0, onBack, onShare, onMore }: RoomHeaderProps) {
  const router = useRouter();
  const levelImage = getLevelImage(level);
  return (
    <View style={styles.container}>
      {/* Back */}
      <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={8}>
        <Ionicons name="arrow-back" size={22} color="#7A0EED" />
      </TouchableOpacity>

      {/* Title */}
      <View style={styles.titleBlock}>
        <Text style={styles.roomName} numberOfLines={1}>{name}</Text>
        <View style={styles.memberRow}>
          <Ionicons name="people" size={13} color="#7A0EED" />
          <Text style={styles.memberText}>{formatCount(memberCount)}</Text>
          {agencyName && (
            <>
              <Text style={styles.dot}>·</Text>
              <Text style={styles.memberText}>{agencyName}</Text>
            </>
          )}
        </View>
      </View>

      {/* Right actions */}
      <View style={styles.actions}>

        {/* Share */}
        <TouchableOpacity onPress={onShare} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="share-social-outline" size={20} color="#60626A" />
        </TouchableOpacity>

        {/* Level badge */}
        <TouchableOpacity onPress={() => router.push({ pathname: '/performance', params: { roomId: roomId ?? '', level: String(level), totalCoins: String(totalCoins) } } as any)} hitSlop={8} activeOpacity={0.75}>
          <Image source={levelImage} style={styles.levelImage} resizeMode="contain" />
        </TouchableOpacity>

        {/* More */}
        <TouchableOpacity onPress={onMore} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="ellipsis-vertical" size={20} color="#60626A" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    flex: 1,
    gap: 2,
  },
  roomName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1C1E22',
    letterSpacing: -0.3,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  memberText: {
    fontSize: 12,
    color: '#7A0EED',
    fontWeight: '600',
  },
  dot: {
    fontSize: 12,
    color: '#ABADB2',
    fontWeight: '400',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelImage: {
    width: 30,
    height: 30,
  },
});
