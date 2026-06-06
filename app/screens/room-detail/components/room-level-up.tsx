import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Image, Modal, StyleSheet, Text, View } from 'react-native';

const { width: W } = Dimensions.get('window');

// All 100 level images — loaded lazily via index
const LEVEL_IMAGES: Record<number, any> = {
  0: require('@/assets/tabs/chatroom/groupLevels/0.png'),
  1: require('@/assets/tabs/chatroom/groupLevels/1.png'),
  2: require('@/assets/tabs/chatroom/groupLevels/2.png'),
  3: require('@/assets/tabs/chatroom/groupLevels/3.png'),
  4: require('@/assets/tabs/chatroom/groupLevels/4.png'),
  5: require('@/assets/tabs/chatroom/groupLevels/5.png'),
  6: require('@/assets/tabs/chatroom/groupLevels/6.png'),
  7: require('@/assets/tabs/chatroom/groupLevels/7.png'),
  8: require('@/assets/tabs/chatroom/groupLevels/8.png'),
  9: require('@/assets/tabs/chatroom/groupLevels/9.png'),
  10: require('@/assets/tabs/chatroom/groupLevels/10.png'),
  11: require('@/assets/tabs/chatroom/groupLevels/11.png'),
  12: require('@/assets/tabs/chatroom/groupLevels/12.png'),
  13: require('@/assets/tabs/chatroom/groupLevels/13.png'),
  14: require('@/assets/tabs/chatroom/groupLevels/14.png'),
  15: require('@/assets/tabs/chatroom/groupLevels/15.png'),
  16: require('@/assets/tabs/chatroom/groupLevels/16.png'),
  17: require('@/assets/tabs/chatroom/groupLevels/17.png'),
  18: require('@/assets/tabs/chatroom/groupLevels/18.png'),
  19: require('@/assets/tabs/chatroom/groupLevels/19.png'),
  20: require('@/assets/tabs/chatroom/groupLevels/20.png'),
  21: require('@/assets/tabs/chatroom/groupLevels/21.png'),
  22: require('@/assets/tabs/chatroom/groupLevels/22.png'),
  23: require('@/assets/tabs/chatroom/groupLevels/23.png'),
  24: require('@/assets/tabs/chatroom/groupLevels/24.png'),
  25: require('@/assets/tabs/chatroom/groupLevels/25.png'),
  26: require('@/assets/tabs/chatroom/groupLevels/26.png'),
  27: require('@/assets/tabs/chatroom/groupLevels/27.png'),
  28: require('@/assets/tabs/chatroom/groupLevels/28.png'),
  29: require('@/assets/tabs/chatroom/groupLevels/29.png'),
  30: require('@/assets/tabs/chatroom/groupLevels/30.png'),
  31: require('@/assets/tabs/chatroom/groupLevels/31.png'),
  32: require('@/assets/tabs/chatroom/groupLevels/32.png'),
  33: require('@/assets/tabs/chatroom/groupLevels/33.png'),
  34: require('@/assets/tabs/chatroom/groupLevels/34.png'),
  35: require('@/assets/tabs/chatroom/groupLevels/35.png'),
  36: require('@/assets/tabs/chatroom/groupLevels/36.png'),
  37: require('@/assets/tabs/chatroom/groupLevels/37.png'),
  38: require('@/assets/tabs/chatroom/groupLevels/38.png'),
  39: require('@/assets/tabs/chatroom/groupLevels/39.png'),
  40: require('@/assets/tabs/chatroom/groupLevels/40.png'),
  41: require('@/assets/tabs/chatroom/groupLevels/41.png'),
  42: require('@/assets/tabs/chatroom/groupLevels/42.png'),
  43: require('@/assets/tabs/chatroom/groupLevels/43.png'),
  44: require('@/assets/tabs/chatroom/groupLevels/44.png'),
  45: require('@/assets/tabs/chatroom/groupLevels/45.png'),
  46: require('@/assets/tabs/chatroom/groupLevels/46.png'),
  47: require('@/assets/tabs/chatroom/groupLevels/47.png'),
  48: require('@/assets/tabs/chatroom/groupLevels/48.png'),
  49: require('@/assets/tabs/chatroom/groupLevels/49.png'),
  50: require('@/assets/tabs/chatroom/groupLevels/50.png'),
  51: require('@/assets/tabs/chatroom/groupLevels/51.png'),
  52: require('@/assets/tabs/chatroom/groupLevels/52.png'),
  53: require('@/assets/tabs/chatroom/groupLevels/53.png'),
  54: require('@/assets/tabs/chatroom/groupLevels/54.png'),
  55: require('@/assets/tabs/chatroom/groupLevels/55.png'),
  56: require('@/assets/tabs/chatroom/groupLevels/56.png'),
  57: require('@/assets/tabs/chatroom/groupLevels/57.png'),
  58: require('@/assets/tabs/chatroom/groupLevels/58.png'),
  59: require('@/assets/tabs/chatroom/groupLevels/59.png'),
  60: require('@/assets/tabs/chatroom/groupLevels/60.png'),
  61: require('@/assets/tabs/chatroom/groupLevels/61.png'),
  62: require('@/assets/tabs/chatroom/groupLevels/62.png'),
  63: require('@/assets/tabs/chatroom/groupLevels/63.png'),
  64: require('@/assets/tabs/chatroom/groupLevels/64.png'),
  65: require('@/assets/tabs/chatroom/groupLevels/65.png'),
  66: require('@/assets/tabs/chatroom/groupLevels/66.png'),
  67: require('@/assets/tabs/chatroom/groupLevels/67.png'),
  68: require('@/assets/tabs/chatroom/groupLevels/68.png'),
  69: require('@/assets/tabs/chatroom/groupLevels/69.png'),
  70: require('@/assets/tabs/chatroom/groupLevels/70.png'),
  71: require('@/assets/tabs/chatroom/groupLevels/71.png'),
  72: require('@/assets/tabs/chatroom/groupLevels/72.png'),
  73: require('@/assets/tabs/chatroom/groupLevels/73.png'),
  74: require('@/assets/tabs/chatroom/groupLevels/74.png'),
  75: require('@/assets/tabs/chatroom/groupLevels/75.png'),
  76: require('@/assets/tabs/chatroom/groupLevels/76.png'),
  77: require('@/assets/tabs/chatroom/groupLevels/77.png'),
  78: require('@/assets/tabs/chatroom/groupLevels/78.png'),
  79: require('@/assets/tabs/chatroom/groupLevels/79.png'),
  80: require('@/assets/tabs/chatroom/groupLevels/80.png'),
  81: require('@/assets/tabs/chatroom/groupLevels/81.png'),
  82: require('@/assets/tabs/chatroom/groupLevels/82.png'),
  83: require('@/assets/tabs/chatroom/groupLevels/83.png'),
  84: require('@/assets/tabs/chatroom/groupLevels/84.png'),
  85: require('@/assets/tabs/chatroom/groupLevels/85.png'),
  86: require('@/assets/tabs/chatroom/groupLevels/86.png'),
  87: require('@/assets/tabs/chatroom/groupLevels/87.png'),
  88: require('@/assets/tabs/chatroom/groupLevels/88.png'),
  89: require('@/assets/tabs/chatroom/groupLevels/89.png'),
  90: require('@/assets/tabs/chatroom/groupLevels/90.png'),
  91: require('@/assets/tabs/chatroom/groupLevels/91.png'),
  92: require('@/assets/tabs/chatroom/groupLevels/92.png'),
  93: require('@/assets/tabs/chatroom/groupLevels/93.png'),
  94: require('@/assets/tabs/chatroom/groupLevels/94.png'),
  95: require('@/assets/tabs/chatroom/groupLevels/95.png'),
  96: require('@/assets/tabs/chatroom/groupLevels/96.png'),
  97: require('@/assets/tabs/chatroom/groupLevels/97.png'),
  98: require('@/assets/tabs/chatroom/groupLevels/98.png'),
  99: require('@/assets/tabs/chatroom/groupLevels/99.png'),
  100: require('@/assets/tabs/chatroom/groupLevels/100.png'),
};

