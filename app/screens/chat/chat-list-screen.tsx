import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image, Modal, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity,
  TouchableWithoutFeedback, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  apiChatBlockedUsers, apiChatConversations, apiChatDeleteConversation, apiChatMarkRead, apiChatMarkUnread, apiChatPin,
  apiChatUnblockUser, apiChatUnpin, isIncomingChatRequest, resolveImageUrl, type BlockedUser, type ChatConversation,
} from '@/services/api';
import { authStore } from '@/store/auth-store';
import { chatSocketStore, subscribeChatEvents } from '@/store/chat-socket-store';
import { MenuIcon } from '@/components/ui/menu-icon';
import { ConversationListItem } from './components/conversation-list-item';
import { avatarSource } from '@/utils/default-avatar';

type FilterMode = 'all' | 'unread' | 'read';
type Tab = 'messages' | 'requests';

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
            <MenuIcon name="pin" color="#7A0EED" />
            <Text style={as.rowText}>{conversation.pinned ? 'Unpin Chat' : 'Pin Chat'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={as.row} activeOpacity={0.7} onPress={() => { onClose(); onMarkUnread(); }}>
            <MenuIcon name="mail-unread" color="#1D6FE0" />
            <Text style={as.rowText}>Mark as Unread</Text>
          </TouchableOpacity>

          <TouchableOpacity style={as.row} activeOpacity={0.7} onPress={() => { onClose(); onDelete(); }}>
            <MenuIcon name="trash" color="#E14C57" />
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
    paddingHorizontal: 12, paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F4F0FF',
  },
  rowText: { fontSize: 14.5, fontWeight: '600', color: '#1A1730' },
  dangerText: { color: '#E14C57' },
  cancelBtn: { paddingVertical: 13, alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F4F0FF' },
  cancelText: { fontSize: 14.5, fontWeight: '700', color: '#60626A' },
});

// ── Header three-dot menu ──────────────────────────────────────────────────────
const FILTER_OPTIONS: { key: FilterMode; icon: keyof typeof Ionicons.glyphMap; color: string; label: string }[] = [
  { key: 'all',    icon: 'chatbubbles', color: '#7A0EED', label: 'All Chats' },
  { key: 'unread', icon: 'mail-unread', color: '#1D6FE0', label: 'Unread Only' },
  { key: 'read',   icon: 'mail-open',   color: '#0D9488', label: 'Read Only' },
];

function HeaderMenu({ visible, onClose, onSelectMessages, onBlockedUsers, filterMode, onSetFilter }: {
  visible: boolean;
  onClose: () => void;
  onSelectMessages: () => void;
  onBlockedUsers: () => void;
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
          <MenuIcon name="checkmark-circle" color="#16A34A" />
          <Text style={hm.itemText}>Select Messages</Text>
        </TouchableOpacity>
        <TouchableOpacity style={hm.item} activeOpacity={0.7} onPress={() => { onClose(); onBlockedUsers(); }}>
          <MenuIcon name="ban" color="#E14C57" />
          <Text style={hm.itemText}>Blocked Users</Text>
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
            <MenuIcon name={opt.icon} color={opt.color} />
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
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 6 },
  itemText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1A1730' },
  itemCheck: { marginLeft: 4 },
  sectionLabel: {
    paddingHorizontal: 14, paddingTop: 8, paddingBottom: 2,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F0EDF8', marginTop: 4,
  },
  sectionLabelText: { fontSize: 10.5, fontWeight: '700', color: '#B5AFC7', letterSpacing: 0.4, },
});

