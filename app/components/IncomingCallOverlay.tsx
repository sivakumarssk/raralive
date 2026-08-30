import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSyncExternalStore } from 'react';
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LocalCameraPreview } from '@/components/LocalCameraPreview';
import { resolveImageUrl } from '@/services/api';
import {
  friendZoneCallSessionStore,
  getFriendZoneCallSessionState,
  subscribeFriendZoneCallSession,
} from '@/store/friend-zone-call-session-store';

export function IncomingCallOverlay() {
  const insets = useSafeAreaInsets();
  const session = useSyncExternalStore(subscribeFriendZoneCallSession, getFriendZoneCallSessionState);

  if (session.phase !== 'incoming_ringing') return null;

  const peer = session.peer;
  const name = peer?.full_name || peer?.username || 'Unknown';
  const avatarUri = peer?.avatar_url ? resolveImageUrl(peer.avatar_url) : undefined;
  // Lightweight, non-Agora camera preview — no engine/permissions/token
  // fetch involved yet, purely a local front-camera view while ringing.
  const showLocalVideo = session.callType === 'video';

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.root}>
        {showLocalVideo ? (
          <LocalCameraPreview style={StyleSheet.absoluteFill} />
        ) : (
          <LinearGradient colors={['#2B0A55', '#7A0EED']} style={StyleSheet.absoluteFill} />
        )}

        {/* Scrims behind the header/name and the action buttons keep both
            legible over live camera footage or a busy photo, regardless of
            what's underneath. */}
        <LinearGradient
          colors={['rgba(0,0,0,0.65)', 'rgba(0,0,0,0)']}
          style={[styles.topScrim, { height: insets.top + 180 }]}
        />
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.75)']}
          style={[styles.bottomScrim, { height: insets.bottom + 220 }]}
        />

        <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
          <Text style={styles.callTypeLabel}>
            Incoming {session.callType === 'video' ? 'Video' : 'Audio'} Call
          </Text>

          {!showLocalVideo && (
            <View style={styles.avatarWrap}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarInitial}>{name[0]?.toUpperCase()}</Text>
                </View>
              )}
            </View>
          )}

          <Text style={styles.name} numberOfLines={1}>{name}</Text>
        </View>

        <View style={[styles.actions, { paddingBottom: insets.bottom + 32 }]}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.rejectBtn]}
            onPress={() => friendZoneCallSessionStore.rejectIncoming()}
            activeOpacity={0.85}>
            <Ionicons name="call" size={26} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.acceptBtn]}
            onPress={() => friendZoneCallSessionStore.acceptIncoming()}
            activeOpacity={0.85}>
            <Ionicons name={session.callType === 'video' ? 'videocam' : 'call'} size={26} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#150330',
  },
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  bottomScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  callTypeLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 1 },
  },
  avatarWrap: {
    marginTop: 28,
  },
  avatar: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  name: {
    marginTop: 20,
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 1 },
  },
  actions: {
    marginTop: 'auto',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 40,
  },
  actionBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  rejectBtn: {
    backgroundColor: '#E14C57',
  },
  acceptBtn: {
    backgroundColor: '#22C55E',
  },
});
