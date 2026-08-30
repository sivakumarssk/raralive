import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';

import {
  BASE_URL, MEDIA_BASE, type ActiveBroadcast, type FriendZoneApplication, type FriendZonePublicFriend, type GoLiveRequest, type MyRoom, type PublicRoom,
  apiActiveBroadcasts, apiFriendZoneFriends, apiFriendZoneMyStatus, apiFriendZoneUpdateToggles, apiGoLiveMyStatus, apiMyRooms, apiOnlineCounts, apiPublicRooms,
} from '@/services/api';
import { authStore } from '@/store/auth-store';
import { consumePendingReturnToFriendZone, friendZoneCallSessionStore } from '@/store/friend-zone-call-session-store';
import { friendZoneSocketStore, getFriendZoneSocketState, subscribeFriendZoneSocket } from '@/store/friend-zone-socket-store';
import { ChatRoomsHeader } from './components/chat-rooms-header';
import { CreateRoomCard } from './components/create-room-card';
import { CreateRoomSheet } from './components/create-room-sheet';
import { FriendZoneScreen, type Friend, type FriendZoneApplicationStatus, type MyProfile } from './components/friend-zone-screen';
import { GoLiveSheet } from './components/go-live-sheet';
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

function ageFromDob(dob: string): number {
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

export function ChatRoomsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ChatTab>('chat-rooms');
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [myRooms, setMyRooms] = useState<MyRoom[]>([]);
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const [onlineCounts, setOnlineCounts] = useState<Record<string, number>>({});

  // Banners
  type Banner = { id: string; title: string | null; image_url: string; link_url: string | null };
  const [banners, setBanners] = useState<Banner[]>([]);
  const bannerRef = useRef<FlatList>(null);
  const bannerIndex = useRef(0);

  // Banners are fetched in loadData

  // Auto-scroll carousel
  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      bannerIndex.current = (bannerIndex.current + 1) % banners.length;
      bannerRef.current?.scrollToIndex({ index: bannerIndex.current, animated: true });
    }, 3500);
    return () => clearInterval(interval);
  }, [banners.length]);

  // Friend Zone state
  const currentUser = authStore.getUser();
  const [fzApplication, setFzApplication] = useState<FriendZoneApplication | null>(null);
  const [showRejectionModal, setShowRejectionModal] = useState(false);

  const fzStatus: FriendZoneApplicationStatus = fzApplication?.status ?? 'none';
  const receiveCalls = fzApplication?.receive_calls ?? true;
  const videoCalls = fzApplication?.video_calls ?? false;

  const myProfile: MyProfile = {
    name: fzApplication?.full_name || currentUser?.fullName || currentUser?.username || 'You',
    avatarUri: currentUser?.avatarUrl ? resolveImageUrl(currentUser.avatarUrl) : undefined,
    isOnline: true,
    applicationStatus: fzStatus,
    rejectionReason: fzApplication?.rejection_reason,
    photos: fzApplication?.photos.map(p => resolveImageUrl(p)!).filter(Boolean),
    gender: fzApplication?.gender,
    age: fzApplication ? ageFromDob(fzApplication.date_of_birth) : undefined,
    city: fzApplication?.city,
    language: fzApplication?.language,
    aboutMe: fzApplication?.about_me ?? undefined,
  };

  // Number of toggle updates currently awaiting the server's response — the
  // periodic status refetch (on focus) must not clobber them with stale data.
  // A counter (not a bool) so two overlapping toggle requests don't let each
  // other's completion prematurely clear the guard.
  const toggleInFlightCount = useRef(0);

  const loadFriendZoneStatus = useCallback(() => {
    const token = authStore.getToken();
    if (!token) return;
    apiFriendZoneMyStatus(token).then(r => {
      if (!r.ok) return;
      if (toggleInFlightCount.current > 0) return; // avoid clobbering an in-progress toggle update
      setFzApplication(r.data);
    });
  }, []);

  useEffect(() => { loadFriendZoneStatus(); }, [loadFriendZoneStatus]);

  useFocusEffect(useCallback(() => { loadFriendZoneStatus(); }, [loadFriendZoneStatus]));

  const fzApplicationRef = useRef(fzApplication);
  fzApplicationRef.current = fzApplication;

  const setReceiveCalls = useCallback((value: boolean) => {
    const currentVideoCalls = fzApplicationRef.current?.video_calls ?? false;
    setFzApplication(prev => prev ? { ...prev, receive_calls: value } : prev);
    const token = authStore.getToken();
    if (token) {
      toggleInFlightCount.current += 1;
      apiFriendZoneUpdateToggles(value, currentVideoCalls, token).then(r => {
        toggleInFlightCount.current -= 1;
        if (r.ok) setFzApplication(r.data);
        else setFzApplication(prev => prev ? { ...prev, receive_calls: !value } : prev);
      });
    }
    friendZoneSocketStore.emitToggleUpdate(value, currentVideoCalls);
  }, []);

  const setVideoCalls = useCallback((value: boolean) => {
    const currentReceiveCalls = fzApplicationRef.current?.receive_calls ?? true;
    setFzApplication(prev => prev ? { ...prev, video_calls: value } : prev);
    const token = authStore.getToken();
    if (token) {
      toggleInFlightCount.current += 1;
      apiFriendZoneUpdateToggles(currentReceiveCalls, value, token).then(r => {
        toggleInFlightCount.current -= 1;
        if (r.ok) setFzApplication(r.data);
        else setFzApplication(prev => prev ? { ...prev, video_calls: !value } : prev);
      });
    }
    friendZoneSocketStore.emitToggleUpdate(currentReceiveCalls, value);
  }, []);
  const [publicFriends, setPublicFriends] = useState<FriendZonePublicFriend[]>([]);
  const [fzSocketState, setFzSocketState] = useState(getFriendZoneSocketState());

  const loadPublicFriends = useCallback(() => {
    const token = authStore.getToken();
    if (!token) return;
    apiFriendZoneFriends(token).then(r => {
      if (r.ok) setPublicFriends(r.data);
    });
  }, []);

  useEffect(() => { loadPublicFriends(); }, [loadPublicFriends]);
  useFocusEffect(useCallback(() => { loadPublicFriends(); }, [loadPublicFriends]));

  // Land back on the Friend Zone tab after a call ends, if that's where the
  // call was started from — see the matching comment on
  // consumePendingReturnToFriendZone().
  useFocusEffect(useCallback(() => {
    if (consumePendingReturnToFriendZone()) setActiveTab('friend-zone');
  }, []));

  useEffect(() => subscribeFriendZoneSocket(() => setFzSocketState(getFriendZoneSocketState())), []);

  const myUserId = authStore.getUserId();

  const friends: Friend[] = publicFriends
    .filter(f => f.user_id !== myUserId)
    .map((f): Friend => {
      const liveToggles = fzSocketState.toggles[f.user_id];
      const receiveCalls = liveToggles?.receiveCalls ?? f.receive_calls;
      const videoCalls = liveToggles?.videoCalls ?? f.video_calls;
      return {
        id: f.user_id,
        name: f.full_name,
        age: ageFromDob(f.date_of_birth),
        location: f.city,
        avatarUri: f.photos[0] ? resolveImageUrl(f.photos[0]) : undefined,
        isOnline: fzSocketState.online[f.user_id] ?? f.is_online,
        gender: f.gender,
        languages: [f.language],
        photos: f.photos.map(p => resolveImageUrl(p)!).filter(Boolean),
        aboutMe: f.about_me ?? undefined,
        canAudio: receiveCalls,
        canVideo: videoCalls,
      };
    })
    .filter(f => f.canAudio || f.canVideo);

  // Live tab state — active broadcasters fetched from the server
  const [activeBroadcasts, setActiveBroadcasts] = useState<ActiveBroadcast[]>([]);
  const myActiveBroadcast = activeBroadcasts.find(b => b.host_user_id === myUserId);
  // Own broadcast is surfaced via the pinned "You're Live" banner, not duplicated in the grid
  const broadcasters: LiveBroadcaster[] = activeBroadcasts
    .filter(b => b.host_user_id !== myUserId)
    .map(b => ({
      id: b.room_id,
      name: b.host_name || b.host_username || 'Live',
      languages: [],
      imageUri: resolveImageUrl(b.host_avatar_url ?? b.room_image_url),
      isLive: true,
      viewerCount: undefined,
    }));
  const myLiveBroadcaster: LiveBroadcaster | null = myActiveBroadcast ? {
    id: myActiveBroadcast.room_id,
    name: myActiveBroadcast.host_name || myActiveBroadcast.host_username || 'Live',
    languages: [],
    imageUri: resolveImageUrl(myActiveBroadcast.host_avatar_url ?? myActiveBroadcast.room_image_url),
    isLive: true,
  } : null;

  const [refreshingBroadcasts, setRefreshingBroadcasts] = useState(false);

  const loadActiveBroadcasts = useCallback(() => {
    const token = authStore.getToken();
    if (!token) return Promise.resolve();
    return apiActiveBroadcasts(token).then(r => { if (r.ok) setActiveBroadcasts(r.data); });
  }, []);

  useEffect(() => { loadActiveBroadcasts(); }, [loadActiveBroadcasts]);
  useFocusEffect(useCallback(() => { loadActiveBroadcasts(); }, [loadActiveBroadcasts]));

  const handleRefreshBroadcasts = useCallback(() => {
    setRefreshingBroadcasts(true);
    loadActiveBroadcasts().finally(() => setRefreshingBroadcasts(false));
  }, [loadActiveBroadcasts]);

  // Go Live request state
  const [goLiveRequest, setGoLiveRequest] = useState<GoLiveRequest | null>(null);
  const [showGoLiveSheet, setShowGoLiveSheet] = useState(false);

  const loadGoLiveStatus = useCallback(() => {
    const token = authStore.getToken();
    if (!token) return;
    apiGoLiveMyStatus(token).then(r => { if (r.ok) setGoLiveRequest(r.data); });
  }, []);

  useEffect(() => { loadGoLiveStatus(); }, [loadGoLiveStatus]);
  useFocusEffect(useCallback(() => { loadGoLiveStatus(); }, [loadGoLiveStatus]));

  const handleGoLivePress = useCallback(() => {
    requireProfile(() => {
      if (goLiveRequest?.status !== 'approved') {
        setShowGoLiveSheet(true);
        return;
      }
      // Already broadcasting — resume directly instead of showing the preview/countdown again.
      if (myActiveBroadcast) {
        router.push({ pathname: '/live-broadcast/[id]', params: { id: myActiveBroadcast.room_id, channel: myActiveBroadcast.channel_name } });
        return;
      }
      router.push('/go-live-preview' as any);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goLiveRequest, myActiveBroadcast]);

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

  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(() => {
    const token = authStore.getToken();
    const promises: Promise<unknown>[] = [];
    if (token) {
      promises.push(apiMyRooms(token).then(r => { if (r.ok) setMyRooms(r.data); }));
    }
    promises.push(apiPublicRooms(token).then(r => { if (r.ok) setPublicRooms(r.data); }));
    promises.push(apiOnlineCounts().then(r => { if (r.ok) setOnlineCounts(r.data); }));
    promises.push(
      fetch(`${BASE_URL}/banners/public`).then(r => r.json()).then(j => { if (j.success) setBanners(j.data); }).catch(() => {})
    );
    return Promise.all(promises);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useFocusEffect(useCallback(() => {
    apiOnlineCounts().then(result => {
      if (result.ok) setOnlineCounts(result.data);
    });
  }, []));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData().finally(() => setRefreshing(false));
  }, [loadData]);

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
          onStatsPress={() => router.push('/wallet' as any)}
          onLeaderboardPress={() => router.push('/leaderboard' as any)}
          onLevelPress={() => router.push('/id-level' as any)}
          onChatPress={() => router.push('/chat' as any)}
        />

        <TabSwitcher activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === 'live' ? (
          <LiveScreen
            broadcasters={broadcasters}
            onGoLive={handleGoLivePress}
            onBroadcasterPress={(b) => requireProfile(() => {
              const target = activeBroadcasts.find(a => a.room_id === b.id);
              if (!target) return;
              router.push({ pathname: '/live-broadcast/[id]', params: { id: target.room_id, channel: target.channel_name } });
            })}
            onRefresh={handleRefreshBroadcasts}
            refreshing={refreshingBroadcasts}
            myLiveBroadcast={myLiveBroadcaster}
            onResumeMyLive={() => {
              if (!myActiveBroadcast) return;
              router.push({ pathname: '/live-broadcast/[id]', params: { id: myActiveBroadcast.room_id, channel: myActiveBroadcast.channel_name } });
            }}
          />
        ) : activeTab === 'friend-zone' ? (
          <FriendZoneScreen
            myProfile={myProfile}
            onEditProfile={() => {
              if (!fzApplication) return;
              router.push({ pathname: '/friend-zone-apply', params: { application: JSON.stringify(fzApplication) } } as any);
            }}
            onJoinPress={() => {
              if (fzStatus === 'rejected') { setShowRejectionModal(true); return; }
              router.push('/friend-zone-apply' as any);
            }}
            receiveCalls={receiveCalls}
            videoCalls={videoCalls}
            onReceiveCallsToggle={setReceiveCalls}
            onVideoCallToggle={setVideoCalls}
            friends={friends}
            onAudioCall={(friend) => friendZoneCallSessionStore.startCall(
              friend.id, { id: friend.id, full_name: friend.name, username: null, avatar_url: friend.avatarUri ?? null }, 'audio',
            )}
            onVideoCall={(friend) => friendZoneCallSessionStore.startCall(
              friend.id, { id: friend.id, full_name: friend.name, username: null, avatar_url: friend.avatarUri ?? null }, 'video',
            )}
            onFriendPress={(friend) => router.push({ pathname: '/friend-profile', params: { friend: JSON.stringify(friend) } } as any)}
            onHistoryPress={() => router.push('/call-history' as any)}
            onPreviewCallUi={() => friendZoneCallSessionStore.startUiPreviewCall('video')}
          />
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7A0EED']} tintColor="#7A0EED" />
            }>

            <SectionHeader title="My Chatroom" />

            {/* Banner carousel */}
            {banners.length > 0 && (
              <View style={styles.bannerWrap}>
                <FlatList
                  ref={bannerRef}
                  data={banners}
                  keyExtractor={b => b.id}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onScrollToIndexFailed={() => {}}
                  onMomentumScrollEnd={e => {
                    const idx = Math.round(e.nativeEvent.contentOffset.x / (Dimensions.get('window').width - 32));
                    bannerIndex.current = idx;
                  }}
                  renderItem={({ item }) => (
                    <TouchableOpacity activeOpacity={0.9} style={styles.bannerCard}>
                      <ExpoImage
                        source={{ uri: `${MEDIA_BASE}/${item.image_url.replace(/^\//, '')}` }}
                        style={styles.bannerImg}
                        contentFit="fill"
                      />
                    </TouchableOpacity>
                  )}
                />
                {banners.length > 1 && (
                  <View style={styles.bannerDots}>
                    {banners.map((b, i) => (
                      <View key={b.id} style={[styles.bannerDot, i === bannerIndex.current && styles.bannerDotActive]} />
                    ))}
                  </View>
                )}
              </View>
            )}

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

      <GoLiveSheet
        visible={showGoLiveSheet}
        onClose={() => setShowGoLiveSheet(false)}
        request={goLiveRequest}
        onSubmitted={(request) => {
          setGoLiveRequest(request);
          setShowGoLiveSheet(false);
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

      {/* Friend Zone rejection reason modal */}
      <Modal
        visible={showRejectionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRejectionModal(false)}>
        <TouchableOpacity style={rj.overlay} activeOpacity={1} onPress={() => setShowRejectionModal(false)} />
        <View style={rj.sheet}>
          <View style={rj.handle} />
          <View style={rj.iconWrap}>
            <Ionicons name="close-circle-outline" size={28} color="#E14C57" />
          </View>
          <Text style={rj.title}>Application Rejected</Text>
          <Text style={rj.reason}>
            {fzApplication?.rejection_reason || 'No reason was provided.'}
          </Text>
          <TouchableOpacity
            style={rj.reapplyBtn}
            activeOpacity={0.85}
            onPress={() => { setShowRejectionModal(false); router.push('/friend-zone-apply' as any); }}>
            <Text style={rj.reapplyBtnText}>Reapply</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowRejectionModal(false)} style={jc.cancelBtn}>
            <Text style={jc.cancelText}>Close</Text>
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
  bannerWrap: { paddingHorizontal: 16, marginBottom: 12 },
  bannerCard: {
    width: Dimensions.get('window').width - 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  bannerImg: { width: Dimensions.get('window').width - 32, height: 160 },
  bannerDots: {
    flexDirection: 'row', justifyContent: 'center',
    gap: 6, marginTop: 8,
  },
  bannerDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#D8D3EC',
  },
  bannerDotActive: { backgroundColor: '#7A0EED', width: 18 },
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

const rj = StyleSheet.create({
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
    backgroundColor: '#FFF0F1',
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontSize: 20, fontWeight: '800', color: '#1C1E22', letterSpacing: -0.3,
  },
  reason: {
    fontSize: 14, color: '#60626A', textAlign: 'center', lineHeight: 20,
  },
  reapplyBtn: {
    width: '100%',
    backgroundColor: '#7A0EED',
    borderRadius: 48,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  reapplyBtnText: {
    fontSize: 16, fontWeight: '700', color: '#FFFFFF',
  },
});
