import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
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
  onSettingsPress?: () => void;
  hasRoomBg?: boolean;
  showBattle?: boolean;
  showSettings?: boolean;
  /** Notified whenever the input gains/loses focus — lets a parent hide sibling UI (e.g. a gift bar row) while the keyboard is up. */
  onFocusChange?: (focused: boolean) => void;
  /** Bumping this (e.g. with an incrementing counter) replaces the current draft with prefillText and focuses the input — used for "Mention/Reply". */
  prefillText?: string;
  prefillKey?: number;
};

export function ChatInputBar({ onSend, onGiftOpen, onCoinPress, onBattlePress, onSettingsPress, hasRoomBg, showBattle = true, showSettings = false, onFocusChange, prefillText, prefillKey }: ChatInputBarProps) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => {
      setFocused(false);
      onFocusChange?.(false);
      inputRef.current?.blur();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (prefillKey === undefined || prefillText === undefined) return;
    setText(prefillText);
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillKey]);

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
            onFocus={() => { setFocused(true); onFocusChange?.(true); }}
            onBlur={() => { setFocused(false); onFocusChange?.(false); }}
          />

          {/* Send button — embedded inside the input pill */}
          <TouchableOpacity onPress={handleSend} activeOpacity={0.85} style={bar.sendBtn}>
            <LinearGradient
              colors={['#7A0EED', '#B50357']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={bar.sendGradient}>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {!focused && showBattle && (
          <TouchableOpacity onPress={onBattlePress} activeOpacity={0.85} style={bar.giftBtn}>
            <ExpoImage source={BATTLE_IMG} style={bar.battleImg} contentFit="contain" />
          </TouchableOpacity>
        )}


        {!focused && (
          <TouchableOpacity onPress={onGiftOpen} activeOpacity={0.85} style={bar.giftBtn}>
            <LinearGradient colors={['#F5A623', '#F07A1A']} style={bar.giftGradient}>
              <Ionicons name="gift-outline" size={18} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {!focused && showSettings && (
          <TouchableOpacity onPress={onSettingsPress} activeOpacity={0.85} style={[bar.settingsBtn, !hasRoomBg && bar.settingsBtnLight]}>
            <Ionicons name="settings-outline" size={18} color={hasRoomBg ? '#FFFFFF' : '#5B5D66'} />
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
    gap: 4,
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
    width: 26,
    height: 26,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F4F5F8',
    borderWidth: 1,
    borderColor: '#E7E4F2',
    paddingLeft: 16,
    paddingRight: 4,
    gap: 8,
  },
  inputWrapBg: { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.25)' },
  input: { flex: 1, fontSize: 14, color: '#1C1E22', padding: 0, borderWidth: 0 },
  inputBg: { color: '#FFFFFF' },
  giftBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  settingsBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  settingsBtnLight: {
    backgroundColor: '#F4F5F8',
  },
  giftGradient: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtn: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  sendGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
