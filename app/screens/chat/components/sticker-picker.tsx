import { FlatList, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { STICKERS } from '../chat.data';

type StickerPickerProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (stickerId: string) => void;
};

export function StickerPicker({ visible, onClose, onSelect }: StickerPickerProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>Stickers</Text>
          <FlatList
            data={STICKERS}
            keyExtractor={(item) => item.id}
            numColumns={4}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.stickerCell}
                activeOpacity={0.7}
                onPress={() => { onSelect(item.id); onClose(); }}
              >
                <Text style={styles.stickerEmoji}>{item.emoji}</Text>
              </TouchableOpacity>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 28, maxHeight: '50%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E0F5', alignSelf: 'center', marginBottom: 12 },
  title: { fontSize: 15, fontWeight: '800', color: '#1A1730', marginBottom: 10 },
  stickerCell: {
    flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center',
    margin: 4, backgroundColor: '#F9F7FF', borderRadius: 16,
  },
  stickerEmoji: { fontSize: 32 },
});
