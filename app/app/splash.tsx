import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientWordmark } from '@/components/gradient-wordmark';
import { authStore } from '@/store/auth-store';

export default function SplashScreen() {
  const [trackWidth, setTrackWidth] = useState(0);
  const progressAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timeout = setTimeout(async () => {
      const hasToken = await authStore.hydrate();
      router.replace(hasToken ? '/(tabs)' : '/login' as never);
    }, 2200);

    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!trackWidth) return;

    const loop = Animated.loop(
      Animated.timing(progressAnimation, {
        toValue: 1,
        duration: 1400,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );

    loop.start();

    return () => {
      loop.stop();
      progressAnimation.setValue(0);
    };
  }, [progressAnimation, trackWidth]);

  const indicatorTranslateX = progressAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(trackWidth - 90, 0)],
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.ring} />
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <View style={styles.content}>
        <View style={styles.logoCard}>
          <Image source={require('@/assets/images/raralogo.png')} style={styles.logo} resizeMode="contain" />
        </View>
        <GradientWordmark
          containerStyle={styles.logoText}
          fontSize={46}
          lineHeight={52}
          fontWeight="900"
          letterSpacing={-0.8}
          includeFontPadding={false}
        />
        <Text style={styles.tagline}>THE CHROMATIC PULSE</Text>
      </View>

      <View style={styles.bottomSection}>
        <View style={styles.progressTrack} onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                transform: [{ translateX: indicatorTranslateX }],
              },
            ]}
          />
        </View>
        <Text style={styles.title}>Social-first Connection</Text>
        <Text style={styles.subtitle}>Where connections feel alive.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFCFF',
    justifyContent: 'space-between',
    paddingTop: 46,
    paddingBottom: 56,
    paddingHorizontal: 28,
  },
  ring: {
    position: 'absolute',
    top: 138,
    right: 56,
    width: 120,
    height: 120,
    borderRadius: 999,
    borderWidth: 18,
    borderColor: 'rgba(180, 118, 255, 0.08)',
  },
  glowTop: {
    position: 'absolute',
    top: -40,
    left: -50,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: 'rgba(237, 95, 255, 0.05)',
  },
  glowBottom: {
    position: 'absolute',
    bottom: 120,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: 'rgba(244, 88, 130, 0.05)',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCard: {
    width: 146,
    height: 146,
    borderRadius: 38,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D595FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 8,
  },
  logo: {
    width: 74,
    height: 74,
  },
  logoText: {
    marginTop: 20,
    width: 240,
    height: 64,
  },
  tagline: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 4,
    color: '#A5A5AF',
  },
  bottomSection: {
    marginBottom: 4,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#E9EDF2',
    overflow: 'hidden',
  },
  progressFill: {
    width: 90,
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#A301D9',
  },
  title: {
    marginTop: 26,
    fontSize: 45 / 2,
    fontWeight: '800',
    color: '#1A1A26',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 18 / 2,
    fontWeight: '600',
    color: '#6A6D77',
  },
});
