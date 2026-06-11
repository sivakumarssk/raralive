import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { Image as ExpoImage } from 'expo-image';
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

const { width: W } = Dimensions.get('window');

// require() keeps SVGs as bundled assets — expo-image renders them natively (no transformer needed)
const LEVEL_IMAGES: Record<number, any> = {
  0: require('@/assets/tabs/chatroom/groupLevels/0.svg'),
  1: require('@/assets/tabs/chatroom/groupLevels/1.svg'),
  2: require('@/assets/tabs/chatroom/groupLevels/2.svg'),
  3: require('@/assets/tabs/chatroom/groupLevels/3.svg'),
  4: require('@/assets/tabs/chatroom/groupLevels/4.svg'),
  5: require('@/assets/tabs/chatroom/groupLevels/5.svg'),
  6: require('@/assets/tabs/chatroom/groupLevels/6.svg'),
  7: require('@/assets/tabs/chatroom/groupLevels/7.svg'),
  8: require('@/assets/tabs/chatroom/groupLevels/8.svg'),
  9: require('@/assets/tabs/chatroom/groupLevels/9.svg'),
  10: require('@/assets/tabs/chatroom/groupLevels/10.svg'),
  11: require('@/assets/tabs/chatroom/groupLevels/11.svg'),
  12: require('@/assets/tabs/chatroom/groupLevels/12.svg'),
  13: require('@/assets/tabs/chatroom/groupLevels/13.svg'),
  14: require('@/assets/tabs/chatroom/groupLevels/14.svg'),
  15: require('@/assets/tabs/chatroom/groupLevels/15.svg'),
  16: require('@/assets/tabs/chatroom/groupLevels/16.svg'),
  17: require('@/assets/tabs/chatroom/groupLevels/17.svg'),
  18: require('@/assets/tabs/chatroom/groupLevels/18.svg'),
  19: require('@/assets/tabs/chatroom/groupLevels/19.svg'),
  20: require('@/assets/tabs/chatroom/groupLevels/20.svg'),
  21: require('@/assets/tabs/chatroom/groupLevels/21.svg'),
  22: require('@/assets/tabs/chatroom/groupLevels/22.svg'),
  23: require('@/assets/tabs/chatroom/groupLevels/23.svg'),
  24: require('@/assets/tabs/chatroom/groupLevels/24.svg'),
  25: require('@/assets/tabs/chatroom/groupLevels/25.svg'),
  26: require('@/assets/tabs/chatroom/groupLevels/26.svg'),
  27: require('@/assets/tabs/chatroom/groupLevels/27.svg'),
  28: require('@/assets/tabs/chatroom/groupLevels/28.svg'),
  29: require('@/assets/tabs/chatroom/groupLevels/29.svg'),
  30: require('@/assets/tabs/chatroom/groupLevels/30.svg'),
  31: require('@/assets/tabs/chatroom/groupLevels/31.svg'),
  32: require('@/assets/tabs/chatroom/groupLevels/32.svg'),
  33: require('@/assets/tabs/chatroom/groupLevels/33.svg'),
  34: require('@/assets/tabs/chatroom/groupLevels/34.svg'),
  35: require('@/assets/tabs/chatroom/groupLevels/35.svg'),
  36: require('@/assets/tabs/chatroom/groupLevels/36.svg'),
  37: require('@/assets/tabs/chatroom/groupLevels/37.svg'),
  38: require('@/assets/tabs/chatroom/groupLevels/38.svg'),
  39: require('@/assets/tabs/chatroom/groupLevels/39.svg'),
  40: require('@/assets/tabs/chatroom/groupLevels/40.svg'),
  41: require('@/assets/tabs/chatroom/groupLevels/41.svg'),
  42: require('@/assets/tabs/chatroom/groupLevels/42.svg'),
  43: require('@/assets/tabs/chatroom/groupLevels/43.svg'),
  44: require('@/assets/tabs/chatroom/groupLevels/44.svg'),
  45: require('@/assets/tabs/chatroom/groupLevels/45.svg'),
  46: require('@/assets/tabs/chatroom/groupLevels/46.svg'),
  47: require('@/assets/tabs/chatroom/groupLevels/47.svg'),
  48: require('@/assets/tabs/chatroom/groupLevels/48.svg'),
  49: require('@/assets/tabs/chatroom/groupLevels/49.svg'),
  50: require('@/assets/tabs/chatroom/groupLevels/50.svg'),
  51: require('@/assets/tabs/chatroom/groupLevels/51.svg'),
  52: require('@/assets/tabs/chatroom/groupLevels/52.svg'),
  53: require('@/assets/tabs/chatroom/groupLevels/53.svg'),
  54: require('@/assets/tabs/chatroom/groupLevels/54.svg'),
  55: require('@/assets/tabs/chatroom/groupLevels/55.svg'),
  56: require('@/assets/tabs/chatroom/groupLevels/56.svg'),
  57: require('@/assets/tabs/chatroom/groupLevels/57.svg'),
  58: require('@/assets/tabs/chatroom/groupLevels/58.svg'),
  59: require('@/assets/tabs/chatroom/groupLevels/59.svg'),
  60: require('@/assets/tabs/chatroom/groupLevels/60.svg'),
  61: require('@/assets/tabs/chatroom/groupLevels/61.svg'),
  62: require('@/assets/tabs/chatroom/groupLevels/62.svg'),
  63: require('@/assets/tabs/chatroom/groupLevels/63.svg'),
  64: require('@/assets/tabs/chatroom/groupLevels/64.svg'),
  65: require('@/assets/tabs/chatroom/groupLevels/65.svg'),
  66: require('@/assets/tabs/chatroom/groupLevels/66.svg'),
  67: require('@/assets/tabs/chatroom/groupLevels/67.svg'),
  68: require('@/assets/tabs/chatroom/groupLevels/68.svg'),
  69: require('@/assets/tabs/chatroom/groupLevels/69.svg'),
  70: require('@/assets/tabs/chatroom/groupLevels/70.svg'),
  71: require('@/assets/tabs/chatroom/groupLevels/71.svg'),
  72: require('@/assets/tabs/chatroom/groupLevels/72.svg'),
  73: require('@/assets/tabs/chatroom/groupLevels/73.svg'),
  74: require('@/assets/tabs/chatroom/groupLevels/74.svg'),
  75: require('@/assets/tabs/chatroom/groupLevels/75.svg'),
  76: require('@/assets/tabs/chatroom/groupLevels/76.svg'),
  77: require('@/assets/tabs/chatroom/groupLevels/77.svg'),
  78: require('@/assets/tabs/chatroom/groupLevels/78.svg'),
  79: require('@/assets/tabs/chatroom/groupLevels/79.svg'),
  80: require('@/assets/tabs/chatroom/groupLevels/80.svg'),
  81: require('@/assets/tabs/chatroom/groupLevels/81.svg'),
  82: require('@/assets/tabs/chatroom/groupLevels/82.svg'),
  83: require('@/assets/tabs/chatroom/groupLevels/83.svg'),
  84: require('@/assets/tabs/chatroom/groupLevels/84.svg'),
  85: require('@/assets/tabs/chatroom/groupLevels/85.svg'),
  86: require('@/assets/tabs/chatroom/groupLevels/86.svg'),
  87: require('@/assets/tabs/chatroom/groupLevels/87.svg'),
  88: require('@/assets/tabs/chatroom/groupLevels/88.svg'),
  89: require('@/assets/tabs/chatroom/groupLevels/89.svg'),
  90: require('@/assets/tabs/chatroom/groupLevels/90.svg'),
  91: require('@/assets/tabs/chatroom/groupLevels/91.svg'),
  92: require('@/assets/tabs/chatroom/groupLevels/92.svg'),
  93: require('@/assets/tabs/chatroom/groupLevels/93.svg'),
  94: require('@/assets/tabs/chatroom/groupLevels/94.svg'),
  95: require('@/assets/tabs/chatroom/groupLevels/95.svg'),
  96: require('@/assets/tabs/chatroom/groupLevels/96.svg'),
  97: require('@/assets/tabs/chatroom/groupLevels/97.svg'),
  98: require('@/assets/tabs/chatroom/groupLevels/98.svg'),
  99: require('@/assets/tabs/chatroom/groupLevels/99.svg'),
  100: require('@/assets/tabs/chatroom/groupLevels/100.svg'),
};

