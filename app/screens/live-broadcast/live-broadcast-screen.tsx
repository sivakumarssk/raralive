import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ChatMessage } from '@/screens/room-detail/room-detail.data';
import { ChatFeed } from '@/screens/room-detail/components/chat-feed';
import { ChatInputBar } from '@/screens/room-detail/components/chat-input-bar';
import { GiftBar } from '@/screens/room-detail/components/gift-tray';
import { GiftFullscreenAnim } from '@/screens/room-detail/components/gift-fullscreen-anim';
import { GiftShopModal } from '@/screens/room-detail/components/gift-shop-modal';
import { CoHostInviteSheet } from './components/cohost-invite-sheet';
import { CommentActionSheet, type CommentActionTarget } from './components/comment-action-sheet';
import { StarfieldBackground } from './components/starfield-background';
import { VideoTile } from './components/video-tile';
import { useLiveBroadcastAgora } from '@/hooks/useLiveBroadcastAgora';
import { type IncomingStageInvite, useRoomSocket } from '@/hooks/useRoomSocket';
import { BASE_URL, MEDIA_BASE, apiEndBroadcast } from '@/services/api';
import { authStore } from '@/store/auth-store';
import {
  onBroadcastLikeState, onBroadcastLikesUpdate, onPinnedCommentUpdate,
  onReportCommentResult, onRemovedFromStage, socketStore,
} from '@/store/socket-store';

const COIN_IMG = require('@/assets/tabs/coin.png');

function resolveAvatar(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  return `${MEDIA_BASE}/${url.replace(/^\//, '')}`;
}

// Agora uid derivation must match backend/store hashing exactly — copied
// from live-broadcast-agora-store.ts so remote tiles can be matched to seats.
function toAgoraUid(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (Math.imul(31, hash) + userId.charCodeAt(i)) >>> 0;
  }
  return (hash % 0xFFFFFF) + 1;
}

const CHAT_HEIGHT = Dimensions.get('window').height * 0.2;

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return String(n);
}

const MAX_COHOSTS = 3;

type RoomInfo = {
  room_name: string;
  host_user_id: string;
  host_name: string | null;
  host_username: string | null;
  host_avatar_url: string | null;
  total_coins_received?: number;
  likes_count?: number;
};

type LiveBroadcastScreenProps = {
  roomId: string;
  channelName: string;
};

