import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COIN_IMG = require('@/assets/tabs/coin.png');

export type CallDirection = 'incoming' | 'outgoing';

export type CallHistoryEntry = {
  id: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  userId: string;
  level: number;
  callType: 'audio' | 'video';
  direction: CallDirection;
  avatarUri?: string;
  isOnline: boolean;
  durationLabel: string;
  // Outgoing calls (you called) are billed in coins; incoming calls (you
  // were called) earn gems — mirrors the room-gift economy (sender pays
  // coins, recipient earns gems).
  coinsSpent: number;
  gemsEarned: number;
  dateLabel: string;
};

type CallHistoryScreenProps = {
  entries: CallHistoryEntry[];
  onBack?: () => void;
  onEntryPress?: (entry: CallHistoryEntry) => void;
};

type FilterTab = 'incoming' | 'outgoing';

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'incoming', label: 'Incoming' },
  { key: 'outgoing', label: 'Outgoing' },
];

function EntryRow({ entry, onPress }: {
  entry: CallHistoryEntry;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={row.card} onPress={onPress} activeOpacity={0.85}>
      <Ionicons name="chevron-forward" size={18} color="#D8D3EC" style={row.chevron} />

      <View style={row.topRow}>
        <View style={row.avatarWrap}>
          {entry.avatarUri ? (
            <Image source={{ uri: entry.avatarUri }} style={row.avatar} />
          ) : (
            <View style={[row.avatar, row.avatarFallback]}>
              <Text style={row.avatarInitial}>{entry.name[0]?.toUpperCase()}</Text>
            </View>
          )}
          {entry.isOnline && <View style={row.onlineDot} />}
        </View>

        <View style={row.info}>
          <View style={row.nameRow}>
            <Text style={row.name} numberOfLines={1}>{entry.name}</Text>
            <View style={row.genderPill}>
              <Ionicons name={entry.gender === 'Female' ? 'female' : 'male'} size={12} color="#5B8DEF" />
              <Text style={row.genderPillText}>{entry.age}</Text>
            </View>
          </View>

          <Text style={row.idText} numberOfLines={1}>ID: {entry.userId}</Text>

          <View style={row.metaRow}>
            <Ionicons name="star" size={12} color="#7A0EED" />
            <Text style={row.metaText}>Level {entry.level}</Text>
            <Text style={row.metaDivider}>|</Text>
            <Ionicons
              name={entry.direction === 'incoming' ? 'arrow-down' : 'arrow-up'}
              size={12}
              color={entry.direction === 'incoming' ? '#22C55E' : '#7A0EED'}
            />
            <Ionicons name={entry.callType === 'video' ? 'videocam' : 'call'} size={12} color="#7A0EED" />
            <Text style={row.metaText}>{entry.callType === 'video' ? 'Video Call' : 'Audio Call'}</Text>
          </View>
        </View>
      </View>

      <View style={row.statsRow}>
        <View style={row.statBlock}>
          <View>
            <Text style={row.statValue}>{entry.durationLabel}</Text>
            <Text style={row.statLabel}>Call Duration</Text>
          </View>
        </View>
        <View style={row.statBlock}>
          <Image source={COIN_IMG} style={row.coinImg} resizeMode="contain" />
          <View>
            <Text style={row.coinsValue}>
              {entry.direction === 'outgoing' ? entry.coinsSpent : entry.gemsEarned}
            </Text>
            <Text style={row.statLabel}>
              {entry.direction === 'outgoing' ? 'Coins Spent' : 'Gems Earned'}
            </Text>
          </View>
        </View>
      </View>

      <View style={row.footer}>
        <Ionicons name="calendar-outline" size={12} color="#ABADB2" />
        <Text style={row.dateText}>{entry.dateLabel}</Text>
      </View>
    </TouchableOpacity>
  );
}

export function CallHistoryScreen({ entries, onBack, onEntryPress }: CallHistoryScreenProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>('incoming');
  const filteredEntries = entries.filter(e => e.direction === activeTab);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={s.backBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color="#1C1E22" />
          </TouchableOpacity>
        )}
        <View style={s.headerTextWrap}>
          <Text style={s.headerTitle}>Call History</Text>
          <Text style={s.headerSubtitle}>View your recent calls and earnings</Text>
        </View>
      </View>

      <View style={s.tabRow}>
        {TABS.map(tab => {
          const isActive = tab.key === activeTab;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.8}
              style={[s.tabBtn, isActive && s.tabBtnActive]}>
              <Text style={[s.tabText, isActive && s.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {filteredEntries.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="time-outline" size={36} color="#D8D3EC" />
            <Text style={s.emptyText}>No {activeTab} calls yet</Text>
          </View>
        ) : (
          filteredEntries.map(entry => (
            <EntryRow
              key={entry.id}
              entry={entry}
              onPress={() => onEntryPress?.(entry)}
            />
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F3FA' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16,
    backgroundColor: '#F5F3FA',
  },
  backBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  headerTextWrap: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1C1E22' },
  headerSubtitle: { fontSize: 13, color: '#8B8D96', fontWeight: '500', marginTop: 2 },

  tabRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 16, paddingBottom: 12,
  },
  tabBtn: {
    flex: 1, height: 38, borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  tabBtnActive: { backgroundColor: '#7A0EED' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#8B8D96' },
  tabTextActive: { color: '#FFFFFF' },

  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 12 },

  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 10 },
  emptyText: { fontSize: 13, color: '#B0AEC0', fontWeight: '500' },
});

const row = StyleSheet.create({
  card: {
    position: 'relative',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    shadowColor: '#7A0EED',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingRight: 22 },
  avatarWrap: { position: 'relative', width: 52, height: 52 },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: { backgroundColor: '#EDE8F7', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 18, fontWeight: '700', color: '#7A0EED' },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 11, height: 11, borderRadius: 5.5,
    backgroundColor: '#22C55E', borderWidth: 2, borderColor: '#FFFFFF',
  },

  info: { flex: 1, gap: 5 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 15, fontWeight: '800', color: '#1C1E22', letterSpacing: -0.2, flexShrink: 1 },
  genderPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#EAF1FF', borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  genderPillText: { fontSize: 11, fontWeight: '700', color: '#5B8DEF' },

  idText: { fontSize: 12, color: '#8B8D96', fontWeight: '500' },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  metaText: { fontSize: 12, fontWeight: '600', color: '#5B3B99' },
  metaDivider: { fontSize: 12, color: '#D8D3EC' },

  statsRow: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F0EDF8',
  },
  statBlock: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  coinImg: { width: 22, height: 22 },
  statValue: { fontSize: 13, fontWeight: '800', color: '#1C1E22' },
  statLabel: { fontSize: 10, color: '#ABADB2', fontWeight: '500', marginTop: 1 },
  coinsValue: { fontSize: 13, fontWeight: '800', color: '#7A0EED' },

  chevron: { position: 'absolute', top: 16, right: 14, zIndex: 1 },

  footer: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F0EDF8',
  },
  dateText: { fontSize: 11, color: '#ABADB2', fontWeight: '500' },
});
