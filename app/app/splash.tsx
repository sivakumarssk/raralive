import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as NativeSplash from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RingLoader } from '@/components/RingLoader';
import { authStore } from '@/store/auth-store';
import { friendZoneSocketStore } from '@/store/friend-zone-socket-store';

const SPLASH_IMG = require('@/assets/images/splash-rara.jpg');

export default function SplashScreen() {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const timeout = setTimeout(async () => {
      const hasToken = await authStore.hydrate();
      // _layout.tsx tries to connect the Friend Zone socket on mount, but
      // that happens before hydrate() has loaded the token from storage, so
      // that first attempt is always a no-op on a cold start into an
      // already-logged-in session. Connect here once the token is actually
      // available.
      if (hasToken) friendZoneSocketStore.connect();
      // A logged-in account that quit before picking a language gets the
      // picker now; otherwise Home.
      router.replace(!hasToken ? '/login' as never : authStore.needsLanguage() ? '/language' : '/(tabs)');
    }, 2200);

    return () => clearTimeout(timeout);
  }, []);

  // One full-screen image. The artwork is 9:16 and most phones are taller
  // (~9:20), so `cover` trims a thin strip off the left/right edges only —
  // the logo, text, icons and people all stay inside the visible area.
  return (
    <View style={styles.container}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />
      <Image
        source={SPLASH_IMG}
        style={styles.fill}
        resizeMode="cover"
        // Native logo splash stays up (see _layout.tsx) until this has decoded
        onLoadEnd={() => { NativeSplash.hideAsync().catch(() => {}); }}
      />

      <RingLoader style={[styles.loader, { bottom: insets.bottom + 24 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Mid-tone of the artwork's edges, shown only for the instant before the image decodes
    backgroundColor: '#B07AFC',
  },
  // Explicit 100% size: a bundled require() image otherwise gets its pixel
  // width/height as its size, which overrides absolute top/left/right/bottom
  // and renders it un-scaled from the top-left corner.
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  loader: {
    position: 'absolute',
    alignSelf: 'center',
  },
});
