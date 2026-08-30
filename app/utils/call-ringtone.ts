import { Platform } from 'react-native';

// Plays a bundled ringtone on a loop while a Friend Zone call is incoming.
// Only the callee should ever hear this (see friend-zone-call-session-store.ts,
// which gates calling startRingtone() to the 'incoming_ringing' phase only).
//
// Earlier attempts played the device's actual system ringtone via
// content://settings/system/ringtone (and notification_sound as a fallback)
// through expo-audio — on the test device both URIs briefly reported
// isLoaded: true then regressed to false with duration: 0, meaning Android
// was denying the app real read access to the audio data after the initial
// metadata handshake. A bundled asset sidesteps that entirely since it's
// packaged into the app, not fetched through a content provider.
//
// expo-audio ships a native module that only exists after a native rebuild
// — until that happens, `require`-ing it throws at import time. Everything
// here is loaded lazily and defensively so a stale/JS-only build silently
// rings nothing instead of crashing whatever screen imports this module.

const RINGTONE_ASSET = require('@/assets/sounds/ringtone.mp3');

type AudioModule = typeof import('expo-audio');
type AudioPlayer = ReturnType<AudioModule['createAudioPlayer']>;

let audioModule: AudioModule | null | undefined;
function getAudio(): AudioModule | null {
  if (audioModule !== undefined) return audioModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    audioModule = require('expo-audio') as AudioModule;
  } catch (e) {
    console.warn('[Ringtone] expo-audio native module unavailable — ringing will be silent until the app is rebuilt:', e);
    audioModule = null;
  }
  return audioModule ?? null;
}

let player: AudioPlayer | null = null;
let ringing = false;

export function startRingtone() {
  if (ringing || Platform.OS !== 'android') return;
  const Audio = getAudio();
  if (!Audio) return;

  ringing = true;
  try {
    Audio.setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => {});

    const p = Audio.createAudioPlayer(RINGTONE_ASSET);
    player = p;
    p.volume = 1.0;
    p.loop = true;

    // createAudioPlayer() is synchronous but loading is async — play()
    // immediately in case it's already loaded, and again the first time
    // the status listener confirms isLoaded, whichever actually starts it.
    let startedAfterLoad = false;
    p.addListener('playbackStatusUpdate', (status) => {
      if (status.isLoaded && !status.playing && !startedAfterLoad && player === p) {
        startedAfterLoad = true;
        p.play();
      }
    });

    p.play();
  } catch (e) {
    console.warn('[Ringtone] failed to start:', e);
    ringing = false;
    player = null;
  }
}

export function stopRingtone() {
  if (!ringing) return;
  ringing = false;
  try {
    player?.pause();
    player?.remove();
  } catch {
    // Non-fatal — player may already be released.
  }
  player = null;
}
