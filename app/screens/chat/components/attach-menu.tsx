import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type AttachMenuProps = {
  visible: boolean;
  onClose: () => void;
  onPickImage: () => void;
  onPickVideo: () => void;
  onPickFile: () => void;
};

export function AttachMenu({ visible, onClose, onPickImage, onPickVideo, onPickFile }: AttachMenuProps) {
  const options = [
    { key: 'image', label: 'Photo', icon: 'image-outline' as const, color: '#7A0EED', onPress: onPickImage },
    { key: 'video', label: 'Video', icon: 'videocam-outline' as const, color: '#FF2A76', onPress: onPickVideo },
    { key: 'file', label: 'File', icon: 'document-outline' as const, color: '#F5A623', onPress: onPickFile },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.row}>
            {options.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={styles.item}
                activeOpacity={0.8}
                onPress={() => { onClose(); opt.onPress(); }}
              >
                <View style={[styles.iconCircle, { backgroundColor: `${opt.color}1A` }]}>
                  <Ionicons name={opt.icon} size={24} color={opt.color} />
                </View>
                <Text style={styles.label}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 32,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E0F5', alignSelf: 'center', marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-around' },
  item: { alignItems: 'center', gap: 8 },
  iconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12.5, fontWeight: '600', color: '#1A1730' },
});
