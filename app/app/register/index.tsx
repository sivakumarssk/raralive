import { Stack, router } from 'expo-router';
import { RegisterScreen } from '@/screens/register/register-screen';
import { ScreenHeader } from '@/components/ui/screen-header';

export default function RegisterRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          header: () => <ScreenHeader step={1} totalSteps={2} />,
          headerTransparent: true,
        }}
      />
      <RegisterScreen onCreateAccount={() => router.push('/otp-verify')} />
    </>
  );
}
