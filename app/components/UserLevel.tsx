import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BASE_URL } from '@/services/api';
import { authStore } from '@/store/auth-store';
import { getMyCoinsGifted, onCoinsGiftedUpdate, setMyCoinsSpent } from '@/store/socket-store';
import {
  formatCoins,
  getLevelThreshold,
  getNextLevelThreshold,
  getUserLevel,
  prefetchUpcomingLevelBadges,
  USER_LEVEL_IMAGES,
} from '@/utils/userLevel';

const { width: W } = Dimensions.get('window');

// ── shared hook ───────────────────────────────────────────────────────────────
export function useUserLevel() {
  const [coinsSpent, setCoinsSpent] = useState(() => getMyCoinsGifted());
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    // Initial fetch
    const token = authStore.getToken();
    if (!token) return;
    fetch(`${BASE_URL}/wallet/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          const d = json.data;
          const spent = d.coins_gifted ?? d.coins_spent ?? d.coinsSpent ?? 0;
          setCoinsSpent(spent);
          setMyCoinsSpent(spent);
        }
      })
      .catch(() => {})
      .finally(() => setFetched(true));

    // Real-time updates: whenever a gift is sent, socket-store calls setMyCoinsSpent
    // which fires onCoinsGiftedUpdate — update local state immediately
    const unsub = onCoinsGiftedUpdate(updated => {
      setCoinsSpent(updated);
      setFetched(true);
    });
    return () => { unsub(); };
  }, []);

  const level = getUserLevel(coinsSpent);
  useEffect(() => {
    prefetchUpcomingLevelBadges(level);
  }, [level]);

  return { coinsSpent, level, fetched };
}

// ── Level detail modal ────────────────────────────────────────────────────────
function LevelModal({ visible, onClose, coinsSpent, loading }: {
  visible: boolean;
  onClose: () => void;
  coinsSpent: number;
  loading: boolean;
}) {
  const level = getUserLevel(coinsSpent);
  const currentThreshold = getLevelThreshold(level);
  const nextThreshold = getNextLevelThreshold(level);
  const badgeImg = USER_LEVEL_IMAGES[level] ?? USER_LEVEL_IMAGES[0];
  const progressCoins = coinsSpent - currentThreshold;
  const neededCoins = nextThreshold != null ? nextThreshold - currentThreshold : 0;
  const progress = neededCoins > 0 ? Math.min(progressCoins / neededCoins, 1) : 1;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={m.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
          <LinearGradient
            colors={['#1A0050', '#3D0099', '#7A0EED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={m.card}>

            <TouchableOpacity style={m.closeBtn} onPress={onClose} hitSlop={10}>
              <Text style={m.closeTxt}>✕</Text>
            </TouchableOpacity>

            <Text style={m.title}>Your Level</Text>

            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="large" style={{ marginVertical: 32 }} />
            ) : (
              <>
                <View style={m.badgeWrap}>
                  <ExpoImage source={badgeImg} style={m.badgeImg} contentFit="contain" />
                </View>

                <Text style={m.levelNum}>Level {level}</Text>
                <Text style={m.levelSub}>Individual Gifting Level</Text>

                <View style={m.statRow}>
                  <View style={m.statBox}>
                    <Text style={m.statValue}>{formatCoins(coinsSpent)}</Text>
                    <Text style={m.statLabel}>Coins Gifted</Text>
                  </View>
                  {nextThreshold != null ? (
                    <View style={m.statBox}>
                      <Text style={m.statValue}>{formatCoins(nextThreshold - coinsSpent)}</Text>
                      <Text style={m.statLabel}>To Next Level</Text>
                    </View>
                  ) : (
                    <View style={m.statBox}>
                      <Text style={[m.statValue, { color: '#FFD700' }]}>MAX</Text>
                      <Text style={m.statLabel}>Level Reached!</Text>
                    </View>
                  )}
                </View>

                {nextThreshold != null && (
                  <View style={m.progressWrap}>
                    <View style={m.progressBg}>
                      <LinearGradient
                        colors={['#FFD700', '#FF8C00']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[m.progressFill, { width: `${Math.round(progress * 100)}%` }]}
                      />
                    </View>
                    <Text style={m.progressTxt}>
                      {formatCoins(coinsSpent)} / {formatCoins(nextThreshold)} coins
                    </Text>
                  </View>
                )}

                {level < 100 && (
                  <View style={m.nextRow}>
                    <ExpoImage
                      source={USER_LEVEL_IMAGES[level + 1] ?? USER_LEVEL_IMAGES[0]}
                      style={m.nextBadge}
                      contentFit="contain"
                    />
                    <Text style={m.nextTxt}>
                      Level {level + 1} — Gift {formatCoins(nextThreshold ?? 0)} coins total
                    </Text>
                  </View>
                )}
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── UserLevelBadge ─────────────────────────────────────────────────────────────
// size="sm"  → 22×22  (chat feed inline)
// size="md"  → 40×40  (profile header)
// size="lg"  → 64×64  (full display, e.g. chatroom header popup)
// tappable=true → tapping badge opens the level detail modal
type BadgeSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_MAP: Record<BadgeSize, number> = { sm: 22, md: 40, lg: 64, xl: 100 };

type UserLevelBadgeProps = {
  size?: BadgeSize;
  tappable?: boolean;
  // Pass level directly (for other users' chat messages)
  level?: number;
};

export function UserLevelBadge({ size = 'md', tappable = false, level: externalLevel }: UserLevelBadgeProps) {
  const [showModal, setShowModal] = useState(false);
  const { coinsSpent, level: ownLevel, fetched } = useUserLevel();

  // If external level provided (e.g. another user's chat message), skip own fetch result
  const level = externalLevel != null ? externalLevel : ownLevel;
  const badgeImg = USER_LEVEL_IMAGES[Math.min(level, 100)] ?? USER_LEVEL_IMAGES[0];
  const px = SIZE_MAP[size];

  const badge = (
    <ExpoImage source={badgeImg} style={{ width: px, height: px }} contentFit="contain" />
  );

  if (!tappable || externalLevel != null) return badge;

  return (
    <>
      <TouchableOpacity onPress={() => setShowModal(true)} activeOpacity={0.8} hitSlop={6}>
        {badge}
      </TouchableOpacity>
      <LevelModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        coinsSpent={coinsSpent}
        loading={!fetched}
      />
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const m = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: W - 48,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#7A0EED',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
  },
  closeTxt: { fontSize: 14, color: '#FFFFFF', fontWeight: '700' },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginBottom: 20,
  },
  badgeWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  badgeImg: { width: 100, height: 100 },
  levelNum: {
    fontSize: 30,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  levelSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '500',
    marginTop: 4,
    marginBottom: 24,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statRow: { flexDirection: 'row', gap: 16, marginBottom: 20 },
  statBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minWidth: 100,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: '500', marginTop: 3 },
  progressWrap: { width: '100%', marginBottom: 20, gap: 6 },
  progressBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },
  progressTxt: { fontSize: 11, color: 'rgba(255,255,255,0.5)', textAlign: 'center' },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: '100%',
  },
  nextBadge: { width: 32, height: 32 },
  nextTxt: { flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
});
