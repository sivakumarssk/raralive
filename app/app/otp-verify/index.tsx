import { Stack, router, useLocalSearchParams } from 'expo-router';
import { OtpVerifyScreen } from '@/screens/otp/otp-verify-screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { authStore } from '@/store/auth-store';

export default function OtpVerifyRoute() {
  // Login arrives with ?mode=login&phone=…; registration passes nothing
  const { mode, phone } = useLocalSearchParams<{ mode?: string; phone?: string }>();
  const isLogin = mode === 'login' && !!phone;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          header: () => <ScreenHeader />,
          headerTransparent: true,
        }}
      />
      <OtpVerifyScreen
        loginPhone={isLogin ? phone : undefined}
        onVerifyContinue={() => {
          if (isLogin) router.replace(authStore.needsLanguage() ? '/language' : '/(tabs)');
          else router.push('/register/profile');
        }}
      />
    </>
  );
}
