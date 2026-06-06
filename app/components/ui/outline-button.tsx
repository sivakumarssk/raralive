import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';

type OutlineButtonProps = {
  label: string;
  onPress?: () => void;
  iconName?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
};

export function OutlineButton({
  label,
  onPress,
  iconName,
  iconColor = '#2C2F33',
  iconSize = 20,
  style,
}: OutlineButtonProps) {
  return (
    <TouchableOpacity style={[styles.button, style]} activeOpacity={0.85} onPress={onPress}>
      {iconName ? <Ionicons name={iconName} size={iconSize} color={iconColor} /> : null}
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 50,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    backgroundColor: '#FAFAFA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  label: {
    color: '#2C2F33',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
});
