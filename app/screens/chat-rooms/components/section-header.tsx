import { StyleSheet, Text, View } from 'react-native';

type SectionHeaderProps = {
  title: string;
};

export function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
    backgroundColor: '#FAFAFA',
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1C1E22',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
});
