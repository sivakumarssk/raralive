import { Stack, router } from 'expo-router';

import { ScreenHeader } from '@/components/ui/screen-header';
import { RegisterProfileScreen } from '@/screens/register/register-profile-screen';

export default function RegisterProfileRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          header: () => <ScreenHeader step={2} totalSteps={2} backgroundColor="#F5F3FA" />,
          headerTransparent: true,
        }}
      />
      <RegisterProfileScreen
        onSkip={() => router.replace('/language')}
        onComplete={() => router.replace('/(tabs)')}
      />
    </>
  );
}
