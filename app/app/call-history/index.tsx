import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { apiFriendZoneCallHistory, resolveImageUrl } from '@/services/api';
import { authStore } from '@/store/auth-store';
import { CallHistoryScreen, type CallHistoryEntry } from '@/screens/call-history/call-history-screen';
import { getFriendZoneSocketState } from '@/store/friend-zone-socket-store';

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} min`;
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (isToday) return `Today, ${time}`;
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`;
}

export default function CallHistoryPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<CallHistoryEntry[]>([]);

  useEffect(() => {
    const token = authStore.getToken();
    if (!token) return;
    apiFriendZoneCallHistory(token).then(r => {
      if (!r.ok) return;
      const onlineMap = getFriendZoneSocketState().online;
      setEntries(r.data.map((e): CallHistoryEntry => ({
        id: e.id,
        name: e.peer_name || e.peer_username || 'Unknown',
        age: 0,
        gender: 'Other',
        userId: e.peer_user_id,
        level: 0,
        callType: e.call_type,
        direction: e.direction,
        avatarUri: e.peer_avatar_url ? resolveImageUrl(e.peer_avatar_url) : undefined,
        isOnline: onlineMap[e.peer_user_id] ?? false,
        durationLabel: formatDuration(e.duration_seconds),
        coinsSpent: e.coins_charged,
        gemsEarned: e.gems_earned,
        dateLabel: formatDateLabel(e.created_at),
      })));
    });
  }, []);

  return (
    <CallHistoryScreen
      entries={entries}
      onBack={() => router.back()}
      onEntryPress={() => {}}
    />
  );
}
