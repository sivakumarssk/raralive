import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Image,
  ImageBackground,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAgoraVoice } from '@/hooks/useAgoraVoice';
import { agoraStore } from '@/store/agora-store';
import { socketStore, onGiftError, onLevelUp, onTaskCompleted, onRewardApplied, subscribeSocket, getSocketState } from '@/store/socket-store';
import { type IncomingSeatRequest, useRoomSocket } from '@/hooks/useRoomSocket';
import { BASE_URL, MEDIA_BASE } from '@/services/api';
import { authStore } from '@/store/auth-store';
import { roomStore } from '@/store/room-store';
import { ChatFeed } from './components/chat-feed';
import { ChatInputBar } from './components/chat-input-bar';
import { BattleModal } from './components/battle-modal';
import { CoinBoxModal } from './components/coinbox-modal';
import { DailyTaskModal } from './components/daily-task-modal';
import { GiftShopModal } from './components/gift-shop-modal';
import { GiftFullscreenAnim } from './components/gift-fullscreen-anim';
import { GiftBar, GiftPickerBar, type GiftTarget } from './components/gift-tray';
import { GiftFlyAnimation, type FlyItem, type SlotPosition } from './components/gift-fly-animation';
import { BattleBanner } from './components/battle-banner';
import { RoomHeader } from './components/room-header';
import { RoomStage, type HostInfo, type BattleStageInfo } from './components/room-stage';
import { RoomLevelUp } from './components/room-level-up';
import { type GiftItem } from './room-detail.data';

const FLOATING_ACTIONS = [
  { key: 'dailytask', src: require('@/assets/tabs/chatroom/dailyTask.png') },
  { key: 'coinbox',   src: require('@/assets/tabs/chatroom/coinbox.png') },
];

type RoomInfo = {
  room_code: string;
  room_name: string;
  agency_name: string;
  room_image_url: string | null;
  host_user_id: string;
  host_name: string | null;
  host_username: string | null;
  host_avatar_url: string | null;
  current_level: number;
  total_coins_received: number;
};

type RoomDetailScreenProps = {
  roomId?: string;
  onBack?: () => void;
};

function resolveAvatar(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try { return `${MEDIA_BASE}${new URL(url).pathname}`; }
  catch { return `${MEDIA_BASE}/${url.replace(/^\//, '')}`; }
}

