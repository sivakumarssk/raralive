import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Language picker shared by the login flow (LanguageSelectionScreen) and the
// Profile → Change Language sheet, so both show the same two-column cards.

export type LanguageOption = {
  id: string;
  label: string;
  nativeLabel: string;
};

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { id: 'en', label: 'English', nativeLabel: 'English' },
  { id: 'hi', label: 'Hindi', nativeLabel: 'हिंदी' },
  { id: 'mr', label: 'Marathi', nativeLabel: 'मराठी' },
  { id: 'te', label: 'Telugu', nativeLabel: 'తెలుగు' },
  { id: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்' },
  { id: 'bn', label: 'Bengali', nativeLabel: 'বাংলা' },
  { id: 'kn', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ' },
  { id: 'ml', label: 'Malayalam', nativeLabel: 'മലയാളം' },
];

/** Page background the cards are designed for — use it behind the grid. */
export const LANGUAGE_PICKER_BG = '#F5F3FA';

/** "Choose Your Language" title + subtitle. */
export function LanguagePickerHeading() {
  return (
    <>
      <Text style={styles.title}>Choose Your Language</Text>
      <Text style={styles.subtitle}>Select your preferred language to customize your experience.</Text>
    </>
  );
}

/** Two-column language cards; the selected one gets a purple border + check badge. */
export function LanguageGrid({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  return (
    <View style={styles.grid}>
      {LANGUAGE_OPTIONS.map((option) => {
        const isSelected = option.id === selected;
        return (
          <TouchableOpacity
            key={option.id}
            style={[styles.langCard, isSelected && styles.langCardSelected]}
            activeOpacity={0.9}
            onPress={() => onSelect(option.id)}>
            {isSelected && (
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
  );
}

const styles = StyleSheet.create({
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
});
