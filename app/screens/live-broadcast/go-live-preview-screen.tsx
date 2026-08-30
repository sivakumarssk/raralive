import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StarfieldBackground } from './components/starfield-background';
import { MEDIA_BASE, apiStartBroadcast } from '@/services/api';
import { authStore } from '@/store/auth-store';

function resolveAvatar(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  return `${MEDIA_BASE}/${url.replace(/^\//, '')}`;
}

// expo-camera ships a native module that only exists after a native rebuild —
// loaded lazily/defensively so a stale/JS-only build shows the starfield
// fallback instead of crashing (same rationale as LocalCameraPreview.tsx).
let CameraViewComponent: any = null;
let useCameraPermissionsHook: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('expo-camera');
  CameraViewComponent = mod.CameraView;
  useCameraPermissionsHook = mod.useCameraPermissions;
} catch {}

const COUNTDOWN_FROM = 5;

const hasCameraModule = !!CameraViewComponent && !!useCameraPermissionsHook;

// Isolates the conditional expo-camera hook so it's only ever called when
// the native module is actually present — GoLivePreviewScreen itself never
// calls a hook conditionally.
function PreviewCamera({ facing, cameraOn, fallback }: { facing: 'front' | 'back'; cameraOn: boolean; fallback: React.ReactNode }) {
  const [permission, requestPermission] = useCameraPermissionsHook();

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  if (!permission?.granted || !cameraOn) return <>{fallback}</>;
  return <CameraViewComponent style={StyleSheet.absoluteFill} facing={facing} />;
}

export function GoLivePreviewScreen() {
  const user = authStore.getUser();
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [starting, setStarting] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const startResultRef = useRef<{ roomId: string; channelName: string } | null>(null);

  // Countdown ticks 5→1 once the broadcast has actually been created, then enters the live room.
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      const result = startResultRef.current;
      if (result) {
        router.replace({ pathname: '/live-broadcast/[id]', params: { id: result.roomId, channel: result.channelName } });
      }
      return;
    }
    const t = setTimeout(() => setCountdown(c => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleGoLive = async () => {
    if (starting || countdown !== null) return;
    setStarting(true);
    setErrorMsg(null);
    const token = authStore.getToken();
    const result = token ? await apiStartBroadcast(token) : null;
    setStarting(false);

    if (!result?.ok) {
      setErrorMsg(result?.message ?? 'Could not start the broadcast. Try again.');
      return;
    }
    startResultRef.current = { roomId: result.data.roomId, channelName: result.data.channelName };
    setCountdown(COUNTDOWN_FROM);
  };

  const fallback = (
    <View style={StyleSheet.absoluteFill}>
      <StarfieldBackground />
      <View style={s.avatarCenterWrap}>
        <View style={s.avatarRing}>
          {resolveAvatar(user?.avatarUrl) ? (
            <Image source={{ uri: resolveAvatar(user?.avatarUrl) }} style={s.avatarImg} />
          ) : (
            <View style={s.avatarInitialWrap}>
              <Text style={s.avatarInitial}>{(user?.fullName || user?.username || '?')[0]?.toUpperCase()}</Text>
            </View>
          )}
        </View>
        {!cameraOn && <Text style={s.cameraOffHint}>Camera is off</Text>}
      </View>
    </View>
  );

  return (
    <View style={s.root}>
      <View style={StyleSheet.absoluteFill}>
        {hasCameraModule
          ? <PreviewCamera facing={facing} cameraOn={cameraOn} fallback={fallback} />
          : fallback}
      </View>

      <SafeAreaView style={s.overlayRoot} edges={['top', 'bottom']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.headerIconBtn} hitSlop={8} disabled={countdown !== null}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Go Live Preview</Text>
          <View style={s.headerIconBtn} />
        </View>

        <View style={s.spacer} />

        {errorMsg && (
          <View style={s.errorBanner}>
            <Ionicons name="alert-circle-outline" size={15} color="#FFFFFF" />
            <Text style={s.errorText}>{errorMsg}</Text>
          </View>
        )}

        {/* Preview controls — hidden once the countdown starts */}
        {countdown === null && (
          <>
            <View style={s.controlRow}>
              <PreviewControlButton
                icon={micOn ? 'mic' : 'mic-off'}
                label="Mic"
                active={micOn}
                onPress={() => setMicOn(v => !v)}
              />
              <PreviewControlButton
                icon={cameraOn ? 'videocam' : 'videocam-off'}
                label="Camera"
                active={cameraOn}
                onPress={() => setCameraOn(v => !v)}
              />
              <PreviewControlButton
                icon="camera-reverse"
                label="Flip"
                active
                disabled={!cameraOn}
                onPress={() => setFacing(f => (f === 'front' ? 'back' : 'front'))}
              />
            </View>

            <TouchableOpacity onPress={handleGoLive} activeOpacity={0.9} style={s.goLiveBtn} disabled={starting}>
              <LinearGradient colors={['#7A0EED', '#B50357']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.goLiveGrad}>
                {starting
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Ionicons name="videocam" size={20} color="#FFFFFF" />}
                <Text style={s.goLiveText}>{starting ? 'Starting…' : 'Go Live'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}
      </SafeAreaView>

      {/* Countdown overlay */}
      {countdown !== null && countdown > 0 && (
        <View style={s.countdownOverlay} pointerEvents="none">
          <Text style={s.countdownLabel}>You're going live in</Text>
          <Text style={s.countdownNumber}>{countdown}</Text>
        </View>
      )}
    </View>
  );
}

function PreviewControlButton({ icon, label, active, disabled, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} disabled={disabled} style={s.ctrlItem}>
      <View style={[s.ctrlBtn, !active && s.ctrlBtnInactive, disabled && s.ctrlBtnDisabled]}>
        <Ionicons name={icon} size={22} color={active ? '#FFFFFF' : '#E14C57'} />
      </View>
      <Text style={s.ctrlLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1A0F3D' },
  overlayRoot: { flex: 1 },
  spacer: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingTop: 6,
  },
  headerIconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  avatarCenterWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 12 },
  avatarRing: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImg: { width: '100%', height: '100%', borderRadius: 999 },
  avatarInitialWrap: {
    width: '100%', height: '100%', borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 32, fontWeight: '800', color: '#FFFFFF' },
  cameraOffHint: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(225,76,87,0.85)', marginHorizontal: 20, marginBottom: 16,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  errorText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  controlRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 28,
    marginBottom: 22,
  },
  ctrlItem: { alignItems: 'center', gap: 6 },
  ctrlBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  ctrlBtnInactive: { backgroundColor: 'rgba(225,76,87,0.35)' },
  ctrlBtnDisabled: { opacity: 0.4 },
  ctrlLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  goLiveBtn: {
    marginHorizontal: 24, marginBottom: 24, borderRadius: 48, overflow: 'hidden',
    shadowColor: '#7A0EED', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 6,
  },
  goLiveGrad: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  goLiveText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', gap: 14,
  },
  countdownLabel: { fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  countdownNumber: { fontSize: 96, fontWeight: '900', color: '#FFFFFF' },
});
