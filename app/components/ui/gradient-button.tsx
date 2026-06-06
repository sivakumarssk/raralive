import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';

type GradientButtonProps = {
  label: string;
  onPress?: () => void;
  iconName?: keyof typeof Ionicons.glyphMap;
  iconNode?: ReactNode;
  colors?: [string, string];
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
};

export function GradientButton({
  label,
  onPress,
  iconName,
  iconNode,
  colors = ['#7A0EED', '#B50357'],
  style,
  disabled = false,
}: GradientButtonProps) {
  return (
    <TouchableOpacity activeOpacity={0.9} style={[styles.button, style, disabled && styles.disabled]} onPress={onPress} disabled={disabled}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.gradient}>
        <Text style={styles.label}>{label}</Text>
        {iconNode ?? (iconName ? <Ionicons name={iconName} size={16} color="#FFFFFF" /> : null)}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 48,
    overflow: 'hidden',
    shadowColor: '#7A0EED',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  gradient: {
    height: 52,
    borderRadius: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.55,
  },
});
