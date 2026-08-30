import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { resolveImageUrl, type ChatConversation } from '@/services/api';
import { formatConversationTime } from '../chat.data';

type ConversationListItemProps = {
  conversation: ChatConversation;
  onPress: () => void;
};

export function ConversationListItem({ conversation, onPress }: ConversationListItemProps) {
  const avatarUri = resolveImageUrl(conversation.peer_avatar_url);
  const name = conversation.peer_name || conversation.peer_username || 'User';
  const initial = name.charAt(0).toUpperCase();
  const unread = conversation.unread_count ?? 0;

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      {avatarUri ? (
        <Image source={{ uri: avatarUri }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarInitial}>{initial}</Text>
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <Text style={styles.time}>{formatConversationTime(conversation.last_message_at)}</Text>
        </View>
        <View style={styles.bottomRow}>
          <Text style={[styles.preview, unread > 0 && styles.previewUnread]} numberOfLines={1}>
            {conversation.last_message_preview || (conversation.status === 'pending' ? 'Says hi 👋' : 'Start the conversation')}
          </Text>
          {unread > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
            </View>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#D0C8F0" />
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
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#EDE8F7', alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 20, fontWeight: '700', color: '#7A0EED' },
  body: { flex: 1, gap: 4 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: 15, fontWeight: '700', color: '#1A1730', flex: 1, marginRight: 8 },
  time: { fontSize: 12, color: '#9A94AE' },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  preview: { fontSize: 13, color: '#9A94AE', flex: 1, marginRight: 8 },
  previewUnread: { color: '#1A1730', fontWeight: '600' },
  badge: {
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6,
    backgroundColor: '#7A0EED', alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
});
