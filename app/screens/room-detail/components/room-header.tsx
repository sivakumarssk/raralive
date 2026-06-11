import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
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
  hasRoomBg?: boolean;
};

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

const MENU_ITEMS = [
  { key: 'gift-history', icon: 'gift-outline' as const, label: 'Gift History' },
  { key: 'co-host',      icon: 'people-outline' as const, label: 'Assign Co-Host' },
] as const;

type DropdownProps = {
  visible: boolean;
  onClose: () => void;
  onGiftHistory: () => void;
  onAssignCoHost: () => void;
};

function Dropdown({ visible, onClose, onGiftHistory, onAssignCoHost }: DropdownProps) {
  if (!visible) return null;
  const handlers: Record<string, () => void> = {
    'gift-history': () => { onClose(); onGiftHistory(); },
    'co-host':      () => { onClose(); onAssignCoHost(); },
  };
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={dd.overlay} />
      </TouchableWithoutFeedback>
      <View style={dd.menu}>
        {MENU_ITEMS.map((item, i) => (
          <TouchableOpacity
            key={item.key}
            onPress={handlers[item.key]}
            activeOpacity={0.75}
            style={[dd.item, i < MENU_ITEMS.length - 1 && dd.itemBorder]}>
            <Ionicons name={item.icon} size={16} color="#7A0EED" />
            <Text style={dd.itemLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Modal>
  );
}

export function RoomHeader({ name, agencyName, memberCount, level = 1, roomId, totalCoins = 0, onBack, onShare, hasRoomBg }: RoomHeaderProps) {
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const levelAsset = getLevelImage(level);

  const iconColor  = hasRoomBg ? '#FFFFFF' : '#7A0EED';
  const iconColor2 = hasRoomBg ? 'rgba(255,255,255,0.85)' : '#60626A';

  return (
    <View style={[styles.container, hasRoomBg && styles.containerBg]}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={8}>
        <Ionicons name="arrow-back" size={22} color={iconColor} />
      </TouchableOpacity>

      <View style={styles.titleBlock}>
        <Text style={[styles.roomName, hasRoomBg && styles.roomNameBg]} numberOfLines={1}>{name}</Text>
        <View style={styles.memberRow}>
          <Ionicons name="people" size={13} color={iconColor} />
          <Text style={[styles.memberText, hasRoomBg && styles.memberTextBg]}>{formatCount(memberCount)}</Text>
          {agencyName && (
            <>
              <Text style={[styles.dot, hasRoomBg && styles.dotBg]}>·</Text>
              <Text style={[styles.memberText, hasRoomBg && styles.memberTextBg]}>{agencyName}</Text>
            </>
          )}
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity onPress={onShare} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="share-social-outline" size={20} color={iconColor2} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push({ pathname: '/performance', params: { roomId: roomId ?? '', level: String(level), totalCoins: String(totalCoins) } } as any)}
          hitSlop={8} activeOpacity={0.75}>
          <ExpoImage source={levelAsset} style={styles.levelImage} contentFit="contain" />
        </TouchableOpacity>

        <View>
          <TouchableOpacity onPress={() => setMenuVisible(v => !v)} style={styles.iconBtn} hitSlop={8}>
            <Ionicons name="ellipsis-vertical" size={20} color={iconColor2} />
          </TouchableOpacity>
          <Dropdown
            visible={menuVisible}
            onClose={() => setMenuVisible(false)}
            onGiftHistory={() => router.push('/gift-history' as any)}
            onAssignCoHost={() => { /* TODO */ }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#FFFFFF', gap: 10,
  },
  containerBg: {
    backgroundColor: 'transparent',
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  titleBlock: { flex: 1, gap: 2 },
  roomName: { fontSize: 17, fontWeight: '800', color: '#1C1E22', letterSpacing: -0.3 },
  roomNameBg: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  memberText: { fontSize: 12, color: '#7A0EED', fontWeight: '600' },
  memberTextBg: { color: 'rgba(255,255,255,0.9)' },
  dot: { fontSize: 12, color: '#ABADB2' },
  dotBg: { color: 'rgba(255,255,255,0.5)' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  levelImage: { width: 30, height: 30 },
});

const dd = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject },
  menu: {
    position: 'absolute',
    top: 95, right: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12, minWidth: 170,
    shadowColor: '#000', shadowOpacity: 0.15,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 12, overflow: 'hidden',
  },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  itemBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0EDF8' },
  itemLabel: { fontSize: 14, fontWeight: '600', color: '#1C1E22' },
});