export function getLevelImage(level: number) {
  return LEVEL_IMAGES[level] ?? LEVEL_IMAGES[0];
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
  useEffect(() => {
    if (!visible) return;
    scale.setValue(0.3);
    opacity.setValue(0);

    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 90, friction: 8 }),
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]),
      Animated.delay(3000),
      Animated.timing(opacity, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start(onDone);
  }, [visible, level]);

  const handleDownload = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow access to save the image to your gallery.');
        return;
      }
      const asset = LEVEL_IMAGES[level] ?? LEVEL_IMAGES[0];
      const resolved = Image.resolveAssetSource(asset);
      const destUri = `${FileSystem.cacheDirectory}level_${level}.svg`;
      await FileSystem.downloadAsync(resolved.uri, destUri);
      await MediaLibrary.saveToLibraryAsync(destUri);
      Alert.alert('Saved!', `Level ${level} badge saved to your gallery.`);
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

          {/* Card content */}
          <View style={s.cardContent}>

            {/* Header: LEVEL UP! label */}
            <View style={s.header}>
              <Text style={s.levelUpLabel}>🎉 LEVEL UP!</Text>
            </View>

            {/* Level badge — expo-image renders SVG natively, crisp at any size */}
            <ExpoImage source={levelAsset} style={s.levelImg} contentFit="contain" />

            {/* Level number */}
            <Text style={s.levelNum}>Group Level {level}</Text>

            {/* Divider */}
            <View style={s.divider} />

            {/* Room info row */}
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

          </View>

          {/* Download button */}
          <TouchableOpacity onPress={handleDownload} style={s.downloadBtn} activeOpacity={0.8}>
            <Ionicons name="download-outline" size={16} color="#7A0EED" />
            <Text style={s.downloadText}>Save Card</Text>
          </TouchableOpacity>

          {/* Dismiss */}
          <TouchableOpacity onPress={onDone} style={s.dismissBtn} hitSlop={12}>
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>

        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const CARD_W = W * 0.72;

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  card: {
    width: CARD_W,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    alignItems: 'center',
    overflow: 'visible',
    shadowColor: '#7A0EED',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 20,
  },
  cardContent: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  header: {
    marginBottom: 8,
  },
  levelUpLabel: {
    fontSize: 18,
    fontWeight: '900',
    color: '#7A0EED',
    letterSpacing: 1.5,
  },
  levelImg: {
    width: CARD_W * 0.5,
    height: CARD_W * 0.5,
  },
  levelNum: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1C1E22',
    marginTop: 6,
    letterSpacing: 0.5,
  },
  divider: {
    width: '80%',
    height: 1,
    backgroundColor: '#F0EDF8',
    marginVertical: 12,
  },
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 4,
  },
  roomAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E8E0FA',
  },
  roomAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EDE8F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomAvatarInitial: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7A0EED',
  },
  roomName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#60626A',
    maxWidth: CARD_W * 0.55,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0EDF8',
    width: '100%',
    justifyContent: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  downloadText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7A0EED',
  },
  dismissBtn: {
    position: 'absolute',
    top: -12,
    right: -12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
