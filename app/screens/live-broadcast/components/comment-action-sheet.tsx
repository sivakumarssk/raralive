import { Ionicons } from '@expo/vector-icons';
import {
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

export type CommentActionTarget = {
  messageId: string;
  userId?: string;
  userName: string;
  avatarUri?: string;
  text: string;
  isPinned: boolean;
};

type CommentActionSheetProps = {
  visible: boolean;
  target: CommentActionTarget | null;
  isHost: boolean;
  onClose: () => void;
  onMention: (target: CommentActionTarget) => void;
  onPin: (target: CommentActionTarget) => void;
  onAddToLiveStreaming: (target: CommentActionTarget) => void;
  onReport: (target: CommentActionTarget) => void;
  onDelete: (target: CommentActionTarget) => void;
  onBlock: (target: CommentActionTarget) => void;
};

function ActionRow({ icon, label, danger, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={s.row}>
      <Ionicons name={icon} size={18} color={danger ? '#E14C57' : '#FFFFFF'} />
      <Text style={[s.rowText, danger && s.rowTextDanger]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function CommentActionSheet({
  visible, target, isHost, onClose,
  onMention, onPin, onAddToLiveStreaming, onReport, onDelete, onBlock,
}: CommentActionSheetProps) {
  if (!target) return null;

  const wrap = (fn: (t: CommentActionTarget) => void) => () => { fn(target); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={s.backdrop} />
      </TouchableWithoutFeedback>
      <View style={s.sheet}>
        <View style={s.handle} />

        <View style={s.header}>
          {target.avatarUri ? (
            <Image source={{ uri: target.avatarUri }} style={s.avatar} />
          ) : (
            <View style={[s.avatar, s.avatarFallback]}>
              <Text style={s.avatarInitial}>{target.userName[0]?.toUpperCase() ?? '?'}</Text>
            </View>
          )}
          <View style={s.headerText}>
            <Text style={s.userName} numberOfLines={1}>{target.userName}</Text>
            <Text style={s.commentText} numberOfLines={2}>{target.text}</Text>
          </View>
        </View>

        <View style={s.divider} />

        <ActionRow icon="at" label="Mention in comment/Reply" onPress={wrap(onMention)} />

        {isHost && (
          <>
            <ActionRow
              icon={target.isPinned ? 'pin' : 'pin-outline'}
              label={target.isPinned ? 'Unpin Comment' : 'Pin Comment'}
              onPress={wrap(onPin)}
            />
            <ActionRow icon="videocam-outline" label="Add to Live Streaming" onPress={wrap(onAddToLiveStreaming)} />
          </>
        )}

        <ActionRow icon="alert-circle-outline" label="Report Comment" danger onPress={wrap(onReport)} />

        {isHost && (
          <ActionRow icon="trash-outline" label="Delete Comment" danger onPress={wrap(onDelete)} />
        )}

        <ActionRow icon="ban-outline" label="Block" danger onPress={wrap(onBlock)} />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#161221', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 10, paddingBottom: 28, paddingHorizontal: 20,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', alignSelf: 'center', marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: { backgroundColor: '#2A2145', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  headerText: { flex: 1, gap: 2 },
  userName: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  commentText: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.12)', marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 },
  rowText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  rowTextDanger: { color: '#E14C57' },
});
