import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { BASE_URL, MEDIA_BASE } from '@/services/api';
import { authStore } from '@/store/auth-store';
import type { SeatSlot } from '@/hooks/useRoomSocket';
import { getLevelImage } from './room-level-up';

type RoomHeaderProps = {
  name: string;
  agencyName?: string;
  /** Opens the agency profile screen when the agency name is tapped. */
  agencyId?: string | null;
  memberCount: number;
  level?: number;
  roomId?: string;
  roomCode?: string;
  totalCoins?: number;
  hostName?: string | null;
  visibility?: 'public' | 'private';
  onBack: () => void;
  onShare?: () => void;
  onMore?: () => void;
  hasRoomBg?: boolean;
  isHost?: boolean;
  seats?: SeatSlot[];
  onInviteToStage?: (userId: string, slotIndex: number) => void;
  onRefreshRoom?: () => void;
};

type RoomMember = {
  userId: string;
  userName: string;
  avatarUrl: string | null;
};

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function resolveAvatar(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${MEDIA_BASE}/${url.replace(/^\//, '')}`;
}

// ── Members bottom sheet ───────────────────────────────────────────────────────

type MembersTab = 'online' | 'blocked';

type BlockedUser = {
  userId: string;
  userName: string;
  avatarUrl: string | null;
};

function MembersSheet({
  visible,
  onClose,
  roomId,
  isHost,
  seats,
  onInviteToStage,
  initialTab = 'online',
}: {
  visible: boolean;
  onClose: () => void;
  roomId: string;
  isHost: boolean;
  seats: SeatSlot[];
  onInviteToStage?: (userId: string, slotIndex: number) => void;
  initialTab?: MembersTab;
}) {
  const router = useRouter();
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<MembersTab>(initialTab);
  const slideAnim = useRef(new Animated.Value(400)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const currentUserId = authStore.getUserId() ?? '';
  // "Co-host" isn't a persisted role — it's whoever currently occupies a
  // non-zero stage seat, same definition used on the live-broadcast screen
  // and for the stage-tap profile actions.
  const canManage = isHost || seats.some(s => s.userId === currentUserId && s.slotIndex !== 0);

  function fetchMembers() {
    const token = authStore.getToken();
    fetch(`${BASE_URL}/rooms/${roomId}/members`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(j => { if (j.success) setMembers(j.data ?? []); })
      .catch(() => {});
  }

  function fetchBlocked() {
    const token = authStore.getToken();
    if (!token || !canManage) return;
    fetch(`${BASE_URL}/rooms/${roomId}/blocked`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(j => { if (j.success) setBlockedUsers(j.data ?? []); })
      .catch(() => {});
  }

  useEffect(() => {
    if (visible) {
      setLoading(true);
      setActiveTab(initialTab);
      Promise.all([fetchMembers(), canManage ? fetchBlocked() : Promise.resolve()])
        .finally(() => setLoading(false));

      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 180 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 400, duration: 220, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const onStageUserIds = new Set(seats.filter(s => s.slotIndex !== 0).map(s => s.userId));
  const filledSlots = seats.filter(s => s.slotIndex !== 0).length;
  const allSlotsFull = filledSlots >= 7;
  const usedSlots = new Set(seats.filter(s => s.slotIndex !== 0).map(s => s.slotIndex));
  const nextSlot = [1,2,3,4,5,6,7].find(i => !usedSlots.has(i)) ?? 1;

  async function handleBlock(userId: string) {
    const token = authStore.getToken();
    if (!token) return;
    await fetch(`${BASE_URL}/rooms/${roomId}/block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId }),
    });
    fetchMembers();
    fetchBlocked();
  }

  async function handleUnblock(userId: string) {
    const token = authStore.getToken();
    if (!token) return;
    await fetch(`${BASE_URL}/rooms/${roomId}/unblock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId }),
    });
    fetchBlocked();
  }

  const renderMember = ({ item }: { item: RoomMember }) => {
    const avatarUri = resolveAvatar(item.avatarUrl);
    const isOnStage = onStageUserIds.has(item.userId);
    const isMe = item.userId === currentUserId;

    return (
      <View style={mb.row}>
        <TouchableOpacity
          style={mb.profileTouch}
          activeOpacity={isMe ? 1 : 0.7}
          disabled={isMe}
          onPress={() => { onClose(); router.push(`/user/${item.userId}` as any); }}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={mb.avatar} />
          ) : (
            <View style={[mb.avatar, mb.avatarFallback]}>
              <Text style={mb.avatarInitial}>{item.userName[0]?.toUpperCase() ?? '?'}</Text>
            </View>
          )}

          <View style={mb.info}>
            <Text style={mb.name} numberOfLines={1}>{item.userName}{isMe ? ' (you)' : ''}</Text>
            {isOnStage && (
              <View style={mb.stageBadge}>
                <Ionicons name="mic" size={10} color="#7A0EED" />
                <Text style={mb.stageBadgeText}>On Stage</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {canManage && !isMe && (
          <View style={mb.actionRow}>
            {/* Block button */}
            <TouchableOpacity activeOpacity={0.8} onPress={() => handleBlock(item.userId)} style={mb.blockBtn}>
              <Ionicons name="ban-outline" size={14} color="#E14C57" />
              <Text style={mb.blockBtnText}>Block</Text>
            </TouchableOpacity>

            {/* Invite button */}
            {isOnStage ? (
              <View style={[mb.inviteBtn, mb.inviteBtnOnStage]}>
                <Text style={mb.inviteBtnOnStageText}>On Stage</Text>
              </View>
            ) : allSlotsFull ? (
              <View style={[mb.inviteBtn, mb.inviteBtnFull]}>
                <Ionicons name="lock-closed" size={12} color="#ABADB2" />
                <Text style={mb.inviteBtnFullText}>Full</Text>
              </View>
            ) : (
              <TouchableOpacity
                activeOpacity={0.8}
                style={mb.inviteBtn}
                onPress={() => { onInviteToStage?.(item.userId, nextSlot); onClose(); }}>
                <LinearGradient
                  colors={['#7A0EED', '#B50357']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={mb.inviteBtnGrad}>
                  <Ionicons name="mic-outline" size={12} color="#FFFFFF" />
                  <Text style={mb.inviteBtnText}>Invite</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderBlocked = ({ item }: { item: BlockedUser }) => {
    const avatarUri = resolveAvatar(item.avatarUrl);
    return (
      <View style={mb.row}>
        <TouchableOpacity
          style={mb.profileTouch}
          activeOpacity={0.7}
          onPress={() => { onClose(); router.push(`/user/${item.userId}` as any); }}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={mb.avatar} />
          ) : (
            <View style={[mb.avatar, mb.avatarFallback]}>
              <Text style={mb.avatarInitial}>{item.userName[0]?.toUpperCase() ?? '?'}</Text>
            </View>
          )}
          <View style={mb.info}>
            <Text style={mb.name} numberOfLines={1}>{item.userName}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.8} onPress={() => handleUnblock(item.userId)} style={mb.unblockBtn}>
          <Text style={mb.unblockBtnText}>Unblock</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}>
      <Animated.View style={[mb.backdrop, { opacity: opacityAnim }]}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
      </Animated.View>

      <Animated.View style={[mb.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={mb.handle} />

        <View style={mb.header}>
          <Ionicons name="people" size={18} color="#7A0EED" />
          <Text style={mb.title}>{activeTab === 'online' ? 'Online Now' : 'Blocked Users'}</Text>
          <TouchableOpacity onPress={onClose} style={mb.closeBtn} hitSlop={12}>
            <Ionicons name="close" size={22} color="#60626A" />
          </TouchableOpacity>
        </View>

        {/* Tabs — only show if host or a currently-seated co-host */}
        {canManage && (
          <View style={mb.tabBar}>
            <TouchableOpacity
              style={[mb.tab, activeTab === 'online' && mb.tabActive]}
              onPress={() => setActiveTab('online')} activeOpacity={0.75}>
              <Text style={[mb.tabLabel, activeTab === 'online' && mb.tabLabelActive]}>Online</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[mb.tab, activeTab === 'blocked' && mb.tabActive]}
              onPress={() => { setActiveTab('blocked'); fetchBlocked(); }} activeOpacity={0.75}>
              <Text style={[mb.tabLabel, activeTab === 'blocked' && mb.tabLabelActive]}>
                Blocked{blockedUsers.length > 0 ? ` (${blockedUsers.length})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <View style={mb.loadingWrap}>
            <ActivityIndicator size="small" color="#7A0EED" />
          </View>
        ) : activeTab === 'online' ? (
          members.length === 0 ? (
            <View style={mb.emptyWrap}>
              <Text style={mb.emptyText}>No members found</Text>
            </View>
          ) : (
            <FlatList
              data={members}
              keyExtractor={item => item.userId}
              renderItem={renderMember}
              contentContainerStyle={mb.list}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={mb.separator} />}
            />
          )
        ) : (
          blockedUsers.length === 0 ? (
            <View style={mb.emptyWrap}>
              <Ionicons name="checkmark-circle-outline" size={36} color="#D8D3EC" />
              <Text style={mb.emptyText}>No blocked users</Text>
            </View>
          ) : (
            <FlatList
              data={blockedUsers}
              keyExtractor={item => item.userId}
              renderItem={renderBlocked}
              contentContainerStyle={mb.list}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={mb.separator} />}
            />
          )
        )}
      </Animated.View>
    </Modal>
  );
}

// ── Dropdown menu ──────────────────────────────────────────────────────────────

type MenuKey =
  | 'edit-room-name' | 'block-user' | 'refresh-room'
  | 'agency' | 'help-support' | 'email-support' | 'report-room';

type MenuVisibility = 'all' | 'hostOnly' | 'managerOnly';

const MENU_ITEMS: {
  key: MenuKey; icon: keyof typeof Ionicons.glyphMap; label: string; subtitle: string; visibility: MenuVisibility;
}[] = [
  { key: 'edit-room-name', icon: 'create-outline',       label: 'Chatroom Name',        subtitle: 'View & edit chatroom name',   visibility: 'hostOnly' },
  { key: 'block-user',     icon: 'ban-outline',           label: 'Block User',           subtitle: 'Manage blocked users',        visibility: 'managerOnly' },
  { key: 'refresh-room',   icon: 'refresh-outline',       label: 'Refresh Room',         subtitle: 'Reload the room',             visibility: 'all' },
  { key: 'agency',         icon: 'business-outline',      label: 'Agency',               subtitle: 'Agency details and support',  visibility: 'all' },
  { key: 'help-support',   icon: 'headset-outline',       label: 'Chatroom Help & Support', subtitle: 'Get help and contact us',  visibility: 'all' },
  { key: 'email-support',  icon: 'mail-outline',          label: 'Email Support',        subtitle: 'support@raralive.com',        visibility: 'all' },
  { key: 'report-room',    icon: 'flag-outline',          label: 'Report Chatroom',      subtitle: 'Report inappropriate content', visibility: 'all' },
];

type DropdownProps = {
  visible: boolean;
  onClose: () => void;
  isHost: boolean;
  canManage: boolean;
  onSelect: (key: MenuKey) => void;
};

function Dropdown({ visible, onClose, isHost, canManage, onSelect }: DropdownProps) {
  const slideAnim = useRef(new Animated.Value(400)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 180 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 400, duration: 220, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const items = MENU_ITEMS.filter(item => {
    if (item.visibility === 'hostOnly') return isHost;
    if (item.visibility === 'managerOnly') return canManage;
    return true;
  });

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[dd.backdrop, { opacity: opacityAnim }]}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
      </Animated.View>

      <Animated.View style={[dd.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={dd.handle} />
        <View style={dd.header}>
          <Text style={dd.title}>Room Options</Text>
          <TouchableOpacity onPress={onClose} style={dd.closeBtn} hitSlop={12}>
            <Ionicons name="close" size={15} color="#60626A" />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={dd.list} showsVerticalScrollIndicator={false}>
          {items.map((item, index) => (
            <TouchableOpacity
              key={item.key}
              onPress={() => { onClose(); onSelect(item.key); }}
              activeOpacity={0.7}
              style={[dd.item, index === items.length - 1 && dd.itemLast]}>
              <View style={dd.itemIconWrap}>
                <Ionicons name={item.icon} size={15} color="#7A0EED" />
              </View>
              <View style={dd.itemTextBlock}>
                <Text style={dd.itemLabel}>{item.label}</Text>
                <Text style={dd.itemSubtitle}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={15} color="#C4C5CC" />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ── RoomHeader ─────────────────────────────────────────────────────────────────

export function RoomHeader({
  name, agencyName, agencyId, memberCount, level = 1, roomId = '', roomCode, totalCoins = 0,
  hostName, visibility, onBack, onShare, hasRoomBg, isHost = false, seats = [], onInviteToStage,
  onRefreshRoom,
}: RoomHeaderProps) {
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const [membersVisible, setMembersVisible] = useState(false);
  const [membersInitialTab, setMembersInitialTab] = useState<MembersTab>('online');
  const levelAsset = getLevelImage(level);

  const currentUserId = authStore.getUserId() ?? '';
  // Same live "co-host = currently seated" definition used throughout the room.
  const canManage = isHost || seats.some(s => s.userId === currentUserId && s.slotIndex !== 0);

  function openMembers(tab: MembersTab) {
    setMembersInitialTab(tab);
    setMembersVisible(true);
  }

  function handleMenuSelect(key: MenuKey) {
    switch (key) {
      case 'edit-room-name':
        router.push({ pathname: '/edit-room-name', params: { roomId, currentName: name } } as any);
        break;
      case 'block-user':     openMembers('blocked'); break;
      case 'refresh-room':   onRefreshRoom?.(); break;
      case 'agency':
        router.push({ pathname: '/coming-soon', params: { title: 'Agency', icon: 'business-outline' } } as any);
        break;
      case 'help-support':
        router.push({ pathname: '/coming-soon', params: { title: 'Help & Support', icon: 'help-circle-outline' } } as any);
        break;
      case 'email-support':
        Linking.openURL('mailto:support@raralive.com').catch(() => {});
        break;
      case 'report-room':
        router.push({ pathname: '/coming-soon', params: { title: 'Report Room', icon: 'flag-outline' } } as any);
        break;
    }
  }

  const iconColor  = hasRoomBg ? '#FFFFFF' : '#7A0EED';
  const iconColor2 = hasRoomBg ? 'rgba(255,255,255,0.85)' : '#60626A';

  return (
    <View style={[styles.container, hasRoomBg && styles.containerBg]}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={8}>
        <Ionicons name="arrow-back" size={22} color={iconColor} />
      </TouchableOpacity>

      <View style={styles.titleBlock}>
        <Text style={[styles.roomName, hasRoomBg && styles.roomNameBg]} numberOfLines={1}>{name}</Text>
        {/* Two separate tap targets: people icon + count opens the members list,
            the agency name opens the agency profile. */}
        <View style={styles.memberRow}>
          <TouchableOpacity
            onPress={() => setMembersVisible(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
            activeOpacity={0.7}
            style={styles.memberTap}>
            <Ionicons name="people" size={13} color={iconColor} />
            <Text style={[styles.memberText, hasRoomBg && styles.memberTextBg]}>{formatCount(memberCount)}</Text>
          </TouchableOpacity>
          {agencyName && (
            <>
              <Text style={[styles.dot, hasRoomBg && styles.dotBg]}>·</Text>
              <TouchableOpacity
                onPress={agencyId ? () => router.push(`/agency/${agencyId}` as any) : undefined}
                disabled={!agencyId}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                activeOpacity={0.7}
                style={styles.agencyTap}>
                <Text
                  style={[styles.memberText, styles.agencyNameText, hasRoomBg && styles.memberTextBg]}
                  numberOfLines={1}>
                  {agencyName}
                </Text>
                <Ionicons name="chevron-forward" size={11} color={hasRoomBg ? 'rgba(255,255,255,0.7)' : '#ABADB2'} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity onPress={onShare} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="share-social-outline" size={20} color={iconColor2} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push({ pathname: '/performance', params: { roomId, level: String(level), totalCoins: String(totalCoins) } } as any)}
          hitSlop={8} activeOpacity={0.75}>
          <ExpoImage source={levelAsset} style={styles.levelImage} contentFit="contain" />
        </TouchableOpacity>

        <View>
          <TouchableOpacity onPress={() => setMenuVisible(v => !v)} style={styles.iconBtn} hitSlop={8}>
            <Ionicons name="ellipsis-vertical" size={20} color={iconColor2} />
          </TouchableOpacity>
          <Dropdown
            visible={menuVisible}
            onClose={() => setMenuVisible(false)}
            isHost={isHost}
            canManage={canManage}
            onSelect={handleMenuSelect}
          />
        </View>
      </View>

      <MembersSheet
        visible={membersVisible}
        onClose={() => setMembersVisible(false)}
        roomId={roomId}
        isHost={isHost}
        seats={seats}
        onInviteToStage={onInviteToStage}
        initialTab={membersInitialTab}
      />

    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#FFFFFF', gap: 10,
  },
  containerBg: { backgroundColor: 'transparent' },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  titleBlock: { flex: 1, gap: 2 },
  roomName: { fontSize: 17, fontWeight: '800', color: '#1C1E22', letterSpacing: -0.3 },
  roomNameBg: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%' },
  memberText: { fontSize: 12, color: '#7A0EED', fontWeight: '600' },
  memberTextBg: { color: 'rgba(255,255,255,0.9)' },
  memberTap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  agencyTap: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 1 },
  agencyNameText: { flexShrink: 1 },
  dot: { fontSize: 12, color: '#ABADB2' },
  dotBg: { color: 'rgba(255,255,255,0.5)' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  levelImage: { width: 30, height: 30 },
});

const dd = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 10,
  },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 8,
    maxHeight: '75%',
    zIndex: 11,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 24,
  },
  handle: {
    width: 34, height: 3.5, borderRadius: 2,
    backgroundColor: '#E0DDED',
    alignSelf: 'center',
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 8,
    gap: 8,
  },
  title: { flex: 1, fontSize: 14.5, fontWeight: '700', color: '#1C1E22', letterSpacing: -0.1 },
  closeBtn: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#F4EEFF',
    alignItems: 'center', justifyContent: 'center',
  },
  list: {
    paddingHorizontal: 14, paddingTop: 2, paddingBottom: 20,
  },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0EDF8',
  },
  itemLast: { borderBottomWidth: 0 },
  itemIconWrap: {
    width: 30, height: 30, borderRadius: 9,
    backgroundColor: '#F4EEFF',
    alignItems: 'center', justifyContent: 'center',
  },
  itemTextBlock: { flex: 1, gap: 1 },
  itemLabel: { fontSize: 12.5, fontWeight: '700', color: '#1C1E22' },
  itemSubtitle: { fontSize: 10.5, color: '#8E9099', fontWeight: '500' },
});

const mb = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 10,
  },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 10,
    paddingBottom: 36,
    maxHeight: '70%',
    zIndex: 11,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 24,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E0DDED',
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0EDF8',
    gap: 8,
  },
  title: { flex: 1, fontSize: 17, fontWeight: '800', color: '#1C1E22' },
  closeBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  loadingWrap: { paddingVertical: 40, alignItems: 'center' },
  emptyWrap: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#ABADB2', fontWeight: '500' },
  list: { paddingVertical: 8, paddingHorizontal: 16 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#F0EDF8' },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, gap: 12,
  },
  profileTouch: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: {
    backgroundColor: '#EDE8F7', alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 18, fontWeight: '800', color: '#7A0EED' },
  info: { flex: 1, gap: 3 },
  name: { fontSize: 14, fontWeight: '700', color: '#1C1E22' },
  stageBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#F4EEFF',
    borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2,
  },
  stageBadgeText: { fontSize: 10, fontWeight: '700', color: '#7A0EED' },

  inviteBtn: { borderRadius: 20, overflow: 'hidden' },
  inviteBtnGrad: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  inviteBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  inviteBtnOnStage: {
    backgroundColor: '#F4EEFF',
    borderRadius: 20, borderWidth: 1, borderColor: '#C4A8F5',
    paddingHorizontal: 12, paddingVertical: 7,
  },
  inviteBtnOnStageText: { fontSize: 12, fontWeight: '600', color: '#7A0EED' },
  inviteBtnFull: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F5F5F5',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
  },
  inviteBtnFullText: { fontSize: 12, fontWeight: '600', color: '#ABADB2' },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0EDF8',
    paddingHorizontal: 16,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 11, position: 'relative' },
  tabActive: { borderBottomWidth: 2.5, borderBottomColor: '#7A0EED' },
  tabLabel: { fontSize: 14, fontWeight: '500', color: '#ABADB2' },
  tabLabelActive: { color: '#7A0EED', fontWeight: '700' },

  // Action row (block + invite side by side)
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // Block button
  blockBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFF0F0',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7,
    borderWidth: 1, borderColor: '#FFD4D4',
  },
  blockBtnText: { fontSize: 12, fontWeight: '700', color: '#E14C57' },

  // Unblock button
  unblockBtn: {
    backgroundColor: '#F3EFFE',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: '#C4B8E8',
  },
  unblockBtnText: { fontSize: 12, fontWeight: '700', color: '#7A0EED' },
});
