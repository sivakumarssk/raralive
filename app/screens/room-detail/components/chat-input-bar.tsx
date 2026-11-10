import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { SendButton } from '@/components/SendButton';

const COIN_IMG = require('@/assets/tabs/coin.png');
const BATTLE_IMG = require('@/assets/tabs/chatroom/battle.png');
const BAG_IMG = require('@/assets/tabs/chatroom/extrabag.png');
const GIFT_IMG = require('@/assets/tabs/chatroom/gift-box.png');
const ACTION_SIZE = 30;

type ChatInputBarProps = {
  onSend?: (text: string) => void;
  onGiftOpen?: () => void;
  onCoinPress?: () => void;
  onBattlePress?: () => void;
  /** The bag button only shows when this is passed. */
  onBagPress?: () => void;
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

export function ChatInputBar({ onSend, onGiftOpen, onCoinPress, onBattlePress, onBagPress, onSettingsPress, hasRoomBg, showBattle = true, showSettings = false, onFocusChange, prefillText, prefillKey }: ChatInputBarProps) {
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
        {/* Collapsed: input + gift + battle + bag */}

        <View style={[bar.inputWrap, hasRoomBg && bar.inputWrapBg]}>
          <TextInput
            ref={inputRef}
            style={[bar.input, hasRoomBg && bar.inputBg]}
            placeholder="Type..."
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
          <SendButton onPress={handleSend} size={30} />
        </View>

        {/* Bag → battle → gift: same-size slots, close together */}
        {!focused && (
          <View style={bar.actions}>
            {onBagPress && (
              <TouchableOpacity onPress={onBagPress} activeOpacity={0.85} style={bar.actionBtn} accessibilityLabel="Bag">
                {/* Line icon in a square outline: white over a room background, dark on the plain bar */}
                <View style={[bar.bagBox, { borderColor: hasRoomBg ? '#FFFFFF' : '#1C1E22' }]}>
                  <ExpoImage source={BAG_IMG} style={bar.bagImg} contentFit="contain" tintColor={hasRoomBg ? '#FFFFFF' : '#1C1E22'} />
                </View>
              </TouchableOpacity>
            )}

            {showBattle && (
              <TouchableOpacity onPress={onBattlePress} activeOpacity={0.85} style={bar.actionBtn} accessibilityLabel="Battle">
                <ExpoImage source={BATTLE_IMG} style={bar.actionImg} contentFit="contain" />
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={onGiftOpen} activeOpacity={0.85} style={bar.actionBtn} accessibilityLabel="Gifts">
              <ExpoImage source={GIFT_IMG} style={bar.actionImg} contentFit="contain" />
            </TouchableOpacity>
          </View>
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
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0EDF8',
    gap: 10,
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
  // The three action slots — one size so they line up evenly
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionBtn: { width: ACTION_SIZE, height: ACTION_SIZE, alignItems: 'center', justifyContent: 'center' },
  actionImg: { width: ACTION_SIZE, height: ACTION_SIZE },
  // Same outer size as the gift/battle images, bag filling most of it
  bagBox: {
    width: ACTION_SIZE,
    height: ACTION_SIZE,
    borderRadius: 9,
    borderWidth: 1.8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bagImg: {
    width: 19,
    height: 21,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F4F5F8',
    borderWidth: 1,
    borderColor: '#E7E4F2',
    paddingLeft: 14,
    paddingRight: 4,
    gap: 10,
  },
  inputWrapBg: { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.25)' },
  input: { flex: 1, fontSize: 15, color: '#1C1E22', padding: 0, borderWidth: 0 },
  inputBg: { color: '#FFFFFF' },
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
});
