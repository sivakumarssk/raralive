import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  apiChatAcceptConversation, apiChatConversations, apiChatRejectConversation, apiChatRequests,
  type ChatConversation,
} from '@/services/api';
import { authStore } from '@/store/auth-store';
import { chatSocketStore, subscribeChatEvents } from '@/store/chat-socket-store';
import { ConversationListItem } from './components/conversation-list-item';
import { RequestListItem } from './components/request-list-item';

type Tab = 'messages' | 'requests';

export function ChatListScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('messages');
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [requests, setRequests] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = authStore.getToken();
    if (!token) return;
    const [convRes, reqRes] = await Promise.all([
      apiChatConversations(token),
      apiChatRequests(token),
    ]);
    if (convRes.ok) setConversations(convRes.data);
    if (reqRes.ok) setRequests(reqRes.data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Keep the list live while it's open — a new message bumps the peer to the
  // top, and an accept/reject moves them between tabs without a manual refresh.
  useFocusEffect(useCallback(() => {
    chatSocketStore.connect();
    const unsub = subscribeChatEvents((event) => {
      if (event.type === 'message' || event.type === 'request_accepted' || event.type === 'request_rejected') {
        load();
      }
    });
    return unsub;
  }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleAccept = async (conversation: ChatConversation) => {
    const token = authStore.getToken();
    if (!token) return;
    setBusyId(conversation.id);
    const res = await apiChatAcceptConversation(conversation.id, token);
    setBusyId(null);
    if (res.ok) {
      setRequests(prev => prev.filter(r => r.id !== conversation.id));
      load();
      router.push(`/chat/${conversation.id}` as any);
    }
  };

  const handleReject = async (conversation: ChatConversation) => {
    const token = authStore.getToken();
    if (!token) return;
    setBusyId(conversation.id);
    const res = await apiChatRejectConversation(conversation.id, token);
    setBusyId(null);
    if (res.ok) setRequests(prev => prev.filter(r => r.id !== conversation.id));
  };

  const openConversation = (conversation: ChatConversation) => {
    router.push(`/chat/${conversation.id}` as any);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={24} color="#1A1730" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chats</Text>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tab, tab === 'messages' && styles.tabActive]} onPress={() => setTab('messages')} activeOpacity={0.8}>
          <Text style={[styles.tabText, tab === 'messages' && styles.tabTextActive]}>Messages</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'requests' && styles.tabActive]} onPress={() => setTab('requests')} activeOpacity={0.8}>
          <Text style={[styles.tabText, tab === 'requests' && styles.tabTextActive]}>Requests</Text>
          {requests.length > 0 && (
            <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{requests.length}</Text></View>
          )}
        </TouchableOpacity>
      </View>

      {tab === 'messages' ? (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ConversationListItem conversation={item} onPress={() => openConversation(item)} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7A0EED" />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={!loading ? (
            <View style={styles.empty}>
              <Ionicons name="chatbubble-ellipses-outline" size={48} color="#D0C8F0" />
              <Text style={styles.emptyText}>No messages yet</Text>
            </View>
          ) : null}
          contentContainerStyle={conversations.length === 0 ? styles.emptyContainer : undefined}
        />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <RequestListItem
              conversation={item}
              busy={busyId === item.id}
              onAccept={() => handleAccept(item)}
              onReject={() => handleReject(item)}
              onPress={() => openConversation(item)}
            />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7A0EED" />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={!loading ? (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color="#D0C8F0" />
              <Text style={styles.emptyText}>No message requests</Text>
            </View>
          ) : null}
          contentContainerStyle={requests.length === 0 ? styles.emptyContainer : undefined}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1A1730' },
  tabRow: {
    flexDirection: 'row', marginHorizontal: 16, marginTop: 8, marginBottom: 4,
    backgroundColor: '#F4F0FF', borderRadius: 24, padding: 4,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 9, borderRadius: 20,
  },
  tabActive: { backgroundColor: '#7A0EED' },
  tabText: { fontSize: 13.5, fontWeight: '700', color: '#9A94AE' },
  tabTextActive: { color: '#FFFFFF' },
  tabBadge: {
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5,
    backgroundColor: '#FF2A76', alignItems: 'center', justifyContent: 'center',
  },
  tabBadgeText: { fontSize: 10.5, fontWeight: '700', color: '#FFFFFF' },
  separator: { height: 1, backgroundColor: '#F4F0FF', marginLeft: 80 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 80 },
  emptyText: { fontSize: 14, color: '#9A94AE', fontWeight: '600' },
  emptyContainer: { flexGrow: 1 },
});
