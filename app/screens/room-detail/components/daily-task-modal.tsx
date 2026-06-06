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
const SHEET_HEIGHT = SCREEN_H * 0.78;

type Tab = 'tasks' | 'top-hosts' | 'winners';

type TaskItem = {
  task_id: string; title: string; description: string; type: 'daily' | 'weekly';
  target_coins: number | null; target_gift_id: string | null; target_count: number;
  reward_gems: number; icon_type: 'emoji' | 'image'; icon_value: string;
  progress: number; completed: boolean; completed_at: string | null; reward_claimed: boolean;
  gift_name: string | null; gift_image_url: string | null;
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

function TaskCard({ task, onClaim }: { task: TaskItem; onClaim: (id: string) => void }) {
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
        <View style={tab.rewardRow}>
          <Text style={tab.rewardText}>💎 {task.reward_gems} gems</Text>
          {task.completed && !task.reward_claimed && (
            <TouchableOpacity onPress={() => onClaim(task.task_id)} style={tab.claimBtn} activeOpacity={0.8}>
              <Text style={tab.claimBtnText}>Claim</Text>
            </TouchableOpacity>
          )}
          {task.reward_claimed && <Text style={tab.claimedText}>✓ Claimed</Text>}
        </View>
      </View>
    </View>
  );
}

function TasksTab({ roomId }: { roomId?: string }) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimMsg, setClaimMsg] = useState('');

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

  useEffect(() => { load(); }, [roomId]);

  const handleClaim = async (taskId: string) => {
    const token = authStore.getToken();
    if (!token) return;
    const res = await fetch(`${BASE_URL}/tasks/claim`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId }),
    }).then(r => r.json());
    if (res.success) {
      setClaimMsg(`💎 +${res.data.gems_awarded} gems claimed!`);
      setTasks(prev => prev.map(t => t.task_id === taskId ? { ...t, reward_claimed: true } : t));
      setTimeout(() => setClaimMsg(''), 2500);
    }
  };

  const dailyTasks = tasks.filter(t => t.type === 'daily');

  if (loading) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#ABADB2', fontSize: 14 }}>Loading tasks…</Text>
    </View>
  );

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={tab.scroll}>
      {claimMsg ? (
        <View style={tab.claimBanner}>
          <Text style={tab.claimBannerText}>{claimMsg}</Text>
        </View>
      ) : null}

      {dailyTasks.length > 0 && (
        <View style={tab.section}>
          <Text style={tab.sectionTitle}>Daily Tasks</Text>
          {dailyTasks.map(task => (
            <TaskCard key={task.task_id} task={task} onClaim={handleClaim} />
          ))}
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

// ── Top Hosts Tab ─────────────────────────────────────────────────────────────

type TopHost = {
  id: string; full_name: string | null; username: string | null;
  avatar_url: string | null; total_coins: number;
};

function TopHostsTab() {
  const [hosts, setHosts] = useState<TopHost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = authStore.getToken();
    if (!token) { setLoading(false); return; }
    fetch(`${BASE_URL}/tasks/top-hosts`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => { if (j.success) setHosts(j.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#ABADB2', fontSize: 14 }}>Loading…</Text>
    </View>
  );

  if (hosts.length === 0) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <Text style={{ fontSize: 36 }}>🏆</Text>
      <Text style={{ color: '#ABADB2', fontSize: 14 }}>No data yet this week</Text>
    </View>
  );

  const MEDAL = ['🥇', '🥈', '🥉'];

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 12 }}>
      <Text style={th.sectionLabel}>This week's top gifted hosts</Text>
      {hosts.map((host, i) => {
        const name = host.username ?? host.full_name ?? 'Host';
        const uri = host.avatar_url ? `${MEDIA_BASE}/${host.avatar_url.replace(/^\//, '')}` : null;
        return (
          <View key={host.id} style={th.row}>
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
              <Text style={th.sub}>received this week</Text>
            </View>
            <View style={th.coinsBadge}>
              <Text style={th.coinsText}>🪙 {formatCoins(Number(host.total_coins))}</Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

// ── Winners Tab ───────────────────────────────────────────────────────────────

type Winner = {
  id: string; full_name: string | null; username: string | null;
  avatar_url: string | null; completed_at: string | null;
  task_title: string; reward_gems: number;
};

function WinnersTab() {
  const [winners, setWinners] = useState<Winner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = authStore.getToken();
    if (!token) { setLoading(false); return; }
    fetch(`${BASE_URL}/tasks/winners`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => { if (j.success) setWinners(j.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#ABADB2', fontSize: 14 }}>Loading…</Text>
    </View>
  );

  if (winners.length === 0) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <Text style={{ fontSize: 36 }}>🎉</Text>
      <Text style={{ color: '#ABADB2', fontSize: 14 }}>No winners yet this week</Text>
    </View>
  );

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 12 }}>
      <Text style={th.sectionLabel}>Hosts who completed tasks this week</Text>
      {winners.map((w, i) => {
        const name = w.username ?? w.full_name ?? 'Host';
        const uri = w.avatar_url ? `${MEDIA_BASE}/${w.avatar_url.replace(/^\//, '')}` : null;
        return (
          <View key={`${w.id}_${i}`} style={th.row}>
            <Text style={th.rank}>🏅</Text>
            <View style={th.avatar}>
              {uri
                ? <Image source={{ uri }} style={th.avatarImg} />
                : <View style={[th.avatarImg, { backgroundColor: '#B50357', alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{name[0]?.toUpperCase()}</Text>
                  </View>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={th.name}>{name}</Text>
              <Text style={th.sub}>{w.task_title}</Text>
            </View>
            <View style={[th.coinsBadge, { backgroundColor: '#E8F5E9' }]}>
              <Text style={[th.coinsText, { color: '#2E7D32' }]}>💎 {w.reward_gems}</Text>
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

type Props = { visible: boolean; onClose: () => void; roomId?: string };

export function DailyTaskModal({ visible, onClose, roomId }: Props) {
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
    { key: 'top-hosts', label: 'Top hosts' },
    { key: 'winners', label: 'Winners' },
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
          {activeTab === 'tasks' && <TasksTab roomId={roomId} />}
          {activeTab === 'top-hosts' && <TopHostsTab />}
          {activeTab === 'winners' && <WinnersTab />}
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
});
