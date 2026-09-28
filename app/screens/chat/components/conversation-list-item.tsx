import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { resolveImageUrl, type ChatConversation } from '@/services/api';
import { formatConversationTime } from '../chat.data';

type ConversationListItemProps = {
  conversation: ChatConversation;
  onPress: () => void;
  onLongPress?: () => void;
  selectMode?: boolean;
  selected?: boolean;
  isOnline?: boolean;
};

export function ConversationListItem({ conversation, onPress, onLongPress, selectMode, selected, isOnline }: ConversationListItemProps) {
  const router = useRouter();
  const avatarUri = resolveImageUrl(conversation.peer_avatar_url);
  const name = conversation.peer_name || conversation.peer_username || 'User';
  const initial = name.charAt(0).toUpperCase();
  const unread = conversation.unread_count ?? 0;

  return (
    <TouchableOpacity
      style={[styles.row, conversation.pinned && styles.rowPinned]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={280}
      activeOpacity={0.7}>
      {selectMode && (
        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
          {selected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
        </View>
      )}

      <TouchableOpacity
        style={styles.avatarWrap}
        activeOpacity={selectMode ? 1 : 0.7}
        disabled={selectMode}
        onPress={() => conversation.peer_id && router.push(`/user/${conversation.peer_id}` as any)}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
        )}
        {isOnline && <View style={styles.onlineDot} />}
      </TouchableOpacity>

      <View style={styles.body}>
        <View style={styles.topRow}>
          <View style={styles.nameRow}>
            {conversation.pinned && <Ionicons name="pin" size={12} color="#7A0EED" style={styles.pinIcon} />}
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
          </View>
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

      {!selectMode && <Ionicons name="chevron-forward" size={18} color="#D0C8F0" />}
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
  rowPinned: { backgroundColor: '#FAF7FF' },
  checkbox: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: '#D0C8F0',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxSelected: { backgroundColor: '#7A0EED', borderColor: '#7A0EED' },
  avatarWrap: { position: 'relative' },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#EDE8F7', alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 20, fontWeight: '700', color: '#7A0EED' },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 13, height: 13, borderRadius: 6.5,
    backgroundColor: '#3ED598', borderWidth: 2, borderColor: '#FFFFFF',
  },
  body: { flex: 1, gap: 4 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nameRow: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  pinIcon: { marginRight: 4 },
  name: { fontSize: 15, fontWeight: '700', color: '#1A1730', flexShrink: 1 },
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
