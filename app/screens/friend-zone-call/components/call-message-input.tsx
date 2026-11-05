import { useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { SendButton } from '@/components/SendButton';

type Props = {
  onSend: (text: string) => void;
};

export function CallMessageInput({ onSend }: Props) {
  const [text, setText] = useState('');

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text);
    setText('');
  };

  return (
    <View style={s.row}>
      <TextInput
        style={s.input}
        value={text}
        onChangeText={setText}
        placeholder="Message…"
        placeholderTextColor="rgba(255,255,255,0.6)"
        onSubmitEditing={handleSend}
        returnKeyType="send"
        blurOnSubmit={false}
      />
      <SendButton onPress={handleSend} disabled={!text.trim()} size={34} />
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 9 : 6,
    fontSize: 13,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
});
