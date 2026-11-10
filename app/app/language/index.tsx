import { Stack } from 'expo-router';

import { ScreenHeader } from '@/components/ui/screen-header';
import { LanguageSelectionScreen } from '@/screens/language/language-selection-screen';
import { enterApp } from '@/store/pending-link';

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
      <LanguageSelectionScreen onContinue={enterApp} />
    </>
  );
}
