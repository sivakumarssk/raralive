import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  /** Red confirm button and icon (delete, remove…). */
  danger?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Confirm is running — shows a spinner and blocks closing. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Small centred yes/no popup in the app's own style. */
export function ConfirmDialog({
  visible, title, message, confirmLabel = 'Confirm', danger, icon, busy, onConfirm, onCancel,
}: ConfirmDialogProps) {
  const accent = danger ? '#E14C57' : '#7A0EED';
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={busy ? undefined : onCancel}>
      <Pressable style={s.backdrop} onPress={busy ? undefined : onCancel}>
        {/* Taps on the card don't close it */}
        <Pressable style={s.card}>
          {icon && (
            <View style={[s.iconCircle, { backgroundColor: `${accent}1A` }]}>
              <Ionicons name={icon} size={26} color={accent} />
            </View>
          )}
          <Text style={s.title}>{title}</Text>
          {!!message && <Text style={s.message}>{message}</Text>}
          <View style={s.buttons}>
            <TouchableOpacity style={[s.btn, s.cancelBtn]} onPress={onCancel} disabled={busy} activeOpacity={0.8}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, { backgroundColor: accent }]} onPress={onConfirm} disabled={busy} activeOpacity={0.85}>
              {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.confirmText}>{confirmLabel}</Text>}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  card: { width: '100%', maxWidth: 340, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 22, alignItems: 'center' },
  iconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { fontSize: 17, fontWeight: '800', color: '#1C1E22', textAlign: 'center' },
  message: { fontSize: 14, color: '#6B6E76', textAlign: 'center', marginTop: 6 },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 20, alignSelf: 'stretch' },
  btn: { flex: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cancelBtn: { backgroundColor: '#F2F2F5' },
  cancelText: { fontSize: 15, fontWeight: '700', color: '#1C1E22' },
  confirmText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
