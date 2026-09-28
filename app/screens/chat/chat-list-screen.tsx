import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  FlatList, Modal, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity,
  TouchableWithoutFeedback, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  apiChatAcceptConversation, apiChatConversations, apiChatDeleteConversation, apiChatMarkRead,
  apiChatMarkUnread, apiChatPin, apiChatRejectConversation, apiChatRequests, apiChatUnpin,
  type ChatConversation,
} from '@/services/api';
import { authStore } from '@/store/auth-store';
import { chatSocketStore, subscribeChatEvents } from '@/store/chat-socket-store';
import { ConversationListItem } from './components/conversation-list-item';
import { RequestListItem } from './components/request-list-item';

type Tab = 'messages' | 'requests';
type FilterMode = 'all' | 'unread' | 'read';

// ── Long-press quick actions for one conversation ─────────────────────────────
function ConversationActionSheet({ visible, onClose, conversation, onPin, onUnpin, onMarkUnread, onDelete }: {
  visible: boolean;
  onClose: () => void;
  conversation: ChatConversation | null;
  onPin: () => void;
  onUnpin: () => void;
  onMarkUnread: () => void;
  onDelete: () => void;
}) {
  if (!visible || !conversation) return null;
  const name = conversation.peer_name || conversation.peer_username || 'this chat';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={as.backdrop} />
      </TouchableWithoutFeedback>
      <View style={as.cardWrap} pointerEvents="box-none">
        <View style={as.card}>
          <Text style={as.title} numberOfLines={1}>{name}</Text>

          <TouchableOpacity
            style={as.row}
            activeOpacity={0.7}
            onPress={() => { onClose(); conversation.pinned ? onUnpin() : onPin(); }}>
            <Ionicons name="pin" size={18} color="#7A0EED" />
            <Text style={as.rowText}>{conversation.pinned ? 'Unpin Chat' : 'Pin Chat'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={as.row} activeOpacity={0.7} onPress={() => { onClose(); onMarkUnread(); }}>
            <Ionicons name="mail-unread-outline" size={18} color="#7A0EED" />
            <Text style={as.rowText}>Mark as Unread</Text>
          </TouchableOpacity>

          <TouchableOpacity style={as.row} activeOpacity={0.7} onPress={() => { onClose(); onDelete(); }}>
            <Ionicons name="trash-outline" size={18} color="#E14C57" />
            <Text style={[as.rowText, as.dangerText]}>Delete Chat</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} style={as.cancelBtn} activeOpacity={0.75}>
            <Text style={as.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const as = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  cardWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  card: {
    width: '100%', backgroundColor: '#FFFFFF', borderRadius: 18, padding: 8,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 16,
  },
  title: { fontSize: 13, fontWeight: '700', color: '#9A94AE', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 12, paddingVertical: 13,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F4F0FF',
  },
  rowText: { fontSize: 14.5, fontWeight: '600', color: '#1A1730' },
  dangerText: { color: '#E14C57' },
  cancelBtn: { paddingVertical: 13, alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F4F0FF' },
  cancelText: { fontSize: 14.5, fontWeight: '700', color: '#60626A' },
});

// ── Header three-dot menu ──────────────────────────────────────────────────────
const FILTER_OPTIONS: { key: FilterMode; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { key: 'all',    icon: 'chatbubbles-outline',    label: 'All Chats' },
  { key: 'unread', icon: 'mail-unread-outline',    label: 'Unread Only' },
  { key: 'read',   icon: 'mail-open-outline',      label: 'Read Only' },
];

function HeaderMenu({ visible, onClose, onSelectMessages, filterMode, onSetFilter }: {
  visible: boolean;
  onClose: () => void;
  onSelectMessages: () => void;
  filterMode: FilterMode;
  onSetFilter: (mode: FilterMode) => void;
}) {
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={hm.backdrop} />
      </TouchableWithoutFeedback>
      <View style={hm.menu}>
        <TouchableOpacity style={hm.item} activeOpacity={0.7} onPress={() => { onClose(); onSelectMessages(); }}>
          <Ionicons name="checkmark-circle-outline" size={18} color="#7A0EED" />
          <Text style={hm.itemText}>Select Messages</Text>
        </TouchableOpacity>

        <View style={hm.sectionLabel}>
          <Text style={hm.sectionLabelText}>Filter</Text>
        </View>
        {FILTER_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.key}
            style={hm.item}
            activeOpacity={0.7}
            onPress={() => { onClose(); onSetFilter(opt.key); }}>
            <Ionicons name={opt.icon} size={18} color="#7A0EED" />
            <Text style={hm.itemText}>{opt.label}</Text>
            {filterMode === opt.key && <Ionicons name="checkmark" size={16} color="#7A0EED" style={hm.itemCheck} />}
          </TouchableOpacity>
        ))}
      </View>
    </Modal>
  );
}

