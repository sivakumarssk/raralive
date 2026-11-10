import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Image,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModalBottomSheet, ModalSafeArea } from '@/components/ModalBottomSheet';
import { useAgoraVoice } from '@/hooks/useAgoraVoice';
import { agoraStore, getAgoraState } from '@/store/agora-store';
import { socketStore, onGiftError, onLiveGift, onUserJoined, onPinnedCommentUpdate, onReportCommentResult, getMyCoinsGifted, onLevelUp, onTaskCompleted, onRewardApplied, onBattleInvite, onBattleInviteAccepted, onBattleInviteDeclined, onBattleInviteCancelled, onJoinBlocked, onKickedFromRoom, formatRestriction, onForcedMute, onReopenBattle, subscribeSocket, getSocketState, getBattleState, getBattleEndsAt, getCachedRoomInfo, primeRoomInfo, type BattleInvitePayload } from '@/store/socket-store';
import { type IncomingSeatRequest, type IncomingStageInvite, useBattleResult, useRoomBattle, useRoomSocket } from '@/hooks/useRoomSocket';
import { BASE_URL, MEDIA_BASE, resolveImageUrl } from '@/services/api';
import { authStore } from '@/store/auth-store';
import { shareRoom } from '@/utils/share';
import { getUserLevel } from '@/utils/userLevel';
import { roomStore } from '@/store/room-store';
import { ChatFeed, messagePreviewText } from './components/chat-feed';
import { WelcomeToast } from './components/welcome-toast';
import { MessageActionSheet, type MessageActionTarget } from './components/message-action-sheet';
import { PinnedMessageBar } from './components/pinned-message-bar';
import { CHILD_SAFETY_REASON, REPORT_GUIDANCE, ReportReasonModal } from './components/report-reason-modal';
import { ChatInputBar } from './components/chat-input-bar';
import { BattleModal } from './components/battle-modal';
import { CoinBoxModal, slabProgressPct, useGiftSlabProgress } from './components/coinbox-modal';
import { DailyTaskModal } from './components/daily-task-modal';
import { GiftShopModal } from './components/gift-shop-modal';
import { GiftFullscreenAnim } from './components/gift-fullscreen-anim';
import { GiftBar, GiftPickerBar, type GiftTarget } from './components/gift-tray';
import { GiftFlyAnimation, type GiftFlyHandle, type SlotPosition } from './components/gift-fly-animation';
import { BANNER_GIFT_CENTER, BANNER_ROW_STEP, GiftComboBanners, type GiftBannersHandle } from './components/gift-combo-banner';
import { BattleBanner, battleBannerOverlayBottom } from './components/battle-banner';
import { BattleOverlay } from './components/battle-result';
import { RoomHeader } from './components/room-header';
import { RoomStage, STAGE_GRADIENT, type HostInfo, type BattleStageInfo } from './components/room-stage';
import { RoomLevelUp, prefetchUpcomingGroupBadges } from './components/room-level-up';
import { UserProfileSheet, type UserProfileSheetTarget } from './components/user-profile-sheet';
import { type ChatMessage, type GiftItem } from './room-detail.data';
import { avatarSource } from '@/utils/default-avatar';

const FLOATING_ACTIONS = [
  { key: 'dailytask', src: require('@/assets/tabs/chatroom/dailyTask.png') },
  { key: 'coinbox',   src: require('@/assets/tabs/chatroom/coinbox.png') },
  { key: 'game',      src: require('@/assets/tabs/chatroom/game.png') },
];

type RoomInfo = {
  room_code: string;
  room_name: string;
  agency_id?: string | null;
  agency_name: string;
  room_image_url: string | null;
  host_user_id: string;
  host_name: string | null;
  host_username: string | null;
  host_avatar_url: string | null;
  current_level: number;
  total_coins_received: number;
  visibility?: 'public' | 'private';
  /** The room's stage background, held for 24h (server-side, same for everyone) */
  stage_bg_url?: string | null;
  /** When the next stage background takes over */
  stage_bg_expires_at?: string | null;
};

type RoomDetailScreenProps = {
  roomId?: string;
  onBack?: () => void;
  openBattle?: boolean;
};

/**
 * Calls fn at `at` (ms). Re-armed in ≤30s steps — RN warns about (and Android
 * may not honour) single long timers. Returns a cancel function.
 */
function runAt(at: number, fn: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const check = () => {
    const left = at - Date.now();
    if (left <= 0) { timer = null; fn(); return; }
    timer = setTimeout(check, Math.min(left, 30_000));
  };
  check();
  return () => { if (timer) clearTimeout(timer); };
}

