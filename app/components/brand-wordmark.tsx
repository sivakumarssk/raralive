import { StyleSheet, Text, View } from 'react-native';

type BrandWordmarkProps = {
  label?: string;
  scale?: number;
};

export function BrandWordmark({ label = 'Rara', scale = 1 }: BrandWordmarkProps) {
  return (
    <View style={[styles.container, { transform: [{ scale }] }]}>
      <Text style={styles.wordmark}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: 0,
    width: 99.94,
    height: 32,
    justifyContent: 'center',
  },
  wordmark: {
    fontSize: 32,
    lineHeight: 32,
    fontWeight: '800',
    color: '#7A04E5',
    letterSpacing: -0.2,
    includeFontPadding: false,
  },
});
