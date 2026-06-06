import { Stack, router } from 'expo-router';
import { OtpVerifyScreen } from '@/screens/otp/otp-verify-screen';
import { ScreenHeader } from '@/components/ui/screen-header';

export default function OtpVerifyRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          header: () => <ScreenHeader />,
          headerTransparent: true,
        }}
      />
      <OtpVerifyScreen onVerifyContinue={() => router.push('/register/profile')} />
    </>
  );
}