export function RoomDetailScreen({ roomId = '', onBack }: RoomDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [showDailyTask, setShowDailyTask] = useState(false);
  const [showCoinBox, setShowCoinBox] = useState(false);
  const [showBattle, setShowBattle] = useState(false);
  const [showGiftShop, setShowGiftShop] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showCoHostModal, setShowCoHostModal] = useState(false);
  const [seatToast, setSeatToast] = useState<string | null>(null);

  // Battle stage info (VS bar in audio box)
  const [battleStageInfo, setBattleStageInfo] = useState<BattleStageInfo | null>(null);
  const battleEndsAtRef = useRef<number | null>(null);
  // Coin totals per userId received as gifts in this room
  const [coinsByUserId, setCoinsByUserId] = useState<Map<string, number>>(new Map());
  const seenGiftIds = useRef(new Set<string>());

  // Gift target picker + fly animation (gift bar)
  const [pendingGift, setPendingGift] = useState<GiftItem | null>(null);
  const [showGiftPicker, setShowGiftPicker] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [allGifts, setAllGifts] = useState<GiftItem[]>([]);
  const [flyItems, setFlyItems] = useState<FlyItem[]>([]);
  const slotPositions = useRef<Map<string, SlotPosition>>(new Map());

  // Gift shop fullscreen animation
  const [fullscreenGift, setFullscreenGift] = useState<{ imageUrl: string | null; bgColor: string } | null>(null);

  // Room level-up animation
  const [levelUpData, setLevelUpData] = useState<{ level: number } | null>(null);

  // Active reward visuals for this room's host (background + frame, 24h TTL)
  const [rewardBgUrl, setRewardBgUrl] = useState<string | null>(null);
  const [rewardFrameUrl, setRewardFrameUrl] = useState<string | null>(null);
  // Increments to trigger DailyTaskModal task list refresh
  const [taskRefreshKey, setTaskRefreshKey] = useState(0);

  useEffect(() => {
    const unsub = onLevelUp(level => {
      setLevelUpData({ level });
      setRoomInfo(prev => prev ? { ...prev, current_level: level } : prev);
    });
    return unsub;
  }, []);

  // Real-time reward visuals — applied immediately when host completes task or claims reward
  useEffect(() => {
    const unsub = onRewardApplied(({ reward_bg_url, reward_frame_url }) => {
      console.log('[ROOM] onRewardApplied triggered: bg=', reward_bg_url, 'frame=', reward_frame_url);
      const bg = reward_bg_url ? `${MEDIA_BASE}/${reward_bg_url.replace(/^\//, '')}` : null;
      const frame = reward_frame_url ? `${MEDIA_BASE}/${reward_frame_url.replace(/^\//, '')}` : null;
      console.log('[ROOM] setting rewardBgUrl=', bg, 'rewardFrameUrl=', frame);
      setRewardBgUrl(bg);
      setRewardFrameUrl(frame);
    });
    return unsub;
  }, []);

  // When a task completes, refresh the task list in the modal
  useEffect(() => {
    const unsub = onTaskCompleted(() => {
      setTaskRefreshKey(k => k + 1);
    });
    return unsub;
  }, []);

  // Fetch active battle for this room by checking notifications for an active invite
  // Uses /battle/notifications to find inviteId for this room, then /battle/invite/:id for details
  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;

    const fetchBattle = async () => {
      const token = authStore.getToken();
      if (!token) return;
      try {
        // Step 1: get recent battle notifications to find active invite for this room
        const nr = await fetch(`${BASE_URL}/battle/notifications`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const nj = await nr.json();
        if (cancelled || !nj.success) return;

        // Find the most recent notification for this room
        const notifs: Array<{ type: string; data: Record<string, string> | null }> = nj.data ?? [];
        // Find any battle notification with an invite_id — we'll check status via invite detail
        const match = notifs.find(n =>
          (n.type === 'battle_invite' || n.type === 'battle_accepted' || n.type === 'battle_started') &&
          n.data?.invite_id
        );
        if (!match?.data?.invite_id) {
          if (!cancelled) { battleEndsAtRef.current = null; setBattleStageInfo(null); }
          return;
        }

        // Step 2: get full invite details
        const ir = await fetch(`${BASE_URL}/battle/invite/${match.data.invite_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const ij = await ir.json();
        if (cancelled || !ij.success || !ij.data) return;

        const d = ij.data;
        // Only show VS bar when battle is active AND involves this room
        if (d.status !== 'active') {
          if (!cancelled) { battleEndsAtRef.current = null; setBattleStageInfo(null); }
          return;
        }
        if (d.from_room_id !== roomId && d.to_room_id !== roomId) {
          if (!cancelled) { battleEndsAtRef.current = null; setBattleStageInfo(null); }
          return;
        }

        const isFrom    = d.from_room_id === roomId;
        const ownName   = isFrom ? d.from_room_name   : d.to_room_name;
        const ownImg    = isFrom ? d.from_room_image_url : d.to_room_image_url;
        const rivalName = isFrom ? d.to_room_name     : d.from_room_name;
        const rivalImg  = isFrom ? d.to_room_image_url : d.from_room_image_url;

        // Compute end time from started_at + duration_minutes (both saved in backend)
        const startedAt = d.started_at ? new Date(d.started_at).getTime() : null;
        const durMs     = (d.duration_minutes ?? 0) * 60_000;
        const endsAtMs  = startedAt ? startedAt + durMs : null;

        if (!cancelled) {
          battleEndsAtRef.current = endsAtMs;
          setBattleStageInfo({
            ownRoomName: ownName ?? '', ownRoomImageUrl: ownImg ?? null,
            rivalRoomName: rivalName ?? '', rivalRoomImageUrl: rivalImg ?? null,
            timeDisplay: '00:00',
            isFinished: false,
          });
        }
      } catch { if (!cancelled) setBattleStageInfo(null); }
    };

    fetchBattle();
    const pollId = setInterval(fetchBattle, 15_000);
    return () => { cancelled = true; clearInterval(pollId); };
  }, [roomId]);

  // Live countdown tick — runs off battleEndsAtRef so timer never resets on re-render
  useEffect(() => {
    const tick = () => {
      const endsAtMs = battleEndsAtRef.current;
      if (!endsAtMs) return;
      const secsLeft = Math.max(0, Math.floor((endsAtMs - Date.now()) / 1000));
      if (secsLeft === 0) {
        // Battle ended — clear all battle UI and coin counts
        battleEndsAtRef.current = null;
        setBattleStageInfo(null);
        setCoinsByUserId(new Map());
        seenGiftIds.current.clear();
        return;
      }
      const m = Math.floor(secsLeft / 60);
      const s = secsLeft % 60;
      setBattleStageInfo(prev => prev ? {
        ...prev,
        timeDisplay: `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
        isFinished: false,
      } : prev);
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Track gift coins per recipient from socket messages
  useEffect(() => {
    const unsub = subscribeSocket(() => {
      const { messages } = getSocketState();
      messages.forEach(msg => {
        if (msg.type !== 'gift') return;
        if (!msg.giftRecipientId || !msg.giftCoins) return;
        if (seenGiftIds.current.has(msg.id)) return;
        seenGiftIds.current.add(msg.id);
        const total = (msg.giftCoins ?? 0) * (msg.giftQty ?? 1);
        setCoinsByUserId(prev => {
          const next = new Map(prev);
          next.set(msg.giftRecipientId!, (next.get(msg.giftRecipientId!) ?? 0) + total);
          return next;
        });
      });
    });
    return unsub;
  }, []);

  // Fetch all gifts for the inline picker
  useEffect(() => {
    fetch(`${BASE_URL}/gifts/public`)
      .then(r => r.json())
      .then(j => { if (j.success) setAllGifts(j.data); })
      .catch(() => {});
  }, []);

  // Cached coin balance — fetched on mount and refreshed after each gift send
  const coinBalanceRef = useRef<number>(9999);
  useEffect(() => {
    const token = authStore.getToken();
    if (!token) return;
    fetch(`${BASE_URL}/wallet/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => { if (j.success) coinBalanceRef.current = j.data.coins ?? 0; })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const unsub = onGiftError(() => {
      router.push('/wallet' as any);
    });
    return unsub;
  }, []);

  const {
    messages, onlineCount,
    seats, hostStatus,
    incomingRequest, seatRequestResult,
    sendMessage, requestSeat,
    acceptSeatRequest, rejectSeatRequest,
    clearSeatRequestResult,
  } = useRoomSocket(roomId);

  const currentUserId = authStore.getUserId() ?? '';
  const isHost = roomInfo ? roomInfo.host_user_id === currentUserId : false;
  // Which slot (1–7) does the current user occupy? null if not on stage
  const mySlotIndex = seats.find(s => s.slotIndex !== 0 && s.userId === currentUserId)?.slotIndex ?? null;
  const iAmOnStage = mySlotIndex !== null;

  // Agora voice — join channel only when on stage (or host)
  const isOnStage = iAmOnStage || isHost;
  const { isMuted, toggleMute } = useAgoraVoice(roomId, currentUserId, isOnStage);

  // Host info comes from socket host_status (real-time) + roomInfo for initial avatar
  const hostInfo: HostInfo = {
    name: hostStatus.isOnline
      ? hostStatus.userName
      : (roomInfo?.host_name || roomInfo?.host_username || 'Host'),
    avatarUri: resolveAvatar(hostStatus.avatarUrl ?? roomInfo?.host_avatar_url),
    isOnline: hostStatus.isOnline,
  };

  const roomAvatarUri = resolveAvatar(roomInfo?.room_image_url ?? roomInfo?.host_avatar_url);

  // Fetch room info once
  useEffect(() => {
    if (!roomId) return;
    const token = authStore.getToken();
    fetch(`${BASE_URL}/rooms/${roomId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(json => { if (json.success) setRoomInfo(json.data); })
      .catch(() => {});
  }, [roomId]);

  // Fetch active reward visuals for this room's host
  useEffect(() => {
    if (!roomId) return;
    const token = authStore.getToken();
    console.log('[ROOM] fetching active-reward for roomId=', roomId);
    fetch(`${BASE_URL}/tasks/active-reward?room_id=${roomId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(json => {
        console.log('[ROOM] active-reward response:', JSON.stringify(json));
        if (json.success && json.data) {
          const bg = json.data.reward_bg_url;
          const frame = json.data.reward_frame_url;
          const bgUrl = bg ? `${MEDIA_BASE}/${bg.replace(/^\//, '')}` : null;
          const frameUrl = frame ? `${MEDIA_BASE}/${frame.replace(/^\//, '')}` : null;
          console.log('[ROOM] applying persisted reward bg=', bgUrl, 'frame=', frameUrl);
          setRewardBgUrl(bgUrl);
          setRewardFrameUrl(frameUrl);
        } else {
          console.log('[ROOM] no active reward found');
        }
      })
      .catch(e => console.error('[ROOM] active-reward fetch error:', e));
  }, [roomId]);

  // Keyboard — track height to push input bar up, and visibility to hide GiftBar
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => { setKeyboardHeight(e.endCoordinates.height); setKeyboardVisible(true); },
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => { setKeyboardHeight(0); setKeyboardVisible(false); },
    );
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Android back button — only active when this screen is focused
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        setShowExitModal(true);
        return true;
      });
      return () => sub.remove();
    }, [])
  );

  // Auto-scroll on new message
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages.length]);

  // Show toast only to host (accepted/rejected confirmation)
  useEffect(() => {
    if (!seatRequestResult || !isHost) return;
    setSeatToast(seatRequestResult.accepted ? 'User added to stage.' : 'Request declined.');
    const t = setTimeout(() => { setSeatToast(null); clearSeatRequestResult(); }, 2500);
    return () => clearTimeout(t);
  }, [seatRequestResult]);

  const handleSend = (text: string) => sendMessage(text);
  const handleBackPress = () => setShowExitModal(true);

  // Build gift targets: host first, then on-stage seats
  const giftTargets: GiftTarget[] = [
    {
      userId: roomInfo?.host_user_id ?? '',
      name: hostInfo.name,
      avatarUrl: roomInfo?.host_avatar_url ?? null,
      isHost: true,
    },
    ...seats
      .filter(s => s.slotIndex !== 0 && s.userId !== roomInfo?.host_user_id)
      .map(s => ({ userId: s.userId, name: s.userName, avatarUrl: s.avatarUrl, isHost: false })),
  ].filter(t => t.userId);

  const handleGiftPress = (gift: GiftItem) => {
    setPendingGift(gift);
    // Pre-select host
    setSelectedTargetId(roomInfo?.host_user_id ?? null);
    setShowGiftPicker(true);
  };

  const handleGiftSend = (qty: number = 1) => {
    if (!pendingGift || !selectedTargetId) return;
    const totalCost = pendingGift.coins * qty;

    // Check balance before doing anything — no animation if insufficient
    if (coinBalanceRef.current < totalCost) {
      setShowGiftPicker(false);
      router.push('/wallet' as any);
      return;
    }

    const target = giftTargets.find(t => t.userId === selectedTargetId);
    const hostUserId = roomInfo?.host_user_id ?? selectedTargetId;
    // Encode all data the socket needs for wallet debit + gift event
    sendMessage(
      `__gift__🎁__to__${target?.name ?? 'someone'}__img__${pendingGift.image_url ?? ''}__bg__${pendingGift.bg_color}` +
      `__giftid__${pendingGift.id}__coins__${pendingGift.coins}__qty__${qty}` +
      `__senderid__${currentUserId}__recipientid__${hostUserId}`
    );
    // Optimistically deduct from local balance
    coinBalanceRef.current = Math.max(0, coinBalanceRef.current - totalCost);

    setFlyItems(prev => [
      ...prev,
      { id: `${Date.now()}-${Math.random()}`, gift: pendingGift, qty },
    ]);
  };

  const handleShare = () => {
    const code = roomInfo?.room_code;
    const name = roomInfo?.room_name ?? 'Chat Room';
    if (!code) return;
    Share.share({
      message: `Join me in "${name}" on Rara Live!\n\nRoom Code: ${code}\n\nOpen Rara Live → Live tab → Join by Code → enter ${code}`,
    });
  };

  const handleMinimize = () => {
    setShowExitModal(false);
    // Keep Agora running — audio continues in background
    roomStore.minimize({
      roomId,
      roomName: roomInfo?.room_name ?? 'Chat Room',
      avatarUri: roomAvatarUri,
    });
    onBack?.();
  };

  const handleExit = () => {
    setShowExitModal(false);
    agoraStore.leave();
    socketStore.leave();
    roomStore.clear();
    onBack?.();
  };

  const handleHostExit = () => {
    setShowExitModal(false);
    if (onlineCount > 1) {
      setShowCoHostModal(true);
    } else {
      handleExit();
    }
  };

  const screenContent = (
    <>
      <RoomHeader
        name={roomInfo?.room_name ?? 'Loading...'}
        agencyName={roomInfo?.agency_name}
        memberCount={onlineCount}
        level={roomInfo?.current_level ?? 0}
        roomId={roomId}
        totalCoins={roomInfo?.total_coins_received ?? 0}
        hasRoomBg={!!rewardBgUrl}
        onBack={handleBackPress}
        onShare={handleShare}
        onMore={() => {}}
      />

      <RoomStage
        hostInfo={hostInfo}
        seats={seats}
        isHost={isHost}
        hideEmptySlots={iAmOnStage}
        onRequestSeat={requestSeat}
        myUserId={currentUserId}
        isMuted={isMuted}
        isHostMuted={isHost ? isMuted : undefined}
        onToggleMute={toggleMute}
        hostUserId={roomInfo?.host_user_id}
        onSlotLayout={(userId, x, y) => { slotPositions.current.set(userId, { x, y }); }}
        battleInfo={battleStageInfo}
        coinsByUserId={coinsByUserId}
        hasRoomBg={!!rewardBgUrl}
        rewardFrameUrl={rewardFrameUrl}
      />

      <BattleBanner roomId={roomId} />

      {/* Chat area — scroll only, no floating icons here */}
      <View style={[styles.chatArea, rewardBgUrl && { backgroundColor: 'transparent' }]}>
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <ChatFeed messages={messages} />
        </ScrollView>

        {/* Toast inside chat area */}
        {seatToast && (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{seatToast}</Text>
          </View>
        )}
      </View>

      <View style={{ marginBottom: keyboardHeight }}>
        {/* Host incoming seat request banner */}
        {isHost && incomingRequest && (
          <SeatRequestBanner
            request={incomingRequest}
            onAccept={() => acceptSeatRequest(incomingRequest)}
            onReject={() => rejectSeatRequest(incomingRequest)}
          />
        )}
        {!keyboardVisible && (
          <GiftBar onGiftPress={handleGiftPress} hasRoomBg={!!rewardBgUrl} />
        )}
        <ChatInputBar
          onSend={handleSend}
          onGiftOpen={() => setShowGiftShop(true)}
          onBattlePress={() => setShowBattle(true)}
          hasRoomBg={!!rewardBgUrl}
        />
      </View>

      {/* Floating action icons — anchored to root, never affected by keyboard */}
      <View style={styles.floatingBar} pointerEvents="box-none">
        {FLOATING_ACTIONS.map((item, index) => (
          <View key={item.key} style={styles.floatingItem}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.floatingBtn}
              onPress={
                item.key === 'dailytask' ? () => setShowDailyTask(true) :
                item.key === 'coinbox'   ? () => setShowCoinBox(true)   : undefined
              }>
              <Image source={item.src} style={styles.floatingImg} resizeMode="contain" />
            </TouchableOpacity>
            {index === FLOATING_ACTIONS.length - 1 && (
              <View style={styles.rankTrack}>
                <View style={styles.rankFill} />
              </View>
            )}
          </View>
        ))}
      </View>

      <DailyTaskModal visible={showDailyTask} onClose={() => setShowDailyTask(false)} roomId={roomId} refreshKey={taskRefreshKey} />
      <CoinBoxModal visible={showCoinBox} onClose={() => setShowCoinBox(false)} />
      <BattleModal visible={showBattle} onClose={() => setShowBattle(false)} roomId={roomId} />
      <GiftShopModal
        visible={showGiftShop}
        onClose={() => setShowGiftShop(false)}
        seats={seats}
        hostInfo={{
          userId: roomInfo?.host_user_id ?? '',
          name: hostInfo.name,
          avatarUrl: roomInfo?.host_avatar_url ?? null,
        }}
        onSendGift={(gift, targetName, qty) => {
          setFullscreenGift({ imageUrl: gift.image_url, bgColor: gift.bg_color });
          const hostUserId = roomInfo?.host_user_id ?? '';
          // Send as single message with total qty — socket handles wallet debit × qty
          sendMessage(
            `__gift__🎁__to__${targetName}__img__${gift.image_url ?? ''}__bg__${gift.bg_color}` +
            `__giftid__${gift.id}__coins__${gift.coins}__qty__${qty}` +
            `__senderid__${currentUserId}__recipientid__${hostUserId}`
          );
        }}
      />

      <GiftFullscreenAnim
        visible={!!fullscreenGift}
        imageUrl={fullscreenGift?.imageUrl ?? null}
        bgColor={fullscreenGift?.bgColor}
        onDone={() => setFullscreenGift(null)}
      />

      <RoomLevelUp
        visible={!!levelUpData}
        level={levelUpData?.level ?? 0}
        roomName={roomInfo?.room_name ?? ''}
        roomAvatarUrl={roomInfo?.room_image_url ?? null}
        onDone={() => setLevelUpData(null)}
      />

      <GiftPickerBar
        visible={showGiftPicker}
        gift={pendingGift}
        gifts={allGifts}
        targets={giftTargets}
        selectedTargetId={selectedTargetId}
        onSelectTarget={setSelectedTargetId}
        onGiftChange={setPendingGift}
        onSend={handleGiftSend}
        onClose={() => setShowGiftPicker(false)}
      />

      <GiftFlyAnimation
        items={flyItems}
        onItemDone={id => setFlyItems(prev => prev.filter(i => i.id !== id))}
      />

      {/* Exit / Minimize modal */}
      <Modal visible={showExitModal} transparent animationType="fade" onRequestClose={() => setShowExitModal(false)}>
        <TouchableOpacity style={modal.overlay} activeOpacity={1} onPress={() => setShowExitModal(false)} />
        <View style={modal.sheet}>
          <View style={modal.handle} />
          <Text style={modal.title}>Leave Room?</Text>
          <Text style={modal.subtitle}>You can minimize and come back, or exit the room.</Text>

          <TouchableOpacity onPress={handleMinimize} activeOpacity={0.9} style={modal.minimizeBtn}>
            <LinearGradient colors={['#7A0EED', '#B50357']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={modal.btnGradient}>
              <Ionicons name="remove-circle-outline" size={20} color="#FFFFFF" />
              <Text style={modal.btnLabel}>Minimize</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={isHost ? handleHostExit : handleExit}
            activeOpacity={0.9}
            style={modal.exitBtn}>
            <Ionicons name="exit-outline" size={20} color="#E14C57" />
            <Text style={modal.exitLabel}>Exit Room</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowExitModal(false)} style={modal.cancelBtn}>
            <Text style={modal.cancelLabel}>Stay</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Co-host modal (host only) */}
      <Modal visible={showCoHostModal} transparent animationType="fade" onRequestClose={() => setShowCoHostModal(false)}>
        <TouchableOpacity style={modal.overlay} activeOpacity={1} onPress={() => setShowCoHostModal(false)} />
        <View style={modal.sheet}>
          <View style={modal.handle} />
          <View style={modal.coHostIconWrap}>
            <Ionicons name="people" size={32} color="#7A0EED" />
          </View>
          <Text style={modal.title}>Assign a Co-host</Text>
          <Text style={modal.subtitle}>
            Please assign a co-host before leaving so the room can continue.
          </Text>
          <View style={modal.coHostNote}>
            <Ionicons name="information-circle-outline" size={16} color="#7A0EED" />
            <Text style={modal.coHostNoteText}>Co-host assignment will be available once seat management is fully implemented.</Text>
          </View>
          <TouchableOpacity onPress={() => { setShowCoHostModal(false); handleExit(); }} activeOpacity={0.9} style={modal.exitBtn}>
            <Ionicons name="exit-outline" size={20} color="#E14C57" />
            <Text style={modal.exitLabel}>Exit Without Co-host</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowCoHostModal(false)} style={modal.cancelBtn}>
            <Text style={modal.cancelLabel}>Stay & Assign</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );

  const innerStyle = { flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom };

  if (rewardBgUrl) {
    return (
      <>
        <StatusBar style="dark" backgroundColor="transparent" translucent />
        <ImageBackground source={{ uri: rewardBgUrl }} style={styles.flex} resizeMode="cover">
          <View style={[styles.flex, styles.bgOverlay, innerStyle]}>
            {screenContent}
          </View>
        </ImageBackground>
      </>
    );
  }

  return (
    <>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />
      <SafeAreaView style={[styles.root, styles.defaultBg]} edges={['top', 'bottom']}>
        {screenContent}
      </SafeAreaView>
    </>
  );
}

