import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BASE_URL, MEDIA_BASE } from '@/services/api';
import { authStore } from '@/store/auth-store';

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_H * 0.55;
const SETUP_HEIGHT = SCREEN_H * 0.48;
const TIME_OPTIONS = [10, 15, 25, 30];

type Room = {
  id: string;
  room_name: string;
  room_image_url: string | null;
};

type Page = 'setup' | 'invite';
type Props = { visible: boolean; onClose: () => void; roomId: string };

function RoomAvatar({ url, name }: { url: string | null; name: string }) {
  const resolved = url
    ? url.startsWith('http') ? url : `${MEDIA_BASE}/${url.replace(/^\//, '')}`
    : null;
  if (resolved) {
    return <Image source={{ uri: resolved }} style={inv.roomAvatar} />;
  }
  return (
    <View style={[inv.roomAvatar, inv.roomAvatarFallback]}>
      <Text style={inv.roomAvatarInitial}>{name[0]?.toUpperCase()}</Text>
    </View>
  );
}

export function BattleModal({ visible, onClose, roomId }: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  const [page, setPage] = useState<Page>('setup');
  const [selectedTime, setSelectedTime] = useState(25);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [invitedId, setInvitedId] = useState<string | null>(null);
  const [inviteSending, setInviteSending] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8,
      onPanResponderMove: (_, g) => { if (g.dy > 0) translateY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 100) close();
        else Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  function open() {
    setPage('setup');
    setInvitedId(null);
    setInviteSuccess(null);
    setSearchQuery('');
    translateY.setValue(SETUP_HEIGHT);
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
  }

  function close() {
    Animated.timing(translateY, { toValue: SHEET_HEIGHT, duration: 220, useNativeDriver: true }).start(onClose);
  }

  function goInvite() {
    setPage('invite');
    if (rooms.length === 0) loadRooms();
  }

  async function loadRooms() {
    setLoadingRooms(true);
    try {
      const r = await fetch(`${BASE_URL}/rooms/public`);
      const json = await r.json();
      if (json.success) setRooms(json.data);
    } catch {}
    setLoadingRooms(false);
  }

  async function sendInvite(toRoomId: string) {
    if (!roomId) return;
    setInviteSending(toRoomId);
    try {
      const token = authStore.getToken();
      const r = await fetch(`${BASE_URL}/battle/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          from_room_id: roomId,
          to_room_id: toRoomId,
          duration_minutes: selectedTime,
        }),
      });
      const json = await r.json();
      if (json.success) {
        setInvitedId(toRoomId);
        setInviteSuccess('Battle invite sent!');
        // Navigate to overview after short delay
        const inviteId = json.data?.id;
        setTimeout(() => {
          close();
          if (inviteId) {
            router.push(`/battle/overview?inviteId=${inviteId}` as any);
          }
        }, 1200);
      } else {
        setInviteSuccess(`Error: ${json.message}`);
      }
    } catch {
      setInviteSuccess('Network error. Please try again.');
    } finally {
      setInviteSending(null);
    }
  }

  const filteredRooms = rooms.filter(r =>
    r.id !== roomId &&
    r.room_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close} onShow={open}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={close} />

      <Animated.View
        style={[
          s.sheet,
          {
            height: page === 'invite' ? SHEET_HEIGHT : SETUP_HEIGHT,
            paddingBottom: insets.bottom + 8,
            transform: [{ translateY }],
          },
        ]}>

        {/* Drag handle */}
        <View {...panResponder.panHandlers} style={s.handleArea}>
          <View style={s.handle} />
        </View>

        {/* Header */}
        <View style={s.header}>
          {page === 'invite' ? (
            <TouchableOpacity onPress={() => setPage('setup')} style={s.backBtn} hitSlop={8}>
              <Ionicons name="arrow-back" size={20} color="#1C1E22" />
            </TouchableOpacity>
          ) : (
            <View style={s.backBtn} />
          )}
          <Text style={s.title}>{page === 'invite' ? 'Invite Room' : 'Battle Room'}</Text>
          <View style={s.backBtn} />
        </View>

        {inviteSuccess && (
          <View style={s.toastBanner}>
            <Text style={s.toastText}>{inviteSuccess}</Text>
          </View>
        )}

        {page === 'setup' ? (
          <SetupPage
            selectedTime={selectedTime}
            setSelectedTime={setSelectedTime}
            onAutomatic={() => {}}
            onInvite={goInvite}
          />
        ) : (
          <InvitePage
            rooms={filteredRooms}
            loading={loadingRooms}
            invitedId={invitedId}
            inviteSending={inviteSending}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onInvite={sendInvite}
          />
        )}
      </Animated.View>
    </Modal>
  );
}

// ── Setup page ────────────────────────────────────────────────────────────────

function SetupPage({
  selectedTime, setSelectedTime,
  onAutomatic, onInvite,
}: {
  selectedTime: number;
  setSelectedTime: (t: number) => void;
  onAutomatic: () => void;
  onInvite: () => void;
}) {
  return (
    <View style={s.body}>
      {/* VS hero */}
      <View style={s.vsRow}>
        <View style={[s.avatar, { backgroundColor: '#E74C3C' }]}>
          <Ionicons name="glasses-outline" size={30} color="#fff" />
        </View>

        <View style={s.vsMiddle}>
          <Text style={s.youLabel}>You</Text>
          <View style={s.battleStrip}>
            <View style={s.stripBlue} />
            <View style={s.vsChip}>
              <Text style={s.vsText}>Vs</Text>
            </View>
            <View style={s.stripOrange} />
          </View>
          <Text style={s.youLabel}>Rival</Text>
        </View>

        <View style={[s.avatar, { backgroundColor: '#EDE8F7' }]}>
          <Text style={s.avatarInitial}>?</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={s.progressRow}>
        <View style={s.progressBlue} />
        <Text style={s.lightning}>⚡</Text>
        <View style={s.progressOrange} />
      </View>

      {/* Divider */}
      <View style={s.divider} />

      {/* Select Time */}
      <Text style={s.sectionLabel}>Select Time</Text>
      <View style={s.timeRow}>
        {TIME_OPTIONS.map(t => (
          <TouchableOpacity
            key={t}
            onPress={() => setSelectedTime(t)}
            activeOpacity={0.8}
            style={[s.timeChip, selectedTime === t && s.timeChipActive]}>
            <Text style={[s.timeChipText, selectedTime === t && s.timeChipTextActive]}>
              {t} mins
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Select Mode */}
      <Text style={s.sectionLabel}>Select Mode</Text>
      <View style={s.modeRow}>
        <TouchableOpacity onPress={onAutomatic} activeOpacity={0.85} style={s.modeBtn}>
          <Text style={s.modeBtnText}>AUTOMATIC</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onInvite} activeOpacity={0.85} style={s.modeBtn}>
          <Text style={s.modeBtnText}>INVITE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Invite page ───────────────────────────────────────────────────────────────

function InvitePage({
  rooms, loading, invitedId, inviteSending, searchQuery, onSearchChange, onInvite,
}: {
  rooms: Room[];
  loading: boolean;
  invitedId: string | null;
  inviteSending: string | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onInvite: (id: string) => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      {/* Search bar */}
      <View style={inv.searchWrap}>
        <Ionicons name="search-outline" size={16} color="#ABADB2" style={inv.searchIcon} />
        <TextInput
          style={inv.searchInput}
          placeholder="Search rooms…"
          placeholderTextColor="#C4C5CC"
          value={searchQuery}
          onChangeText={onSearchChange}
          returnKeyType="search"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => onSearchChange('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color="#ABADB2" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={inv.center}>
          <ActivityIndicator color="#7A0EED" />
          <Text style={inv.emptyText}>Loading rooms…</Text>
        </View>
      ) : rooms.length === 0 ? (
        <View style={inv.center}>
          <Ionicons name="chatbubbles-outline" size={40} color="#DDDAE8" />
          <Text style={inv.emptyText}>No active rooms found</Text>
        </View>
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={r => r.id}
          contentContainerStyle={inv.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={inv.separator} />}
          renderItem={({ item }) => {
            const invited = invitedId === item.id;
            const sending = inviteSending === item.id;
            return (
              <View style={inv.row}>
                <RoomAvatar url={item.room_image_url} name={item.room_name} />
                <Text style={inv.roomName} numberOfLines={1}>{item.room_name}</Text>
                <TouchableOpacity
                  onPress={() => !invited && !sending && onInvite(item.id)}
                  activeOpacity={0.8}
                  style={[inv.inviteBtn, invited && inv.invitedBtn, sending && inv.sendingBtn]}
                  disabled={invited || sending}>
                  {sending ? (
                    <ActivityIndicator size="small" color="#3B82F6" />
                  ) : (
                    <Text style={[inv.inviteBtnText, invited && inv.invitedBtnText]}>
                      {invited ? 'Invited ✓' : 'Invite'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 2,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#DDDAE8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: {
    width: 36, height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: '#1C1E22',
  },
  toastBanner: {
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#6EE7B7',
  },
  toastText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#065F46',
    textAlign: 'center',
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
  },
  vsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  avatar: {
    width: 68, height: 68, borderRadius: 34,
    alignItems: 'center', justifyContent: 'center',
  },
  vsMiddle: {
    flex: 1, alignItems: 'center', gap: 6, paddingHorizontal: 8,
  },
  youLabel: {
    fontSize: 12, fontWeight: '600', color: '#60626A',
  },
  battleStrip: {
    flexDirection: 'row', alignItems: 'center', width: '100%',
  },
  stripBlue: {
    flex: 1, height: 3, backgroundColor: '#3B82F6', borderRadius: 2,
  },
  vsChip: {
    backgroundColor: '#1C1E22', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, marginHorizontal: 6,
  },
  vsText: {
    color: '#FFFFFF', fontSize: 11, fontWeight: '800',
  },
  stripOrange: {
    flex: 1, height: 3, backgroundColor: '#F59E0B', borderRadius: 2,
  },
  progressRow: {
    flexDirection: 'row', alignItems: 'center', height: 12, marginBottom: 16,
  },
  progressBlue: {
    flex: 1, height: 10, backgroundColor: '#3B82F6',
    borderTopLeftRadius: 5, borderBottomLeftRadius: 5,
  },
  lightning: {
    fontSize: 18, marginHorizontal: -4, zIndex: 1,
  },
  progressOrange: {
    flex: 1, height: 10, backgroundColor: '#F59E0B',
    borderTopRightRadius: 5, borderBottomRightRadius: 5,
  },
  divider: {
    height: StyleSheet.hairlineWidth, backgroundColor: '#F0EDF8', marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 15, fontWeight: '700', color: '#1C1E22', marginBottom: 10,
  },
  timeRow: {
    flexDirection: 'row', gap: 8, marginBottom: 16,
  },
  timeChip: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#E0DCF0', alignItems: 'center',
  },
  timeChipActive: {
    borderColor: '#3B82F6', backgroundColor: '#EFF6FF',
  },
  timeChipText: {
    fontSize: 12, fontWeight: '600', color: '#ABADB2',
  },
  timeChipTextActive: {
    color: '#3B82F6', fontWeight: '700',
  },
  modeRow: {
    flexDirection: 'row', gap: 12,
  },
  modeBtn: {
    flex: 1, paddingVertical: 15, borderRadius: 14,
    backgroundColor: '#3B82F6', alignItems: 'center',
  },
  modeBtnText: {
    fontSize: 14, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5,
  },
  avatarInitial: {
    fontSize: 24, fontWeight: '800', color: '#7A0EED',
  },
});

const inv = StyleSheet.create({
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  emptyText: {
    fontSize: 14, color: '#ABADB2', fontWeight: '500',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 10,
    backgroundColor: '#F7F5FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E6F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchIcon: {},
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1C1E22',
    paddingVertical: 0,
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
  },
  separator: {
    height: StyleSheet.hairlineWidth, backgroundColor: '#F0EDF8',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12,
  },
  roomAvatar: {
    width: 46, height: 46, borderRadius: 23,
  },
  roomAvatarFallback: {
    backgroundColor: '#EDE8F7', alignItems: 'center', justifyContent: 'center',
  },
  roomAvatarInitial: {
    fontSize: 18, fontWeight: '700', color: '#7A0EED',
  },
  roomName: {
    flex: 1, fontSize: 14, fontWeight: '600', color: '#1C1E22',
  },
  inviteBtn: {
    paddingHorizontal: 18, paddingVertical: 8,
    borderRadius: 20, backgroundColor: '#3B82F6',
    minWidth: 72, alignItems: 'center',
  },
  invitedBtn: {
    backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#3B82F6',
  },
  sendingBtn: {
    backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#3B82F6',
  },
  inviteBtnText: {
    fontSize: 13, fontWeight: '700', color: '#FFFFFF',
  },
  invitedBtnText: {
    color: '#3B82F6',
  },
});
