import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUserLevel } from '@/components/UserLevel';
import { formatCoins, getLevelThreshold, getNextLevelThreshold, USER_LEVEL_IMAGES } from '@/utils/userLevel';

const COIN_IMG = require('@/assets/tabs/coin.png');
const { width: W } = Dimensions.get('window');

const REWARD_MILESTONES = [
  { level: 1,  emoji: '🎁', title: 'Starter Gift',  desc: 'Exclusive badge frame' },
  { level: 3,  emoji: '💎', title: 'Diamond Aura',  desc: 'Animated profile ring' },
  { level: 5,  emoji: '🏆', title: 'Elite Trophy',  desc: 'Gold name effect in chat' },
  { level: 10, emoji: '🚀', title: 'Rocket Status', desc: 'Special entry animation' },
  { level: 20, emoji: '👑', title: 'Crown Royale',  desc: 'VIP room access + crown badge' },
];

function ProgressBar({ progress }: { progress: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: progress, duration: 900, useNativeDriver: false }).start();
  }, [progress]);
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'], extrapolate: 'clamp' });
  return (
    <View style={pb.track}>
      <Animated.View style={[pb.fill, { width }]} />
      <Animated.View style={[pb.dot, { left: width as any }]} />
    </View>
  );
}

const pb = StyleSheet.create({
  track: { height: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 4, overflow: 'visible', position: 'relative' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: '#A855F7', shadowColor: '#A855F7', shadowOpacity: 0.7, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  dot: { position: 'absolute', top: -3, width: 14, height: 14, borderRadius: 7, backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: '#A855F7', marginLeft: -7, elevation: 4 },
});

export default function IdLevelScreen() {
  const router = useRouter();
  const { coinsSpent, level } = useUserLevel();

  const currentThreshold = getLevelThreshold(level);
  const nextThreshold = getNextLevelThreshold(level);
  const coinsNeeded = Math.max(1, (nextThreshold ?? currentThreshold + 1) - currentThreshold);
  const coinsIntoLevel = Math.max(0, coinsSpent - currentThreshold);
  const progress = Math.min(coinsIntoLevel / coinsNeeded, 1);

  const nextMilestone = REWARD_MILESTONES.find(m => m.level > level);
  const coinsToMilestone = nextMilestone ? Math.max(0, getLevelThreshold(nextMilestone.level) - coinsSpent) : 0;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header — same as wallet/performance */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.headerBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#1C1E22" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>ID Level</Text>
        <View style={s.headerBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Dark hero stage (only this section is dark) ── */}
        <LinearGradient
          colors={['#0F172A', '#1E1050', '#0F2744']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.hero}>
          {/* Decorative circles */}
          <View style={[s.circle, s.circleTopRight]} />
          <View style={[s.circle, s.circleBottomLeft]} />
          <View style={[s.circleSm, s.circleTopLeft]} />

          {/* Level pill + coins */}
          <View style={s.heroTopRow}>
            <LinearGradient colors={['#7A0EED', '#B50357']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.levelPill}>
              <Text style={s.levelPillText}>LEVEL {level}</Text>
            </LinearGradient>
            <View style={s.heroCoinsBadge}>
              <Image source={COIN_IMG} style={s.heroCoin} resizeMode="contain" />
              <Text style={s.heroCoins}>{formatCoins(coinsSpent)} gifted</Text>
            </View>
          </View>

          {/* Badge */}
          <ExpoImage source={USER_LEVEL_IMAGES[Math.min(level, 100)]} style={s.badgeImg} contentFit="contain" />
          <Text style={s.heroSub}>Individual Gifting Level</Text>

          {/* Progress card */}
          <View style={s.progressCard}>
            <View style={s.progressCardHeader}>
              <Text style={s.progressCardTitle}>
                {nextThreshold != null ? `Progress to Level ${level + 1}` : 'Max Level Reached!'}
              </Text>
              <Text style={s.progressPercent}>{Math.round(progress * 100)}%</Text>
            </View>
            <ProgressBar progress={progress} />
            {nextThreshold != null && (
              <View style={s.progressLabels}>
                <View style={s.labelRow}>
                  <Image source={COIN_IMG} style={s.smallCoin} resizeMode="contain" />
                  <Text style={s.labelCoins}>{formatCoins(currentThreshold)}</Text>
                </View>
                <View style={s.labelRow}>
                  <Image source={COIN_IMG} style={s.smallCoin} resizeMode="contain" />
                  <Text style={s.remainText}>{formatCoins(Math.max(0, nextThreshold - coinsSpent))} to go</Text>
                </View>
                <View style={s.labelRow}>
                  <Image source={COIN_IMG} style={s.smallCoin} resizeMode="contain" />
                  <Text style={s.labelCoins}>{formatCoins(nextThreshold)}</Text>
                </View>
              </View>
            )}
          </View>
        </LinearGradient>

        {/* ── Below sections: normal light bg ── */}

        {/* Reward milestones */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Level Rewards</Text>
          <Text style={s.sectionSub}>Unlock exclusive rewards as you level up</Text>

          <View style={s.milestonesGrid}>
            {REWARD_MILESTONES.map(m => {
              const unlocked = level >= m.level;
              return (
                <View key={m.level} style={[s.milestoneCard, unlocked && s.milestoneCardUnlocked]}>
                  <View style={[s.milestoneIconWrap, unlocked && s.milestoneIconWrapUnlocked]}>
                    <Text style={s.milestoneEmoji}>{m.emoji}</Text>
                    {unlocked && (
                      <View style={s.checkBadge}>
                        <Ionicons name="checkmark" size={9} color="#FFFFFF" />
                      </View>
                    )}
                  </View>
                  <Text style={[s.milestoneLevelLbl, unlocked && s.milestoneLevelLblUnlocked]}>Level {m.level}</Text>
                  <Text style={s.milestoneTitle}>{m.title}</Text>
                  <Text style={s.milestoneDesc} numberOfLines={2}>{m.desc}</Text>
                  {!unlocked && (
                    <View style={s.lockRow}>
                      <Ionicons name="lock-closed" size={10} color="#ABADB2" />
                      <Text style={s.lockTxt}>Locked</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Next reward */}
        {nextMilestone && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Next Reward</Text>
            <LinearGradient
              colors={['#1E1050', '#2D1080']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.nextCard}>
              <View style={s.nextLeft}>
                <Text style={s.nextEmoji}>{nextMilestone.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.nextTitle}>{nextMilestone.title}</Text>
                  <Text style={s.nextDesc}>{nextMilestone.desc}</Text>
                  <View style={s.nextCoinsRow}>
                    <Image source={COIN_IMG} style={s.smallCoin} resizeMode="contain" />
                    <Text style={s.nextCoins}>{formatCoins(coinsToMilestone)} more coins to gift</Text>
                  </View>
                </View>
              </View>
              <View style={s.nextBadgeWrap}>
                <ExpoImage source={USER_LEVEL_IMAGES[nextMilestone.level]} style={s.nextBadge} contentFit="contain" />
                <Text style={s.nextBadgeLbl}>Lv {nextMilestone.level}</Text>
              </View>
            </LinearGradient>
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F4FD' },

  // Header — identical to wallet + performance screens
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#F7F4FD' },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'left', fontSize: 18, fontWeight: '700', color: '#1C1E22' },

  scroll: { paddingBottom: 40 },

  // Hero — dark, same as performance screen
  hero: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  circle: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(122,14,237,0.1)', borderWidth: 1, borderColor: 'rgba(122,14,237,0.12)' },
  circleTopRight: { top: -60, right: -60 },
  circleBottomLeft: { bottom: -80, left: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(181,3,87,0.07)' },
  circleSm: { position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(168,85,247,0.1)', borderWidth: 1, borderColor: 'rgba(168,85,247,0.1)' },
  circleTopLeft: { top: 20, left: -20 },

  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 10 },
  levelPill: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  levelPillText: { fontSize: 12, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1 },
  heroCoinsBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  heroCoin: { width: 16, height: 16 },
  heroCoins: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  badgeImg: { width: W * 0.38, height: W * 0.38, marginVertical: 6 },
  heroSub: { fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16 },

  progressCard: { width: '100%', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', gap: 10 },
  progressCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressCardTitle: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  progressPercent: { fontSize: 14, fontWeight: '900', color: '#A855F7' },
  progressLabels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  labelCoins: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.65)' },
  smallCoin: { width: 11, height: 11 },
  remainText: { fontSize: 11, color: '#A855F7', fontWeight: '600' },

  // Light sections below
  section: { paddingHorizontal: 16, paddingTop: 22 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#1C1E22', marginBottom: 3 },
  sectionSub: { fontSize: 12, color: '#7A7A8A', marginBottom: 14 },

  milestonesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  milestoneCard: {
    width: (W - 42) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EDE8F8',
    gap: 4,
    shadowColor: '#7A0EED',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  milestoneCardUnlocked: { borderColor: '#C4B8E8', backgroundColor: '#FDFAFF' },
  milestoneIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3EFFE', alignItems: 'center', justifyContent: 'center', marginBottom: 6, position: 'relative' },
  milestoneIconWrapUnlocked: { backgroundColor: '#EDE8F8' },
  milestoneEmoji: { fontSize: 22 },
  checkBadge: { position: 'absolute', bottom: 0, right: 0, width: 16, height: 16, borderRadius: 8, backgroundColor: '#22C55E', alignItems: 'center', justifyContent: 'center' },
  milestoneLevelLbl: { fontSize: 10, fontWeight: '700', color: '#ABADB2', textTransform: 'uppercase', letterSpacing: 0.8 },
  milestoneLevelLblUnlocked: { color: '#7A0EED' },
  milestoneTitle: { fontSize: 13, fontWeight: '800', color: '#1C1E22' },
  milestoneDesc: { fontSize: 11, color: '#7A7A8A', lineHeight: 15 },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  lockTxt: { fontSize: 10, color: '#ABADB2', fontWeight: '500' },

  nextCard: { borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: 'rgba(122,14,237,0.3)' },
  nextLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, flex: 1 },
  nextEmoji: { fontSize: 34 },
  nextTitle: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', marginBottom: 2 },
  nextDesc: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8 },
  nextCoinsRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  nextCoins: { fontSize: 12, fontWeight: '600', color: '#A855F7' },
  nextBadgeWrap: { alignItems: 'center', gap: 4 },
  nextBadge: { width: 64, height: 64 },
  nextBadgeLbl: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
});
