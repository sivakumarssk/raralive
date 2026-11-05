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
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#FAFAFA',
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1C1E22',
    letterSpacing: 0.2,
    
  },
});
