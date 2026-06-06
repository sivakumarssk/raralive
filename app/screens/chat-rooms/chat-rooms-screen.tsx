import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BASE_URL, MEDIA_BASE, type MyRoom, type PublicRoom, apiMyRooms, apiOnlineCounts, apiPublicRooms } from '@/services/api';
import { authStore } from '@/store/auth-store';
import { ChatRoomsHeader } from './components/chat-rooms-header';
import { CreateRoomCard } from './components/create-room-card';
import { CreateRoomSheet } from './components/create-room-sheet';
import { FriendZoneScreen, type Friend } from './components/friend-zone-screen';
import { LiveScreen, type LiveBroadcaster } from './components/live-screen';
import { MyChatroomCard } from './components/my-chatroom-card';
import { PopularRoomItem } from './components/popular-room-item';
import { SectionHeader } from './components/section-header';
import { TabSwitcher, type ChatTab } from './components/tab-switcher';

function resolveImageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const path = new URL(url).pathname;
    return `${MEDIA_BASE}${path}`;
  } catch {
    return `${MEDIA_BASE}/${url.replace(/^\//, '')}`;
  }
}

export function ChatRoomsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ChatTab>('chat-rooms');
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [myRooms, setMyRooms] = useState<MyRoom[]>([]);
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const [onlineCounts, setOnlineCounts] = useState<Record<string, number>>({});

  // Friend Zone state
  const [receiveCalls, setReceiveCalls] = useState(true);
  const [videoCalls, setVideoCalls] = useState(false);
  const [friends] = useState<Friend[]>([]);

  // Live tab state — replace with real API fetch when backend is ready
  const [broadcasters] = useState<LiveBroadcaster[]>([]);

  // Join by code
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [kbHeight, setKbHeight] = useState(0);
  const codeInputRef = useRef<TextInput>(null);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', e => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const myRoomIds = new Set(myRooms.map(r => r.id));

  useEffect(() => {
    const token = authStore.getToken();
    if (token) {
      apiMyRooms(token).then(result => {
        if (result.ok) setMyRooms(result.data);
      });
    }
    apiPublicRooms().then(result => {
      if (result.ok) setPublicRooms(result.data);
    });
  }, []);

  useFocusEffect(useCallback(() => {
    apiOnlineCounts().then(result => {
      if (result.ok) setOnlineCounts(result.data);
    });
  }, []));

  const hasPublic = myRooms.some(r => r.visibility === 'public');
  const hasPrivate = myRooms.some(r => r.visibility === 'private');
  const canCreateMore = !hasPublic || !hasPrivate;

  const popularRooms = publicRooms.filter(r => !myRoomIds.has(r.id));

  function requireProfile(action: () => void) {
    if (!authStore.getToken()) {
      router.push('/login' as never);
      return;
    }
    action();
  }

  const handleRoomCreated = (newRoom: MyRoom) => {
    setMyRooms(prev => [newRoom, ...prev]);
    if (newRoom.visibility === 'public') {
      setPublicRooms(prev => [
        { id: newRoom.id, room_name: newRoom.room_name, room_image_url: newRoom.room_image_url, current_level: newRoom.current_level ?? 0 },
        ...prev,
      ]);
    }
  };

  const openJoinModal = () => {
    setJoinCode('');
    setJoinError('');
    setShowJoinModal(true);
    setTimeout(() => codeInputRef.current?.focus(), 200);
  };

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) { setJoinError('Enter a room code.'); return; }
    setJoinLoading(true);
    setJoinError('');
    try {
      const res = await fetch(`${BASE_URL}/rooms/by-code/${encodeURIComponent(code)}`);
      const json = await res.json();
      if (!json.success) {
        setJoinError('Room not found. Check the code and try again.');
        setJoinLoading(false);
        return;
      }
      setShowJoinModal(false);
      setJoinCode('');
      requireProfile(() =>
        router.push({ pathname: '/room/[id]', params: { id: json.data.id } })
      );
    } catch {
      setJoinError('Network error. Try again.');
    } finally {
      setJoinLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <ChatRoomsHeader
          onAvatarPress={() => {}}
          onStatsPress={() => router.push('/wallet' as any)}
          onMicPress={() => {}}
        />

        <TabSwitcher activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === 'live' ? (
          <LiveScreen
            broadcasters={broadcasters}
            onGoLive={() => {}}
            onBroadcasterPress={() => {}}
          />
        ) : activeTab === 'friend-zone' ? (
          <FriendZoneScreen
            receiveCalls={receiveCalls}
            videoCalls={videoCalls}
            onReceiveCallsToggle={setReceiveCalls}
            onVideoCallToggle={setVideoCalls}
            friends={friends}
            onAudioCall={() => {}}
            onVideoCall={() => {}}
            onHistoryPress={() => {}}
          />
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>

            <SectionHeader title="My Chatroom" />

            {myRooms.map(room => (
              <MyChatroomCard
                key={room.id}
                room={{
                  id: room.id,
                  name: room.room_name,
                  onlineCount: onlineCounts[room.id] ?? 0,
                  avatarUri: resolveImageUrl(room.room_image_url),
                  level: room.current_level ?? 0,
                }}
                onPress={() => requireProfile(() =>
                  router.push({ pathname: '/room/[id]', params: { id: room.id } })
                )}
              />
            ))}

            {canCreateMore && (
              <CreateRoomCard onPress={() => requireProfile(() => setShowCreateSheet(true))} />
            )}

            <SectionHeader title="Popular Rooms" />
            <View style={styles.popularList}>
              {popularRooms.map(room => (
                <PopularRoomItem
                  key={room.id}
                  room={{
                    id: room.id,
                    name: room.room_name,
                    onlineCount: onlineCounts[room.id] ?? 0,
                    memberCount: onlineCounts[room.id] ?? 0,
                    imageUri: resolveImageUrl(room.room_image_url),
                    level: room.current_level ?? 0,
                  }}
                  onPress={() => requireProfile(() =>
                    router.push({ pathname: '/room/[id]', params: { id: room.id } })
                  )}
                />
              ))}
            </View>

            <View style={styles.bottomSpacer} />
          </ScrollView>
        )}
      </View>

      {/* Floating join button — only on Chat Rooms tab */}
      {activeTab === 'chat-rooms' && (
        <TouchableOpacity style={styles.fab} onPress={openJoinModal} activeOpacity={0.85}>
          <Ionicons name="enter-outline" size={24} color="#FFFFFF" />
          <Text style={{ position: 'absolute', bottom: 5, fontSize: 10, color: '#FFFFFF', fontWeight: '600' }}>Join</Text>
        </TouchableOpacity>
      )}

      <CreateRoomSheet
        visible={showCreateSheet}
        onClose={() => setShowCreateSheet(false)}
        hasPublic={hasPublic}
        hasPrivate={hasPrivate}
        onCreated={(newRoom) => {
          handleRoomCreated(newRoom);
          setShowCreateSheet(false);
        }}
      />

      {/* Join by Code modal */}
      <Modal
        visible={showJoinModal}
        transparent
        animationType="fade"
        onRequestClose={() => { Keyboard.dismiss(); setShowJoinModal(false); }}>
        <TouchableOpacity
          style={jc.overlay}
          activeOpacity={1}
          onPress={() => { Keyboard.dismiss(); setShowJoinModal(false); }}
        />
        <View style={[jc.sheet, { bottom: kbHeight }]}>
          <View style={jc.handle} />

          <View style={jc.iconWrap}>
            <Ionicons name="enter-outline" size={28} color="#7A0EED" />
          </View>
          <Text style={jc.title}>Join by Room Code</Text>
          <Text style={jc.subtitle}>Enter the code shared with you (e.g. RM-A1B2C3)</Text>

          <TextInput
            ref={codeInputRef}
            style={jc.input}
            placeholder="RM-XXXXXX"
            placeholderTextColor="#BDBDBD"
            value={joinCode}
            onChangeText={v => { setJoinCode(v); setJoinError(''); }}
            autoCapitalize="characters"
            returnKeyType="go"
            onSubmitEditing={handleJoin}
          />

          {!!joinError && <Text style={jc.error}>{joinError}</Text>}

          <TouchableOpacity
            style={[jc.joinBtn, (!joinCode.trim() || joinLoading) && jc.joinBtnDisabled]}
            onPress={handleJoin}
            activeOpacity={0.85}
            disabled={!joinCode.trim() || joinLoading}>
            {joinLoading
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : <Text style={jc.joinBtnText}>Join Room</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { Keyboard.dismiss(); setShowJoinModal(false); }} style={jc.cancelBtn}>
            <Text style={jc.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  popularList: { backgroundColor: '#FAFAFA' },
  bottomSpacer: { height: 100 },
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#7A0EED',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#7A0EED',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
});

const jc = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    alignItems: 'center',
    gap: 12,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E0DDED', marginBottom: 4,
  },
  iconWrap: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#F4EEFF',
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontSize: 20, fontWeight: '800', color: '#1C1E22', letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13, color: '#60626A', textAlign: 'center', lineHeight: 18,
  },
  input: {
    width: '100%',
    backgroundColor: '#F4F5F8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1E22',
    letterSpacing: 2,
    textAlign: 'center',
    marginTop: 4,
  },
  error: {
    fontSize: 13, color: '#E14C57', textAlign: 'center',
  },
  joinBtn: {
    width: '100%',
    backgroundColor: '#7A0EED',
    borderRadius: 48,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  joinBtnDisabled: { backgroundColor: '#DDDAE8' },
  joinBtnText: {
    fontSize: 16, fontWeight: '700', color: '#FFFFFF',
  },
  cancelBtn: { paddingVertical: 8 },
  cancelText: { fontSize: 15, color: '#ABADB2', fontWeight: '600' },
});
