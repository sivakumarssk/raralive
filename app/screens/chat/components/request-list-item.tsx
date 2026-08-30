import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { resolveImageUrl, type ChatConversation } from '@/services/api';

type RequestListItemProps = {
  conversation: ChatConversation;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
  onPress: () => void;
};

export function RequestListItem({ conversation, busy, onAccept, onReject, onPress }: RequestListItemProps) {
  const avatarUri = resolveImageUrl(conversation.peer_avatar_url);
  const name = conversation.peer_name || conversation.peer_username || 'User';
  const initial = name.charAt(0).toUpperCase();

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.85}>
      {avatarUri ? (
        <Image source={{ uri: avatarUri }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarInitial}>{initial}</Text>
        </View>
      )}
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        <Text style={styles.preview} numberOfLines={1}>{conversation.last_message_preview || 'wants to message you'}</Text>
      </View>
      {busy ? (
        <ActivityIndicator size="small" color="#7A0EED" />
      ) : (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.rejectBtn} onPress={onReject} activeOpacity={0.8}>
            <Text style={styles.rejectText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.acceptBtn} onPress={onAccept} activeOpacity={0.8}>
            <Text style={styles.acceptText}>Accept</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#EDE8F7', alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 18, fontWeight: '700', color: '#7A0EED' },
  body: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontWeight: '700', color: '#1A1730' },
  preview: { fontSize: 12.5, color: '#9A94AE' },
  actions: { flexDirection: 'row', gap: 8 },
  rejectBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
    backgroundColor: '#F4F0FF', borderWidth: 1, borderColor: '#E9D5FF',
  },
  rejectText: { fontSize: 12.5, fontWeight: '700', color: '#9A94AE' },
  acceptBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
    backgroundColor: '#7A0EED',
  },
  acceptText: { fontSize: 12.5, fontWeight: '700', color: '#FFFFFF' },
});
