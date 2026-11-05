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

import { ModalBottomSheet, ModalSafeArea } from '@/components/ModalBottomSheet';

import { RS, RT } from '../room-ui';
import { avatarSource } from '@/utils/default-avatar';

export type MessageActionTarget = {
  messageId: string;
  userId?: string;
  userName: string;
  avatarUri?: string;
  text: string;
  isPinned: boolean;
  /** The host tapped their own message — Block / Report don't apply. */
  isOwn: boolean;
};

type Action = 'pin' | 'delete' | 'block' | 'report';

// Actions on a chat message. Host: Pin (to top) / Delete / Block / Report.
// Everyone else: Report only.
export function MessageActionSheet({ target, isHost, onClose, onAction }: {
  target: MessageActionTarget | null;
  isHost: boolean;
  onClose: () => void;
  onAction: (action: Action, target: MessageActionTarget) => void;
}) {
  if (!target) return null;

  type Row = { key: Action; icon: keyof typeof Ionicons.glyphMap; label: string; danger?: boolean };
  const pin: Row = { key: 'pin', icon: target.isPinned ? 'pin' : 'pin-outline', label: target.isPinned ? 'Unpin' : 'Pin to top' };
  const del: Row = { key: 'delete', icon: 'trash-outline', label: 'Delete', danger: true };
  const block: Row = { key: 'block', icon: 'ban-outline', label: 'Block', danger: true };
  const report: Row = { key: 'report', icon: 'warning-outline', label: 'Report', danger: true };
  const rows: Row[] = isHost
    ? (target.isOwn ? [pin, del] : [pin, del, block, report])
    : [report];

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      {/* Insets measured inside the modal's own window — see ModalBottomSheet */}
      <ModalSafeArea>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={s.backdrop} />
      </TouchableWithoutFeedback>

      <ModalBottomSheet style={s.sheet} minPadding={16} extraPadding={8}>
        <View style={s.handle} />

        {/* The message being acted on */}
        <View style={s.preview}>
          <Image source={avatarSource(target.avatarUri)} style={s.avatar} />
          <View style={s.previewText}>
            <Text style={s.name} numberOfLines={1}>{target.userName}</Text>
            <Text style={s.message} numberOfLines={2}>{target.text}</Text>
          </View>
        </View>

        {rows.map(r => (
          <TouchableOpacity
            key={r.key}
            onPress={() => { onClose(); onAction(r.key, target); }}
            activeOpacity={0.75}
            style={s.row}>
            <View style={[s.iconBox, r.danger && s.iconBoxDanger]}>
              <Ionicons name={r.icon} size={17} color={r.danger ? '#E14C57' : '#7A0EED'} />
            </View>
            <Text style={[s.rowText, r.danger && s.rowTextDanger]}>{r.label}</Text>
          </TouchableOpacity>
        ))}
      </ModalBottomSheet>
      </ModalSafeArea>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: RS.sheetRadius, borderTopRightRadius: RS.sheetRadius,
    paddingTop: 8, paddingHorizontal: RS.pad,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E0DDF5', alignSelf: 'center', marginBottom: 12 },

  preview: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F7F5FC', borderRadius: 12, padding: 10, marginBottom: 6,
  },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: { backgroundColor: '#EDE8F7', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: RT.body, fontWeight: '700', color: '#7A0EED' },
  previewText: { flex: 1, gap: 2 },
  name: { fontSize: RT.secondary, fontWeight: '700', color: '#3A3C42' },
  message: { fontSize: RT.body, color: '#1C1E22', lineHeight: 19 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  iconBox: {
    width: RS.iconBox, height: RS.iconBox, borderRadius: 10,
    backgroundColor: '#F4EEFF', alignItems: 'center', justifyContent: 'center',
  },
  iconBoxDanger: { backgroundColor: '#FFF1F2' },
  rowText: { fontSize: RT.body, fontWeight: '600', color: '#1C1E22' },
  rowTextDanger: { color: '#E14C57' },
});
