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

type Tab = 'tasks' | 'bonus';

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
          <Text style={{ fontSize: 28 }}>📋</Text>
          <Text style={{ color: '#ABADB2', marginTop: 12, fontSize: 14 }}>No tasks available yet.</Text>
        </View>
      )}
    </ScrollView>
  );
}

// ── Bonus Payment Tab ────────────────────────────────────────────────────────
// Daily Task bonus slabs (admin → Daily Task Bonus): an extra bonus on Audio
// Chat Room gems, separate from the earning slabs. Reaching a slab credits its
// amount to the wallet as Extra Bonus (done on the server).

type BonusSlab = { gems: number; amount: number; reached: boolean; credited_at: string | null };
type BonusData = { month: string; month_gems: number; slabs: BonusSlab[] };

const BONUS_INFO = 'Once you complete a slab, the corresponding bonus amount will be automatically credited to your Wallet as Extra Bonus.';

function formatInr(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function BonusPaymentTab({ refreshKey }: { refreshKey?: number }) {
  const [data, setData] = useState<BonusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    const token = authStore.getToken();
    if (!token) { setLoading(false); return; }
    fetch(`${BASE_URL}/tasks/bonus`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => { if (j.success) setData(j.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#ABADB2', fontSize: 14 }}>Loading…</Text>
    </View>
  );

  const slabs = data?.slabs ?? [];
  const gems = data?.month_gems ?? 0;
  const nextIndex = slabs.findIndex(sl => !sl.reached);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={tab.scroll}>
      <View style={bp.section}>
        {/* Heading + ? (tap for how it works) */}
        <View style={bp.headRow}>
          <Text style={bp.title}>Bonus Payment</Text>
          <TouchableOpacity onPress={() => setShowInfo(v => !v)} hitSlop={10} accessibilityLabel="How Bonus Payment works">
            <Ionicons name={showInfo ? 'help-circle' : 'help-circle-outline'} size={20} color="#7A0EED" />
          </TouchableOpacity>
        </View>
        {showInfo && (
          <View style={bp.infoBox}>
            <Ionicons name="information-circle" size={16} color="#7A0EED" style={{ marginTop: 1 }} />
            <Text style={bp.infoText}>{BONUS_INFO}</Text>
          </View>
        )}

        {slabs.length === 0 ? (
          <View style={bp.empty}>
            <Text style={{ fontSize: 28 }}>🎁</Text>
            <Text style={bp.emptyText}>No bonus slabs right now</Text>
          </View>
        ) : (
          <>
            <Text style={bp.progressLine}>
              This month: <Text style={bp.progressGems}>💎 {gems.toLocaleString('en-IN')} gems</Text>
            </Text>
            {slabs.map((sl, i) => {
              const isNext = i === nextIndex;
              return (
                <View key={sl.gems} style={[bp.slabCard, sl.reached && bp.slabCardDone]}>
                  <View style={[bp.slabBadge, sl.reached && bp.slabBadgeDone]}>
                    {sl.reached
                      ? <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                      : <Text style={bp.slabBadgeText}>{i + 1}</Text>}
                  </View>
                  <View style={bp.slabBody}>
                    <View style={bp.slabTop}>
                      <Text style={bp.slabGems}>💎 {sl.gems.toLocaleString('en-IN')} gems</Text>
                      <Text style={[bp.slabAmount, sl.reached && bp.slabAmountDone]}>{formatInr(sl.amount)}</Text>
                    </View>
                    {sl.reached ? (
                      <Text style={bp.creditedText}>✓ Credited to wallet as Extra Bonus</Text>
                    ) : isNext ? (
                      <View style={bp.nextRow}>
                        <ProgressBar progress={gems} goal={sl.gems} />
                        <Text style={bp.nextLabel}>{formatCoins(gems)} / {formatCoins(sl.gems)}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const bp = StyleSheet.create({
  section: { paddingHorizontal: 16, paddingTop: 16 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 14, fontWeight: '800', color: '#1C1E22' },
  infoBox: {
    flexDirection: 'row', gap: 6, marginTop: 8, padding: 10, borderRadius: 12,
    backgroundColor: '#F4EEFF', borderWidth: 1, borderColor: '#E4D6FF',
  },
  infoText: { flex: 1, fontSize: 12, lineHeight: 17, color: '#4B3A6B' },
  progressLine: { marginTop: 10, marginBottom: 4, fontSize: 12, color: '#7A7A8A' },
  progressGems: { fontWeight: '800', color: '#1C1E22' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 32 },
  emptyText: { color: '#ABADB2', fontSize: 14 },
  slabCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8,
    padding: 12, borderRadius: 14, backgroundColor: '#FAF8FF', borderWidth: 1, borderColor: '#EEE8FB',
  },
  slabCardDone: { backgroundColor: '#F1FAF2', borderColor: '#D6EFD9' },
  slabBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#EDE4FF', alignItems: 'center', justifyContent: 'center' },
  slabBadgeDone: { backgroundColor: '#4CAF50' },
  slabBadgeText: { fontSize: 12, fontWeight: '800', color: '#7A0EED' },
  slabBody: { flex: 1, gap: 6 },
  slabTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  slabGems: { fontSize: 13, fontWeight: '700', color: '#1C1E22' },
  slabAmount: { fontSize: 15, fontWeight: '900', color: '#7A0EED' },
  slabAmountDone: { color: '#2E7D32' },
  creditedText: { fontSize: 11, fontWeight: '600', color: '#4CAF50' },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nextLabel: { fontSize: 11, fontWeight: '700', color: '#7A0EED' },
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
    { key: 'bonus', label: 'Bonus Payment' },
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
          {activeTab === 'bonus' && <BonusPaymentTab refreshKey={refreshKey} />}
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
  tabLabel: { fontSize: 14, fontWeight: '500', color: '#7A7A8A' },
  tabLabelActive: { color: '#7A0EED', fontWeight: '700' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 16, right: 16, height: 2.5, borderRadius: 2, backgroundColor: '#7A0EED' },
  content: { flex: 1 },
});

const tab = StyleSheet.create({
  scroll: { paddingBottom: 20 },
  section: { paddingHorizontal: 16, paddingTop: 16, gap: 0 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#1C1E22', marginBottom: 4 },
  taskCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EBEBEB',
  },
  taskCardDone: { opacity: 0.85 },
  taskIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF4E0',
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  completedBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 18, height: 18, borderRadius: 9, backgroundColor: '#4CAF50',
    alignItems: 'center', justifyContent: 'center',
  },
  iconImg: { width: 28, height: 28, borderRadius: 14 },
  coinImg: { width: 26, height: 26 },
  taskEmoji: { fontSize: 22 },
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
  rewardChipText: { fontSize: 11, fontWeight: '700', color: '#7A0EED' },
  rewardSection: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  rewardSectionTitle: { fontSize: 14, fontWeight: '800', color: '#1C1E22', marginBottom: 10 },
  rewardCards: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  rewardCardRow: { flexDirection: 'row', gap: 8 },
  rewardCard: {
    width: 64, height: 64, borderRadius: 12, overflow: 'hidden',
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
  rewardCardTagText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
});