const hm = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject },
  menu: {
    position: 'absolute', top: 56, right: 12,
    backgroundColor: '#FFFFFF', borderRadius: 14, minWidth: 200,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 14,
    overflow: 'hidden',
    paddingVertical: 4,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  itemText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1A1730' },
  itemCheck: { marginLeft: 4 },
  sectionLabel: {
    paddingHorizontal: 14, paddingTop: 8, paddingBottom: 2,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F0EDF8', marginTop: 4,
  },
  sectionLabelText: { fontSize: 10.5, fontWeight: '700', color: '#B5AFC7', letterSpacing: 0.4, textTransform: 'uppercase' },
});

export function ChatListScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('messages');
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [requests, setRequests] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [headerMenuVisible, setHeaderMenuVisible] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionSheetTarget, setActionSheetTarget] = useState<ChatConversation | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  const [onlineMap, setOnlineMap] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const token = authStore.getToken();
    if (!token) return;
    const [convRes, reqRes] = await Promise.all([
      apiChatConversations(token),
      apiChatRequests(token),
    ]);
    if (convRes.ok) {
      setConversations(convRes.data);
      convRes.data.forEach(c => chatSocketStore.checkOnline(c.peer_id));
    }
    if (reqRes.ok) setRequests(reqRes.data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Keep the list live while it's open — a new message bumps the peer to the
  // top, an accept/reject moves them between tabs, and presence updates keep
  // the online dots current — all without a manual refresh.
  useFocusEffect(useCallback(() => {
    chatSocketStore.connect();
    const unsub = subscribeChatEvents((event) => {
      if (event.type === 'message' || event.type === 'request_accepted' || event.type === 'request_rejected') {
        load();
      } else if (event.type === 'online_status') {
        setOnlineMap(prev => ({ ...prev, [event.userId]: event.isOnline }));
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
    if (selectMode) {
      toggleSelected(conversation.id);
      return;
    }
    router.push(`/chat/${conversation.id}` as any);
  };

  function toggleSelected(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  // ── Single-conversation actions (from long-press action sheet) ──────────────
  async function handlePin(conversation: ChatConversation) {
    const token = authStore.getToken();
    if (!token) return;
    setConversations(prev => prev.map(c => c.id === conversation.id ? { ...c, pinned: true } : c)
      .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned)));
    await apiChatPin(conversation.id, token);
  }

  async function handleUnpin(conversation: ChatConversation) {
    const token = authStore.getToken();
    if (!token) return;
    setConversations(prev => prev.map(c => c.id === conversation.id ? { ...c, pinned: false } : c));
    await apiChatUnpin(conversation.id, token);
  }

  async function handleMarkUnreadOne(conversation: ChatConversation) {
    const token = authStore.getToken();
    if (!token) return;
    setConversations(prev => prev.map(c => c.id === conversation.id ? { ...c, unread_count: (c.unread_count ?? 0) + 1 } : c));
    await apiChatMarkUnread(conversation.id, token);
  }

  async function handleDeleteOne(conversation: ChatConversation) {
    const token = authStore.getToken();
    if (!token) return;
    setConversations(prev => prev.filter(c => c.id !== conversation.id));
    await apiChatDeleteConversation(conversation.id, token);
  }

  // ── Bulk actions (select mode) ───────────────────────────────────────────────
  async function handleBulkDelete() {
    const token = authStore.getToken();
    if (!token || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setConversations(prev => prev.filter(c => !selectedIds.has(c.id)));
    exitSelectMode();
    await Promise.all(ids.map(id => apiChatDeleteConversation(id, token)));
  }

  async function handleBulkMarkRead() {
    const token = authStore.getToken();
    if (!token || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setConversations(prev => prev.map(c => selectedIds.has(c.id) ? { ...c, unread_count: 0 } : c));
    exitSelectMode();
    await Promise.all(ids.map(id => apiChatMarkRead(id, token)));
  }

  async function handleBulkMarkUnread() {
    const token = authStore.getToken();
    if (!token || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setConversations(prev => prev.map(c => selectedIds.has(c.id) ? { ...c, unread_count: (c.unread_count ?? 0) + 1 } : c));
    exitSelectMode();
    await Promise.all(ids.map(id => apiChatMarkUnread(id, token)));
  }

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return conversations.filter(c => {
      if (filterMode === 'unread' && (c.unread_count ?? 0) === 0) return false;
      if (filterMode === 'read' && (c.unread_count ?? 0) > 0) return false;
      if (!q) return true;
      const name = (c.peer_name || '').toLowerCase();
      const username = (c.peer_username || '').toLowerCase();
      return name.includes(q) || username.includes(q);
    });
  }, [conversations, searchQuery, filterMode]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {selectMode ? (
        <View style={styles.header}>
          <TouchableOpacity onPress={exitSelectMode} style={styles.backBtn} activeOpacity={0.8}>
            <Ionicons name="close" size={24} color="#1A1730" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select chats'}</Text>
        </View>
      ) : searchVisible ? (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { setSearchVisible(false); setSearchQuery(''); }} style={styles.backBtn} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={24} color="#1A1730" />
          </TouchableOpacity>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color="#9A94AE" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search chats"
              placeholderTextColor="#B5AFC7"
              style={styles.searchInput}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color="#B5AFC7" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={24} color="#1A1730" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chats</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => setSearchVisible(true)} style={styles.headerIconBtn} hitSlop={8}>
              <Ionicons name="search" size={20} color="#1A1730" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setHeaderMenuVisible(true)} style={styles.headerIconBtn} hitSlop={8}>
              <Ionicons name="ellipsis-vertical" size={20} color="#1A1730" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!selectMode && (
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
      )}

      {!selectMode && tab === 'messages' && filterMode !== 'all' && (
        <View style={styles.filterChipRow}>
          <View style={styles.filterChip}>
            <Ionicons name={filterMode === 'unread' ? 'mail-unread' : 'mail-open'} size={13} color="#7A0EED" />
            <Text style={styles.filterChipText}>{filterMode === 'unread' ? 'Unread only' : 'Read only'}</Text>
            <TouchableOpacity onPress={() => setFilterMode('all')} hitSlop={8}>
              <Ionicons name="close" size={14} color="#7A0EED" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {tab === 'messages' ? (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ConversationListItem
              conversation={item}
              onPress={() => openConversation(item)}
              onLongPress={() => !selectMode && setActionSheetTarget(item)}
              selectMode={selectMode}
              selected={selectedIds.has(item.id)}
              isOnline={!!onlineMap[item.peer_id]}
            />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7A0EED" />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={!loading ? (
            <View style={styles.empty}>
              <Ionicons
                name={searchQuery ? 'search-outline' : 'chatbubble-ellipses-outline'}
                size={48} color="#D0C8F0"
              />
              <Text style={styles.emptyText}>
                {searchQuery
                  ? 'No chats found'
                  : filterMode === 'unread' ? 'No unread chats'
                  : filterMode === 'read' ? 'No read chats'
                  : 'No messages yet'}
              </Text>
            </View>
          ) : null}
          contentContainerStyle={filteredConversations.length === 0 ? styles.emptyContainer : undefined}
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

      {selectMode && (
        <View style={styles.bulkBar}>
          <TouchableOpacity style={styles.bulkBtn} activeOpacity={0.75} onPress={handleBulkMarkRead} disabled={selectedIds.size === 0}>
            <Ionicons name="mail-open-outline" size={20} color={selectedIds.size ? '#7A0EED' : '#D0C8F0'} />
            <Text style={[styles.bulkBtnText, !selectedIds.size && styles.bulkBtnTextDisabled]}>Read</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bulkBtn} activeOpacity={0.75} onPress={handleBulkMarkUnread} disabled={selectedIds.size === 0}>
            <Ionicons name="mail-unread-outline" size={20} color={selectedIds.size ? '#7A0EED' : '#D0C8F0'} />
            <Text style={[styles.bulkBtnText, !selectedIds.size && styles.bulkBtnTextDisabled]}>Unread</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bulkBtn} activeOpacity={0.75} onPress={handleBulkDelete} disabled={selectedIds.size === 0}>
            <Ionicons name="trash-outline" size={20} color={selectedIds.size ? '#E14C57' : '#D0C8F0'} />
            <Text style={[styles.bulkBtnText, styles.bulkBtnDanger, !selectedIds.size && styles.bulkBtnTextDisabled]}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}

      <HeaderMenu
        visible={headerMenuVisible}
        onClose={() => setHeaderMenuVisible(false)}
        onSelectMessages={() => setSelectMode(true)}
        filterMode={filterMode}
        onSetFilter={setFilterMode}
      />

      <ConversationActionSheet
        visible={!!actionSheetTarget}
        onClose={() => setActionSheetTarget(null)}
        conversation={actionSheetTarget}
        onPin={() => actionSheetTarget && handlePin(actionSheetTarget)}
        onUnpin={() => actionSheetTarget && handleUnpin(actionSheetTarget)}
        onMarkUnread={() => actionSheetTarget && handleMarkUnreadOne(actionSheetTarget)}
        onDelete={() => actionSheetTarget && handleDeleteOne(actionSheetTarget)}
      />
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
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: '#1A1730' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  headerIconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F4F0FF', borderRadius: 20,
    paddingHorizontal: 14, height: 38,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1A1730', padding: 0 },
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
  filterChipRow: { paddingHorizontal: 16, marginTop: 8 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#F4EEFF', borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  filterChipText: { fontSize: 12, fontWeight: '700', color: '#7A0EED' },
  separator: { height: 1, backgroundColor: '#F4F0FF', marginLeft: 80 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 80 },
  emptyText: { fontSize: 14, color: '#9A94AE', fontWeight: '600' },
  emptyContainer: { flexGrow: 1 },
  bulkBar: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: 12, paddingBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F0EDF8',
    backgroundColor: '#FFFFFF',
  },
  bulkBtn: { alignItems: 'center', gap: 3, minWidth: 64 },
  bulkBtnText: { fontSize: 11.5, fontWeight: '700', color: '#7A0EED' },
  bulkBtnDanger: { color: '#E14C57' },
  bulkBtnTextDisabled: { color: '#D0C8F0' },
});
