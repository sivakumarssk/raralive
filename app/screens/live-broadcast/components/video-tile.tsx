import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RtcSurfaceView, VideoSourceType } from 'react-native-agora';

import { StarfieldBackground } from './starfield-background';

type VideoTileProps = {
  isLocal: boolean;
  uid: number;
  name: string;
  avatarUri?: string;
  isHost?: boolean;
  isCameraOff?: boolean;
  isMicMuted?: boolean;
  hasRemoteVideo?: boolean;
  /** Whether the local Agora engine has actually joined the channel — until then there's no camera surface to render, regardless of isCameraOff. */
  isLocalJoined?: boolean;
  onLongPress?: () => void;
  /** Fullscreen hero tile (main/host view) — bigger centered avatar, no name chip. */
  fullscreen?: boolean;
};

export function VideoTile({
  isLocal, uid, name, avatarUri, isHost, isCameraOff, isMicMuted, hasRemoteVideo = true, isLocalJoined = true, onLongPress, fullscreen = false,
}: VideoTileProps) {
  const showVideo = isLocal ? (isLocalJoined && !isCameraOff) : hasRemoteVideo;

  const content = (
    <View style={s.container}>
      {showVideo ? (
        isLocal ? (
          <RtcSurfaceView
            style={StyleSheet.absoluteFill}
            canvas={{ uid: 0, sourceType: VideoSourceType.VideoSourceCamera }}
            zOrderMediaOverlay
          />
        ) : (
          <RtcSurfaceView style={StyleSheet.absoluteFill} canvas={{ uid }} />
        )
      ) : (
        <View style={StyleSheet.absoluteFill}>
          <StarfieldBackground />
          <View style={s.avatarCenterWrap}>
            <View style={[s.avatarRing, fullscreen && s.avatarRingLarge]}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={s.avatarImg} />
              ) : (
                <View style={s.avatarInitialWrap}>
                  <Text style={[s.avatarInitial, fullscreen && s.avatarInitialLarge]}>{name[0]?.toUpperCase() ?? '?'}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      )}

      {!fullscreen && (
        <View style={s.nameRow}>
          {isHost && (
            <View style={s.hostBadge}>
              <Text style={s.hostBadgeText}>HOST</Text>
            </View>
          )}
          <Text style={s.name} numberOfLines={1}>{name}</Text>
          {isMicMuted && (
            <View style={s.muteBadge}>
              <Ionicons name="mic-off" size={10} color="#FFFFFF" />
            </View>
          )}
        </View>
      )}
    </View>
  );

  if (onLongPress) {
    return (
      <TouchableOpacity activeOpacity={0.9} onLongPress={onLongPress} style={s.touchWrap}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

const s = StyleSheet.create({
  touchWrap: { flex: 1 },
  container: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1C1730',
  },
  avatarCenterWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRing: {
    width: 84, height: 84, borderRadius: 42,
    borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  avatarRingLarge: { width: 92, height: 92, borderRadius: 46 },
  avatarImg: { width: '100%', height: '100%', borderRadius: 999 },
  avatarInitialWrap: {
    width: '100%', height: '100%', borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 26, fontWeight: '800', color: '#FFFFFF' },
  avatarInitialLarge: { fontSize: 30 },
  nameRow: {
    position: 'absolute',
    bottom: 6, left: 6, right: 6,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  hostBadge: {
    backgroundColor: '#F5A623', borderRadius: 5,
    paddingHorizontal: 5, paddingVertical: 1.5,
  },
  hostBadgeText: { fontSize: 8, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },
  name: {
    flex: 1, fontSize: 11, fontWeight: '700', color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  muteBadge: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#E14C57', alignItems: 'center', justifyContent: 'center',
  },
});
