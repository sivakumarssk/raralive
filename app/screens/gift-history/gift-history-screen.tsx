import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BASE_URL, MEDIA_BASE } from '@/services/api';
import { authStore } from '@/store/auth-store';

type GiftEvent = {
  id: string; coins: number; quantity: number; gems_earned: number;
  gift_name: string; gift_image_url: string | null; created_at: string;
  room_name: string; room_id: string;
  sender_name: string | null; sender_username: string | null; sender_avatar: string | null;
};

function resolveImg(url: string | null | undefined) {
  if (!url) return null;
  try { return `${MEDIA_BASE}${new URL(url).pathname}`; }
  catch { return `${MEDIA_BASE}/${url.replace(/^\//, '')}`; }
}

function monthLabel(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export function GiftHistoryScreen() {
  const router = useRouter();
  const [events, setEvents] = useState<GiftEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = authStore.getToken();
    if (!token) { setLoading(false); return; }
    fetch(`${BASE_URL}/tasks/gem-history`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => { if (j.success) setEvents(j.data?.chatroom?.events ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const grouped = events.reduce<Record<string, GiftEvent[]>>((acc, ev) => {
    const key = monthLabel(ev.created_at);
    if (!acc[key]) acc[key] = [];
    acc[key].push(ev);
    return acc;
  }, {});

  const totalGems = events.reduce((s, e) => s + e.gems_earned, 0);

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#1C1E22" />
        </TouchableOpacity>
        <Text style={s.title}>Gift History</Text>
        <View style={s.gemTotBadge}>
          <Ionicons name="diamond" size={13} color="#7A0EED" />
          <Text style={s.gemTotText}>{totalGems.toLocaleString()}</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color="#7A0EED" style={{ marginTop: 40 }} />
      ) : events.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="gift-outline" size={48} color="#D8D3EC" />
          <Text style={s.emptyText}>No gifts received yet</Text>
          <Text style={s.emptyHint}>Gifts you receive in chat rooms will appear here</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          {Object.entries(grouped).map(([month, evs]) => {
            const monthGems = evs.reduce((sum, e) => sum + e.gems_earned, 0);
            return (
              <View key={month} style={s.group}>
                <View style={s.groupHeader}>
                  <Text style={s.groupMonth}>{month}</Text>
                  <View style={s.groupGemBadge}>
                    <Ionicons name="diamond" size={11} color="#A855F7" />
                    <Text style={s.groupGems}>+{monthGems.toLocaleString()}</Text>
                  </View>
                </View>
                {evs.map((ev, i) => {
                  const imgUri = resolveImg(ev.gift_image_url);
                  const senderLabel = ev.sender_name || (ev.sender_username ? `@${ev.sender_username}` : 'Someone');
                  return (
                    <View key={ev.id} style={[s.row, i < evs.length - 1 && s.rowBorder]}>
                      <View style={s.giftImgWrap}>
                        {imgUri
                          ? <Image source={{ uri: imgUri }} style={s.giftImg} resizeMode="contain" />
                          : <Text style={s.giftEmoji}>🎁</Text>}
                      </View>
                      <View style={s.rowInfo}>
                        <Text style={s.rowTitle} numberOfLines={1}>
                          {ev.gift_name} × {ev.quantity}
                        </Text>
                        <Text style={s.rowRoom} numberOfLines={1}>{ev.room_name}</Text>
                        <Text style={s.rowSender} numberOfLines={1}>from {senderLabel}</Text>
                      </View>
                      <View style={s.rowRight}>
                        <View style={s.gemsRow}>
                          <Ionicons name="diamond" size={11} color="#A855F7" />
                          <Text style={s.rowGems}>+{ev.gems_earned.toLocaleString()}</Text>
                        </View>
                        <Text style={s.rowTime}>
                          {new Date(ev.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F4FD' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#F7F4FD', gap: 10,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: '#1C1E22' },
  gemTotBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F2EAFF', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  gemTotText: { fontSize: 13, fontWeight: '800', color: '#7A0EED' },
  scroll: { paddingHorizontal: 16, paddingBottom: 40, gap: 14 },
  group: {
    backgroundColor: '#FFFFFF', borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#7A0EED', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  groupHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#F9F5FF',
  },
  groupMonth: { fontSize: 13, fontWeight: '700', color: '#1C1E22' },
  groupGemBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  groupGems: { fontSize: 12, fontWeight: '700', color: '#A855F7' },
  row: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, paddingHorizontal: 14, paddingVertical: 13,
  },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0EDF8' },
  giftImgWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#F5F0FF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  giftImg: { width: 36, height: 36 },
  giftEmoji: { fontSize: 22 },
  rowInfo: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 13, fontWeight: '700', color: '#1C1E22' },
  rowRoom: { fontSize: 11, color: '#7A0EED', fontWeight: '600' },
  rowSender: { fontSize: 11, color: '#ABADB2' },
  rowRight: { alignItems: 'flex-end', gap: 3 },
  gemsRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  rowGems: { fontSize: 13, fontWeight: '800', color: '#A855F7' },
  rowTime: { fontSize: 10, color: '#ABADB2' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 15, color: '#B0AEC0', fontWeight: '600' },
  emptyHint: { fontSize: 13, color: '#C8C5D8', textAlign: 'center', paddingHorizontal: 40 },
});
