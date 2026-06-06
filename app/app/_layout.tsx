import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { MiniRoomPlayer } from '@/components/MiniRoomPlayer';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { register401Handler } from '@/services/api';
import { authStore } from '@/store/auth-store';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    register401Handler(
      () => { authStore.clear(); router.replace('/login'); },
      () => authStore.getToken(),
    );
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
        <Stack.Screen name="notifications/index" options={{ headerShown: false }} />
        <Stack.Screen name="battle/overview" options={{ headerShown: false }} />
        <Stack.Screen name="battle/live" options={{ headerShown: false }} />
      </Stack>
      <MiniRoomPlayer />
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