// ── Blocked users (⋮ → Blocked Users) ─────────────────────────────────────────
function BlockedUsersSheet({ visible, onClose, onChanged }: {
  visible: boolean;
  onClose: () => void;
  /** Called after an unblock so the chat list can bring that chat back. */
  onChanged: () => void;
}) {
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    const token = authStore.getToken();
    if (!token) return;
    setLoading(true);
    apiChatBlockedUsers(token).then(r => { if (r.ok) setUsers(r.data); }).finally(() => setLoading(false));
  }, [visible]);

  const unblock = (u: BlockedUser) => {
    const name = u.full_name || (u.username ? `@${u.username}` : 'this user');
    Alert.alert(`Unblock ${name}?`, 'They will be able to message you again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock', onPress: async () => {
          const token = authStore.getToken();
          if (!token) return;
          setBusyId(u.id);
          const r = await apiChatUnblockUser(u.id, token);
          setBusyId(null);
          if (!r.ok) { Alert.alert('Could not unblock', r.message); return; }
          setUsers(prev => prev.filter(x => x.id !== u.id));
          onChanged();
        },
      },
    ]);
  };

  if (!visible) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={bu.backdrop} />
      </TouchableWithoutFeedback>
      <View style={bu.sheet}>
        <View style={bu.handle} />
        <View style={bu.header}>
          <Text style={bu.title}>Blocked Users</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8} style={bu.closeBtn}>
            <Ionicons name="close" size={20} color="#60626A" />
          </TouchableOpacity>
        </View>
        {loading ? (
          <ActivityIndicator color="#7A0EED" style={{ marginVertical: 40 }} />
        ) : users.length === 0 ? (
          <View style={bu.empty}>
            <Ionicons name="ban-outline" size={40} color="#D0C8F0" />
            <Text style={bu.emptyText}>You haven&apos;t blocked anyone</Text>
          </View>
        ) : (
          <FlatList
            data={users}
            keyExtractor={u => u.id}
            style={{ maxHeight: 420 }}
            ItemSeparatorComponent={() => <View style={bu.sep} />}
            renderItem={({ item }) => {
              const name = item.full_name || item.username || 'User';
              const avatar = resolveImageUrl(item.avatar_url);
              return (
                <View style={bu.row}>
                  <Image source={avatarSource(avatar)} style={bu.avatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={bu.name} numberOfLines={1}>{name}</Text>
                    {!!item.username && <Text style={bu.username} numberOfLines={1}>@{item.username}</Text>}
                  </View>
                  <TouchableOpacity onPress={() => unblock(item)} disabled={busyId === item.id} activeOpacity={0.8} style={bu.unblockBtn}>
                    {busyId === item.id
                      ? <ActivityIndicator size="small" color="#7A0EED" />
                      : <Text style={bu.unblockText}>Unblock</Text>}
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

const bu = StyleSheet.create({
  // Transparent — the chat list stays visible; tapping it still closes the sheet
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 18, paddingTop: 10, paddingBottom: 32,
    // Lifted off the list by a shadow instead of a dimmed background
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#ECE8F5',
    shadowColor: '#1A1730', shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: -4 }, elevation: 18,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#E0DDED', marginBottom: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontSize: 17, fontWeight: '800', color: '#1A1730' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F4F5F8', alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  emptyText: { fontSize: 14, color: '#9A94AE', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  sep: { height: 1, backgroundColor: '#F4F0FF' },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { backgroundColor: '#EDE8F7', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 17, fontWeight: '700', color: '#7A0EED' },
  name: { fontSize: 14.5, fontWeight: '700', color: '#1A1730' },
  username: { fontSize: 12, color: '#9A94AE', marginTop: 1 },
  unblockBtn: {
    minWidth: 86, height: 34, borderRadius: 17, paddingHorizontal: 14,
    borderWidth: 1.5, borderColor: '#7A0EED', alignItems: 'center', justifyContent: 'center',
  },
  unblockText: { fontSize: 13, fontWeight: '700', color: '#7A0EED' },
});

export function ChatListScreen() {
  const router = useRouter();
  const myUserId = authStore.getUserId();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [headerMenuVisible, setHeaderMenuVisible] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionSheetTarget, setActionSheetTarget] = useState<ChatConversation | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [showBlocked, setShowBlocked] = useState(false);
  const [tab, setTab] = useState<Tab>('messages');

  const [onlineMap, setOnlineMap] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const token = authStore.getToken();
    if (!token) return;
    // Incoming requests are split into the Requests tab below and handled
    // (Accept / Remove / Block) inside the conversation itself.
    const convRes = await apiChatConversations(token);
    if (convRes.ok) {
      setConversations(convRes.data);
      convRes.data.forEach(c => chatSocketStore.checkOnline(c.peer_id));
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Keep the list live while it's open — a new message bumps the peer to the
  // top, an accept/reject moves it between the tabs, and presence updates keep
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

  const requestCount = useMemo(
    () => conversations.filter(c => isIncomingChatRequest(c, myUserId)).length,
    [conversations, myUserId],
  );

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return conversations.filter(c => {
      if (isIncomingChatRequest(c, myUserId) !== (tab === 'requests')) return false;
      // Read / unread filter belongs to the Messages tab
      if (tab === 'messages' && filterMode === 'unread' && (c.unread_count ?? 0) === 0) return false;
      if (tab === 'messages' && filterMode === 'read' && (c.unread_count ?? 0) > 0) return false;
      if (!q) return true;
      const name = (c.peer_name || '').toLowerCase();
      const username = (c.peer_username || '').toLowerCase();
      return name.includes(q) || username.includes(q);
    });
  }, [conversations, searchQuery, filterMode, tab, myUserId]);

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
            {requestCount > 0 && (
              <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{requestCount}</Text></View>
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

      <FlatList
        key={tab}
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
            isRequest={isIncomingChatRequest(item, myUserId)}
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7A0EED" />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={!loading ? (
          <View style={styles.empty}>
            <Ionicons
              name={searchQuery ? 'search-outline' : tab === 'requests' ? 'people-outline' : 'chatbubble-ellipses-outline'}
              size={48} color="#D0C8F0"
            />
            <Text style={styles.emptyText}>
              {searchQuery
                ? 'No chats found'
                : tab === 'requests' ? 'No message requests'
                : filterMode === 'unread' ? 'No unread chats'
                : filterMode === 'read' ? 'No read chats'
                : 'No messages yet'}
            </Text>
          </View>
        ) : null}
        contentContainerStyle={filteredConversations.length === 0 ? styles.emptyContainer : undefined}
      />

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
        onBlockedUsers={() => setShowBlocked(true)}
        filterMode={filterMode}
        onSetFilter={setFilterMode}
      />

      <BlockedUsersSheet visible={showBlocked} onClose={() => setShowBlocked(false)} onChanged={load} />

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
