import { Ionicons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import { Image } from 'expo-image';
import * as InAppUpdates from 'expo-in-app-updates';
import { useSegments } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  AppState,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

import { GradientButton } from '@/components/ui/gradient-button';

// Re-check this often while the app stays open, on top of every return to
// the foreground — so a release published mid-session still shows up.
const RECHECK_MS = 60 * 60 * 1000;

async function openUpdate() {
  try {
    // Play's full-screen update flow; the app restarts on the new version.
    if (await InAppUpdates.startUpdate(true)) return;
  } catch {}
  // Fallback: the Play Store listing.
  const id = Application.applicationId ?? 'com.tanushssts.raralive';
  Linking.openURL(`market://details?id=${id}`)
    .catch(() => Linking.openURL(`https://play.google.com/store/apps/details?id=${id}`));
}

/**
 * While Google Play has a newer version than the one installed:
 *  - an "Update" tag pinned to the right edge of every screen (Home, Reels,
 *    Video Chat, Live, …). Mounted once in the root layout, above the
 *    navigator, so it never moves between screens;
 *  - a "New version available" popup once per app launch, after the splash.
 * Both disappear on their own once the installed version catches up, because
 * Play then reports no update.
 *
 * Play compares the installed versionCode with the newest one on the store.
 * Its in-app update API only answers for installs that came from Play, so
 * debug / sideloaded builds never show either.
 */
export function AppUpdateTag() {
  const segments = useSegments() as string[];
  const { height } = useWindowDimensions();
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [popupDismissed, setPopupDismissed] = useState(false);

  const check = useCallback(async () => {
    try {
      const result = await InAppUpdates.checkForUpdate();
      setUpdateAvailable(result.updateAvailable);
    } catch {
      // Not installed from Play, offline, or Play unavailable — keep the
      // last known answer rather than flashing the tag on and off.
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    const timer = setInterval(check, RECHECK_MS);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [check]);

  // Launch splash is the root index route (no segments) or /splash. Matched by
  // segment, not pathname: the Home tab's pathname is also "/".
  const onSplash = segments.length === 0 || segments[0] === 'splash';
  if (!updateAvailable || onSplash) return null;

  return (
    <>
      <TouchableOpacity
        style={[styles.tag, { top: Math.round(height * 0.3) }]}
        onPress={openUpdate}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="App update available. Tap to update.">
        <Ionicons name="arrow-up-circle" size={16} color="#FFFFFF" />
        <Text style={styles.tagText}>Update</Text>
      </TouchableOpacity>

      <Modal
        visible={!popupDismissed}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setPopupDismissed(true)}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.logoWrap}>
              <Image source={require('@/assets/images/raralogo.png')} style={styles.logo} contentFit="contain" />
            </View>
            <Text style={styles.title}>New Version Available</Text>
            <Text style={styles.body}>
              A new release of RaRa Live is ready on Google Play. Install it to get the latest features and fixes.
            </Text>
            <GradientButton
              label="Install Update"
              iconName="download-outline"
              style={styles.installBtn}
              onPress={() => {
                setPopupDismissed(true);
                openUpdate();
              }}
            />
            <TouchableOpacity onPress={() => setPopupDismissed(true)} style={styles.laterBtn} activeOpacity={0.7}>
              <Text style={styles.laterText}>Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Flush with the right edge, rounded on the left only, so it reads as a tab
  // and covers as little of each screen as possible.
  tag: {
    position: 'absolute',
    right: 0,
    zIndex: 1000,
    elevation: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 7,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    backgroundColor: '#7A0EED',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  tagText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 12,
    alignItems: 'center',
  },
  logoWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#F1E7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 64, height: 64 },
  title: { marginTop: 14, fontSize: 20, fontWeight: '800', color: '#1C1E22', textAlign: 'center' },
  body: { marginTop: 8, fontSize: 14, lineHeight: 20, color: '#60626A', textAlign: 'center' },
  installBtn: { marginTop: 20, alignSelf: 'stretch' },
  laterBtn: { paddingVertical: 12, paddingHorizontal: 24, marginTop: 4 },
  laterText: { fontSize: 14, fontWeight: '700', color: '#7B7D86' },
});