function SeatRequestBanner({ request, onAccept, onReject }: {
  request: IncomingSeatRequest;
  onAccept: () => void;
  onReject: () => void;
}) {
  const uri = resolveAvatar(request.fromAvatarUrl);
  return (
    <View style={banner.container}>
      {uri ? (
        <Image source={{ uri }} style={banner.avatar} />
      ) : (
        <View style={[banner.avatar, banner.avatarFallback]}>
          <Text style={banner.initial}>{request.fromUserName[0]?.toUpperCase()}</Text>
        </View>
      )}
      <View style={banner.info}>
        <Text style={banner.name} numberOfLines={1}>{request.fromUserName}</Text>
        <Text style={banner.sub}>wants to join slot {request.slotIndex}</Text>
      </View>
      <TouchableOpacity onPress={onReject} style={banner.rejectBtn}>
        <Ionicons name="close" size={18} color="#E14C57" />
      </TouchableOpacity>
      <TouchableOpacity onPress={onAccept} style={banner.acceptBtn}>
        <LinearGradient colors={['#7A0EED', '#B50357']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={banner.acceptGrad}>
          <Text style={banner.acceptText}>Accept</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  defaultBg: { flex: 1, backgroundColor: '#FFFFFF' },
  flex: { flex: 1 },
  bgOverlay: { backgroundColor: 'rgba(0,0,0,0.25)' },
  scrollContent: { paddingBottom: 8 },
  chatArea: {
    flex: 1,
  },
  toast: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
    zIndex: 5,
  },
  toastText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  floatingBar: {
    position: 'absolute',
    right: 10,
    bottom: 180,   // fixed above input bar height — never moves with keyboard
    zIndex: 4,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    // picker bar zIndex: 30 sits above this when open
  },
  floatingItem: { alignItems: 'center', gap: 4 },
  floatingBtn: { width: 42, height: 42 },
  floatingImg: { width: 42, height: 42 },
  rankTrack: {
    width: 42, height: 5, borderRadius: 3,
    backgroundColor: '#E8E0FA', overflow: 'hidden',
  },
  rankFill: {
    width: '42%', height: '100%',
    backgroundColor: '#7A0EED', borderRadius: 3,
  },
});

