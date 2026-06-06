import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type CreateRoomCardProps = {
  onPress?: () => void;
};

export function CreateRoomCard({ onPress }: CreateRoomCardProps) {
  return (
    <View style={styles.wrapper}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.card}>
        <LinearGradient
          colors={['#7A0EED', '#B50357']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconCircle}>
          <Ionicons name="add" size={18} color="#FFFFFF" />
        </LinearGradient>

        <View style={styles.textBlock}>
          <Text style={styles.title}>Create New Room</Text>
          <Text style={styles.subtitle}>Start your own live chat space</Text>
        </View>

        <Ionicons name="chevron-forward" size={16} color="#7A0EED" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: '#E8DAFF',
    borderStyle: 'dashed',
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1E22',
  },
  subtitle: {
    fontSize: 11,
    color: '#ABADB2',
    fontWeight: '500',
  },
});
