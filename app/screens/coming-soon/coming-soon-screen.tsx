import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppScreenHeader } from '@/components/ui/app-screen-header';

type ComingSoonScreenProps = {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

export function ComingSoonScreen({ title, icon = 'construct-outline' }: ComingSoonScreenProps) {
  const router = useRouter();
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <AppScreenHeader title={title} onBack={() => router.back()} />
      <View style={s.body}>
        <Ionicons name={icon} size={48} color="#C4B8E8" />
        <Text style={s.text}>Coming soon</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  text: { fontSize: 15, fontWeight: '600', color: '#ABADB2' },
});
