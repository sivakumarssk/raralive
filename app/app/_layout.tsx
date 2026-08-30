import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { IncomingCallOverlay } from '@/components/IncomingCallOverlay';
import { InsufficientCoinsModal } from '@/components/InsufficientCoinsModal';
import { MiniRoomPlayer } from '@/components/MiniRoomPlayer';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { register401Handler } from '@/services/api';
import { authStore } from '@/store/auth-store';
import { chatSocketStore } from '@/store/chat-socket-store';
import { initFriendZoneCallSession } from '@/store/friend-zone-call-session-store';
import {
  friendZoneSocketStore,
  startFriendZoneAppStateWatcher,
  stopFriendZoneAppStateWatcher,
} from '@/store/friend-zone-socket-store';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    register401Handler(
      () => { authStore.clear(); friendZoneSocketStore.disconnect(); chatSocketStore.disconnect(); router.replace('/login'); },
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
        <Stack.Screen name="performance/index" options={{ headerShown: false }} />
        <Stack.Screen name="leaderboard/index" options={{ headerShown: false }} />
        <Stack.Screen name="notifications/index" options={{ headerShown: false }} />
        <Stack.Screen name="battle/overview" options={{ headerShown: false }} />
        <Stack.Screen name="profile/edit" options={{ headerShown: false }} />
        <Stack.Screen name="gift-history/index" options={{ headerShown: false }} />
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
      </Stack>
      <MiniRoomPlayer />
      <IncomingCallOverlay />
      <InsufficientCoinsModal />
    </ThemeProvider>
  );
}
