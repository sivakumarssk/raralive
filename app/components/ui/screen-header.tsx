import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientWordmark } from '@/components/gradient-wordmark';

type ScreenHeaderProps = {
  step?: number;
  totalSteps?: number;
  onBack?: () => void;
  backgroundColor?: string;
};

export function ScreenHeader({ step, totalSteps, onBack, backgroundColor }: ScreenHeaderProps) {
  const handleBack = onBack ?? (() => router.back());
  const { top } = useSafeAreaInsets();
  const stepProgress = step && totalSteps ? step / totalSteps : undefined;
  const resolvedBackgroundColor = backgroundColor ?? '#F5F3FA';

  return (
    <View style={[styles.header, { paddingTop: top + 10, backgroundColor: resolvedBackgroundColor }]}>
      {/* Left: back button with GradientWordmark */}
      <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={22} color="#7A0EED" />
        <GradientWordmark
          text="Rara Live"
          containerStyle={styles.wordmark}
          fontSize={18}
          lineHeight={22}
          fontWeight="800"
          letterSpacing={-0.3}
          includeFontPadding={false}
        />
      </TouchableOpacity>

      {/* Right: step indicator */}
      {stepProgress !== undefined && (
        <View style={styles.stepIndicator}>
          <View style={styles.stepTrack}>
            <View style={[styles.stepFill, { width: `${stepProgress * 100}%` }]} />
          </View>
          <View style={styles.stepLabelWrap}>
            <GradientWordmark
              text={`STEP ${step}/${totalSteps}`}
              containerStyle={styles.stepWordmark}
              fontSize={11}
              lineHeight={14}
              fontWeight="700"
              letterSpacing={0.8}
              includeFontPadding={false}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    // backgroundColor: '#FFFFFF',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  wordmark: {
    width: 82,
    height: 22,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepTrack: {
    width: 48,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#DDD6F5',
    overflow: 'hidden',
  },
  stepFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#7A0EED',
  },
  stepLabelWrap: {
    justifyContent: 'center',
  },
  stepWordmark: {
    width: 82,
    height: 14,
  },
});
