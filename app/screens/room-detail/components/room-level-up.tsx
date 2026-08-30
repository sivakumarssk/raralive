import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as MediaLibrary from 'expo-media-library';
import { useEffect, useRef } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MEDIA_BASE } from '@/services/api';
import { prefetchBadgesInBackground } from '@/utils/levelBadgeCache';

const { width: W } = Dimensions.get('window');

const RARA_LOGO = require('@/assets/images/raralogo.png');

// Group badges 0-5 are bundled into the app (every room starts there, so they must
// render instantly with no network). Levels 6-100 are served from the backend and
// cached to disk in the background — see app/utils/userLevel.ts for the same pattern.
const BUNDLED_GROUP_LEVELS: Record<number, any> = {
  0: require('@/assets/tabs/chatroom/levels-bundled/group/0.png'),
  1: require('@/assets/tabs/chatroom/levels-bundled/group/1.png'),
  2: require('@/assets/tabs/chatroom/levels-bundled/group/2.png'),
  3: require('@/assets/tabs/chatroom/levels-bundled/group/3.png'),
  4: require('@/assets/tabs/chatroom/levels-bundled/group/4.png'),
  5: require('@/assets/tabs/chatroom/levels-bundled/group/5.png'),
};

function groupLevelUrl(level: number) {
  return `${MEDIA_BASE}/levels/group/${level}.png`;
}

const LEVEL_IMAGES: Record<number, any> = Object.fromEntries(
  Array.from({ length: 101 }, (_, level) => [
    level,
    BUNDLED_GROUP_LEVELS[level] ?? { uri: groupLevelUrl(level) },
  ])
);

export function getLevelImage(level: number) {
  return LEVEL_IMAGES[level] ?? LEVEL_IMAGES[0];
}

// Silently caches group badges just above the room's current level in the background.
// Bundled levels (0-5) need no prefetch.
export function prefetchUpcomingGroupBadges(currentLevel: number, lookahead = 10) {
  const start = Math.max(currentLevel + 1, 6);
  const end = Math.min(currentLevel + lookahead, 100);
  if (start > end) return;
  const urls = Array.from({ length: end - start + 1 }, (_, i) => groupLevelUrl(start + i));
  prefetchBadgesInBackground(urls);
}

function resolveAvatar(url: string | null | undefined) {
  if (!url) return null;
  try { return `${MEDIA_BASE}${new URL(url).pathname}`; }
  catch { return `${MEDIA_BASE}/${url.replace(/^\//, '')}`; }
}

type Props = {
  visible: boolean;
  level: number;
  roomName: string;
  roomAvatarUrl: string | null;
  onDone: () => void;
};

export function RoomLevelUp({ visible, level, roomName, roomAvatarUrl, onDone }: Props) {
  const scale = useRef(new Animated.Value(0.3)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const cardRef = useRef<View>(null);

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0.3);
    opacity.setValue(0);

    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 90, friction: 8 }),
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [visible, level]);

  const handleDownload = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow access to save the image to your gallery.');
        return;
      }
      const { captureRef } = await import('react-native-view-shot');
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Saved!', 'Level card saved to your gallery.');
    } catch {
      Alert.alert('Error', 'Could not save the image.');
    }
  };

  if (!visible) return null;

  const levelAsset = getLevelImage(level);
  const avatarUri = resolveAvatar(roomAvatarUrl);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[s.overlay, { opacity }]}>
        <Animated.View style={[s.card, { transform: [{ scale }] }]}>
          {/* Captured area — no buttons inside */}
          <View ref={cardRef} collapsable={false} style={s.captureWrap}>
            <LinearGradient
              colors={['#7A0EED', '#C931F5', '#FF6B9D', '#FFB347']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.cardGradient}
            >
              <View style={s.decCircle1} />
              <View style={s.decCircle2} />

              <View style={s.brandRow}>
                <Image source={RARA_LOGO} style={s.brandLogo} resizeMode="contain" />
                <Text style={s.brandName}>Rara Live</Text>
              </View>

              <Text style={s.levelUpLabel}>🎉 LEVEL UP!</Text>

              <View style={s.badgeWrap}>
                <ExpoImage source={levelAsset} style={s.levelImg} contentFit="contain" />
              </View>

              <Text style={s.levelNum}>Group Level {level}</Text>

              <View style={s.divider} />

              <View style={s.roomRow}>
                {avatarUri
                  ? <Image source={{ uri: avatarUri }} style={s.roomAvatar} />
                  : (
                    <View style={s.roomAvatarFallback}>
                      <Text style={s.roomAvatarInitial}>{roomName[0]?.toUpperCase()}</Text>
                    </View>
                  )}
                <Text style={s.roomName} numberOfLines={1}>{roomName}</Text>
              </View>
            </LinearGradient>
          </View>

          {/* Save button — outside capture area so it won't appear in saved image */}
          <TouchableOpacity onPress={handleDownload} style={s.downloadBtn} activeOpacity={0.8}>
            <Ionicons name="download-outline" size={16} color="#FFFFFF" />
            <Text style={s.downloadText}>Save Card</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onDone} style={s.dismissBtn} hitSlop={12}>
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.9)" />
          </TouchableOpacity>

        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const CARD_W = W * 0.78;

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  card: {
    width: CARD_W,
    alignItems: 'center',
    overflow: 'visible',
  },
  captureWrap: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#7A0EED',
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 20,
  },

  // Full-card gradient
  cardGradient: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 28,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  decCircle1: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  decCircle2: {
    position: 'absolute',
    bottom: 40,
    left: -24,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  brandLogo: {
    width: 30,
    height: 30,
  },
  brandName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  levelUpLabel: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    marginBottom: 18,
  },
  badgeWrap: {
    width: CARD_W * 0.44,
    height: CARD_W * 0.44,
    borderRadius: CARD_W * 0.22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  levelImg: {
    width: CARD_W * 0.37,
    height: CARD_W * 0.37,
  },
  levelNum: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginBottom: 12,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  divider: {
    width: '70%',
    height: 1.5,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.35)',
    marginBottom: 14,
  },
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  roomAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  roomAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomAvatarInitial: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  roomName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    maxWidth: CARD_W * 0.55,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: CARD_W,
    marginTop: 12,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  downloadText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  // Dismiss X
  dismissBtn: {
    position: 'absolute',
    top: -12,
    right: -12,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
});
