import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ComingSoonScreen } from '@/screens/coming-soon/coming-soon-screen';

export default function ComingSoonPage() {
  const { title, icon } = useLocalSearchParams<{ title?: string; icon?: string }>();
  return (
    <ComingSoonScreen
      title={title ?? 'Coming Soon'}
      icon={(icon as keyof typeof Ionicons.glyphMap) ?? 'construct-outline'}
    />
  );
}
