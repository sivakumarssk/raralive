import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { router, Stack } from 'expo-router';
import * as ScreenCapture from 'expo-screen-capture';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Alert, Platform, StatusBar } from 'react-native';
import 'react-native-reanimated';

import { AppUpdateTag } from '@/components/AppUpdateTag';
import { IncomingCallOverlay } from '@/components/IncomingCallOverlay';
import { InsufficientCoinsModal } from '@/components/InsufficientCoinsModal';
import { MiniRoomPlayer } from '@/components/MiniRoomPlayer';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { register401Handler } from '@/services/api';
import { authStore } from '@/store/auth-store';
import { chatSocketStore, subscribeChatEvents } from '@/store/chat-socket-store';
import { socketStore } from '@/store/socket-store';
import { initFriendZoneCallSession } from '@/store/friend-zone-call-session-store';
import {
  friendZoneSocketStore,
  startFriendZoneAppStateWatcher,
  stopFriendZoneAppStateWatcher,
} from '@/store/friend-zone-socket-store';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Keep the native logo splash up until the JS splash artwork has decoded
// (splash.tsx hides it), otherwise a blank white frame shows in between.
SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ fade: true, duration: 250 });

// Android status bar is translucent app-wide, from launch and never toggled.
// Screens that draw behind it (chat room stage, profile cover, leaderboard)
// used to switch translucency on mount/unmount, which resizes the window
// after the first layout: the header slid down on open and the screen
// jumped on back. Every screen pads its own top with safe-area insets, as
// it already does on iOS.
if (Platform.OS === 'android') {
  StatusBar.setTranslucent(true);
  StatusBar.setBackgroundColor('transparent');
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // No screenshots or screen recording anywhere in the app. Android: the
  // window is marked secure, so screenshots are refused and recordings show
  // black. iOS: blocks recordings (iOS 11+) and screenshots (iOS 13+).
  // Set once here, for every screen.
  useEffect(() => {
    ScreenCapture.preventScreenCaptureAsync('app').catch(() => {});
  }, []);

  // Moderation warning (5 different people reported this user) — shown on
  // whatever screen is open; also saved under Notifications.
  useEffect(() => subscribeChatEvents(event => {
    if (event.type === 'moderation_warning') Alert.alert('Warning', event.message);
  }), []);

  // Safety net: when the app opens straight onto another screen (deep link,
  // notification) splash.tsx never mounts to hide the native splash.
  useEffect(() => {
    const t = setTimeout(() => { SplashScreen.hideAsync().catch(() => {}); }, 3000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    register401Handler(
      (reason) => {
        authStore.clear(); friendZoneSocketStore.disconnect(); chatSocketStore.disconnect(); socketStore.leave(); router.replace('/login');
        if (reason === 'revoked') Alert.alert('Logged out', 'Your account was logged out of all devices. Please log in again.');
      },
      () => authStore.getToken(),
    );
  }, []);

  useEffect(() => {
    initFriendZoneCallSession();
    if (authStore.getToken()) { friendZoneSocketStore.connect(); chatSocketStore.connect(); }
    startFriendZoneAppStateWatcher();
    // Friend Zone socket is app-wide and persistent — do NOT disconnect it
    // here. This effect's cleanup can fire on root layout remounts (e.g.
    // Fast Refresh), which would otherwise kill the socket without anything
    // ever reconnecting it, leaving the user stuck "offline" for everyone
    // else. Logout (register401Handler above) is the only place that should
    // disconnect it.
    return () => {
      stopFriendZoneAppStateWatcher();
    };
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="splash" options={{ headerShown: false }} />
        <Stack.Screen name="login/index" options={{ headerShown: false }} />
        <Stack.Screen name="language/index" options={{ headerShown: false }} />
        <Stack.Screen name="register/index" options={{ headerShown: false }} />
        <Stack.Screen name="register/profile" options={{ headerShown: false }} />
        <Stack.Screen name="otp-verify/index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="room/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password/index" options={{ headerShown: false }} />
        <Stack.Screen name="wallet/index" options={{ headerShown: false }} />
        <Stack.Screen name="agency-wallet/index" options={{ headerShown: false }} />
        <Stack.Screen name="agency-wallet-history/index" options={{ headerShown: false }} />
        <Stack.Screen name="wallet-history/index" options={{ headerShown: false }} />
        <Stack.Screen name="service-earnings/index" options={{ headerShown: false }} />
        <Stack.Screen name="performance/index" options={{ headerShown: false }} />
        <Stack.Screen name="leaderboard/index" options={{ headerShown: false }} />
        <Stack.Screen name="notifications/index" options={{ headerShown: false }} />
        <Stack.Screen name="battle/overview" options={{ headerShown: false }} />
        <Stack.Screen name="profile/edit" options={{ headerShown: false }} />
        <Stack.Screen name="gift-history/index" options={{ headerShown: false }} />
        <Stack.Screen name="legal/[doc]" options={{ headerShown: false }} />
        <Stack.Screen name="search/index" options={{ headerShown: false }} />
        <Stack.Screen name="post/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="category-posts" options={{ headerShown: false }} />
        <Stack.Screen name="id-level/index" options={{ headerShown: false }} />
        <Stack.Screen name="friend-zone-apply/index" options={{ headerShown: false }} />
        <Stack.Screen name="friend-profile/index" options={{ headerShown: false }} />
        <Stack.Screen name="call-history/index" options={{ headerShown: false }} />
        <Stack.Screen name="friend-zone-call/index" options={{ headerShown: false }} />
        <Stack.Screen name="chat/index" options={{ headerShown: false }} />
        <Stack.Screen name="chat/[conversationId]" options={{ headerShown: false }} />
        <Stack.Screen name="user/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="live-broadcast/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="go-live-preview/index" options={{ headerShown: false }} />
        <Stack.Screen name="edit-room-name/index" options={{ headerShown: false }} />
        <Stack.Screen name="agency/[id]" options={{ headerShown: false }} />
      </Stack>
      {/* Always mounted, so translucency never falls back to the opaque
          default when no screen-level StatusBar is mounted. Sets no barStyle —
          screens keep choosing their own icon colour. */}
      <StatusBar translucent backgroundColor="transparent" />
      <MiniRoomPlayer />
      {/* Above the navigator so it stays put on every screen */}
      <AppUpdateTag />
      <IncomingCallOverlay />
      <InsufficientCoinsModal />
    </ThemeProvider>
  );
}
