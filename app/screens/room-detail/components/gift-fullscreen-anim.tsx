import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Image, Modal, StyleSheet, View } from 'react-native';
import { MEDIA_BASE } from '@/services/api';

const { width: W, height: H } = Dimensions.get('window');

type Props = {
  visible: boolean;
  imageUrl: string | null;
  bgColor?: string;
  onDone: () => void;
};

export function GiftFullscreenAnim({ visible, imageUrl, bgColor = '#FFE4EE', onDone }: Props) {
  const scale = useRef(new Animated.Value(0.3)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0.3);
    opacity.setValue(0);

    Animated.sequence([
      // Pop in
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 120, friction: 7 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
      // Hold for 1.2s
      Animated.delay(1200),
      // Fade out
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(onDone);
  }, [visible]);

  if (!visible) return null;

  const imgUri = imageUrl ? `${MEDIA_BASE}/${imageUrl.replace(/^\//, '')}` : null;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[s.overlay, { opacity }]}>
        <Animated.View style={[s.imgWrap, { backgroundColor: bgColor, transform: [{ scale }] }]}>
          {imgUri
            ? <Image source={{ uri: imgUri }} style={s.img} resizeMode="contain" />
            : <View style={s.fallback} />
          }
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
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  imgWrap: {
    width: W * 0.65,
    height: W * 0.65,
    borderRadius: W * 0.325,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  img: {
    width: W * 0.55,
    height: W * 0.55,
  },
  fallback: {
    width: W * 0.4,
    height: W * 0.4,
    borderRadius: W * 0.2,
    backgroundColor: '#7A0EED',
  },
});
