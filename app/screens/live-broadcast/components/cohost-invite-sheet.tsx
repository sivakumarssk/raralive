import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import { BASE_URL, MEDIA_BASE } from '@/services/api';
import { authStore } from '@/store/auth-store';
import type { SeatSlot } from '@/hooks/useRoomSocket';

type RoomMember = {
  userId: string;
  userName: string;
  avatarUrl: string | null;
};

function resolveAvatar(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${MEDIA_BASE}/${url.replace(/^\//, '')}`;
}

type CoHostInviteSheetProps = {
  visible: boolean;
  onClose: () => void;
  roomId: string;
  seats: SeatSlot[];
  maxCohosts: number;
  onInvite: (userId: string, slotIndex: number) => void;
};

export function CoHostInviteSheet({ visible, onClose, roomId, seats, maxCohosts, onInvite }: CoHostInviteSheetProps) {
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [loading, setLoading] = useState(false);
  const currentUserId = authStore.getUserId();

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    const token = authStore.getToken();
    fetch(`${BASE_URL}/rooms/${roomId}/members`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(j => { if (j.success) setMembers((j.data ?? []).filter((m: RoomMember) => m.userId !== currentUserId)); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible, roomId, currentUserId]);

  const cohostSeats = seats.filter(s => s.slotIndex !== 0);
  const onStageUserIds = new Set(cohostSeats.map(s => s.userId));
  const usedSlots = new Set(cohostSeats.map(s => s.slotIndex));
  const slotsAvailable = Array.from({ length: maxCohosts }, (_, i) => i + 1).filter(i => !usedSlots.has(i));
  const isFull = slotsAvailable.length === 0;

  const renderItem = ({ item }: { item: RoomMember }) => {
    const avatarUri = resolveAvatar(item.avatarUrl);
    const isOnStage = onStageUserIds.has(item.userId);

    return (
      <View style={s.row}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={s.avatar} />
        ) : (
          <View style={[s.avatar, s.avatarFallback]}>
            <Text style={s.avatarInitial}>{item.userName[0]?.toUpperCase() ?? '?'}</Text>
          </View>
        )}
        <Text style={s.name} numberOfLines={1}>{item.userName}</Text>

        {isOnStage ? (
          <View style={s.onStageBadge}>
            <Text style={s.onStageBadgeText}>Co-host</Text>
          </View>
        ) : isFull ? (
          <View style={s.fullBadge}>
            <Ionicons name="lock-closed" size={11} color="#ABADB2" />
            <Text style={s.fullBadgeText}>Full</Text>
          </View>
        ) : (
          <TouchableOpacity
            activeOpacity={0.85}
            style={s.inviteBtn}
            onPress={() => onInvite(item.userId, slotsAvailable[0])}>
            <LinearGradient colors={['#7A0EED', '#B50357']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.inviteBtnGrad}>
              <Text style={s.inviteBtnText}>Invite</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={s.backdrop} />
      </TouchableWithoutFeedback>
      <View style={s.sheet}>
        <View style={s.handle} />
        <View style={s.header}>
          <Text style={s.title}>Invite Co-host</Text>
          <Text style={s.subtitle}>{cohostSeats.length}/{maxCohosts} co-hosts</Text>
          <TouchableOpacity onPress={onClose} style={s.closeBtn} hitSlop={12}>
            <Ionicons name="close" size={20} color="#60626A" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={s.emptyWrap}><ActivityIndicator size="small" color="#7A0EED" /></View>
        ) : members.length === 0 ? (
          <View style={s.emptyWrap}><Text style={s.emptyText}>No viewers online yet</Text></View>
        ) : (
          <FlatList
            data={members}
            keyExtractor={item => item.userId}
            renderItem={renderItem}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={s.separator} />}
          />
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 10, paddingBottom: 36, maxHeight: '65%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E0DDED', alignSelf: 'center', marginBottom: 12 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0EDF8',
  },
  title: { fontSize: 17, fontWeight: '800', color: '#1C1E22' },
  subtitle: { flex: 1, fontSize: 12, color: '#ABADB2', fontWeight: '600', textAlign: 'right', marginRight: 4 },
  closeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  list: { paddingVertical: 8, paddingHorizontal: 16 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#F0EDF8' },
  emptyWrap: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#ABADB2', fontWeight: '500' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: { backgroundColor: '#EDE8F7', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 16, fontWeight: '800', color: '#7A0EED' },
  name: { flex: 1, fontSize: 14, fontWeight: '700', color: '#1C1E22' },
  inviteBtn: { borderRadius: 20, overflow: 'hidden' },
  inviteBtnGrad: { paddingHorizontal: 14, paddingVertical: 7 },
  inviteBtnText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  onStageBadge: { backgroundColor: '#F4EEFF', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  onStageBadgeText: { fontSize: 11, fontWeight: '700', color: '#7A0EED' },
  fullBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F5F5F5', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  fullBadgeText: { fontSize: 11, fontWeight: '600', color: '#ABADB2' },
});
