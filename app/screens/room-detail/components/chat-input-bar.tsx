import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  Image,
  Keyboard,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const COIN_IMG = require('@/assets/tabs/coin.png');
const BATTLE_IMG = require('@/assets/tabs/chatroom/battle.png');

type ChatInputBarProps = {
  onSend?: (text: string) => void;
  onGiftOpen?: () => void;
  onCoinPress?: () => void;
  onBattlePress?: () => void;
  hasRoomBg?: boolean;
};

export function ChatInputBar({ onSend, onGiftOpen, onCoinPress, onBattlePress, hasRoomBg }: ChatInputBarProps) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => {
      setFocused(false);
      inputRef.current?.blur();
    });
    return () => sub.remove();
  }, []);

  const handleSend = () => {
    if (!text.trim()) return;
    onSend?.(text.trim());
    setText('');
  };

  return (
    <View style={[bar.container, hasRoomBg && bar.containerBg]}>
        {/* Collapsed: input + battle + gift */}

        <View style={[bar.inputWrap, hasRoomBg && bar.inputWrapBg]}>
          <TextInput
            ref={inputRef}
            style={[bar.input, hasRoomBg && bar.inputBg]}
            placeholder="Say something..."
            placeholderTextColor={hasRoomBg ? 'rgba(255,255,255,0.5)' : '#ABADB2'}
            value={text}
            onChangeText={setText}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            underlineColorAndroid="transparent"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
        </View>

        {/* Send button — always visible */}
        <TouchableOpacity onPress={handleSend} activeOpacity={0.85} style={bar.sendBtn}>
          <LinearGradient
            colors={['#7A0EED', '#B50357']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={bar.sendGradient}>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>

{!focused && (
          <TouchableOpacity onPress={onBattlePress} activeOpacity={0.85} style={bar.giftBtn}>
            <Image source={BATTLE_IMG} style={bar.battleImg} />
          </TouchableOpacity>
        )}


        {!focused && (
          <TouchableOpacity onPress={onGiftOpen} activeOpacity={0.85} style={bar.giftBtn}>
            <LinearGradient colors={['#F5A623', '#F07A1A']} style={bar.giftGradient}>
              <Ionicons name="gift-outline" size={18} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        )}

        
    </View>
  );
}

const bar = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0EDF8',
    gap: 8,
  },
  containerBg: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  coinBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF4DE',
    borderWidth: 2,
    borderColor: '#F5A623',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinImg: {
    width: 22,
    height: 22,
  },
  battleImg: {
    width: 35,
    height: 35,
  },
  inputWrap: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F4F5F8',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  inputWrapBg: { backgroundColor: 'rgba(255,255,255,0.15)' },
  input: { fontSize: 14, color: '#1C1E22' },
  inputBg: { color: '#FFFFFF' },
  giftBtn: {
    borderRadius: 19,
    overflow: 'hidden',
  },
  giftGradient: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtn: {
    borderRadius: 21,
    overflow: 'hidden',
  },
  sendGradient: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
