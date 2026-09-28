import { useLocalSearchParams } from 'expo-router';
import { AgencyProfileScreen } from '@/screens/agency-profile/agency-profile-screen';

export default function AgencyProfilePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AgencyProfileScreen agencyId={id ?? ''} />;
}
