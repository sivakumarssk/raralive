import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BASE_URL, MEDIA_BASE } from '@/services/api';
import { authStore } from '@/store/auth-store';

const COIN_IMG = require('@/assets/tabs/coin.png');
const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_H * 0.55;

type Tab = 'tasks' | 'top-gifters';

type TaskItem = {
  task_id: string; title: string; description: string; type: 'daily' | 'weekly';
  target_coins: number | null; target_gift_id: string | null; target_count: number;
  icon_type: 'emoji' | 'image'; icon_value: string;
  progress: number; completed: boolean; completed_at: string | null; reward_claimed: boolean;
  gift_name: string | null; gift_image_url: string | null;
  reward_bg_url: string | null; reward_frame_url: string | null;
};

function formatCoins(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return String(n);
}

function ProgressBar({ progress, goal, color = '#7A0EED' }: { progress: number; goal: number; color?: string }) {
  const pct = Math.min(progress / goal, 1);
  return (
    <View style={pb.track}>
      <View style={[pb.fill, { width: `${pct * 100}%` as any, backgroundColor: color }]} />
    </View>
  );
}
const pb = StyleSheet.create({
  track: { flex: 1, height: 8, backgroundColor: '#E8E4F5', borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
});

function TaskIcon({ task }: { task: TaskItem }) {
  if (task.icon_type === 'image') {
    const uri = task.icon_value ? `${MEDIA_BASE}/${task.icon_value.replace(/^\//, '')}` : null;
    if (uri) return <Image source={{ uri }} style={tab.iconImg} resizeMode="contain" />;
  }
  if (task.icon_value === '__coin__') return <Image source={COIN_IMG} style={tab.coinImg} resizeMode="contain" />;
  return <Text style={tab.taskEmoji}>{task.icon_value}</Text>;
}

function TaskCard({ task }: { task: TaskItem }) {
  const goal = task.target_coins ?? task.target_count;
  const goalLabel = task.target_coins ? formatCoins(task.target_coins) : String(task.target_count);
  const color = '#7A0EED';

  return (
    <View style={[tab.taskCard, task.completed && tab.taskCardDone]}>
      <View style={[tab.taskIcon, task.completed && { backgroundColor: '#E8F5E9' }]}>
        <TaskIcon task={task} />
        {task.completed && (
          <View style={tab.completedBadge}>
            <Ionicons name="checkmark" size={10} color="#fff" />
          </View>
        )}
      </View>
      <View style={tab.taskBody}>
        <View style={tab.progressRow}>
          <ProgressBar progress={task.progress} goal={goal} color={task.completed ? '#4CAF50' : color} />
          <Text style={[tab.progressLabel, { color: task.completed ? '#4CAF50' : color }]}>
            {formatCoins(task.progress)} / {goalLabel}
          </Text>
        </View>
        <Text style={tab.taskDesc}>{task.description}</Text>
        {task.completed && (
          <View style={tab.rewardRow}>
            <Text style={tab.claimedText}>✓ Reward applied</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function TasksTab({ roomId, refreshKey }: { roomId?: string; refreshKey?: number }) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);


  const load = () => {
    const token = authStore.getToken();
    if (!token) { setLoading(false); return; }
    fetch(`${BASE_URL}/tasks/my${roomId ? `?room_id=${roomId}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(json => { if (json.success) setTasks(json.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [roomId, refreshKey]);

  const dailyTasks = tasks.filter(t => t.type === 'daily');

  if (loading) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#ABADB2', fontSize: 14 }}>Loading tasks…</Text>
    </View>
  );

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={tab.scroll}>
      {dailyTasks.length > 0 && (
        <View style={tab.section}>
          <Text style={tab.sectionTitle}>Daily Tasks</Text>
          {dailyTasks.map(task => (
            <TaskCard key={task.task_id} task={task} />
          ))}
        </View>
      )}

      {/* Rewards */}
      {dailyTasks.some(t => t.reward_bg_url || t.reward_frame_url) && (
        <View style={tab.rewardSection}>
          <Text style={tab.rewardSectionTitle}>Rewards</Text>
          <View style={tab.rewardCards}>
            {dailyTasks.map(task => {
              const bgUri = task.reward_bg_url ? `${MEDIA_BASE}/${task.reward_bg_url.replace(/^\//, '')}` : null;
              const frameUri = task.reward_frame_url ? `${MEDIA_BASE}/${task.reward_frame_url.replace(/^\//, '')}` : null;
              const unlocked = task.reward_claimed;
              if (!bgUri && !frameUri) return null;
              return (
                <View key={task.task_id} style={tab.rewardCardRow}>
                  {bgUri && (
                    <View style={tab.rewardCard}>
                      <Image source={{ uri: bgUri }} style={tab.rewardCardImg} resizeMode="cover" />
                      {!unlocked && (
                        <View style={tab.rewardCardLock}>
                          <Ionicons name="lock-closed" size={14} color="#FFD700" />
                        </View>
                      )}
                      <View style={tab.rewardCardTag}>
                        <Text style={tab.rewardCardTagText}>1d</Text>
                      </View>
                    </View>
                  )}
                  {frameUri && (
                    <View style={tab.rewardCard}>
                      <Image source={{ uri: frameUri }} style={tab.rewardCardImg} resizeMode="cover" />
                      {!unlocked && (
                        <View style={tab.rewardCardLock}>
                          <Ionicons name="lock-closed" size={14} color="#FFD700" />
                        </View>
                      )}
                      <View style={tab.rewardCardTag}>
                        <Text style={tab.rewardCardTagText}>1d</Text>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {tasks.length === 0 && (
        <View style={{ alignItems: 'center', paddingTop: 60 }}>
          <Text style={{ fontSize: 40 }}>📋</Text>
          <Text style={{ color: '#ABADB2', marginTop: 12, fontSize: 14 }}>No tasks available yet.</Text>
        </View>
      )}
    </ScrollView>
  );
}

// ── Top Gifters Tab ──────────────────────────────────────────────────────────

type TopGifter = {
  id: string; full_name: string | null; username: string | null;
  avatar_url: string | null; total_coins: number;
};

function TopGiftersTab() {
  const [gifters, setGifters] = useState<TopGifter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = authStore.getToken();
    if (!token) { setLoading(false); return; }
    fetch(`${BASE_URL}/tasks/top-gifters`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => { if (j.success) setGifters(j.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#ABADB2', fontSize: 14 }}>Loading…</Text>
    </View>
  );

  if (gifters.length === 0) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <Text style={{ fontSize: 36 }}>🎁</Text>
      <Text style={{ color: '#ABADB2', fontSize: 14 }}>No gifters yet this week</Text>
    </View>
  );

  const MEDAL = ['🥇', '🥈', '🥉'];

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 12 }}>
      <Text style={th.sectionLabel}>Top gifters this week</Text>
      {gifters.map((g, i) => {
        const name = g.username ?? g.full_name ?? 'User';
        const uri = g.avatar_url ? `${MEDIA_BASE}/${g.avatar_url.replace(/^\//, '')}` : null;
        return (
          <View key={g.id} style={th.row}>
            <Text style={th.rank}>{MEDAL[i] ?? `#${i + 1}`}</Text>
            <View style={th.avatar}>
              {uri
                ? <Image source={{ uri }} style={th.avatarImg} />
                : <View style={[th.avatarImg, { backgroundColor: '#7A0EED', alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{name[0]?.toUpperCase()}</Text>
                  </View>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={th.name}>{name}</Text>
              <Text style={th.sub}>gifted this week</Text>
            </View>
            <View style={th.coinsBadge}>
              <Text style={th.coinsText}>🪙 {formatCoins(Number(g.total_coins))}</Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const th = StyleSheet.create({
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#ABADB2', paddingHorizontal: 20, paddingBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0EFF5' },
  rank: { fontSize: 20, width: 28, textAlign: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  name: { fontSize: 14, fontWeight: '700', color: '#1C1E22' },
  sub: { fontSize: 12, color: '#ABADB2', marginTop: 1 },
  coinsBadge: { backgroundColor: '#F0E8FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  coinsText: { fontSize: 12, fontWeight: '700', color: '#7A0EED' },
});

type Props = { visible: boolean; onClose: () => void; roomId?: string; refreshKey?: number };

export function DailyTaskModal({ visible, onClose, roomId, refreshKey }: Props) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>('tasks');
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 5,
      onPanResponderMove: (_, g) => { if (g.dy > 0) translateY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 100) close();
        else Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  function open() {
    translateY.setValue(SHEET_HEIGHT);
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
  }
  function close() {
    Animated.timing(translateY, { toValue: SHEET_HEIGHT, duration: 220, useNativeDriver: true }).start(onClose);
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'tasks', label: 'Tasks' },
    { key: 'top-gifters', label: 'Top Gifters' },
  ];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close} onShow={open}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={close} />
      <Animated.View style={[s.sheet, { height: SHEET_HEIGHT, paddingBottom: insets.bottom + 8, transform: [{ translateY }] }]}>
        <View {...panResponder.panHandlers} style={s.handleArea}>
          <View style={s.handle} />
        </View>
        <View style={s.tabBar}>
          {TABS.map(t => (
            <TouchableOpacity key={t.key} style={s.tabBtn} onPress={() => setActiveTab(t.key)} activeOpacity={0.75}>
              <Text style={[s.tabLabel, activeTab === t.key && s.tabLabelActive]}>{t.label}</Text>
              {activeTab === t.key && <View style={s.tabUnderline} />}
            </TouchableOpacity>
          ))}
        </View>
        <View style={s.content}>
          {activeTab === 'tasks' && <TasksTab roomId={roomId} refreshKey={refreshKey} />}
          {activeTab === 'top-gifters' && <TopGiftersTab />}
        </View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
  },
  handleArea: { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DDDAE8' },
  tabBar: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EBEBEB' },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, position: 'relative' },
  tabLabel: { fontSize: 15, fontWeight: '500', color: '#7A7A8A' },
  tabLabelActive: { color: '#7A0EED', fontWeight: '700' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 16, right: 16, height: 2.5, borderRadius: 2, backgroundColor: '#7A0EED' },
  content: { flex: 1 },
});

const tab = StyleSheet.create({
  scroll: { paddingBottom: 20 },
  section: { paddingHorizontal: 20, paddingTop: 16, gap: 0 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1C1E22', marginBottom: 4 },
  taskCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    paddingVertical: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EBEBEB',
  },
  taskCardDone: { opacity: 0.85 },
  taskIcon: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFF4E0',
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  completedBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 18, height: 18, borderRadius: 9, backgroundColor: '#4CAF50',
    alignItems: 'center', justifyContent: 'center',
  },
  iconImg: { width: 36, height: 36, borderRadius: 18 },
  coinImg: { width: 34, height: 34 },
  taskEmoji: { fontSize: 28 },
  taskBody: { flex: 1, gap: 6 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressLabel: { fontSize: 12, fontWeight: '700', color: '#7A0EED', minWidth: 44, textAlign: 'right' },
  taskDesc: { fontSize: 13, color: '#60626A', lineHeight: 18 },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rewardText: { fontSize: 12, fontWeight: '600', color: '#7A0EED' },
  claimBtn: { backgroundColor: '#7A0EED', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  claimBtnText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  claimedText: { fontSize: 11, fontWeight: '600', color: '#4CAF50' },
  claimBanner: {
    margin: 16, backgroundColor: '#E8F5E9', borderRadius: 12, padding: 12, alignItems: 'center',
  },
  claimBannerText: { fontSize: 14, fontWeight: '700', color: '#2E7D32' },
  rewardChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#F2EAFF', borderRadius: 20, paddingHorizontal: 7, paddingVertical: 3,
  },
  rewardChipText: { fontSize: 10, fontWeight: '700', color: '#7A0EED' },
  rewardSection: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 },
  rewardSectionTitle: { fontSize: 15, fontWeight: '800', color: '#1C1E22', marginBottom: 10 },
  rewardCards: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  rewardCardRow: { flexDirection: 'row', gap: 8 },
  rewardCard: {
    width: 80, height: 80, borderRadius: 14, overflow: 'hidden',
    backgroundColor: '#E0DDED', position: 'relative',
    borderWidth: 2, borderColor: '#C4B8E8',
  },
  rewardCardImg: { width: '100%', height: '100%' },
  rewardCardLock: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  rewardCardTag: {
    position: 'absolute', top: 3, right: 3,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  rewardCardTagText: { fontSize: 8, fontWeight: '800', color: '#FFFFFF' },
});
