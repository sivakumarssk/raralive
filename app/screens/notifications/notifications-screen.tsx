import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppScreenHeader } from '@/components/ui/app-screen-header';
import { BASE_URL } from '@/services/api';
import { authStore } from '@/store/auth-store';

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, string> | null;
  is_read: boolean;
  created_at: string;
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function NotifIcon({ type }: { type: string }) {
  if (type === 'battle_invite') {
    return (
      <View style={[styles.iconCircle, { backgroundColor: '#EFF6FF' }]}>
        <Text style={styles.iconEmoji}>⚔️</Text>
      </View>
    );
  }
  if (type === 'battle_accepted') {
    return (
      <View style={[styles.iconCircle, { backgroundColor: '#ECFDF5' }]}>
        <Text style={styles.iconEmoji}>✅</Text>
      </View>
    );
  }
  return (
    <View style={[styles.iconCircle, { backgroundColor: '#F5F3FA' }]}>
      <Ionicons name="notifications-outline" size={20} color="#7A0EED" />
    </View>
  );
}

export function NotificationsScreen() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const token = authStore.getToken();
      const r = await fetch(`${BASE_URL}/battle/notifications`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await r.json();
      if (json.success) setNotifications(json.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Mark all as read after 1 second
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const token = authStore.getToken();
        await fetch(`${BASE_URL}/battle/notifications/read`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        // Update local state to reflect read
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      } catch {}
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleAccept = async (notif: NotificationItem) => {
    const inviteId = notif.data?.invite_id;
    if (!inviteId) return;
    setAcceptingId(notif.id);
    try {
      const token = authStore.getToken();
      const r = await fetch(`${BASE_URL}/battle/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ invite_id: inviteId }),
      });
      const json = await r.json();
      if (json.success) {
        router.push(`/battle/overview?inviteId=${inviteId}` as any);
      }
    } catch {}
    setAcceptingId(null);
  };

  const handleNotifPress = (notif: NotificationItem) => {
    const inviteId = notif.data?.invite_id;
    if (inviteId && (notif.type === 'battle_accepted' || notif.type === 'battle_invite')) {
      router.push(`/battle/overview?inviteId=${inviteId}` as any);
    }
  };

  const renderItem = ({ item }: { item: NotificationItem }) => {
    const isBattleInvite = item.type === 'battle_invite';
    const isAccepting = acceptingId === item.id;

    return (
      <TouchableOpacity
        style={[styles.notifRow, !item.is_read && styles.notifRowUnread]}
        activeOpacity={0.75}
        onPress={() => handleNotifPress(item)}>
        <NotifIcon type={item.type} />

        <View style={styles.notifContent}>
          <View style={styles.notifTitleRow}>
            <Text style={styles.notifTitle} numberOfLines={1}>{item.title}</Text>
            {!item.is_read && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
          <Text style={styles.notifTime}>{timeAgo(item.created_at)}</Text>

          {isBattleInvite && (
            <TouchableOpacity
              style={[styles.acceptBtn, isAccepting && styles.acceptBtnLoading]}
              activeOpacity={0.85}
              onPress={() => handleAccept(item)}
              disabled={isAccepting}>
              {isAccepting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.acceptBtnText}>Accept Challenge</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppScreenHeader
        title="Notifications"
        onBack={() => router.back()}
        backgroundColor="#FFFFFF"
        noBottomShadow
      />
      <View style={styles.headerGap} />

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator color="#7A0EED" size="large" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.centerWrap}>
          <Ionicons name="notifications-off-outline" size={56} color="#D0C8F0" />
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptySub}>Battle invites and updates will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={n => n.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={renderItem}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: '#FFFFFF' },
  headerGap:       { height: 8, backgroundColor: '#F5F3FA' },
  centerWrap:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  emptyTitle:      { fontSize: 18, fontWeight: '700', color: '#1C1E22' },
  emptySub:        { fontSize: 13, color: '#ABADB2', textAlign: 'center', lineHeight: 20 },
  list:            { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },
  separator:       { height: StyleSheet.hairlineWidth, backgroundColor: '#E8E6F0', marginLeft: 78 },

  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    shadowColor: '#4A0099',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    marginBottom: 8,
  },
  notifRowUnread: {
    backgroundColor: '#FAF8FF',
    shadowOpacity: 0.08,
    elevation: 2,
  },

  iconCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  iconEmoji: { fontSize: 20 },

  notifContent:  { flex: 1 },
  notifTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  notifTitle:    { flex: 1, fontSize: 14, fontWeight: '700', color: '#1C1E22' },
  unreadDot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3B82F6', flexShrink: 0 },
  notifBody:     { fontSize: 13, color: '#60626A', lineHeight: 19, marginBottom: 4 },
  notifTime:     { fontSize: 11, color: '#ABADB2', fontWeight: '500' },

  acceptBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#3B82F6',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
    minWidth: 140,
    alignItems: 'center',
  },
  acceptBtnLoading: { backgroundColor: '#93C5FD' },
  acceptBtnText:    { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
});
