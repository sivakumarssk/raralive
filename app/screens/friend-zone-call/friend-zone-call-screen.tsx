import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Dimensions, Image, Keyboard, Platform, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RtcSurfaceView, VideoSourceType } from 'react-native-agora';

import { LocalCameraPreview } from '@/components/LocalCameraPreview';
import { resolveImageUrl } from '@/services/api';
import type { CallPhase } from '@/store/friend-zone-call-session-store';
import type { FriendZoneCallPeer } from '@/store/friend-zone-socket-store';
import {
  friendZoneCallChatStore,
  getFriendZoneCallChatState,
  initFriendZoneCallChat,
  subscribeFriendZoneCallChat,
} from '@/store/friend-zone-call-chat-store';
import { CallChatOverlay } from './components/call-chat-overlay';
import { CallGiftBar, type CallGiftItem } from './components/call-gift-bar';
import { CallGiftFlyAnimation, type CallFlyItem } from './components/call-gift-fly-animation';
import { CallMessageInput } from './components/call-message-input';

// The Activity is set to android:windowSoftInputMode="adjustResize" app-wide
// (needed for login/register/room-chat forms), so opening the keyboard here
// would normally shrink the whole window — including the full-screen video
// background, which visibly "moves." FULL_SCREEN_HEIGHT is the physical
// screen height captured once at module load, before any keyboard event, so
// the video layer below can be pinned to it and stay put regardless of what
// the OS resizes the window to.
const FULL_SCREEN_HEIGHT = Dimensions.get('screen').height;

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

type SelfInfo = { name: string; avatarUri?: string };

type Props = {
  phase: CallPhase;
  callId: string | null;
  callType: 'audio' | 'video' | null;
  peer: FriendZoneCallPeer | null;
  self: SelfInfo;
  isIncoming: boolean;
  lowBalanceWarning: boolean;
  endReason: string | null;
  localUid: number | null;
  remoteUid: number | null;
  isMicMuted: boolean;
  isCameraOff: boolean;
  isSpeakerOn: boolean;
  onEnd: () => void;
  onCancel: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onSwitchCamera: () => void;
  onToggleSpeaker: () => void;
  onRecharge: () => void;
  onDismissEnded: () => void;
};

const END_REASON_LABEL: Record<string, string> = {
  rejected: 'Call declined',
  cancelled: 'Call cancelled',
  ended: 'Call ended',
  insufficient_coins: 'Call ended — insufficient coins',
  disconnected: 'Call disconnected',
  offline: 'User is offline',
  busy: 'User is on another call',
  media_permission_denied: 'Call ended — mic/camera permission needed',
  not_answered: 'Not answered',
};

