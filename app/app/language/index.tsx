import { Stack, router } from 'expo-router';

import { ScreenHeader } from '@/components/ui/screen-header';
import { LanguageSelectionScreen } from '@/screens/language/language-selection-screen';

export default function LanguageRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          header: () => <ScreenHeader />,
          headerTransparent: true,
        }}
      />
      <LanguageSelectionScreen onContinue={() => router.replace('/(tabs)')} />
    </>
  );
}