const banner = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 16,
    padding: 10,
    gap: 10,
    shadowColor: '#7A0EED',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F0EDF8',
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: { backgroundColor: '#EDE8F7', alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 16, fontWeight: '700', color: '#7A0EED' },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '700', color: '#1C1E22' },
  sub: { fontSize: 11, color: '#ABADB2' },
  rejectBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#FFF5F5', alignItems: 'center', justifyContent: 'center',
  },
  acceptBtn: { borderRadius: 20, overflow: 'hidden' },
  acceptGrad: { paddingHorizontal: 14, paddingVertical: 8 },
  acceptText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});

const modal = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 12, paddingBottom: 36,
    gap: 12, alignItems: 'center',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E0DDED', marginBottom: 8 },
  coHostIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#F4EEFF', alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  title: { fontSize: 20, fontWeight: '800', color: '#1C1E22', letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: '#60626A', textAlign: 'center', lineHeight: 20 },
  minimizeBtn: { width: '100%', borderRadius: 48, overflow: 'hidden', marginTop: 4 },
  btnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14,
  },
  btnLabel: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  exitBtn: {
    width: '100%', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8, paddingVertical: 14,
    borderRadius: 48, backgroundColor: '#FFF5F5',
    borderWidth: 1, borderColor: '#FFE4E4',
  },
  exitLabel: { fontSize: 16, fontWeight: '700', color: '#E14C57' },
  cancelBtn: { paddingVertical: 10 },
  cancelLabel: { fontSize: 15, color: '#ABADB2', fontWeight: '600' },
  coHostNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#F4EEFF', borderRadius: 12, padding: 12, width: '100%',
  },
  coHostNoteText: { flex: 1, fontSize: 13, color: '#7A0EED', lineHeight: 18 },
});