export function getLevelImage(level: number) {
  return LEVEL_IMAGES[level] ?? LEVEL_IMAGES[0];
}

type Props = {
  visible: boolean;
  level: number;
  onDone: () => void;
};

export function RoomLevelUp({ visible, level, onDone }: Props) {
  const scale = useRef(new Animated.Value(0.2)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const labelY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0.2);
    opacity.setValue(0);
    labelY.setValue(20);

    Animated.sequence([
      // Pop in
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 7 }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(labelY, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
      // Hold
      Animated.delay(1800),
      // Fade out
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(onDone);
  }, [visible, level]);

  if (!visible) return null;

  const img = LEVEL_IMAGES[level] ?? LEVEL_IMAGES[0];

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[s.overlay, { opacity }]}>
        <Animated.View style={[s.content, { transform: [{ scale }] }]}>
          <Animated.View style={{ transform: [{ translateY: labelY }], opacity }}>
            <Text style={s.levelUpText}>LEVEL UP!</Text>
          </Animated.View>
          <Image source={img} style={s.levelImg} resizeMode="contain" />
          <Animated.View style={{ transform: [{ translateY: labelY }], opacity }}>
            <Text style={s.levelNum}>Group Level {level}</Text>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  content: {
    alignItems: 'center',
    gap: 12,
  },
  levelUpText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFD700',
    letterSpacing: 3,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  levelImg: {
    width: W * 0.55,
    height: W * 0.55,
  },
  levelNum: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
