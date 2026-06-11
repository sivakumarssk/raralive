import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useRef, useState } from 'react';
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
import { getLevelImage } from './room-level-up';

const COIN_IMG = require('@/assets/tabs/coin.png');

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_H * 0.88;

type Tab = 'levels' | 'supporters';

// Mock level rewards — horizontal scroll cards
const LEVEL_REWARDS = [
  { id: '1', emoji: '🚀', label: 'Rocket',   duration: '1 Day',  bg: '#DDF0FF', tagColor: '#4A90E2' },
  { id: '2', emoji: '💍', label: 'Ring',      duration: '1 Day',  bg: '#FFE8F0', tagColor: '#E85580' },
  { id: '3', emoji: '🏍️', label: 'Bike',      duration: '1 Day',  bg: '#2A1A3A', tagColor: '#F5A623' },
  { id: '4', emoji: '💎', label: 'Diamond',   duration: '1 Day',  bg: '#4A90D9', tagColor: '#4A90E2' },
];

// Mock top supporters
const TOP_SUPPORTERS = [
  { rank: 1, name: 'Priya_Live',  coins: 4820, avatarColor: '#F7A8D0' },
  { rank: 2, name: 'RajaStream',  coins: 3100, avatarColor: '#A8D0F7' },
  { rank: 3, name: 'DeviVoice',   coins: 2450, avatarColor: '#A8F7C6' },
  { rank: 4, name: 'KunalBeats',  coins: 1890, avatarColor: '#F7D6A8' },
  { rank: 5, name: 'AnanyaLive',  coins: 1230, avatarColor: '#D0A8F7' },
];

function formatCoins(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

type Props = { visible: boolean; onClose: () => void; level?: number };

export function PerformanceModal({ visible, onClose, level = 0 }: Props) {
  const levelImg = getLevelImage(level);
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>('levels');
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 5,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 100) {
          close();
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        }
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

  const currentLevel = 0;
  const currentCoins = 0;
  const nextLevelCoins = 5;
  const progress = 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={close}
      onShow={open}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={close} />

      <Animated.View
        style={[s.sheet, { height: SHEET_HEIGHT, paddingBottom: insets.bottom + 8, transform: [{ translateY }] }]}>

        {/* Header row */}
        <View {...panResponder.panHandlers} style={s.headerRow}>
          <TouchableOpacity onPress={close} style={s.backBtn} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color="#1C1E22" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Performance</Text>
          <View style={s.backBtn} />
        </View>

        {/* Tab bar */}
        <View style={s.tabBar}>
          {([
            { key: 'levels', label: 'Levels' },
            { key: 'supporters', label: 'Top Supporters' },
          ] as { key: Tab; label: string }[]).map(t => (
            <TouchableOpacity
              key={t.key}
              style={s.tabBtn}
              onPress={() => setActiveTab(t.key)}
              activeOpacity={0.75}>
              <Text style={[s.tabLabel, activeTab === t.key && s.tabLabelActive]}>{t.label}</Text>
              {activeTab === t.key && <View style={s.tabUnderline} />}
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {activeTab === 'levels' && (
            <>
              {/* Level hero banner */}
              <View style={s.heroBanner}>
                {/* Glow behind image */}
                <View style={s.heroGlow} />
                <ExpoImage source={levelImg} style={s.heroLevelImg} contentFit="contain" />

                {/* Progress bar + labels */}
                <View style={s.heroBottom}>
                  <View style={s.progressTrack}>
                    <View style={[s.progressFill, { width: `${progress * 100}%` }]} />
                  </View>
                  <View style={s.levelLabels}>
                    <View style={s.levelLabelLeft}>
                      <Text style={s.levelLabelText}>Lv {currentLevel} /</Text>
                      <Image source={COIN_IMG} style={s.smallCoin} resizeMode="contain" />
                      <Text style={s.levelLabelCoins}>{currentCoins}</Text>
                    </View>
                    <View style={s.levelLabelRight}>
                      <Text style={s.levelLabelText}>Lv {currentLevel + 1} /</Text>
                      <Image source={COIN_IMG} style={s.smallCoin} resizeMode="contain" />
                      <Text style={s.levelLabelCoins}>{nextLevelCoins}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Level rewards */}
              <View style={s.rewardsSection}>
                <Text style={s.rewardsTitle}>Level Rewards</Text>
                <Text style={s.rewardsSub}>Top 10 contributors may win rewards</Text>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.rewardsScroll}>
                  {LEVEL_REWARDS.map(reward => (
                    <View key={reward.id} style={[s.rewardCard, { backgroundColor: reward.bg }]}>
                      <Text style={s.rewardEmoji}>{reward.emoji}</Text>
                      <View style={[s.rewardTag, { backgroundColor: reward.tagColor }]}>
                        <Text style={s.rewardTagText}>{reward.duration}</Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </>
          )}

          {activeTab === 'supporters' && (
            <View style={s.supportersList}>
              {TOP_SUPPORTERS.map(s2 => (
                <View key={s2.rank} style={s.supporterRow}>
                  <Text style={[s.rank, s2.rank <= 3 && s.rankTop]}>
                    {s2.rank <= 3 ? ['🥇', '🥈', '🥉'][s2.rank - 1] : s2.rank}
                  </Text>
                  <View style={[s.avatar, { backgroundColor: s2.avatarColor }]}>
                    <Text style={s.avatarInitial}>{s2.name[0]}</Text>
                  </View>
                  <Text style={s.supporterName} numberOfLines={1}>{s2.name}</Text>
                  <View style={s.coinsWrap}>
                    <Image source={COIN_IMG} style={s.coinIcon} resizeMode="contain" />
                    <Text style={s.coins}>{formatCoins(s2.coins)}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1E22',
  },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EBEBEB',
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  tabLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#7A7A8A',
  },
  tabLabelActive: {
    color: '#7A0EED',
    fontWeight: '700',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: '#7A0EED',
  },

  // Hero banner
  heroBanner: {
    width: '100%',
    height: SCREEN_W * 0.65,
    backgroundColor: '#1A1060',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  heroGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(100,80,220,0.35)',
  },
  heroLevelImg: {
    width: 160,
    height: 160,
  },
  heroBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#7A0EED',
    borderRadius: 3,
  },
  levelLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  levelLabelLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  levelLabelRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  levelLabelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  levelLabelCoins: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  smallCoin: {
    width: 14,
    height: 14,
  },

  // Level rewards
  rewardsSection: {
    paddingTop: 20,
    paddingHorizontal: 16,
  },
  rewardsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1C1E22',
    marginBottom: 4,
  },
  rewardsSub: {
    fontSize: 13,
    color: '#7A7A8A',
    marginBottom: 14,
  },
  rewardsScroll: {
    gap: 12,
    paddingBottom: 20,
  },
  rewardCard: {
    width: SCREEN_W * 0.36,
    height: SCREEN_W * 0.36,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  rewardEmoji: {
    fontSize: 52,
  },
  rewardTag: {
    position: 'absolute',
    bottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rewardTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Top supporters
  supportersList: {
    paddingTop: 8,
  },
  supporterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0EDF8',
  },
  rank: {
    width: 28,
    fontSize: 15,
    fontWeight: '700',
    color: '#ABADB2',
    textAlign: 'center',
  },
  rankTop: {
    fontSize: 20,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  supporterName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1E22',
  },
  coinsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  coinIcon: {
    width: 16,
    height: 16,
  },
  coins: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E8944A',
  },
});
