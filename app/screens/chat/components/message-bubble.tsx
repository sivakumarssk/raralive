import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { MEDIA_BASE, type DirectMessage } from '@/services/api';
import { formatMessageTime, stickerEmoji } from '../chat.data';

type MessageBubbleProps = {
  message: DirectMessage;
  isMine: boolean;
  showReceipt?: boolean;
  isRead?: boolean;
};

function resolveMediaUrl(url: string | null): string | undefined {
  if (!url) return undefined;
  return url.startsWith('http') ? url : `${MEDIA_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

function AudioBubble({ uri, isMine }: { uri: string; isMine: boolean }) {
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);

  const toggle = () => {
    if (status.playing) player.pause();
    else { player.seekTo(0); player.play(); }
  };

  const durationSec = Math.round((status.duration || 0));

  return (
    <TouchableOpacity style={styles.audioRow} onPress={toggle} activeOpacity={0.8}>
      <Ionicons name={status.playing ? 'pause-circle' : 'play-circle'} size={30} color={isMine ? '#FFFFFF' : '#7A0EED'} />
      <View style={styles.audioWave}>
        {[3, 6, 4, 8, 5, 7, 3].map((h, i) => (
          <View key={i} style={[styles.audioBar, { height: h * 2, backgroundColor: isMine ? 'rgba(255,255,255,0.7)' : '#B79BEB' }]} />
        ))}
      </View>
      <Text style={[styles.audioDuration, isMine && styles.textMine]}>{durationSec ? `${durationSec}s` : ''}</Text>
    </TouchableOpacity>
  );
}

function ReadReceipt({ isRead, onDark }: { isRead: boolean; onDark: boolean }) {
  const sentColor = onDark ? 'rgba(255,255,255,0.65)' : '#9A94AE';
  // On the purple bubble a light blue tick blends into the background, so
  // "read" uses a warm gold there instead — high contrast on dark and light
  // alike, and still visually distinct from the muted "sent" gray/white.
  const readColor = onDark ? '#FFD54A' : '#34B7F1';
  return (
    <Ionicons
      name={isRead ? 'checkmark-done' : 'checkmark'}
      size={14}
      color={isRead ? readColor : sentColor}
      style={styles.receiptIcon}
    />
  );
}

export function MessageBubble({ message, isMine, showReceipt, isRead }: MessageBubbleProps) {
  const time = formatMessageTime(message.created_at);

  const content = (() => {
    switch (message.type) {
      case 'text':
        return <Text style={[styles.text, isMine && styles.textMine]}>{message.text}</Text>;
      case 'sticker':
        return <Text style={styles.stickerEmoji}>{stickerEmoji(message.sticker_id)}</Text>;
      case 'image': {
        const uri = resolveMediaUrl(message.media_url);
        return uri ? <Image source={{ uri }} style={styles.image} resizeMode="cover" /> : null;
      }
      case 'audio': {
        const uri = resolveMediaUrl(message.media_url);
        return uri ? <AudioBubble uri={uri} isMine={isMine} /> : null;
      }
      case 'video': {
        const uri = resolveMediaUrl(message.media_url);
        return (
          <TouchableOpacity onPress={() => uri && Linking.openURL(uri)} activeOpacity={0.85} style={styles.videoWrap}>
            <Ionicons name="play-circle" size={40} color="#FFFFFF" />
            <Text style={styles.videoLabel}>Video</Text>
          </TouchableOpacity>
        );
      }
      case 'file': {
        const uri = resolveMediaUrl(message.media_url);
        return (
          <TouchableOpacity onPress={() => uri && Linking.openURL(uri)} activeOpacity={0.8} style={styles.fileRow}>
            <Ionicons name="document-text-outline" size={22} color={isMine ? '#FFFFFF' : '#7A0EED'} />
            <Text style={[styles.fileName, isMine && styles.textMine]} numberOfLines={1}>{message.media_name || 'File'}</Text>
          </TouchableOpacity>
        );
      }
      default:
        return null;
    }
  })();

  const isMediaOnly = message.type === 'sticker' || message.type === 'image';

  return (
    <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
      <View
        style={[
          !isMediaOnly && styles.bubble,
          !isMediaOnly && (isMine ? styles.bubbleMine : styles.bubbleTheirs),
        ]}
      >
        {content}
        {!isMediaOnly && (
          <View style={styles.timeRow}>
            <Text style={[styles.time, isMine && styles.timeMine]}>{time}</Text>
            {isMine && showReceipt && <ReadReceipt isRead={!!isRead} onDark={isMine} />}
          </View>
        )}
      </View>
      {isMediaOnly && (
        <View style={styles.timeRow}>
          <Text style={styles.timeUnderMedia}>{time}</Text>
          {isMine && showReceipt && <ReadReceipt isRead={!!isRead} onDark={false} />}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginVertical: 4, paddingHorizontal: 12 },
  rowMine: { alignItems: 'flex-end' },
  rowTheirs: { alignItems: 'flex-start' },
  bubble: { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  bubbleMine: { backgroundColor: '#7A0EED', borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: '#F4F0FF', borderBottomLeftRadius: 4 },
  text: { fontSize: 14.5, color: '#1A1730', lineHeight: 20 },
  textMine: { color: '#FFFFFF' },
  timeRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 3, gap: 2 },
  time: { fontSize: 10, color: '#9A94AE' },
  timeMine: { color: 'rgba(255,255,255,0.7)' },
  timeUnderMedia: { fontSize: 10, color: '#9A94AE' },
  receiptIcon: { marginLeft: 1 },
  stickerEmoji: { fontSize: 56 },
  image: { width: 200, height: 200, borderRadius: 16 },
  audioRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 160 },
  audioWave: { flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 },
  audioBar: { width: 3, borderRadius: 2 },
  audioDuration: { fontSize: 11, color: '#9A94AE', fontWeight: '600' },
  videoWrap: {
    width: 200, height: 140, borderRadius: 16, backgroundColor: '#1A1730',
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  videoLabel: { fontSize: 12, color: '#FFFFFF', fontWeight: '600' },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 220 },
  fileName: { fontSize: 13.5, color: '#1A1730', fontWeight: '600', flexShrink: 1 },
});
