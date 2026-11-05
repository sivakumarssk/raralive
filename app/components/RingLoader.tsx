import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

// Spinning ring with a faint track and a white→pink arc, with a label below.
// Used on the splash screen over the purple bottom of the artwork.
type Props = {
  size?: number;
  strokeWidth?: number;
  label?: string | null;
  style?: StyleProp<ViewStyle>;
};

export function RingLoader({ size = 46, strokeWidth = 5, label = 'Loading...', style }: Props) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  // Arc covers ~75% of the ring, the rest shows only the faint track
  const arc = circumference * 0.75;

  return (
    <View style={[s.wrap, style]}>
      <Animated.View style={{ width: size, height: size, transform: [{ rotate }] }}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id="ringArc" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
              <Stop offset="1" stopColor="#F7A8EC" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Circle
            cx={size / 2} cy={size / 2} r={r}
            stroke="rgba(255,255,255,0.25)" strokeWidth={strokeWidth} fill="none"
          />
          <Circle
            cx={size / 2} cy={size / 2} r={r}
            stroke="url(#ringArc)" strokeWidth={strokeWidth} fill="none"
            strokeLinecap="round"
            strokeDasharray={`${arc} ${circumference}`}
          />
        </Svg>
      </Animated.View>
      {!!label && <Text style={s.label}>{label}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  wrap:  { alignItems: 'center' },
  label: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(60,0,120,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