export function LiveBroadcastScreen({ roomId, channelName }: LiveBroadcastScreenProps) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const currentUserId = authStore.getUserId() ?? '';

  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState<'beautify' | 'lenses' | null>(null);
  const [showGiftShop, setShowGiftShop] = useState(false);
  const [fullscreenGift, setFullscreenGift] = useState<{ imageUrl: string | null; bgColor: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [coinsReceived, setCoinsReceived] = useState(0);
  const [likesCount, setLikesCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [pinnedMessageId, setPinnedMessageId] = useState<string | null>(null);
  const [commentTarget, setCommentTarget] = useState<CommentActionTarget | null>(null);
  const [showCommentSheet, setShowCommentSheet] = useState(false);
  const seenGiftIds = useRef(new Set<string>());

  const {
    messages, onlineCount, seats,
    sendMessage, inviteToStage, removeFromStage, leaveStage,
    incomingStageInvite, acceptStageInvite, rejectStageInvite,
    pinComment, unpinComment, deleteComment, reportComment,
  } = useRoomSocket(roomId);

  const isHost = roomInfo ? roomInfo.host_user_id === currentUserId : false;
  const mySlotIndex = seats.find(s => s.slotIndex !== 0 && s.userId === currentUserId)?.slotIndex ?? null;
  const iAmCoHost = mySlotIndex !== null;
  const shouldPublish = isHost || iAmCoHost;

  const {
    joined, isMicMuted, isCameraOff, remoteUsers,
    toggleMic, toggleCamera, switchCamera,
  } = useLiveBroadcastAgora(channelName, currentUserId, shouldPublish);

  // Fetch room info once
  useEffect(() => {
    const token = authStore.getToken();
    fetch(`${BASE_URL}/rooms/${roomId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          setRoomInfo(json.data);
          setCoinsReceived(json.data.total_coins_received ?? 0);
          setLikesCount(json.data.likes_count ?? 0);
        }
      })
      .catch(() => {});
  }, [roomId]);

  // Auto-scroll chat on new message
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages.length]);

  // Track gift coins received in real time from chat gift events
  useEffect(() => {
    messages.forEach(msg => {
      if (msg.type !== 'gift') return;
      if (seenGiftIds.current.has(msg.id)) return;
      seenGiftIds.current.add(msg.id);
      const total = (msg.giftCoins ?? 0) * (msg.giftQty ?? 1);
      if (total > 0) setCoinsReceived(prev => prev + total);
    });
  }, [messages]);

  // Live-updated like count, synced across all viewers
  useEffect(() => {
    const unsub = onBroadcastLikesUpdate(count => setLikesCount(count));
    return unsub;
  }, []);

  // My own like/unlike state — server is the source of truth (sent on join and after each toggle)
  useEffect(() => {
    const unsub = onBroadcastLikeState(liked => setIsLiked(liked));
    return unsub;
  }, []);

  // Pinned comment — synced to all viewers, sent on join and after every pin/unpin
  useEffect(() => {
    const unsub = onPinnedCommentUpdate(messageId => setPinnedMessageId(messageId));
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onReportCommentResult(ok => {
      setToast(ok ? 'Comment reported.' : 'Could not report comment.');
      setTimeout(() => setToast(null), 2000);
    });
    return unsub;
  }, []);

  // Co-host got removed by host — leave and inform them
  useEffect(() => {
    const unsub = onRemovedFromStage(() => {
      Alert.alert('Removed', 'The host removed you as a co-host.');
    });
    return unsub;
  }, []);

  const handleExit = useCallback(async () => {
    setShowExitModal(false);
    if (isHost) {
      setEnding(true);
      const token = authStore.getToken();
      if (token) await apiEndBroadcast(token);
      setEnding(false);
    } else if (iAmCoHost) {
      leaveStage();
    }
    router.back();
  }, [isHost, iAmCoHost, leaveStage]);

  // Android back button
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setShowExitModal(true);
      return true;
    });
    return () => sub.remove();
  }, []));

  const handleAcceptCoHostInvite = () => {
    if (!incomingStageInvite) return;
    acceptStageInvite(incomingStageInvite.slotIndex, incomingStageInvite.hostSocketId);
  };

  const handleInvite = (userId: string, slotIndex: number) => {
    inviteToStage(userId, slotIndex);
    setShowInviteSheet(false);
    setToast('Invite sent.');
    setTimeout(() => setToast(null), 2000);
  };

  const handleLikePress = () => {
    socketStore.likeBroadcast(roomId);
  };

  const [mentionText, setMentionText] = useState('');
  const [mentionKey, setMentionKey] = useState<number | undefined>(undefined);

  const handleCommentPress = (msg: ChatMessage) => {
    if (!msg.user) return;
    setCommentTarget({
      messageId: msg.id,
      userId: msg.user.id,
      userName: msg.user.name,
      avatarUri: msg.user.avatarUri,
      text: msg.text ?? '',
      isPinned: msg.id === pinnedMessageId,
    });
    setShowCommentSheet(true);
  };

  const handleMention = (target: CommentActionTarget) => {
    setMentionText(`@${target.userName} `);
    setMentionKey(k => (k ?? 0) + 1);
  };

  const handlePinToggle = (target: CommentActionTarget) => {
    if (target.isPinned) unpinComment();
    else pinComment(target.messageId);
  };

  const handleAddToLiveStreaming = (target: CommentActionTarget) => {
    if (!target.userId) return;
    if (cohostSeats.length >= MAX_COHOSTS) {
      setToast('Co-host slots are full.');
      setTimeout(() => setToast(null), 2000);
      return;
    }
    const usedSlots = new Set(cohostSeats.map(s => s.slotIndex));
    const nextSlot = [1, 2, 3].find(i => !usedSlots.has(i)) ?? 1;
    inviteToStage(target.userId, nextSlot);
    setToast('Invite sent.');
    setTimeout(() => setToast(null), 2000);
  };

  const handleReport = (target: CommentActionTarget) => {
    reportComment(target.messageId, target.text, target.userId);
  };

  const handleDeleteComment = (target: CommentActionTarget) => {
    deleteComment(target.messageId);
  };

  const handleBlockCommenter = async (target: CommentActionTarget) => {
    if (!target.userId) return;
    const token = authStore.getToken();
    if (!token) return;
    try {
      await fetch(`${BASE_URL}/rooms/${roomId}/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: target.userId }),
      });
      setToast(`${target.userName} blocked.`);
      setTimeout(() => setToast(null), 2000);
    } catch {}
  };

  const cohostSeats = seats.filter(s => s.slotIndex !== 0).sort((a, b) => a.slotIndex - b.slotIndex);
  // onlineCount includes every socket connected to the room (host + co-hosts + audience) —
  // subtract the host and each co-host so the header shows actual viewers only.
  const viewerCount = Math.max(0, onlineCount - 1 - cohostSeats.length);

  const hostUid = roomInfo ? toAgoraUid(roomInfo.host_user_id) : null;
  const remoteUidSet = new Set(remoteUsers.map(u => u.uid));

  type Tile = {
    key: string;
    isLocal: boolean;
    uid: number;
    name: string;
    avatarUri?: string;
    isHost: boolean;
    isMicMuted?: boolean;
    isCameraOff?: boolean;
    hasRemoteVideo: boolean;
    slotIndex?: number;
  };

  const hostTile: Tile | null = roomInfo ? {
    key: 'host',
    isLocal: isHost,
    uid: hostUid ?? 0,
    name: roomInfo.host_name || roomInfo.host_username || 'Host',
    avatarUri: resolveAvatar(roomInfo.host_avatar_url),
    isHost: true,
    isMicMuted: isHost ? isMicMuted : undefined,
    isCameraOff: isHost ? isCameraOff : undefined,
    hasRemoteVideo: hostUid !== null && remoteUidSet.has(hostUid),
  } : null;

  const coTiles: Tile[] = cohostSeats.map(seat => {
    const isMe = seat.userId === currentUserId;
    const uid = toAgoraUid(seat.userId);
    return {
      key: `seat-${seat.slotIndex}`,
      isLocal: isMe,
      uid,
      name: seat.userName,
      avatarUri: resolveAvatar(seat.avatarUrl),
      isHost: false,
      isMicMuted: isMe ? isMicMuted : seat.isMuted,
      isCameraOff: isMe ? isCameraOff : undefined,
      hasRemoteVideo: remoteUidSet.has(uid),
      slotIndex: seat.slotIndex,
    };
  });

  const handleTileLongPress = (tile: Tile) => {
    if (!isHost || tile.isHost || tile.slotIndex === undefined) return;
    Alert.alert('Remove Co-host', `Remove ${tile.name} from the broadcast?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeFromStage(tile.slotIndex!) },
    ]);
  };

  return (
    <View style={s.root}>
      {/* Fullscreen hero — host's video, or starfield+avatar fallback */}
      <View style={StyleSheet.absoluteFill}>
        {hostTile ? (
          <VideoTile
            isLocal={hostTile.isLocal}
            uid={hostTile.uid}
            name={hostTile.name}
            avatarUri={hostTile.avatarUri}
            hasRemoteVideo={hostTile.hasRemoteVideo}
            isCameraOff={hostTile.isCameraOff}
            isLocalJoined={joined}
            fullscreen
          />
        ) : (
          <StarfieldBackground />
        )}
      </View>

      {/* Co-host thumbnails — small tiles stacked top-right, below header */}
      {coTiles.length > 0 && (
        <View style={[s.coHostStack, { top: insets.top + 64 }]}>
          {coTiles.slice(0, 3).map(tile => (
            <TouchableOpacity
              key={tile.key}
              activeOpacity={0.9}
              onLongPress={() => handleTileLongPress(tile)}
              style={s.coHostThumb}>
              <VideoTile
                isLocal={tile.isLocal}
                uid={tile.uid}
                name={tile.name}
                avatarUri={tile.avatarUri}
                isHost={false}
                isMicMuted={tile.isMicMuted}
                isCameraOff={tile.isCameraOff}
                hasRemoteVideo={tile.hasRemoteVideo}
                isLocalJoined={joined}
              />
            </TouchableOpacity>
          ))}
        </View>
      )}

      <SafeAreaView style={s.overlayRoot} edges={['top', 'bottom']} pointerEvents="box-none">
        {/* Header */}
        <View style={s.header} pointerEvents="box-none">
          <TouchableOpacity onPress={() => setShowExitModal(true)} style={s.headerIconBtn} hitSlop={8}>
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={s.viewerPill}>
            <Ionicons name="people" size={13} color="#FFFFFF" />
            <Text style={s.viewerPillText}>{viewerCount}</Text>
            <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.7)" />
          </View>

          <View style={s.coinsPill}>
            <Image source={COIN_IMG} style={s.coinsPillIcon} resizeMode="contain" />
            <Text style={s.coinsPillText}>{formatCount(coinsReceived)}</Text>
          </View>

          <TouchableOpacity onPress={handleLikePress} activeOpacity={0.75} style={s.likesPill}>
            <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={13} color="#FF4D6D" />
            <Text style={s.likesPillText}>{formatCount(likesCount)}</Text>
          </TouchableOpacity>

          <View style={s.headerSpacer} />

          <TouchableOpacity style={s.headerIconBtn} hitSlop={8}>
            <Ionicons name="share-social-outline" size={19} color="#FFFFFF" />
          </TouchableOpacity>

          {isHost && (
            <TouchableOpacity
              onPress={() => setShowInviteSheet(true)}
              style={s.headerIconBtn}
              disabled={cohostSeats.length >= MAX_COHOSTS}
              hitSlop={8}>
              <Ionicons name="person-add" size={19} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Room name + LIVE badge, floated under header */}
        <View style={s.titleRow} pointerEvents="none">
          <View style={s.liveBadge}>
            <View style={s.liveDot} />
            <Text style={s.liveBadgeText}>LIVE</Text>
          </View>
          <Text style={s.roomName} numberOfLines={1}>{roomInfo?.room_name ?? 'Live'}</Text>
        </View>

        {!joined && shouldPublish && (
          <View style={s.connectingOverlay} pointerEvents="none">
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={s.connectingText}>Connecting…</Text>
          </View>
        )}

        <View style={s.bottomSpacer} pointerEvents="none" />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={insets.top}>
          {/* Chat overlay — fixed to ~20% of the screen height, scrolls internally */}
          <View style={s.chatArea}>
            <ScrollView
              ref={scrollRef}
              style={s.flex}
              contentContainerStyle={s.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">
              <ChatFeed
                messages={messages}
                hasRoomBg
                compact
                pinnedMessageId={pinnedMessageId}
                onCommentPress={handleCommentPress}
              />
            </ScrollView>

            {toast && (
              <View style={s.toast}><Text style={s.toastText}>{toast}</Text></View>
            )}
          </View>

          {/* Camera-off nudge — host/co-host only */}
          {shouldPublish && isCameraOff && (
            <View style={s.cameraOffBanner} pointerEvents="none">
              <Ionicons name="videocam-off" size={15} color="#FFFFFF" />
              <View style={{ flex: 1 }}>
                <Text style={s.cameraOffTitle}>Camera Off!</Text>
                <Text style={s.cameraOffSubtitle}>Show your face on Live to get more views</Text>
              </View>
            </View>
          )}

          <GiftBar onGiftPress={() => setShowGiftShop(true)} hasRoomBg />

          <ChatInputBar
            onSend={sendMessage}
            onGiftOpen={() => setShowGiftShop(true)}
            hasRoomBg
            showBattle={false}
            prefillText={mentionText}
            prefillKey={mentionKey}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Control bar — mic/camera/beautify/lenses/flip, only for host/co-host — vertical column
          confined to the top area (below the title row), never reaching down toward the chat/input. */}
      {shouldPublish && (
        <View style={[s.controlBar, { top: insets.top + (coTiles.length > 0 ? 200 : 64) }]} pointerEvents="box-none">
          <ControlButton icon={isMicMuted ? 'mic-off' : 'mic'} active={!isMicMuted} label="Mic" onPress={toggleMic} />
          <ControlButton icon={isCameraOff ? 'videocam-off' : 'videocam'} active={!isCameraOff} label="Camera" onPress={toggleCamera} />
          <ControlButton icon="sparkles" label="Beautify" onPress={() => setShowComingSoon('beautify')} />
          <ControlButton icon="color-filter" label="Lenses" onPress={() => setShowComingSoon('lenses')} />
          <ControlButton icon="camera-reverse" label="Flip" onPress={switchCamera} disabled={isCameraOff} />
        </View>
      )}

      {/* Incoming co-host invite banner (non-host) */}
      {!isHost && incomingStageInvite && (
        <View style={s.inviteIncomingWrap}>
          <View style={s.inviteIncomingCard}>
            <Ionicons name="videocam" size={16} color="#7A0EED" />
            <Text style={s.inviteIncomingText} numberOfLines={1}>
              {incomingStageInvite.hostName} invited you to co-host
            </Text>
            <TouchableOpacity onPress={() => rejectStageInvite(incomingStageInvite.hostSocketId)} style={s.inviteRejectBtn}>
              <Ionicons name="close" size={16} color="#E14C57" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleAcceptCoHostInvite} style={s.inviteAcceptBtn}>
              <LinearGradient colors={['#7A0EED', '#B50357']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.inviteAcceptGrad}>
                <Text style={s.inviteAcceptText}>Join</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Co-host invite sheet (host only) */}
      {isHost && (
        <CoHostInviteSheet
          visible={showInviteSheet}
          onClose={() => setShowInviteSheet(false)}
          roomId={roomId}
          seats={seats}
          maxCohosts={MAX_COHOSTS}
          onInvite={handleInvite}
        />
      )}

      <CommentActionSheet
        visible={showCommentSheet}
        target={commentTarget}
        isHost={isHost}
        onClose={() => setShowCommentSheet(false)}
        onMention={handleMention}
        onPin={handlePinToggle}
        onAddToLiveStreaming={handleAddToLiveStreaming}
        onReport={handleReport}
        onDelete={handleDeleteComment}
        onBlock={handleBlockCommenter}
      />

      <GiftShopModal
        visible={showGiftShop}
        onClose={() => setShowGiftShop(false)}
        seats={seats}
        hostInfo={{
          userId: roomInfo?.host_user_id ?? '',
          name: hostTile?.name ?? 'Host',
          avatarUrl: roomInfo?.host_avatar_url ?? null,
        }}
        isHostOnline
        onSendGift={(gift, targetName, qty, targetUserId) => {
          setFullscreenGift({ imageUrl: gift.image_url, bgColor: gift.bg_color });
          const hostUserId = roomInfo?.host_user_id ?? '';
          const giftTargetId = targetUserId || hostUserId;
          sendMessage(
            `__gift__🎁__to__${targetName}__img__${gift.image_url ?? ''}__bg__${gift.bg_color}` +
            `__giftid__${gift.id}__coins__${gift.coins}__qty__${qty}` +
            `__senderid__${currentUserId}__recipientid__${hostUserId}__giftfor__${giftTargetId}`
          );
        }}
      />

      <GiftFullscreenAnim
        visible={!!fullscreenGift}
        imageUrl={fullscreenGift?.imageUrl ?? null}
        bgColor={fullscreenGift?.bgColor}
        onDone={() => setFullscreenGift(null)}
      />

      {/* Beautify/Lenses coming-soon sheet */}
      <Modal visible={!!showComingSoon} transparent animationType="fade" onRequestClose={() => setShowComingSoon(null)}>
        <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={() => setShowComingSoon(null)} />
        <View style={m.sheet}>
          <View style={m.handle} />
          <View style={m.iconWrap}>
            <Ionicons name={showComingSoon === 'beautify' ? 'sparkles' : 'color-filter'} size={28} color="#7A0EED" />
          </View>
          <Text style={m.title}>{showComingSoon === 'beautify' ? 'Beautify' : 'Lenses'} Coming Soon</Text>
          <Text style={m.subtitle}>This feature is on the way — check back in a future update.</Text>
          <TouchableOpacity onPress={() => setShowComingSoon(null)} style={m.okBtn}>
            <Text style={m.okBtnText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Exit modal */}
      <Modal visible={showExitModal} transparent animationType="fade" onRequestClose={() => setShowExitModal(false)}>
        <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={() => setShowExitModal(false)} />
        <View style={m.sheet}>
          <View style={m.handle} />
          <Text style={m.title}>{isHost ? 'End Live?' : iAmCoHost ? 'Leave Co-host Seat?' : 'Leave Live?'}</Text>
          <Text style={m.subtitle}>
            {isHost
              ? 'This will end the broadcast for everyone watching.'
              : iAmCoHost
                ? 'You will step down and return to the audience view.'
                : 'You can rejoin anytime while the host is live.'}
          </Text>
          <TouchableOpacity onPress={handleExit} activeOpacity={0.9} style={m.exitBtn} disabled={ending}>
            {ending
              ? <ActivityIndicator size="small" color="#E14C57" />
              : <Ionicons name="exit-outline" size={20} color="#E14C57" />}
            <Text style={m.exitLabel}>{isHost ? 'End Live' : iAmCoHost ? 'Leave Seat' : 'Leave'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowExitModal(false)} style={m.cancelBtn}>
            <Text style={m.cancelLabel}>Stay</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

function ControlButton({ icon, label, onPress, active = true, disabled = false }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} disabled={disabled} style={s.ctrlItem}>
      <View style={[s.ctrlBtn, !active && s.ctrlBtnInactive, disabled && s.ctrlBtnDisabled]}>
        <Ionicons name={icon} size={15} color={active ? '#FFFFFF' : '#E14C57'} />
      </View>
      <Text style={s.ctrlLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1A0F3D' },
  overlayRoot: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingTop: 6,
  },
  headerIconBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  headerSpacer: { flex: 1 },
  viewerPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6,
  },
  viewerPillText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  coinsPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 6,
  },
  coinsPillIcon: { width: 14, height: 14 },
  coinsPillText: { fontSize: 12, fontWeight: '700', color: '#F5C518' },
  likesPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 6,
  },
  likesPillText: { fontSize: 12, fontWeight: '700', color: '#FF4D6D' },
  titleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, marginTop: 8,
  },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#FF3B3B', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  liveDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF' },
  liveBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.4 },
  roomName: {
    flex: 1, fontSize: 13, fontWeight: '700', color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  coHostStack: {
    position: 'absolute', right: 12, gap: 8, zIndex: 5,
  },
  coHostThumb: {
    width: 76, height: 100, borderRadius: 12, overflow: 'hidden',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
  },
  connectingOverlay: {
    position: 'absolute', top: '42%', left: 0, right: 0,
    alignItems: 'center', gap: 8,
  },
  connectingText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  cameraOffBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(120,20,20,0.75)', marginHorizontal: 14, marginBottom: 10,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
  },
  cameraOffTitle: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  cameraOffSubtitle: { fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  controlBar: {
    position: 'absolute', right: 10, zIndex: 5,
    alignItems: 'center', gap: 10,
  },
  ctrlItem: { alignItems: 'center', gap: 2 },
  ctrlBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  ctrlBtnInactive: { backgroundColor: 'rgba(225,76,87,0.35)' },
  ctrlBtnDisabled: { opacity: 0.4 },
  ctrlLabel: {
    fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.85)',
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  bottomSpacer: { flex: 1 },
  chatArea: { height: CHAT_HEIGHT },
  scrollContent: { paddingBottom: 8, flexGrow: 1, justifyContent: 'flex-end' },
  toast: {
    position: 'absolute', top: 8, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8,
  },
  toastText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  inviteIncomingWrap: { position: 'absolute', left: 0, right: 0, bottom: 150, zIndex: 20 },
  inviteIncomingCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFFFF', marginHorizontal: 16, borderRadius: 16, padding: 10,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 10,
  },
  inviteIncomingText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#1C1E22' },
  inviteRejectBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFF5F5', alignItems: 'center', justifyContent: 'center' },
  inviteAcceptBtn: { borderRadius: 16, overflow: 'hidden' },
  inviteAcceptGrad: { paddingHorizontal: 14, paddingVertical: 8 },
  inviteAcceptText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
});

const m = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 12, paddingBottom: 36, gap: 12, alignItems: 'center',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E0DDED', marginBottom: 8 },
  iconWrap: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: '#F4EEFF',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  title: { fontSize: 19, fontWeight: '800', color: '#1C1E22', letterSpacing: -0.3, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#60626A', textAlign: 'center', lineHeight: 20 },
  exitBtn: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 48, backgroundColor: '#FFF5F5',
    borderWidth: 1, borderColor: '#FFE4E4', marginTop: 4,
  },
  exitLabel: { fontSize: 16, fontWeight: '700', color: '#E14C57' },
  cancelBtn: { paddingVertical: 10 },
  cancelLabel: { fontSize: 15, color: '#ABADB2', fontWeight: '600' },
  okBtn: { width: '100%', paddingVertical: 14, borderRadius: 48, backgroundColor: '#7A0EED', alignItems: 'center', marginTop: 4 },
  okBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
