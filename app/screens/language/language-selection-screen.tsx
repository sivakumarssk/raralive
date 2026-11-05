import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { GradientButton } from '@/components/ui/gradient-button';
import { ScreenBackground } from '@/components/ui/screen-background';
import { apiSetLanguage } from '@/services/api';
import { authStore } from '@/store/auth-store';
import { LANGUAGE_PICKER_BG, LanguageGrid, LanguagePickerHeading } from './language-grid';

type LanguageSelectionScreenProps = {
  onContinue?: () => void;
};

export function LanguageSelectionScreen({ onContinue }: LanguageSelectionScreenProps) {
  const [selectedLanguage, setSelectedLanguage] = useState(authStore.getLanguage() ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    if (!selectedLanguage) {
      setError('Please choose a language to continue.');
      return;
    }
    setError('');

    // Saved on the account so later logins (on any phone) skip this page.
    // Guests have no account — the phone remembers it instead.
    const token = authStore.getToken();
    if (token) {
      setSaving(true);
      const result = await apiSetLanguage(selectedLanguage, token);
      setSaving(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
    }
    authStore.setLanguage(selectedLanguage);
    onContinue?.();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenBackground />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.logoWrap}>
          <View style={styles.logoGlow} />
          <Image source={require('@/assets/images/raralogo.png')} style={styles.logo} contentFit="contain" />
        </View>

        <LanguagePickerHeading />

        <LanguageGrid
          selected={selectedLanguage}
          onSelect={(id) => {
            setSelectedLanguage(id);
            if (error) setError('');
          }}
        />

        <View style={styles.communityCard}>
          <View style={styles.communityIconWrap}>
            <Ionicons name="earth-outline" size={16} color="#7A0EED" />
          </View>
          <View style={styles.communityTextWrap}>
            <Text style={styles.communityTitle}>Global Community</Text>
            <Text style={styles.communityBody}>Connect with people in your own tongue.</Text>
          </View>
        </View>

        <View style={styles.footer}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <GradientButton
            label={saving ? 'Saving…' : 'Continue'}
            iconName="arrow-forward"
            onPress={handleContinue}
            disabled={saving}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: LANGUAGE_PICKER_BG,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 58,
    paddingBottom: 16,
  },
  logoWrap: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  logoGlow: {
    position: 'absolute',
    width: 74,
    height: 74,
    borderRadius: 999,
    backgroundColor: 'rgba(151, 94, 244, 0.24)',
  },
  logo: {
    width: 54,
    height: 54,
  },
  communityCard: {
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  communityIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1E7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  communityTextWrap: {
    flex: 1,
  },
  communityTitle: {
    color: '#2C2F33',
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '700',
  },
  communityBody: {
    color: '#5D606B',
    fontSize: 12,
    lineHeight: 16,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(122, 14, 237, 0.08)',
  },
  errorText: {
    marginBottom: 8,
    color: '#E14C57',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
});
