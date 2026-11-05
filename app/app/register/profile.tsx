import { Stack, router } from 'expo-router';

import { ScreenHeader } from '@/components/ui/screen-header';
import { RegisterProfileScreen } from '@/screens/register/register-profile-screen';
import { authStore } from '@/store/auth-store';

// A new account has no language yet, so this lands on the one-time picker.
const goHomeOrLanguage = () => router.replace(authStore.needsLanguage() ? '/language' : '/(tabs)');

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
        onSkip={goHomeOrLanguage}
        onComplete={goHomeOrLanguage}
      />
    </>
  );
}
