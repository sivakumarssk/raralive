import { useEffect, useState } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

// Lightweight, non-Agora front-camera preview shown while a video call is
// ringing (either side, before the call connects) — deliberately avoids
// spinning up the Agora engine (permissions, token fetch, channel init)
// just to show a preview. Once the call actually connects, the caller
// switches to the real Agora RtcSurfaceView instead (see
// friend-zone-call-screen.tsx / IncomingCallOverlay.tsx) — this component
// only ever renders during the ringing phases.
//
// expo-camera ships a native module that only exists after a native
// rebuild — until that happens, importing it throws at module-eval time.
// Loaded lazily/defensively so a stale/JS-only build just shows nothing
// instead of crashing the ringing screen.

let CameraViewComponent: any = null;
let useCameraPermissionsHook: any = null;
let loadError: unknown = null;

function loadCameraModule() {
  if (CameraViewComponent || loadError) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-camera');
    CameraViewComponent = mod.CameraView;
    useCameraPermissionsHook = mod.useCameraPermissions;
  } catch (e) {
    console.warn('[LocalCameraPreview] expo-camera native module unavailable — preview will be blank until the app is rebuilt:', e);
    loadError = e;
  }
}
loadCameraModule();

export function LocalCameraPreview({ style }: { style?: ViewProps['style'] }) {
  const [ready, setReady] = useState(!!CameraViewComponent);

  useEffect(() => {
    if (!CameraViewComponent || !useCameraPermissionsHook) return;
    setReady(true);
  }, []);

  if (!CameraViewComponent || !useCameraPermissionsHook) {
    return <View style={[styles.fallback, style]} />;
  }

  return <PermissionedCameraPreview style={style} />;
}

function PermissionedCameraPreview({ style }: { style?: ViewProps['style'] }) {
  const [permission, requestPermission] = useCameraPermissionsHook();

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  if (!permission?.granted) {
    return <View style={[styles.fallback, style]} />;
  }

  return <CameraViewComponent style={[styles.camera, style]} facing="front" />;
}

const styles = StyleSheet.create({
  fallback: { backgroundColor: '#000' },
  camera: { flex: 1 },
});
