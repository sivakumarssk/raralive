import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';

type GradientButtonProps = {
  label: string;
  onPress?: () => void;
  /** Ionicons icon name */
  iconName?: keyof typeof Ionicons.glyphMap;
  /** Emoji or any custom node rendered before the label */
  iconNode?: ReactNode;
  /** Gradient color stops — left to right. Defaults to purple→magenta. */
  colors?: readonly [string, string, ...string[]];
  /** Gradient direction. Defaults to left→right. */
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  height?: number;
  borderRadius?: number;
  fontSize?: number;
  iconSize?: number;
  disabled?: boolean;
};

export function GradientButton({
  label,
  onPress,
  iconName,
  iconNode,
  colors = ['#7A0EED', '#B50357'],
  start = { x: 0, y: 0.5 },
  end = { x: 1, y: 0.5 },
  style,
  textStyle,
  height = 52,
  borderRadius = 48,
  fontSize = 16,
  iconSize = 18,
  disabled = false,
}: GradientButtonProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      style={[styles.button, { borderRadius }, style, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}>
      <LinearGradient
        colors={colors}
        start={start}
        end={end}
        style={[styles.gradient, { height, borderRadius }]}>
        {iconNode ?? (iconName
          ? <Ionicons name={iconName} size={iconSize} color="#FFFFFF" />
          : null)}
        <Text style={[styles.label, { fontSize }, textStyle]}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    overflow: 'hidden',
    shadowColor: '#7A0EED',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  label: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
});
