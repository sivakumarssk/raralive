import { Ionicons } from '@expo/vector-icons';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type VoiceRecorderButtonProps = {
  onRecorded: (uri: string, durationMs: number) => void;
  onRecordingChange?: (isRecording: boolean) => void;
};

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function VoiceRecorderButton({ onRecorded, onRecordingChange }: VoiceRecorderButtonProps) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);
  const [preparing, setPreparing] = useState(false);
  const startedAtRef = useRef(0);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true }).catch(() => {});
  }, []);

  const isRecording = recorderState.isRecording;

  useEffect(() => {
    onRecordingChange?.(isRecording);
  }, [isRecording, onRecordingChange]);

  useEffect(() => {
    if (!isRecording) { pulse.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.35, duration: 550, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 550, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isRecording, pulse]);

  const startRecording = async () => {
    if (preparing || isRecording) return;
    setPreparing(true);
    try {
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      if (!granted) { setPreparing(false); return; }
      await recorder.prepareToRecordAsync();
      recorder.record();
      startedAtRef.current = Date.now();
    } finally {
      setPreparing(false);
    }
  };

  const stopRecording = async (send: boolean) => {
    if (!isRecording) return;
    await recorder.stop();
    const durationMs = Date.now() - startedAtRef.current;
    const uri = recorder.uri;
    if (send && uri && durationMs >= 500) {
      onRecorded(uri, durationMs);
    }
  };

  if (isRecording) {
    return (
      <View style={styles.recordingBar}>
        <TouchableOpacity onPress={() => stopRecording(false)} style={styles.cancelBtn} activeOpacity={0.75}>
          <Ionicons name="trash-outline" size={20} color="#FF2A76" />
        </TouchableOpacity>

        <View style={styles.recordingMid}>
          <Animated.View style={[styles.recDot, { transform: [{ scale: pulse }] }]} />
          <Text style={styles.recordingTime}>{formatDuration(recorderState.durationMillis ?? 0)}</Text>
          <View style={styles.waveRow}>
            {[6, 10, 14, 9, 16, 8, 12, 6].map((h, i) => (
              <View key={i} style={[styles.waveBar, { height: h }]} />
            ))}
          </View>
        </View>

        <TouchableOpacity onPress={() => stopRecording(true)} style={styles.sendRecBtn} activeOpacity={0.85}>
          <Ionicons name="send" size={17} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity style={styles.micBtn} activeOpacity={0.8} onPress={startRecording} disabled={preparing}>
      <Ionicons name="mic-outline" size={21} color="#7A0EED" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  micBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F4F0FF', alignItems: 'center', justifyContent: 'center',
  },
  recordingBar: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    height: 44, borderRadius: 22,
    backgroundColor: '#FFF0F5',
    paddingLeft: 6, paddingRight: 6,
  },
  cancelBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  recordingMid: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF2A76' },
  recordingTime: { fontSize: 13.5, fontWeight: '700', color: '#FF2A76', fontVariant: ['tabular-nums'] },
  waveRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3 },
  waveBar: { width: 3, borderRadius: 2, backgroundColor: '#F3A8C4' },
  sendRecBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#7A0EED', alignItems: 'center', justifyContent: 'center',
  },
});
