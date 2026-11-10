import { Stack } from 'expo-router';

import { ScreenHeader } from '@/components/ui/screen-header';
import { RegisterProfileScreen } from '@/screens/register/register-profile-screen';
import { enterApp } from '@/store/pending-link';

// A new account has no language yet, so this lands on the one-time picker.
const goHomeOrLanguage = enterApp;

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
