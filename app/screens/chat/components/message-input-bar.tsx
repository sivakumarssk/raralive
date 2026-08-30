import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { VoiceRecorderButton } from './voice-recorder-button';

type MessageInputBarProps = {
  onSendText: (text: string) => void;
  onAttach: () => void;
  onSticker: () => void;
  onRecorded: (uri: string, durationMs: number) => void;
  onTyping: (isTyping: boolean) => void;
};

export function MessageInputBar({ onSendText, onAttach, onSticker, onRecorded, onTyping }: MessageInputBarProps) {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  const handleChange = (value: string) => {
    setText(value);
    onTyping(value.length > 0);
  };

  const handleSend = () => {
    if (!text.trim()) return;
    onSendText(text.trim());
    setText('');
    onTyping(false);
  };

  const handleRecorded = (uri: string, durationMs: number) => {
    setIsRecording(false);
    onRecorded(uri, durationMs);
  };

  const hasText = text.trim().length > 0;

  return (
    <View style={styles.container}>
      {!isRecording && (
        <TouchableOpacity onPress={onAttach} style={styles.iconBtn} activeOpacity={0.8}>
          <Ionicons name="add-circle-outline" size={26} color="#7A0EED" />
        </TouchableOpacity>
      )}

      {!isRecording && (
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            placeholder="Message..."
            placeholderTextColor="#ABADB2"
            value={text}
            onChangeText={handleChange}
            multiline
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity onPress={onSticker} style={styles.stickerBtn} activeOpacity={0.8}>
            <Ionicons name="happy-outline" size={22} color="#9A94AE" />
          </TouchableOpacity>
        </View>
      )}

      {hasText ? (
        <TouchableOpacity onPress={handleSend} style={styles.sendBtn} activeOpacity={0.85}>
          <Ionicons name="send" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      ) : (
        <VoiceRecorderButton onRecorded={handleRecorded} onRecordingChange={setIsRecording} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12,
    backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F0EDF8',
  },
  iconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  inputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'flex-end',
    minHeight: 40, maxHeight: 120, borderRadius: 20,
    backgroundColor: '#F4F5F8', paddingHorizontal: 14, paddingVertical: 8, gap: 6,
  },
  input: { flex: 1, fontSize: 14, color: '#1C1E22', maxHeight: 100 },
  stickerBtn: { paddingBottom: 2 },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#7A0EED', alignItems: 'center', justifyContent: 'center',
  },
});
