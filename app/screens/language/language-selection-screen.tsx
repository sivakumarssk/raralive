import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { GradientButton } from '@/components/ui/gradient-button';
import { ScreenBackground } from '@/components/ui/screen-background';

type LanguageOption = {
  id: string;
  label: string;
  nativeLabel: string;
};

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { id: 'en', label: 'English', nativeLabel: 'English' },
  { id: 'hi', label: 'Hindi', nativeLabel: 'हिंदी' },
  { id: 'mr', label: 'Marathi', nativeLabel: 'मराठी' },
  { id: 'te', label: 'Telugu', nativeLabel: 'తెలుగు' },
  { id: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்' },
  { id: 'bn', label: 'Bengali', nativeLabel: 'বাংলা' },
  { id: 'kn', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ' },
  { id: 'ml', label: 'Malayalam', nativeLabel: 'മലയാളം' },
];

type LanguageSelectionScreenProps = {
  onContinue?: () => void;
};

export function LanguageSelectionScreen({ onContinue }: LanguageSelectionScreenProps) {
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [error, setError] = useState('');

  const handleContinue = () => {
    if (!selectedLanguage) {
      setError('Please choose a language to continue.');
      return;
    }
    setError('');
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

        <Text style={styles.title}>Choose Your Language</Text>
        <Text style={styles.subtitle}>Select your preferred language to customize your experience.</Text>

        <View style={styles.grid}>
          {LANGUAGE_OPTIONS.map((option) => {
            const selected = option.id === selectedLanguage;
            return (
              <TouchableOpacity
                key={option.id}
                style={[styles.langCard, selected && styles.langCardSelected]}
                activeOpacity={0.9}
                onPress={() => {
                  setSelectedLanguage(option.id);
                  if (error) setError('');
                }}>
                {selected && (
                  <View style={styles.checkBadge}>
                    <Ionicons name="checkmark" size={11} color="#FFFFFF" />
                  </View>
                )}
                <Text style={styles.langTitle}>{option.label}</Text>
                <Text style={styles.langNative}>{option.nativeLabel}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

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
          <GradientButton label="Continue" iconName="arrow-forward" onPress={handleContinue} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F3FA',
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
  title: {
    marginTop: 18,
    textAlign: 'center',
    color: '#1C1E22',
    fontSize: 48 / 2,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: 8,
    textAlign: 'center',
    color: '#60626A',
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 24,
  },
  grid: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  langCard: {
    width: '48%',
    minHeight: 84,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.72)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  langCardSelected: {
    borderColor: '#7A0EED',
    backgroundColor: '#FFFFFF',
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 10,
    width: 16,
    height: 16,
    borderRadius: 999,
    backgroundColor: '#7A0EED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  langTitle: {
    color: '#2A2C33',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  langNative: {
    marginTop: 4,
    color: '#6B6E79',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '500',
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
