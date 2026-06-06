import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

export function ScreenBackground() {
  return (
    <LinearGradient
      colors={['#E9DFF9', '#F5F3FA']}
      start={{ x: 0.5, y: 0.5 }}
      end={{ x: 0.5, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  );
}