function formatBattleTime(endsAtMs: number | null): string {
  const secsLeft = endsAtMs ? Math.max(0, Math.floor((endsAtMs - Date.now()) / 1000)) : 0;
  const m = Math.floor(secsLeft / 60);
  const s = secsLeft % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function resolveAvatar(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try { return `${MEDIA_BASE}${new URL(url).pathname}`; }
  catch { return `${MEDIA_BASE}/${url.replace(/^\//, '')}`; }
}

export function RoomDetailScreen({ roomId = '', onBack, openBattle }: RoomDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const { width: screenWidth } = useWindowDimensions();
  const [showDailyTask, setShowDailyTask] = useState(false);
  const [showCoinBox, setShowCoinBox] = useState(false);
  const { data: giftSlab, reload: reloadGiftSlab } = useGiftSlabProgress();
  const [showBattle, setShowBattle] = useState(!!openBattle);
  // Measured height of GiftBar + ChatInputBar — the floating icons sit just
  // above it, since that height varies with screen size / font scale.
  const [bottomBarHeight, setBottomBarHeight] = useState(0);
  const [showNoBattle, setShowNoBattle] = useState(false);
  const [showGiftShop, setShowGiftShop] = useState(false);
  const [giftShopTarget, setGiftShopTarget] = useState<{ userId: string; userName: string } | null>(null);
  const [profileSheetTarget, setProfileSheetTarget] = useState<UserProfileSheetTarget | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(() => getCachedRoomInfo(roomId) as RoomInfo | null);

  useEffect(() => {
    if (roomInfo?.current_level != null) prefetchUpcomingGroupBadges(roomInfo.current_level);
  }, [roomInfo?.current_level]);

  const [showExitModal, setShowExitModal] = useState(false);
  const [seatToast, setSeatToast] = useState<string | null>(null);

  // Battle stage info (VS bar in audio box)
  const [battleStageInfo, setBattleStageInfo] = useState<BattleStageInfo | null>(null);
  const battleStageRef = useRef<BattleStageInfo | null>(null);
  const battleEndsAtRef = useRef<number | null>(null);
  // Coin totals per userId received as gifts in this room
  const [coinsByUserId, setCoinsByUserId] = useState<Map<string, number>>(new Map());
  const seenGiftIds = useRef(new Set<string>());
  // Top gifters (senders) tracking: userId → { name, avatarUri, coins }
  const [giftersByUserId, setGiftersByUserId] = useState<Map<string, { name: string; avatarUri: string; coins: number }>>(new Map());

  // Gift target picker + fly animation (gift bar)
  const [pendingGift, setPendingGift] = useState<GiftItem | null>(null);
  const [showGiftPicker, setShowGiftPicker] = useState(false);
  // Multiple recipients can be selected at once — sending fires one gift
  // event per selected user (see handleGiftSend below).
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [allGifts, setAllGifts] = useState<GiftItem[]>([]);
  const giftFlyRef = useRef<GiftFlyHandle>(null);
  const slotPositions = useRef<Map<string, SlotPosition>>(new Map());
  // Window position of the chat area's top-left — the gift combo banners sit there,
  // and the gift fly animation starts from the banner's gift image.
  const chatAreaRef = useRef<View>(null);
  const chatAreaPos = useRef<SlotPosition | null>(null);

  // Gift shop fullscreen animation
  const [fullscreenGift, setFullscreenGift] = useState<{ imageUrl: string | null; bgColor: string } | null>(null);

  // Room level-up animation
  const [levelUpData, setLevelUpData] = useState<{ level: number } | null>(null);

  // Active reward visuals for this room's host (background + frame, 24h TTL)
  const [rewardBgUrl, setRewardBgUrl] = useState<string | null>(null);
  const [rewardFrameUrl, setRewardFrameUrl] = useState<string | null>(null);
  const [rewardExpiresAt, setRewardExpiresAt] = useState<number | null>(null);

  // The reward lasts 24h from completion. Clearing it brings back the room's
  // own stage background — the same one as before, not a new pick.
  useEffect(() => {
    if (!rewardExpiresAt) return;
    return runAt(rewardExpiresAt, () => {
      setRewardBgUrl(null);
      setRewardFrameUrl(null);
      setRewardExpiresAt(null);
    });
  }, [rewardExpiresAt]);

  // Increments to trigger DailyTaskModal task list refresh
  const [taskRefreshKey, setTaskRefreshKey] = useState(0);

  // Daily task completion congrats overlay
  const [taskCongrats, setTaskCongrats] = useState<{ completedBy: string; taskTitle: string; bgUrl: string | null; frameUrl: string | null } | null>(null);

  // Incoming battle invite popup (host-only)
  const [incomingBattleInvite, setIncomingBattleInvite] = useState<BattleInvitePayload | null>(null);
  const battleInviteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = onLevelUp(level => {
      setLevelUpData({ level });
      setRoomInfo(prev => prev ? { ...prev, current_level: level } : prev);
    });
    return unsub;
  }, []);

  // Real-time reward visuals — applied immediately when host completes task or claims reward
  useEffect(() => {
    const unsub = onRewardApplied(({ reward_bg_url, reward_frame_url, completed_by, task_title, expires_at }) => {
      const bg = reward_bg_url ? `${MEDIA_BASE}/${reward_bg_url.replace(/^\//, '')}` : null;
      const frame = reward_frame_url ? `${MEDIA_BASE}/${reward_frame_url.replace(/^\//, '')}` : null;
      setRewardBgUrl(bg);
      setRewardFrameUrl(frame);
      setRewardExpiresAt(expires_at ? new Date(expires_at).getTime() : null);
      // Refresh task list so lock updates
      setTaskRefreshKey(k => k + 1);
      if (completed_by) {
        setTaskCongrats({ completedBy: completed_by, taskTitle: task_title ?? 'Daily Task', bgUrl: bg, frameUrl: frame });
        setTimeout(() => setTaskCongrats(null), 10000);
      }
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

  // Incoming battle invite — show popup only to host, auto-dismiss after 10s
  const isHostRef = useRef(false);
  useEffect(() => {
    const unsub = onBattleInvite((data) => {
      if (!isHostRef.current) return;
      setIncomingBattleInvite(data);
      if (battleInviteTimerRef.current) clearTimeout(battleInviteTimerRef.current);
      battleInviteTimerRef.current = setTimeout(() => {
        setIncomingBattleInvite(null);
      }, 10000);
    });
    return unsub;
  }, []);

  // Inviter cancelled — dismiss the incoming popup on receiver side
  useEffect(() => {
    const unsub = onBattleInviteCancelled(({ from_room_name }) => {
      setIncomingBattleInvite(null);
      if (battleInviteTimerRef.current) clearTimeout(battleInviteTimerRef.current);
      setSeatToast(`${from_room_name} cancelled the battle invite.`);
      setTimeout(() => setSeatToast(null), 3000);
    });
    return unsub;
  }, []);

  // Battle invite result — accepted or declined (toast for context, main handling in overview screen)
  useEffect(() => {
    const unsubA = onBattleInviteAccepted(({ to_room_name }) => {
      setSeatToast(`${to_room_name} accepted the battle!`);
      setTimeout(() => setSeatToast(null), 3000);
    });
    const unsubD = onBattleInviteDeclined(({ to_room_name }) => {
      setSeatToast(`${to_room_name} declined the battle.`);
      setTimeout(() => setSeatToast(null), 3000);
    });
    return () => { unsubA(); unsubD(); };
  }, []);

  // Battle VS bar — driven by the room socket (battle_state on join,
  // battle_started when one begins), so it shows the instant the battle starts.
  useEffect(() => {
    if (!roomId) return;
    let lastInviteId: string | null | undefined;
    const apply = () => {
      const { battle } = getBattleState();
      const inviteId = battle?.id ?? null;
      if (inviteId === lastInviteId) return;
      lastInviteId = inviteId;
      if (!battle) {
        battleEndsAtRef.current = null;
        setBattleStageInfo(null);
        setCoinsByUserId(new Map());
        setGiftersByUserId(new Map());
        return;
      }

      const isFrom = battle.from_room_id === roomId;
      const endsAtMs = getBattleEndsAt(battle);
      battleEndsAtRef.current = endsAtMs;
      setBattleStageInfo({
        inviteId: battle.id,
        ownRoomName: (isFrom ? battle.from_room_name : battle.to_room_name) ?? '',
        ownRoomImageUrl: (isFrom ? battle.from_room_image_url : battle.to_room_image_url) ?? null,
        rivalRoomName: (isFrom ? battle.to_room_name : battle.from_room_name) ?? '',
        rivalRoomImageUrl: (isFrom ? battle.to_room_image_url : battle.from_room_image_url) ?? null,
        timeDisplay: formatBattleTime(endsAtMs),
        isFinished: false,
        fromRoomId: battle.from_room_id,
        toRoomId: battle.to_room_id,
        fromHostUserId: battle.from_user_id,
        toHostUserId: battle.to_user_id,
        mode: battle.mode,
      });
    };
    apply();
    return subscribeSocket(apply);
  }, [roomId]);

  // Live countdown tick — runs off battleEndsAtRef so timer never resets on re-render
  useEffect(() => {
    const tick = () => {
      const endsAtMs = battleEndsAtRef.current;
      if (!endsAtMs) return;
      const secsLeft = Math.max(0, Math.floor((endsAtMs - Date.now()) / 1000));
      if (secsLeft === 0) {
        battleEndsAtRef.current = null;
        setBattleStageInfo(null);
        setCoinsByUserId(new Map());
        setGiftersByUserId(new Map());
        seenGiftIds.current.clear();
        return;
      }
      setBattleStageInfo(prev => prev ? {
        ...prev,
        timeDisplay: formatBattleTime(endsAtMs),
        isFinished: false,
      } : prev);
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Track gift coins per recipient + per sender from socket messages
  useEffect(() => {
    const unsub = subscribeSocket(() => {
      const { messages } = getSocketState();
      messages.forEach(msg => {
        if (msg.type !== 'gift') return;
        if (seenGiftIds.current.has(msg.id)) return;
        seenGiftIds.current.add(msg.id);
        if (!msg.giftRecipientId || !msg.giftCoins) return;
        const total = (msg.giftCoins ?? 0) * (msg.giftQty ?? 1);
        // Track coins per recipient (for battle bar width)
        setCoinsByUserId(prev => {
          const next = new Map(prev);
          next.set(msg.giftRecipientId!, (next.get(msg.giftRecipientId!) ?? 0) + total);
          return next;
        });
        // Track coins per sender (for top gifters list)
        if (msg.user?.id) {
          setGiftersByUserId(prev => {
            const next = new Map(prev);
            const existing = next.get(msg.user!.id!) ?? { name: msg.user!.name, avatarUri: msg.user!.avatarUri, coins: 0 };
            next.set(msg.user!.id!, { ...existing, coins: existing.coins + total });
            return next;
          });
        }
      });
    });
    return unsub;
  }, []);

  // Live gifts for EVERYONE in the room (sender included). Each SENDER has their
  // own queue: different senders play simultaneously (never wait on each other),
  // while one sender's gifts play in order. Each gift updates its sender's banner,
  // then flies from that banner's gift image to the recipient's seat. The pace
  // follows how fast the sender taps — their next gift launches a short gap after
  // the previous one takes off, without waiting for it to land. When a sender's
  // gifts pile up, the gap and flight time shrink so the animation keeps up.
  //
  // Speed follows the sender's tap rhythm: a gift arriving within
  // GIFT_COMBO_WINDOW_MS of that sender's previous one is continuous tapping
  // and flies fast; a single tap flies at normal speed.
  type QueuedGift = { msg: ChatMessage; quick: boolean };
  type SenderQueue = { items: QueuedGift[]; timer: ReturnType<typeof setTimeout> | null };
  const GIFT_COMBO_WINDOW_MS = 700;
  const giftBannersRef = useRef<GiftBannersHandle>(null);
  const giftQueues = useRef<Map<string, SenderQueue>>(new Map());
  const lastGiftAt = useRef<Map<string, number>>(new Map());
  // Senders waiting for a banner slot (all 3 busy), first come first served
  const giftWaiting = useRef<string[]>([]);

  const playNextGift = useCallback((senderKey: string) => {
    const q = giftQueues.current.get(senderKey);
    if (!q) return;
    const next = q.items.shift();
    if (!next) { giftQueues.current.delete(senderKey); return; }
    const { msg, quick } = next;

    const shown = giftBannersRef.current ? giftBannersRef.current.show(msg) : { isNew: true, row: 0 };
    if (!shown) {
      // All slots busy with other senders: hold this gift (and the rest of this
      // sender's line) until a slot frees up, see handleGiftSlotFree.
      q.items.unshift(next);
      q.timer = null;
      if (!giftWaiting.current.includes(senderKey)) giftWaiting.current.push(senderKey);
      return;
    }
    const { isNew: isNewBox, row } = shown;
    // A new box needs a moment to slide in before the gift flies out of it
    const startDelay = isNewBox ? 250 : 0;
    // Continuous tapping (or a pile-up) → fast; a single tap → normal speed
    const backlog = q.items.length;
    const fast = quick || backlog >= 3;
    const duration = fast ? 280 : backlog >= 1 ? 400 : 500;
    const gap = fast ? 40 : backlog >= 1 ? 70 : 100;
    const targetId = msg.giftForId ?? msg.giftRecipientId;
    giftFlyRef.current?.launch(
      {
        id: `${msg.id}-${Date.now()}`,
        gift: {
          id: msg.giftId ?? '',
          name: msg.giftName ?? '',
          image_url: msg.giftImageUrl ?? null,
          coins: msg.giftCoins ?? 0,
          bg_color: msg.giftBgColor ?? '',
        },
        qty: msg.giftQty ?? 1,
        targetUserId: targetId,
        targetPos: targetId ? slotPositions.current.get(targetId) : undefined,
        origin: chatAreaPos.current
          ? {
              x: chatAreaPos.current.x + BANNER_GIFT_CENTER.x,
              y: chatAreaPos.current.y + BANNER_GIFT_CENTER.y + row * BANNER_ROW_STEP,
            }
          : undefined,
        startDelay,
        duration,
      },
    );
    // This sender's next gift launches right after this one takes off (keeps order)
    q.timer = setTimeout(() => playNextGift(senderKey), startDelay + gap);
  }, []);

  const enqueueGift = useCallback((msg: ChatMessage) => {
    const senderKey = String(msg.user?.id ?? msg.user?.name ?? 'unknown');
    // Within the combo window of this sender's previous gift = tapping continuously
    const now = Date.now();
    const quick = now - (lastGiftAt.current.get(senderKey) ?? 0) < GIFT_COMBO_WINDOW_MS;
    lastGiftAt.current.set(senderKey, now);
    const existing = giftQueues.current.get(senderKey);
    if (existing) { existing.items.push({ msg, quick }); return; }  // already playing — joins the line
    giftQueues.current.set(senderKey, { items: [{ msg, quick }], timer: null });
    playNextGift(senderKey);  // new sender starts immediately, alongside others
  }, [playNextGift]);

  // A banner slot freed up: let the longest-waiting sender in
  const handleGiftSlotFree = useCallback(() => {
    const next = giftWaiting.current.shift();
    if (next) playNextGift(next);
  }, [playNextGift]);

  // "Welcome <name>" toast, bottom-left, for 3s each time someone enters
  const [welcome, setWelcome] = useState<{ key: string; name: string; user: ChatMessage['user'] } | null>(null);
  useEffect(() => onUserJoined(msg => {
    if (msg.user?.name) setWelcome({ key: msg.id, name: msg.user.name, user: msg.user });
  }), []);

  // My own gifts are played instantly on tap (see playMyGift) — skip the server
  // echo of them so they don't animate twice. Everyone else's come from here.
  useEffect(() => {
    const unsub = onLiveGift(msg => {
      if (msg.user?.id && msg.user.id === authStore.getUserId()) return;
      enqueueGift(msg);
    });
    return () => {
      unsub();
      giftQueues.current.forEach(q => { if (q.timer) clearTimeout(q.timer); });
      giftQueues.current.clear();
      giftWaiting.current = [];
    };
  }, [enqueueGift]);

  // Plays the sender's own gift immediately on tap — no waiting for the server
  // round trip (wallet transaction + broadcast), which made rapid taps lag.
  const playMyGift = (gift: GiftItem, qty: number, targetId: string, targetName: string) => {
    const me = authStore.getUser();
    enqueueGift({
      id: `local_${Date.now()}_${Math.random()}`,
      type: 'gift',
      user: {
        id: authStore.getUserId() ?? undefined,
        name: me?.fullName || me?.username || 'You',
        avatarUri: resolveImageUrl(me?.avatarUrl) ?? '',
        level: getUserLevel(getMyCoinsGifted()),
      },
      giftName: gift.name,
      giftTo: targetName,
      giftImageUrl: gift.image_url,
      giftBgColor: gift.bg_color,
      giftCoins: gift.coins,
      giftQty: qty,
      giftId: gift.id,
      giftForId: targetId,
    });
  };

  // Keep ref in sync
  useEffect(() => { battleStageRef.current = battleStageInfo; }, [battleStageInfo]);

  // Fetch all gifts for the inline picker
  useEffect(() => {
    fetch(`${BASE_URL}/gifts/public`)
      .then(r => r.json())
      .then(j => { if (j.success) setAllGifts(j.data); })
      .catch(() => {});
  }, []);

  // Cached coin balance — refreshed every time the screen comes into focus
  const coinBalanceRef = useRef<number>(9999);
  const fetchCoinBalance = useCallback(() => {
    const token = authStore.getToken();
    if (!token) return;
    fetch(`${BASE_URL}/wallet/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => { if (j.success) coinBalanceRef.current = j.data.coins ?? 0; })
      .catch(() => {});
  }, []);
  useFocusEffect(useCallback(() => { fetchCoinBalance(); }, [fetchCoinBalance]));

  useEffect(() => {
    const unsub = onGiftError(() => {
      router.push('/wallet' as any);
    });
    return unsub;
  }, []);

  useEffect(() => {
    // Entry refused / removed: blocked by the host, or a 24h report ban on
    // this ID or room (the server's exact message, plus when access returns)
    const leaveRoom = () => { agoraStore.leave(); socketStore.leave(); roomStore.clear(); onBack?.(); };
    const titleFor = (kind?: string, fallback = 'Blocked') =>
      kind === 'user_ban' ? 'Access Restricted' : kind === 'room_ban' || kind === 'room_deleted' ? 'Chat Room Unavailable' : fallback;
    const unsub1 = onJoinBlocked((message, info) => {
      Alert.alert(titleFor(info.kind), formatRestriction(message || 'You are blocked from this room.', info.expiresAt), [
        { text: 'OK', onPress: leaveRoom },
      ], { cancelable: false });
    });
    const unsub2 = onKickedFromRoom((message, info) => {
      Alert.alert(titleFor(info.kind, 'Removed'), formatRestriction(message || 'You have been removed from this room.', info.expiresAt), [
        { text: 'OK', onPress: leaveRoom },
      ], { cancelable: false });
    });
    const unsub3 = onReopenBattle(() => {
      setShowBattle(true);
    });
    const unsub4 = onForcedMute((isMuted) => {
      // Only act if this actually changes our local state — toggleMute() is a
      // toggle, not a setter, so calling it when already in the target state
      // would flip it the wrong way.
      if (getAgoraState().isMuted !== isMuted) agoraStore.toggleMute();
    });
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, []);

  const {
    messages, onlineCount,
    seats, hostStatus,
    incomingRequest, seatRequestResult,
    sendMessage, sendGift, requestSeat,
    acceptSeatRequest, rejectSeatRequest,
    clearSeatRequestResult, inviteToStage, removeFromStage, leaveStage, hostLeaveStage, hostReturnStage,
    incomingStageInvite, acceptStageInvite, rejectStageInvite, clearStageInvite,
    pinComment, unpinComment, deleteComment, reportComment,
    roomInfo: socketRoomInfo,
  } = useRoomSocket(roomId);

  // Room header data pushed with join_room — usually beats the HTTP fetch below
  useEffect(() => {
    if (socketRoomInfo) setRoomInfo(socketRoomInfo as unknown as RoomInfo);
  }, [socketRoomInfo]);

  const currentUserId = authStore.getUserId() ?? '';
  const isHost = roomInfo ? roomInfo.host_user_id === currentUserId : false;

  // ── Host message actions: Pin (to top) / Delete / Block / Report ──
  const [pinnedMessageId, setPinnedMessageId] = useState<string | null>(null);
  const [msgTarget, setMsgTarget] = useState<MessageActionTarget | null>(null);
  const [reportTarget, setReportTarget] = useState<MessageActionTarget | null>(null);
  useEffect(() => onPinnedCommentUpdate(id => setPinnedMessageId(id)), []);
  const pinnedMessage = pinnedMessageId ? messages.find(m => m.id === pinnedMessageId) ?? null : null;
  // y offset of each chat message inside the feed — lets the pinned bar jump to it
  const messageY = useRef(new Map<string, number>());
  const scrollToPinned = () => {
    if (!pinnedMessageId) return;
    const y = messageY.current.get(pinnedMessageId);
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
  };

  const showRoomToast = (text: string) => {
    setSeatToast(text);
    setTimeout(() => setSeatToast(null), 2000);
  };

  const handleMessagePress = (msg: ChatMessage) => {
    if (!msg.user || !msg.id) return;
    const isOwn = !!msg.user.id && msg.user.id === currentUserId;
    // Non-hosts only get "Report" — nothing to offer on their own message
    if (!isHost && isOwn) return;
    setMsgTarget({
      messageId: msg.id,
      userId: msg.user.id,
      userName: msg.user.name,
      avatarUri: msg.user.avatarUri,
      text: messagePreviewText(msg),
      isPinned: msg.id === pinnedMessageId,
      isOwn,
    });
  };

  const handleMessageAction = async (action: 'pin' | 'delete' | 'block' | 'report', t: MessageActionTarget) => {
    switch (action) {
      case 'pin':
        if (t.isPinned) unpinComment(); else pinComment(t.messageId);
        showRoomToast(t.isPinned ? 'Message unpinned' : 'Message pinned');
        break;
      case 'delete':
        deleteComment(t.messageId);
        showRoomToast('Message deleted');
        break;
      case 'report':
        setReportTarget(t);
        break;
      case 'block': {
        if (!t.userId) return;
        const token = authStore.getToken();
        try {
          const res = await fetch(`${BASE_URL}/rooms/${roomId}/block`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify({ userId: t.userId }),
          });
          const json = await res.json();
          showRoomToast(json.success ? `${t.userName} blocked` : (json.message || 'Could not block user'));
        } catch {
          showRoomToast('Could not block user');
        }
        break;
      }
    }
  };

  // Report goes over the socket; resolve when the server confirms (or time out)
  const submitMessageReport = (reason: string) => new Promise<string | null>(resolve => {
    if (!reportTarget) { resolve('Something went wrong.'); return; }
    let done = false;
    const unsub = onReportCommentResult((ok, info) => {
      if (done) return;
      done = true; unsub(); clearTimeout(timer);
      if (ok && info.duplicate) resolve('You have already reported this message.');
      else resolve(ok ? null : (info.message || 'Could not send. Please try again.'));
    });
    const timer = setTimeout(() => {
      if (done) return;
      done = true; unsub();
      resolve('No response. Please try again.');
    }, 8000);
    reportComment(reportTarget.messageId, reportTarget.text, reportTarget.userId, reason);
  });
  isHostRef.current = isHost;
  // Which slot (1–7) does the current user occupy? null if not on stage
  const mySlotIndex = seats.find(s => s.slotIndex !== 0 && s.userId === currentUserId)?.slotIndex ?? null;
  const iAmOnStage = mySlotIndex !== null;

  // Agora voice — join channel only when on stage (or host, unless they've
  // left the stage; they stay in the room and its chat)
  const hostOffStage = isHost && !!hostStatus.offStage;
  const isOnStage = iAmOnStage || (isHost && !hostOffStage);
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

  // Fetch room info (initial load + manual "Refresh Room" from the header menu)
  const fetchRoomInfo = useCallback(() => {
    if (!roomId) return;
    const token = authStore.getToken();
    fetch(`${BASE_URL}/rooms/${roomId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(json => {
        if (!json.success) return;
        primeRoomInfo(json.data);
        setRoomInfo(json.data);
      })
      .catch(() => {});
  }, [roomId]);

  // Admin-uploaded stage background behind the status bar, header and seats.
  // The server holds one per room for 24h (same for every viewer), so it stays
  // the same on reopen / minimise / navigating back; it arrives with the room
  // info (cached from the last visit, so it shows straight away).
  const stageBgUrl = roomInfo?.stage_bg_url ? resolveAvatar(roomInfo.stage_bg_url) ?? null : null;
  const stageBgExpiresAt = roomInfo?.stage_bg_expires_at ? new Date(roomInfo.stage_bg_expires_at).getTime() : null;
  // Its 24h ran out while the room is open → the server gives the next one
  useEffect(() => {
    if (!stageBgExpiresAt) return;
    return runAt(stageBgExpiresAt + 1000, fetchRoomInfo);
  }, [stageBgExpiresAt, fetchRoomInfo]);

  // "Refresh Room" (header ⋮ menu): room info + live seats / host status / chat
  const handleRefreshRoom = () => {
    fetchRoomInfo();
    socketStore.refreshRoom(roomId);
    setSeatToast('Room refreshed');
    setTimeout(() => setSeatToast(null), 2000);
  };

  // Re-fetch whenever this screen regains focus — picks up a chatroom name
  // change made on the Edit Chatroom Name screen (no other way to get that
  // update back across a navigation boundary) as well as any lazy expiry
  // revert the server applied while we were away.
  useFocusEffect(useCallback(() => { fetchRoomInfo(); }, [fetchRoomInfo]));

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
          setRewardExpiresAt(json.data.expires_at ? new Date(json.data.expires_at).getTime() : null);
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

  const handleBattlePress = () => {
    if (battleStageInfo?.inviteId) {
      // Battle ongoing — both profiles + Cancel Battle
      setShowBattleStatus(true);
    } else if (isHost) {
      // Host, no battle — open invite modal
      setShowBattle(true);
    } else {
      // Non-host, no battle
      setShowNoBattle(true);
    }
  };

  // ── Running battle: status sheet (Battle icon) + result after it ends ──
  const liveBattle = useRoomBattle();
  // Gifting battles have no raised bridge — the banner sits a little differently
  const bannerShowsBridge = liveBattle.battle?.mode !== 'gifting';
  const battleResult = useBattleResult();
  const [showBattleStatus, setShowBattleStatus] = useState(false);
  const [cancellingBattle, setCancellingBattle] = useState(false);
  // The battle is over: forget the status sheet, so it doesn't pop up again
  // by itself when the next battle starts
  useEffect(() => {
    if (!liveBattle.battle) setShowBattleStatus(false);
  }, [liveBattle.battle]);

  const handleCancelBattle = async () => {
    setCancellingBattle(true);
    // Closes the battle and shows the result at once; the server confirms it
    const res = await socketStore.cancelBattle();
    setCancellingBattle(false);
    setShowBattleStatus(false);
    if (!res.ok) showRoomToast(res.message ?? 'Could not cancel the battle.');
  };

  const battleStatus = (() => {
    const b = liveBattle.battle;
    if (!showBattleStatus || !b) return null;
    const ownIsFrom = b.from_room_id === roomId;
    const scores = liveBattle.scores;
    const sideScore = (from: boolean) => (scores ? (from ? scores.left : scores.right) : 0);
    return {
      own: {
        name: ownIsFrom ? b.from_room_name : b.to_room_name,
        imageUrl: ownIsFrom ? b.from_room_image_url : b.to_room_image_url,
        score: sideScore(ownIsFrom),
      },
      rival: {
        name: ownIsFrom ? b.to_room_name : b.from_room_name,
        imageUrl: ownIsFrom ? b.to_room_image_url : b.from_room_image_url,
        score: sideScore(!ownIsFrom),
      },
      timeDisplay: battleStageInfo?.timeDisplay,
      // Either host in the battle can end it
      canCancel: currentUserId === b.from_user_id || currentUserId === b.to_user_id,
      cancelling: cancellingBattle,
      onCancel: handleCancelBattle,
    };
  })();

  // Build gift targets: host first (only if online), then on-stage seats
  const giftTargets: GiftTarget[] = [
    ...(hostInfo.isOnline ? [{
      userId: roomInfo?.host_user_id ?? '',
      name: hostInfo.name,
      avatarUrl: roomInfo?.host_avatar_url ?? null,
      isHost: true,
    }] : []),
    ...seats
      .filter(s => s.slotIndex !== 0 && s.userId !== roomInfo?.host_user_id)
      .map(s => ({ userId: s.userId, name: s.userName, avatarUrl: s.avatarUrl, isHost: false })),
  ].filter(t => t.userId);

  const handleGiftPress = (gift: GiftItem) => {
    setPendingGift(gift);
    // Pre-select first available target (host if online, otherwise first on-stage user)
    const firstTarget = giftTargets[0]?.userId;
    setSelectedTargetIds(firstTarget ? [firstTarget] : []);
    setShowGiftPicker(true);
  };

  const handleToggleGiftTarget = (userId: string) => {
    setSelectedTargetIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleGiftSend = (qty: number = 1) => {
    if (!pendingGift || selectedTargetIds.length === 0) return;
    const totalCost = pendingGift.coins * qty * selectedTargetIds.length;

    // Check balance against the FULL batch before sending anything — no
    // partial sends, no animation if the combined cost is insufficient.
    if (coinBalanceRef.current < totalCost) {
      setShowGiftPicker(false);
      router.push('/wallet' as any);
      return;
    }

    const hostUserId = roomInfo?.host_user_id ?? selectedTargetIds[0];

    selectedTargetIds.forEach(targetId => {
      const target = giftTargets.find(t => t.userId === targetId);
      // Encode all data the socket needs for wallet debit + gift event
      // recipientid = host (for wallet/gems), giftfor = actual target (for stage display)
      // sendGift adds it to the battle score immediately (confirmed by the server)
      sendGift(
        `__gift__🎁__to__${target?.name ?? 'someone'}__img__${pendingGift.image_url ?? ''}__bg__${pendingGift.bg_color}` +
        `__giftid__${pendingGift.id}__coins__${pendingGift.coins}__qty__${qty}` +
        `__senderid__${currentUserId}__recipientid__${hostUserId}__giftfor__${targetId}`,
        pendingGift.coins * qty,
      );
      playMyGift(pendingGift, qty, targetId, target?.name ?? 'someone');
    });

    // Optimistically deduct the full batch cost from local balance
    coinBalanceRef.current = Math.max(0, coinBalanceRef.current - totalCost);
  };

  // Link opens this room in the app (code when known, else the room id)
  const handleShare = () => {
    shareRoom({ idOrCode: roomInfo?.room_code ?? roomId, name: roomInfo?.room_name ?? 'Chat Room' });
  };

  const handleAvatarPress = (
    userId: string, userName: string, avatarUrl: string | null, isRoomHost: boolean, slotIndex?: number
  ) => {
    setProfileSheetTarget({ userId, userName, avatarUrl, isRoomHost, slotIndex });
  };

  // Profile popup for someone in chat or the welcome toast — same popup as
  // tapping an avatar on the stage.
  const openUserProfile = (userId: string, user?: ChatMessage['user']) => {
    if (!userId) return;
    const seat = seats.find(s => s.userId === userId);
    handleAvatarPress(
      userId,
      user?.name ?? 'User',
      user?.avatarUri || null,
      userId === roomInfo?.host_user_id,
      seat?.slotIndex,
    );
  };

  const handleSendGiftFromProfile = (userId: string, userName: string) => {
    setGiftShopTarget({ userId, userName });
    setShowGiftShop(true);
  };

  const handleBlockUser = async (userId: string) => {
    const token = authStore.getToken();
    if (!token) return;
    await fetch(`${BASE_URL}/rooms/${roomId}/block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId }),
    });
  };

  const handleAddToStageFromProfile = (userId: string) => {
    const usedSlots = new Set(seats.filter(s => s.slotIndex !== 0).map(s => s.slotIndex));
    const nextSlot = [1, 2, 3, 4, 5, 6, 7].find(i => !usedSlots.has(i)) ?? 1;
    inviteToStage(userId, nextSlot);
  };

  const handleToggleTargetMuteFromProfile = (userId: string, mute: boolean) => {
    socketStore.forceMuteUser(userId, mute);
  };

  const handleOpponentRoomPress = (opponentRoomId: string) => {
    // Leaving this room's audio stage before navigating away — the user
    // can't hold a seat in two rooms' stages at once.
    const iAmOnStage = seats.some(s => s.userId === currentUserId && s.slotIndex !== 0);
    if (iAmOnStage) leaveStage();
    router.push(`/room/${opponentRoomId}` as any);
  };

  // This room is on screen now — no minimized-room JOIN bubble on top of it
  // (also covers opening another room while one was minimized: its socket
  // replaces the minimized one).
  useEffect(() => { roomStore.clear(); }, [roomId]);

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

  // Exit leaves the room socket only once this screen has unmounted (after the
  // back transition) — leaving straight away emptied the chat, seats and
  // battle while the screen was still sliding out, which read as a flicker.
  const leaveOnUnmountRef = useRef(false);
  useEffect(() => () => {
    if (leaveOnUnmountRef.current && getSocketState().roomId === roomId) socketStore.leave();
  }, [roomId]);

  const handleExit = () => {
    setShowExitModal(false);
    agoraStore.leave();
    roomStore.clear();
    leaveOnUnmountRef.current = true;
    onBack?.();
  };

  // The full-screen reward background (daily task) takes priority over it
  // stage_bg_url is undefined until the server has answered (null = no images
  // uploaded). Only then may the default stage show — while waiting, or while
  // the image downloads, a dark backing shows so it never flashes.
  const stagePending = roomInfo?.stage_bg_url === undefined;
  const hasTopBg = !rewardBgUrl && (!!stageBgUrl || stagePending);

  // Header + seat stage, drawn over the stage background when there is one
  const topSection = (
    <>
      <RoomHeader
        name={roomInfo?.room_name ?? 'Loading...'}
        agencyName={roomInfo?.agency_name}
        agencyId={roomInfo?.agency_id}
        memberCount={onlineCount}
        level={roomInfo?.current_level ?? 0}
        roomId={roomId}
        roomCode={roomInfo?.room_code}
        totalCoins={roomInfo?.total_coins_received ?? 0}
        hostName={roomInfo?.host_name || roomInfo?.host_username}
        visibility={roomInfo?.visibility}
        hasRoomBg={!!rewardBgUrl || hasTopBg}
        transparentBg={!rewardBgUrl}
        onBack={handleBackPress}
        onShare={handleShare}
        onMore={() => {}}
        isHost={isHost}
        seats={seats}
        onInviteToStage={(userId, slotIndex) => inviteToStage(userId, slotIndex)}
        onRefreshRoom={handleRefreshRoom}
      />

      <View style={styles.stageWrap}>
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
          hasRoomBg={!!rewardBgUrl || hasTopBg}
          transparentBg={!rewardBgUrl}
          rewardFrameUrl={rewardFrameUrl}
          onAvatarPress={handleAvatarPress}
        />

        {/* Battle banner overlays the bottom of the stage, on top of the seat grid.
            Placed from the banner's own geometry, so the stage's bottom edge meets
            it at the same point on every screen size: the bridge top (normal), or
            inside the flat middle strip (gifting — nothing shows through). */}
        <View style={[styles.battleOverlay, { bottom: battleBannerOverlayBottom(screenWidth, bannerShowsBridge) }]} pointerEvents="box-none">
          <BattleBanner
            roomId={roomId}
            coinsByUserId={coinsByUserId}
            giftersByUserId={giftersByUserId}
            onOpponentRoomPress={handleOpponentRoomPress}
          />
        </View>
      </View>
    </>
  );

  const screenContent = (
    <>
      {/* Same wrapper whichever background is showing — the stage image and
          reward background load after the room opens, and swapping the
          wrapper type then remounted the header + stage (a visible flash). */}
      <View style={{ paddingTop: insets.top }}>
        {!rewardBgUrl && !hasTopBg && (
          // Default stage — only when the admin has uploaded no images. Its
          // gradient runs up behind header + status bar
          <LinearGradient colors={STAGE_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        )}
        {hasTopBg && (
          <>
            <View style={[StyleSheet.absoluteFill, styles.topBgBacking]} />
            {!!stageBgUrl && <ExpoImage source={{ uri: stageBgUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />}
            <View style={styles.topBgShade} pointerEvents="none" />
          </>
        )}
        {topSection}
      </View>

      {/* Chat area — scroll only, no floating icons here */}
      <View
        ref={chatAreaRef}
        onLayout={() => chatAreaRef.current?.measureInWindow((x, y) => { chatAreaPos.current = { x, y }; })}
        style={[styles.chatArea, rewardBgUrl && { backgroundColor: 'transparent' }]}>
        {pinnedMessage && (
          <PinnedMessageBar
            message={pinnedMessage}
            canUnpin={isHost}
            onPress={scrollToPinned}
            onUnpin={() => { unpinComment(); showRoomToast('Message unpinned'); }}
          />
        )}

        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <ChatFeed
            messages={messages}
            hasRoomBg={!!rewardBgUrl}
            // Keep messages clear of the floating icon column (right: 8 + 44 wide + gap)
            rightInset={FLOATING_COL_INSET}
            pinnedMessageId={pinnedMessageId}
            // Tap a message → host: Pin / Delete / Block / Report; others: Report
            onCommentPress={handleMessagePress}
            tapToAct
            onMessageLayout={(id, y) => { messageY.current.set(id, y); }}
            onAvatarPress={openUserProfile}
          />
        </ScrollView>

        {/* Live gift combo banners — float over the top of the chat, just under the stage */}
        <GiftComboBanners ref={giftBannersRef} myUserId={currentUserId} onSlotFree={handleGiftSlotFree} />

        {welcome && (
          <WelcomeToast
            key={welcome.key}
            name={welcome.name}
            hostAvatarUri={hostInfo.avatarUri}
            hostName={hostInfo.name}
            onPress={welcome.user?.id ? () => openUserProfile(welcome.user!.id!, welcome.user) : undefined}
            onDone={() => setWelcome(w => (w?.key === welcome.key ? null : w))}
          />
        )}

        {/* Toast inside chat area */}
        {seatToast && (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{seatToast}</Text>
          </View>
        )}
      </View>

      {/* On Android, windowSoftInputMode adjustResize already shrinks the
          screen by the keyboard's height, so the input bar naturally lands
          just above it — adding marginBottom: keyboardHeight on top of that
          double-compensates and leaves a keyboard-height gap. iOS doesn't
          resize the root view for the keyboard (no KeyboardAvoidingView on
          this screen), so it still needs the manual push there. */}
      <View
        style={{ marginBottom: Platform.OS === 'ios' ? keyboardHeight : 0 }}
        onLayout={e => { if (!keyboardVisible) setBottomBarHeight(e.nativeEvent.layout.height); }}>
        {!keyboardVisible && (
          <GiftBar onGiftPress={handleGiftPress} hasRoomBg={!!rewardBgUrl} />
        )}
        <ChatInputBar
          onSend={handleSend}
          onGiftOpen={() => setShowGiftShop(true)}
          onBattlePress={handleBattlePress}
          // Placeholder until the bag (inventory) screen exists
          onBagPress={() => Alert.alert('Bag', 'Coming soon.')}
          hasRoomBg={!!rewardBgUrl}
          showBattle={isHost && roomInfo?.visibility !== 'private'}
        />
      </View>

      {/* Seat request banner — absolute so it always floats above floating icons */}
      {isHost && incomingRequest && (
        <View style={banner.floatingWrap}>
          <SeatRequestBanner
            request={incomingRequest}
            onAccept={() => acceptSeatRequest(incomingRequest)}
            onReject={() => rejectSeatRequest(incomingRequest)}
          />
        </View>
      )}

      {/* Stage invite banner — shown to the invited user (non-host) */}
      {!isHost && incomingStageInvite && (
        <View style={banner.floatingWrap}>
          <StageInviteBanner
            invite={incomingStageInvite}
            onAccept={() => acceptStageInvite(incomingStageInvite.slotIndex, incomingStageInvite.hostSocketId)}
            onReject={() => rejectStageInvite(incomingStageInvite.hostSocketId)}
          />
        </View>
      )}

      {/* Floating action icons — anchored to root, hidden while the keyboard is
          up. floatingBar's `bottom` is measured against this View's positioned
          ancestor, whose height Android shrinks under the keyboard
          (windowSoftInputMode adjustResize) — a fixed `bottom` would then sit
          at the wrong spot (and once the keyboard is taller than that offset,
          overlap the input bar). Simplest correct fix: don't render the
          shortcuts while typing, same as GiftBar already does. */}
      {!keyboardVisible && (
        <View
          style={[styles.floatingBar, bottomBarHeight > 0 && { bottom: insets.bottom + bottomBarHeight + 8 }]}
          pointerEvents="box-none">
          {FLOATING_ACTIONS.map((item) => (
            <View key={item.key} style={styles.floatingItem}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.floatingBtn}
                onPress={
                  item.key === 'dailytask' ? () => setShowDailyTask(true) :
                  item.key === 'coinbox'   ? () => { reloadGiftSlab(); setShowCoinBox(true); } : undefined
                }>
                <ExpoImage source={item.src} style={styles.floatingImg} contentFit="contain" />
              </TouchableOpacity>
              {item.key === 'coinbox' && (
                <View style={styles.rankTrack}>
                  <View style={[styles.rankFill, { width: `${slabProgressPct(giftSlab)}%` }]} />
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      <MessageActionSheet
        target={msgTarget}
        isHost={isHost}
        onClose={() => setMsgTarget(null)}
        onAction={handleMessageAction}
      />
      <ReportReasonModal
        visible={!!reportTarget}
        title="Report Message"
        subtitle={reportTarget ? `Why are you reporting ${reportTarget.userName}'s message?` : undefined}
        notice={REPORT_GUIDANCE}
        reasons={[CHILD_SAFETY_REASON, 'Abuse or hate speech', 'Sexual content', 'Spam or scam', 'Sharing private information', 'Something else']}
        onClose={() => setReportTarget(null)}
        onSubmit={submitMessageReport}
      />

      <DailyTaskModal visible={showDailyTask} onClose={() => setShowDailyTask(false)} roomId={roomId} refreshKey={taskRefreshKey} />
      <CoinBoxModal visible={showCoinBox} onClose={() => setShowCoinBox(false)} data={giftSlab} />

      {/* No battle modal — non-host when no active battle */}
      <Modal visible={showNoBattle} transparent animationType="fade" onRequestClose={() => setShowNoBattle(false)}>
        <TouchableOpacity style={modal.overlay} activeOpacity={1} onPress={() => setShowNoBattle(false)} />
        <View style={modal.sheet}>
          <View style={modal.handle} />
          <Text style={{ fontSize: 28, marginBottom: 4 }}>⚔️</Text>
          <Text style={modal.title}>No Battle Right Now</Text>
          <Text style={modal.subtitle}>There is no active battle in this room at the moment.</Text>
          <TouchableOpacity onPress={() => setShowNoBattle(false)} style={modal.cancelBtn}>
            <Text style={modal.exitLabel}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
      <BattleOverlay
        status={battleStatus}
        result={battleResult}
        roomId={roomId}
        myUserId={currentUserId}
        onCloseStatus={() => setShowBattleStatus(false)}
        onCloseResult={() => {
          setShowBattleStatus(false);
          socketStore.dismissBattleResult();
        }}
      />

      <BattleModal
        visible={showBattle}
        onClose={() => setShowBattle(false)}
        roomId={roomId}
        roomImageUrl={roomInfo?.room_image_url ?? null}
      />
      <GiftShopModal
        visible={showGiftShop}
        onClose={() => { setShowGiftShop(false); setGiftShopTarget(null); }}
        seats={seats}
        hostInfo={{
          userId: roomInfo?.host_user_id ?? '',
          name: hostInfo.name,
          avatarUrl: roomInfo?.host_avatar_url ?? null,
        }}
        isHostOnline={hostInfo.isOnline}
        initialTargetUserId={giftShopTarget?.userId}
        initialTargetName={giftShopTarget?.userName}
        onSendGift={(gift, qty, targets) => {
          if (targets.length === 0) return;
          const totalCost = gift.coins * qty * targets.length;

          // Check balance against the FULL batch before sending anything —
          // no partial sends, navigate to wallet if the combined cost is
          // insufficient (same rule as the gift bar's multi-select send).
          if (coinBalanceRef.current < totalCost) {
            router.push('/wallet' as any);
            return;
          }

          // Same gift already showing → keep the same state object, so repeat
          // taps don't re-render the whole room (that slowed the flying gifts)
          setFullscreenGift(prev => (prev && prev.imageUrl === gift.image_url && prev.bgColor === gift.bg_color
            ? prev
            : { imageUrl: gift.image_url, bgColor: gift.bg_color }));
          const hostUserId = roomInfo?.host_user_id ?? '';

          targets.forEach(({ userId: targetUserId, name: targetName }) => {
            const giftTargetId = targetUserId || hostUserId;
            sendGift(
              `__gift__🎁__to__${targetName}__img__${gift.image_url ?? ''}__bg__${gift.bg_color}` +
              `__giftid__${gift.id}__coins__${gift.coins}__qty__${qty}` +
              `__senderid__${currentUserId}__recipientid__${hostUserId}__giftfor__${giftTargetId}`,
              gift.coins * qty,
            );
            playMyGift(gift, qty, giftTargetId, targetName);
          });

          coinBalanceRef.current = Math.max(0, coinBalanceRef.current - totalCost);
        }}
      />

      <GiftFullscreenAnim
        visible={!!fullscreenGift}
        imageUrl={fullscreenGift?.imageUrl ?? null}
        bgColor={fullscreenGift?.bgColor}
        onDone={() => setFullscreenGift(null)}
      />

      <UserProfileSheet
        visible={!!profileSheetTarget}
        onClose={() => setProfileSheetTarget(null)}
        roomId={roomId}
        target={profileSheetTarget}
        canManage={isHost || seats.some(s => s.userId === currentUserId && s.slotIndex !== 0)}
        targetIsMuted={profileSheetTarget ? seats.find(s => s.userId === profileSheetTarget.userId)?.isMuted : undefined}
        onSendGift={handleSendGiftFromProfile}
        onBlock={handleBlockUser}
        onRemoveFromStage={removeFromStage}
        onAddToStage={handleAddToStageFromProfile}
        onToggleTargetMute={handleToggleTargetMuteFromProfile}
        selfIsMuted={isMuted}
        selfOnStage={isOnStage}
        canExitStage={isHost ? !hostOffStage : iAmOnStage}
        onToggleSelfMute={toggleMute}
        onExitStage={isHost ? hostLeaveStage : leaveStage}
        onReturnToStage={hostOffStage ? hostReturnStage : undefined}
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
        selectedTargetIds={selectedTargetIds}
        onToggleTarget={handleToggleGiftTarget}
        onGiftChange={setPendingGift}
        onSend={handleGiftSend}
        onClose={() => setShowGiftPicker(false)}
      />

      <GiftFlyAnimation ref={giftFlyRef} />

      {/* Daily task congrats overlay — shown to all users for 10s */}
      {taskCongrats && (
        <TouchableOpacity
          style={congratsStyles.overlay}
          activeOpacity={1}
          onPress={() => setTaskCongrats(null)}>
          <View style={congratsStyles.card}>
            <Text style={congratsStyles.emoji}>🎉</Text>
            <Text style={congratsStyles.title}>Congratulations!</Text>
            <Text style={congratsStyles.sub}>Daily task is completed</Text>

            {/* Reward cards */}
            <View style={congratsStyles.rewardRow}>
              {taskCongrats.bgUrl && (
                <View style={congratsStyles.rewardCard}>
                  <Image source={{ uri: taskCongrats.bgUrl }} style={congratsStyles.rewardCardImg} resizeMode="cover" />
                  <View style={congratsStyles.rewardCardTag}>
                    <Text style={congratsStyles.rewardCardTagText}>1d</Text>
                  </View>
                </View>
              )}
              {taskCongrats.frameUrl && (
                <View style={congratsStyles.rewardCard}>
                  <Image source={{ uri: taskCongrats.frameUrl }} style={congratsStyles.rewardCardImg} resizeMode="cover" />
                  <View style={congratsStyles.rewardCardTag}>
                    <Text style={congratsStyles.rewardCardTagText}>1d</Text>
                  </View>
                </View>
              )}
            </View>

            <Text style={congratsStyles.hint}>Rewards applied! Tap to dismiss</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Incoming battle invite popup — host only, auto-dismisses after 10s, anchored to bottom */}
      {incomingBattleInvite && (
        <View style={battleInvitePopup.overlay} pointerEvents="box-none">
          <View style={battleInvitePopup.card}>
            <Text style={battleInvitePopup.title}>⚔️ Battle Challenge!</Text>
            <View style={battleInvitePopup.roomRow}>
              {incomingBattleInvite.from_room_image_url ? (
                <Image
                  source={{ uri: incomingBattleInvite.from_room_image_url.startsWith('http')
                    ? incomingBattleInvite.from_room_image_url
                    : `${MEDIA_BASE}/${incomingBattleInvite.from_room_image_url.replace(/^\//, '')}` }}
                  style={battleInvitePopup.avatar}
                />
              ) : (
                <View style={[battleInvitePopup.avatar, battleInvitePopup.avatarFallback]}>
                  <Text style={battleInvitePopup.avatarInitial}>
                    {incomingBattleInvite.from_room_name[0]?.toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={battleInvitePopup.roomName} numberOfLines={2}>
                {incomingBattleInvite.from_room_name}
              </Text>
            </View>
            <Text style={battleInvitePopup.sub}>
              {incomingBattleInvite.duration_minutes} min battle • Tap to accept or decline
            </Text>
            <View style={battleInvitePopup.btnRow}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={[battleInvitePopup.btn, battleInvitePopup.declineBtn]}
                onPress={async () => {
                  const id = incomingBattleInvite.invite_id;
                  setIncomingBattleInvite(null);
                  if (battleInviteTimerRef.current) clearTimeout(battleInviteTimerRef.current);
                  try {
                    const token = authStore.getToken();
                    await fetch(`${BASE_URL}/battle/decline`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                      body: JSON.stringify({ invite_id: id }),
                    });
                  } catch {}
                }}>
                <Text style={battleInvitePopup.declineBtnText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                style={[battleInvitePopup.btn, battleInvitePopup.acceptBtn]}
                onPress={async () => {
                  const id = incomingBattleInvite.invite_id;
                  setIncomingBattleInvite(null);
                  if (battleInviteTimerRef.current) clearTimeout(battleInviteTimerRef.current);
                  try {
                    const token = authStore.getToken();
                    const r = await fetch(`${BASE_URL}/battle/accept`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                      body: JSON.stringify({ invite_id: id }),
                    });
                    const json = await r.json();
                    if (json.success) {
                      setSeatToast('Battle accepted!');
                    } else {
                      setSeatToast(json.message || 'Battle was cancelled.');
                    }
                    setTimeout(() => setSeatToast(null), 3000);
                  } catch {}
                }}>
                <Text style={battleInvitePopup.acceptBtnText}>Accept</Text>
              </TouchableOpacity>
            </View>
            <View style={battleInvitePopup.handle} />
          </View>
        </View>
      )}


      {/* Exit / Minimize modal */}
      {/* Translucent bars → the modal always draws behind the Android nav bar.
          Its bottom padding comes from insets measured inside the modal's own
          window (ModalSafeArea), so it clears a 3-button nav bar and adds no
          strip on devices without one. */}
      <Modal
        visible={showExitModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setShowExitModal(false)}>
        <ModalSafeArea>
        <TouchableOpacity style={modal.overlay} activeOpacity={1} onPress={() => setShowExitModal(false)} />
        <ModalBottomSheet style={modal.exitSheet}>
          <View style={modal.exitHandle} />
          <Text style={modal.exitTitle}>Exit Chat?</Text>
          <Text style={modal.exitSubtitle}>
            Users can enter chatroom and interact with others in your absence
          </Text>

          <View style={modal.exitActionRow}>
            <TouchableOpacity onPress={handleMinimize} activeOpacity={0.7} style={modal.exitActionBtn}>
              <Text style={modal.minimiseLabel}>Minimise</Text>
            </TouchableOpacity>

            <View style={modal.exitActionDivider} />

            <TouchableOpacity
              onPress={handleExit}
              activeOpacity={0.7}
              style={modal.exitActionBtn}>
              <Text style={modal.exitActionLabel}>Exit</Text>
            </TouchableOpacity>
          </View>
        </ModalBottomSheet>
        </ModalSafeArea>
      </Modal>

    </>
  );

  return (
    <>
      {/* Top background (image or stage gradient) runs under the status bar.
          The bar is translucent app-wide (app/_layout.tsx), so this only
          changes the icon colour — no layout jump on open/back. */}
      <StatusBar style={hasTopBg ? 'light' : 'dark'} backgroundColor="transparent" translucent />
      <View style={[styles.root, rewardBgUrl ? null : styles.defaultBg, { paddingBottom: insets.bottom }]}>
        {!!rewardBgUrl && (
          <ExpoImage source={{ uri: rewardBgUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        )}
        <View style={[styles.flex, rewardBgUrl ? styles.bgOverlay : null]}>
          {screenContent}
        </View>
      </View>
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
      <Image source={avatarSource(uri)} style={banner.avatar} />
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

function StageInviteBanner({ invite, onAccept, onReject }: {
  invite: IncomingStageInvite;
  onAccept: () => void;
  onReject: () => void;
}) {
  const uri = resolveAvatar(invite.hostAvatarUrl);
  return (
    <View style={banner.container}>
      <Image source={avatarSource(uri)} style={banner.avatar} />
      <View style={banner.info}>
        <Text style={banner.name} numberOfLines={1}>{invite.hostName}</Text>
        <Text style={banner.sub}>invited you to the stage</Text>
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

const congratsStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 998,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#7A0EED',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
  },
  emoji: { fontSize: 32, marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '900', color: '#1C1E22', marginBottom: 4 },
  sub: { fontSize: 14, color: '#60626A', textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  name: { fontWeight: '800', color: '#7A0EED' },
  rewardRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  rewardCard: {
    width: 72, height: 72, borderRadius: 14, overflow: 'hidden',
    backgroundColor: '#E0DDED', position: 'relative',
    borderWidth: 2, borderColor: '#C4B8E8',
  },
  rewardCardImg: { width: '100%', height: '100%' },
  rewardCardTag: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  rewardCardTagText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
  hint: { fontSize: 11, color: '#ABADB2', fontWeight: '500' },
});

const battleInvitePopup = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    zIndex: 999,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    alignItems: 'center',
    width: '88%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 20,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E0DDED', marginTop: 16,
  },
  title: {
    fontSize: 16, fontWeight: '800', color: '#1C1E22', marginBottom: 16,
  },
  roomRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8, width: '100%',
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
  },
  avatarFallback: {
    backgroundColor: '#EDE8F7', alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 18, fontWeight: '800', color: '#7A0EED',
  },
  roomName: {
    flex: 1, fontSize: 14, fontWeight: '700', color: '#1C1E22',
  },
  sub: {
    fontSize: 13, color: '#ABADB2', fontWeight: '500', marginBottom: 20,
  },
  btnRow: {
    flexDirection: 'row', gap: 12, width: '100%',
  },
  btn: {
    flex: 1, paddingVertical: 11, borderRadius: 14, alignItems: 'center',
  },
  declineBtn: {
    backgroundColor: '#F5F3FF', borderWidth: 1.5, borderColor: '#E0DCF0',
  },
  declineBtnText: {
    fontSize: 14, fontWeight: '700', color: '#7A0EED',
  },
  acceptBtn: {
    backgroundColor: '#7A0EED',
  },
  acceptBtnText: {
    fontSize: 14, fontWeight: '700', color: '#FFFFFF',
  },
});

// Right-side floating icon column: 8 from the edge + 44 wide + 6 gap
const FLOATING_COL_INSET = 58;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  defaultBg: { flex: 1, backgroundColor: '#FFFFFF' },
  flex: { flex: 1 },
  bgOverlay: { backgroundColor: 'rgba(0,0,0,0.25)' },
  // Light shade over the stage background so white names/icons stay readable
  topBgShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.18)' },
  topBgBacking: { backgroundColor: '#1B1430' },
  scrollContent: { paddingBottom: 8 },
  stageWrap: {
    position: 'relative',
  },
  battleOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 6,
  },
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
    right: 8,
    bottom: 150,   // default/fallback — actual bottom is set inline to counter keyboard resize, see usage
    zIndex: 4,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    // picker bar zIndex: 30 sits above this when open
  },
  floatingItem: { alignItems: 'center', gap: 3 },
  floatingBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  floatingImg: { width: 44, height: 44 },
  rankTrack: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E8E0FA', overflow: 'hidden',
  },
  rankFill: {
    height: '100%',
    backgroundColor: '#7A0EED', borderRadius: 3,
  },
});

const banner = StyleSheet.create({
  floatingWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 160,
    zIndex: 20,
    elevation: 20,
  },
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
  title: { fontSize: 18, fontWeight: '800', color: '#1C1E22', letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: '#60626A', textAlign: 'center', lineHeight: 20 },
  exitBtn: {
    width: '100%', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8, paddingVertical: 11,
    borderRadius: 48, backgroundColor: '#FFF5F5',
    borderWidth: 1, borderColor: '#FFE4E4',
  },
  exitLabel: { fontSize: 16, fontWeight: '700', color: '#E14C57' },
  cancelBtn: { paddingVertical: 10 },
  cancelLabel: { fontSize: 14, color: '#ABADB2', fontWeight: '600' },
  exitSheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 12, paddingBottom: 4,
    alignItems: 'center',
  },
  exitHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E0DDED', marginBottom: 16 },
  exitTitle: { fontSize: 16, fontWeight: '700', color: '#1C1E22' },
  exitSubtitle: {
    fontSize: 13, color: '#8A8C94', textAlign: 'center', lineHeight: 19,
    paddingHorizontal: 32, marginTop: 8,
  },
  exitActionRow: {
    flexDirection: 'row', alignItems: 'stretch',
    width: '100%', marginTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EDEDF0',
  },
  exitActionBtn: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  exitActionDivider: { width: StyleSheet.hairlineWidth, backgroundColor: '#EDEDF0' },
  minimiseLabel: { fontSize: 16, fontWeight: '700', color: '#1C1E22' },
  exitActionLabel: { fontSize: 16, fontWeight: '700', color: '#E14C57' },
});
