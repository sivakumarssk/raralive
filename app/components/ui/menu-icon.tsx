import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

/** Filled, colour-coded menu icon with a soft drop shadow for a raised look — no tile behind it. */
export function MenuIcon({ name, color }: { name: keyof typeof Ionicons.glyphMap; color: string }) {
  return (
    <View style={styles.wrap}>
      <Ionicons name={name} size={22} color={color} style={[styles.glyph, { textShadowColor: `${color}55` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  glyph: { textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
});
