import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

type RangeLoaderProps = {
  color?: string;
};

const BAR_COUNT = 7;

export function RangeLoader({ color = '#E11D48' }: RangeLoaderProps) {
  const animations = useRef(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(0.35))
  ).current;

  const loopAnimation = useMemo(() => {
    const sequences = animations.map((value, index) =>
      Animated.sequence([
        Animated.delay(index * 120),
        Animated.timing(value, {
          toValue: 1,
          duration: 320,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0.35,
          duration: 320,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    return Animated.loop(Animated.parallel(sequences));
  }, [animations]);

  useEffect(() => {
    loopAnimation.start();
    return () => {
      loopAnimation.stop();
    };
  }, [loopAnimation]);

  return (
    <View style={styles.container}>
      {animations.map((animatedValue, index) => (
        <Animated.View
          key={`range-bar-${index}`}
          style={[
            styles.bar,
            {
              backgroundColor: color,
              transform: [{ scaleY: animatedValue }],
              opacity: animatedValue,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
    height: 44,
  },
  bar: {
    width: 6,
    height: 38,
    borderRadius: 999,
  },
});
