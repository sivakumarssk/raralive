import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MAX_ZOOM = 4;
const DOUBLE_TAP_ZOOM = 2.5;
const DISMISS_DISTANCE = 120;

type Props = {
  /** Image to show; the viewer is closed while this is null. */
  uri: string | null;
  title: string;
  subtitle?: string;
  onClose: () => void;
};

/**
 * Full-screen photo viewer, WhatsApp style: black screen, title bar with a
 * back arrow, pinch or double-tap to zoom, drag to pan while zoomed, and swipe
 * down to close.
 */
export function ImageViewer({ uri, title, subtitle, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const savedPanX = useSharedValue(0);
  const savedPanY = useSharedValue(0);
  const dragY = useSharedValue(0); // swipe-to-close offset, only while not zoomed

  // Every open starts un-zoomed
  useEffect(() => {
    if (!uri) return;
    scale.value = 1; savedScale.value = 1;
    panX.value = 0; panY.value = 0;
    savedPanX.value = 0; savedPanY.value = 0;
    dragY.value = 0;
  }, [uri, scale, savedScale, panX, panY, savedPanX, savedPanY, dragY]);

  const resetZoom = () => {
    'worklet';
    scale.value = withTiming(1);
    savedScale.value = 1;
    panX.value = withTiming(0);
    panY.value = withTiming(0);
    savedPanX.value = 0;
    savedPanY.value = 0;
  };

  const pinch = Gesture.Pinch()
    .onUpdate(e => {
      scale.value = Math.min(MAX_ZOOM, Math.max(1, savedScale.value * e.scale));
    })
    .onEnd(() => {
      if (scale.value <= 1.02) resetZoom();
      else savedScale.value = scale.value;
    });

  const pan = Gesture.Pan()
    .onUpdate(e => {
      if (savedScale.value > 1) {
        // Stops once the zoomed image's edge reaches the screen edge
        const maxX = (width * (scale.value - 1)) / 2;
        const maxY = (height * (scale.value - 1)) / 2;
        panX.value = Math.min(maxX, Math.max(-maxX, savedPanX.value + e.translationX));
        panY.value = Math.min(maxY, Math.max(-maxY, savedPanY.value + e.translationY));
      } else if (e.translationY > 0) {
        dragY.value = e.translationY;
      }
    })
    .onEnd(() => {
      if (savedScale.value > 1) {
        savedPanX.value = panX.value;
        savedPanY.value = panY.value;
      } else if (dragY.value > DISMISS_DISTANCE) {
        runOnJS(onClose)();
      } else {
        dragY.value = withTiming(0);
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (savedScale.value > 1) {
        resetZoom();
      } else {
        scale.value = withTiming(DOUBLE_TAP_ZOOM);
        savedScale.value = DOUBLE_TAP_ZOOM;
      }
    });

  const gestures = Gesture.Simultaneous(pinch, pan, doubleTap);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: panX.value },
      { translateY: panY.value + dragY.value },
      { scale: scale.value },
    ],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dragY.value, [0, DISMISS_DISTANCE * 3], [1, 0.3], 'clamp'),
  }));

  return (
    <Modal visible={!!uri} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />

        <GestureDetector gesture={gestures}>
          <Animated.View style={[styles.imageWrap, imageStyle]}>
            {uri && <Image source={{ uri }} style={{ width, height }} contentFit="contain" transition={150} />}
          </Animated.View>
        </GestureDetector>

        {/* Title bar */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel="Close">
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.titleWrap}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            {!!subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { backgroundColor: '#000000' },
  imageWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  titleWrap: { flex: 1 },
  title: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  subtitle: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
});
