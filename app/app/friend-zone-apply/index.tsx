import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

import type { FriendZoneApplication } from '@/services/api';
import { FriendZoneApplyScreen } from '@/screens/friend-zone-apply/friend-zone-apply-screen';

export default function FriendZoneApplyPage() {
  const { application: applicationParam } = useLocalSearchParams<{ application?: string }>();

  const existingApplication = useMemo<FriendZoneApplication | undefined>(() => {
    if (!applicationParam) return undefined;
    try { return JSON.parse(applicationParam); } catch { return undefined; }
  }, [applicationParam]);

  return <FriendZoneApplyScreen existingApplication={existingApplication} />;
}