function useCallTimer(phase: CallPhase): number {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (phase === 'active' && startRef.current === null) {
      startRef.current = Date.now();
    }
    if (phase !== 'active') {
      startRef.current = null;
      setElapsed(0);
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== 'active') return;
    const id = setInterval(() => {
      if (startRef.current) setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  return elapsed;
}

function statusLabelFor(phase: CallPhase, elapsed: number, endReason: string | null): string {
  if (phase === 'outgoing_ringing') return 'Ringing…';
  if (phase === 'incoming_ringing') return 'Incoming call…';
  if (phase === 'connecting') return 'Connecting…';
  if (phase === 'active') return formatDuration(elapsed);
  if (phase === 'ended') return endReason ? (END_REASON_LABEL[endReason] ?? 'Call ended') : 'Call ended';
  return '';
}

export function FriendZoneCallScreen(props: Props) {
  if (props.callType === 'audio') return <AudioCallScreen {...props} />;
  return <VideoCallScreen {...props} />;
}

function AudioCallScreen({
  phase, peer, self, endReason, isMicMuted, isSpeakerOn,
  onEnd, onCancel, onToggleMic, onToggleSpeaker, onDismissEnded,
}: Props) {
  const insets = useSafeAreaInsets();
  const elapsed = useCallTimer(phase);
  const statusLabel = statusLabelFor(phase, elapsed, endReason);

  const peerName = peer?.full_name || peer?.username || 'Unknown';
  const peerAvatarUri = peer?.avatar_url ? resolveImageUrl(peer.avatar_url) : undefined;

  return (
    <View style={audioStyles.container}>
      <LinearGradient colors={['#1B0736', '#2B0A55', '#150330']} style={StyleSheet.absoluteFill} />

      <View style={[audioStyles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={phase === 'ended' ? onDismissEnded : (phase === 'incoming_ringing' || phase === 'outgoing_ringing' ? onCancel : onEnd)}
          hitSlop={10}>
          <Ionicons name="chevron-down" size={26} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={audioStyles.headerTitleWrap}>
          <Ionicons name="pulse" size={14} color="#22C55E" />
          <Text style={audioStyles.headerTitle}>Audio Call</Text>
        </View>

        <View style={audioStyles.headerIcons}>
          <Ionicons name="shield-checkmark-outline" size={20} color="rgba(255,255,255,0.85)" />
          <Ionicons name="ellipsis-vertical" size={20} color="rgba(255,255,255,0.85)" />
        </View>
      </View>

      <Text style={audioStyles.timer}>{statusLabel}</Text>

      <View style={audioStyles.participants}>
        <ParticipantCard name={peerName} avatarUri={peerAvatarUri} verified online />
        <View style={audioStyles.connector}>
          <View style={audioStyles.connectorDot} />
          <View style={audioStyles.connectorDot} />
          <View style={audioStyles.connectorDot} />
        </View>
        <ParticipantCard name={`${self.name} (You)`} avatarUri={self.avatarUri} verified online />
      </View>

      <View style={[audioStyles.bottomBar, { paddingBottom: insets.bottom + 32 }]}>
        {phase === 'active' && (
          <View style={styles.controlsRow}>
            <TouchableOpacity style={styles.controlBtn} onPress={onToggleMic} activeOpacity={0.85}>
              <Ionicons name={isMicMuted ? 'mic-off' : 'mic'} size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.controlBtn, isSpeakerOn && styles.controlBtnActive]}
              onPress={onToggleSpeaker}
              activeOpacity={0.85}>
              <Ionicons name={isSpeakerOn ? 'volume-high' : 'volume-medium-outline'} size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}

        {phase === 'ended' ? (
          <TouchableOpacity style={[styles.endCallBtn, styles.dismissBtn]} onPress={onDismissEnded} activeOpacity={0.85}>
            <Text style={styles.dismissText}>Close</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.endCallBtn}
            onPress={phase === 'incoming_ringing' || phase === 'outgoing_ringing' ? onCancel : onEnd}
            activeOpacity={0.85}>
            <Ionicons name="call" size={28} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function ParticipantCard({ name, avatarUri, verified, online }: { name: string; avatarUri?: string; verified?: boolean; online?: boolean }) {
  return (
    <View style={audioStyles.participantCard}>
      <View style={audioStyles.participantAvatarWrap}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={audioStyles.participantAvatar} />
        ) : (
          <View style={[audioStyles.participantAvatar, audioStyles.participantAvatarFallback]}>
            <Text style={audioStyles.participantAvatarInitial}>{name[0]?.toUpperCase()}</Text>
          </View>
        )}
        {online && <View style={audioStyles.participantOnlineDot} />}
      </View>
      <View style={audioStyles.participantNameRow}>
        <Text style={audioStyles.participantName} numberOfLines={1}>{name}</Text>
        {verified && <Ionicons name="checkmark-circle" size={16} color="#5B8DEF" />}
      </View>
      {online && (
        <View style={audioStyles.participantStatusRow}>
          <View style={audioStyles.participantStatusDot} />
          <Text style={audioStyles.participantStatusText}>Online</Text>
        </View>
      )}
    </View>
  );
}

function VideoCallScreen({
  phase, callId, callType, peer, self, isIncoming, lowBalanceWarning, endReason,
  localUid, remoteUid, isMicMuted, isCameraOff, isSpeakerOn,
  onEnd, onCancel, onToggleMic, onToggleCamera, onSwitchCamera, onToggleSpeaker, onRecharge, onDismissEnded,
}: Props) {
  const insets = useSafeAreaInsets();
  const elapsed = useCallTimer(phase);
  const statusLabel = statusLabelFor(phase, elapsed, endReason);

  const chat = useSyncExternalStore(subscribeFriendZoneCallChat, getFriendZoneCallChatState);
  const [flyItems, setFlyItems] = useState<CallFlyItem[]>([]);
  const seenGiftIds = useRef(new Set<string>());

  // The video background is pinned to FULL_SCREEN_HEIGHT (see above) so it
  // physically cannot shrink when adjustResize kicks in. That leaves the
  // *window* height shrinking (which DOES happen under adjustResize) as the
  // one reliable signal for how much room the keyboard is actually taking —
  // comparing against the BASELINE window height captured on mount (before
  // any keyboard interaction) sidesteps status-bar/gesture-nav
  // inconsistencies entirely, since only the delta the keyboard itself
  // introduces matters here. Far more accurate than trusting
  // keyboardDidShow's own reported height, which was the source of the
  // leftover gap.
  const baselineWindowHeight = useRef(Dimensions.get('window').height);
  const [windowHeight, setWindowHeight] = useState(baselineWindowHeight.current);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const keyboardGap = keyboardVisible ? Math.max(0, baselineWindowHeight.current - windowHeight) : 0;
  // Chat feed gets more room when idle (gift bar + controls sit below it,
  // but there's no keyboard eating the bottom of the screen) and less when
  // typing (no gift bar/controls to compete with, but the keyboard itself
  // covers the lower part of the screen) — sized off the actual keyboard
  // height rather than a guessed constant, so it adapts to any device.
  const chatFeedMaxHeight = keyboardVisible
    ? Math.max(120, keyboardGap - 90)
    : Math.round(FULL_SCREEN_HEIGHT * 0.32);

  useEffect(() => {
    const dimSub = Dimensions.addEventListener('change', ({ window }) => setWindowHeight(window.height));
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false),
    );
    return () => { dimSub.remove(); show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    if (phase === 'active' && callId) {
      friendZoneCallChatStore.attach(callId);
      initFriendZoneCallChat();
    } else if (phase !== 'active') {
      friendZoneCallChatStore.detach();
      seenGiftIds.current.clear();
      setFlyItems([]);
    }
  }, [phase, callId]);

  useEffect(() => {
    const lastGift = [...chat.rows].reverse().find(r => r.kind === 'gift');
    if (!lastGift || lastGift.kind !== 'gift') return;
    if (seenGiftIds.current.has(lastGift.id)) return;
    seenGiftIds.current.add(lastGift.id);
    setFlyItems(prev => [...prev, {
      id: lastGift.id, giftName: lastGift.giftName, giftImageUrl: lastGift.giftImageUrl, qty: lastGift.qty,
    }]);
  }, [chat.rows]);

  const name = peer?.full_name || peer?.username || 'Unknown';
  const avatarUri = peer?.avatar_url ? resolveImageUrl(peer.avatar_url) : undefined;
  const isVideo = callType === 'video';
  const isRingingPhase = phase === 'outgoing_ringing' || phase === 'incoming_ringing';
  const showRemoteVideo = isVideo && phase === 'active' && remoteUid !== null;
  // While ringing: a full-screen, lightweight non-Agora camera preview (no
  // engine involved). Once the call is actually active: the real Agora
  // local video, shrunk to a PIP box, since the remote feed takes over the
  // full screen at that point. Never both at once.
  const showRingingPreview = isVideo && isRingingPhase && !isCameraOff;
  const showActiveLocalVideo = isVideo && phase === 'active' && !isCameraOff && localUid !== null;
  // Before the remote stream arrives, show the peer's photo full-screen
  // instead of a plain gradient — but while ringing with our own preview
  // up full-screen, that preview IS the background.
  const showFullScreenPhoto = !showRemoteVideo && !!avatarUri && !showRingingPreview;

  const overlayText = showRemoteVideo || showFullScreenPhoto || showRingingPreview;

  return (
    <TouchableWithoutFeedback onPress={() => keyboardVisible && Keyboard.dismiss()}>
    <View style={[styles.container, { height: FULL_SCREEN_HEIGHT }]}>
      {showRingingPreview ? (
        <LocalCameraPreview style={StyleSheet.absoluteFill} />
      ) : showRemoteVideo ? (
        <RtcSurfaceView style={StyleSheet.absoluteFill} canvas={{ uid: remoteUid! }} />
      ) : showFullScreenPhoto ? (
        <>
          <Image source={{ uri: avatarUri }} style={StyleSheet.absoluteFill} blurRadius={2} resizeMode="cover" />
          <View style={[StyleSheet.absoluteFill, styles.photoDim]} />
        </>
      ) : (
        <LinearGradient colors={['#2B0A55', '#7A0EED']} style={StyleSheet.absoluteFill} />
      )}

      {/* Scrims keep the name/status and the bottom controls legible over
          live camera footage or a busy photo, regardless of what's under
          them. */}
      {overlayText && (
        <LinearGradient
          colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0)']}
          style={[styles.topScrim, { height: insets.top + 140 }]}
        />
      )}
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)']}
        style={[styles.bottomScrim, { height: insets.bottom + 180 }]}
      />

      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        {!showRemoteVideo && !showFullScreenPhoto && !showRingingPreview && (
          <View style={styles.avatarWrap}>
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>{name[0]?.toUpperCase()}</Text>
            </View>
          </View>
        )}
        <Text style={[styles.name, overlayText && styles.nameOnVideo]} numberOfLines={1}>{name}</Text>
        <Text style={[styles.status, overlayText && styles.statusOnVideo]}>{statusLabel}</Text>
      </View>

      {showActiveLocalVideo && (
        <View style={[styles.localVideoWrap, { top: insets.top + 12 }]}>
          <RtcSurfaceView
            style={StyleSheet.absoluteFill}
            canvas={{ uid: 0, sourceType: VideoSourceType.VideoSourceCamera }}
            // zOrderMediaOverlay layers this above the OTHER native
            // SurfaceView on screen at this point (the remote video) —
            // without it, both compositing in their own layers below the
            // window can render one of them transparent/invisible.
            zOrderMediaOverlay
          />
        </View>
      )}

      {/* Camera flip lives alone as a top-right button, out of the way of
          the self-video PIP (now top-left) and the bottom gift/chat/controls
          stack. Mic mute stays down with the rest of the call controls. */}
      {phase === 'active' && isVideo && (
        <View style={[styles.sideControls, { top: insets.top + 12 }]}>
          <TouchableOpacity style={styles.controlBtn} onPress={onSwitchCamera} activeOpacity={0.85}>
            <Ionicons name="camera-reverse" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      <CallGiftFlyAnimation items={flyItems} onItemDone={(id) => setFlyItems(prev => prev.filter(f => f.id !== id))} />

      {lowBalanceWarning && phase === 'active' && (
        <View style={[styles.warningBanner, { top: insets.top + 12 }]}>
          <Ionicons name="alert-circle" size={16} color="#7A2E00" />
          <Text style={styles.warningText}>Low balance — recharge to keep the call going</Text>
          <TouchableOpacity onPress={onRecharge} style={styles.warningBtn}>
            <Text style={styles.warningBtnText}>Recharge</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bottom stack: Instagram-Live style chat feed, then the gift strip,
          then the message input, then the call controls row — all normally
          docked to the bottom together. While the keyboard is open, the
          gift strip and controls row hide entirely (same as Instagram Live
          collapsing down to just the feed + input while typing) and the
          input's marginBottom lifts it to sit right above the keyboard. */}
      {isVideo && phase === 'active' ? (
        <View style={[styles.bottomStack, { paddingBottom: insets.bottom + 16 }]}>
          <CallChatOverlay
            rows={chat.rows}
            selfName={self.name}
            selfAvatarUri={self.avatarUri}
            peerName={name}
            peerAvatarUri={avatarUri}
            maxHeight={chatFeedMaxHeight}
          />
          {!keyboardVisible && (
            <CallGiftBar onSendGift={(gift: CallGiftItem) => friendZoneCallChatStore.sendGift(gift.id, 1)} />
          )}
          <View style={{ marginBottom: keyboardGap }}>
            <CallMessageInput onSend={(t) => friendZoneCallChatStore.sendMessage(t)} />
          </View>
          {!keyboardVisible && (
            <View style={styles.controlsRow}>
              <TouchableOpacity
                style={[styles.controlBtn, isMicMuted && styles.controlBtnActive]}
                onPress={onToggleMic}
                activeOpacity={0.85}>
                <Ionicons name={isMicMuted ? 'mic-off' : 'mic'} size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.controlBtn, isSpeakerOn && styles.controlBtnActive]}
                onPress={onToggleSpeaker}
                activeOpacity={0.85}>
                <Ionicons name={isSpeakerOn ? 'volume-high' : 'volume-medium-outline'} size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.controlBtn} onPress={onToggleCamera} activeOpacity={0.85}>
                <Ionicons name={isCameraOff ? 'videocam-off' : 'videocam'} size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.endCallBtn} onPress={onEnd} activeOpacity={0.85}>
                <Ionicons name="call" size={24} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 24 }]}>
          {phase === 'ended' ? (
            <TouchableOpacity style={[styles.endCallBtnLarge, styles.dismissBtn]} onPress={onDismissEnded} activeOpacity={0.85}>
              <Text style={styles.dismissText}>Close</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.endCallBtnLarge}
              onPress={isIncoming && phase === 'incoming_ringing' ? onCancel : (phase === 'outgoing_ringing' ? onCancel : onEnd)}
              activeOpacity={0.85}>
              <Ionicons name="call" size={28} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#150330' },
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0 },
  bottomScrim: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  topBar: { alignItems: 'center', paddingHorizontal: 24 },
  avatarWrap: { marginTop: 24 },
  avatar: { width: 112, height: 112, borderRadius: 56, borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' },
  avatarFallback: { backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 42, fontWeight: '800', color: '#FFFFFF' },
  photoDim: { backgroundColor: 'rgba(21,3,48,0.45)' },
  name: { marginTop: 16, fontSize: 22, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3 },
  nameOnVideo: { textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } },
  status: { marginTop: 6, fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
  statusOnVideo: { textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } },
  localVideoWrap: {
    position: 'absolute',
    left: 16,
    width: 100,
    height: 140,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: '#000',
  },
  sideControls: {
    position: 'absolute',
    right: 16,
    gap: 12,
  },
  bottomStack: {
    marginTop: 'auto',
    paddingHorizontal: 16,
    gap: 10,
  },
  warningBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFE29A',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  warningText: { flex: 1, fontSize: 12, fontWeight: '700', color: '#7A2E00' },
  warningBtn: { backgroundColor: '#7A2E00', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  warningBtnText: { fontSize: 11, fontWeight: '800', color: '#FFF' },
  bottomBar: { marginTop: 'auto', alignItems: 'center', paddingHorizontal: 20 },
  controlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 },
  controlBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  controlBtnActive: {
    backgroundColor: '#7A0EED',
  },
  endCallBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#E14C57',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6,
  },
  endCallBtnLarge: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: '#E14C57',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6,
  },
  dismissBtn: { backgroundColor: 'rgba(255,255,255,0.18)', width: 140, borderRadius: 24, height: 48 },
  dismissText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
});

const audioStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#150330' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  timer: {
    marginTop: 4,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  participants: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  connector: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  connectorDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#7A0EED',
  },
  participantCard: {
    alignItems: 'center',
    gap: 6,
  },
  participantAvatarWrap: {
    position: 'relative',
    borderRadius: 60,
    padding: 3,
    borderWidth: 2,
    borderColor: 'rgba(180,120,255,0.55)',
  },
  participantAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  participantAvatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantAvatarInitial: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  participantOnlineDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#150330',
  },
  participantNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 220,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  participantStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  participantStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
  participantStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  bottomBar: { alignItems: 'center', gap: 28, paddingHorizontal: 24 },
});
