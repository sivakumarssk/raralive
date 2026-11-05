import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';

import { BoldIcon } from '@/components/ui/bold-icon';

// The app-wide message send button (chat rooms, live, Friend Zone calls, DMs).
// Same purple oval as the old sendButtonIcon.png (colours sampled from it),
// drawn as a vector so the paper plane can be a little bolder and stay sharp.
const ASPECT = 168 / 133; // the oval is wider than it is tall
const GRADIENT = ['#6A10FA', '#5D0ADB', '#4902BF'] as const;

type Props = {
  onPress: () => void;
  /** Rendered height; width follows the oval's aspect ratio. */
  size?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function SendButton({ onPress, size = 36, disabled = false, style }: Props) {
  const width = Math.round(size * ASPECT);
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel="Send message"
      style={[{ opacity: disabled ? 0.45 : 1 }, style]}>
      <LinearGradient
        colors={GRADIENT}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={[styles.oval, { width, height: size, borderRadius: size / 2 }]}>
        <BoldIcon name="paper-plane" size={Math.round(size * 0.56)} color="#FFFFFF" weight={14} style={styles.plane} />
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  oval: { alignItems: 'center', justifyContent: 'center' },
  // The plane's visual centre sits left of its box — nudge it to the middle
  plane: { marginLeft: 2 },
});
