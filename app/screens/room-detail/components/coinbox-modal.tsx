import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const COINBOX_IMG = require('@/assets/tabs/chatroom/coinbox.png');
const COIN_IMG    = require('@/assets/tabs/coin.png');

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_H * 0.75;

// Mock winning items — replace with real data later
const WINNING_ITEMS = [
  { id: '1', label: '3RD SURPRISE', emoji: '🥉', bg: '#FFF3DC', border: '#F5C842' },
  { id: '2', label: 'CENTURY',      emoji: '🏆', bg: '#F5F5F5', border: '#C0C0C0' },
  { id: '3', label: 'Hello!',       emoji: '💬', bg: '#FFE8E8', border: '#FFB8B8' },
  { id: '4', label: '🥊',           emoji: '🥊', bg: '#FFE8E8', border: '#FFB8B8' },
  { id: '5', label: 'Hello!',       emoji: '💬', bg: '#FFE8E8', border: '#FFB8B8' },
  { id: '6', label: 'BOUNCER',      emoji: '🎪', bg: '#EDE8FF', border: '#9B7FE8' },
  { id: '7', label: '👑',           emoji: '👑', bg: '#FFF3DC', border: '#F5C842' },
  { id: '8', label: '🍺',           emoji: '🍺', bg: '#F0FFF0', border: '#90EE90' },
];

type Props = { visible: boolean; onClose: () => void };

export function CoinBoxModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 5,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 100) {
          close();
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  function open() {
    translateY.setValue(SHEET_HEIGHT);
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }

  function close() {
    Animated.timing(translateY, {
      toValue: SHEET_HEIGHT,
      duration: 220,
      useNativeDriver: true,
    }).start(onClose);
  }

  const level = 1;
  const progress = 0.05; // 5% filled — replace with real value

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={close}
      onShow={open}>
      {/* Backdrop */}
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={close} />

      <Animated.View
        style={[
          s.sheet,
          { height: SHEET_HEIGHT, paddingBottom: insets.bottom + 8, transform: [{ translateY }] },
        ]}>
        {/* Drag handle */}
        <View {...panResponder.panHandlers} style={s.handleArea}>
          <View style={s.handle} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

          {/* Treasure box section */}
          <View style={s.boxSection}>
            {/* Help icon */}
            <TouchableOpacity style={s.helpBtn} activeOpacity={0.7}>
              <Ionicons name="help-circle" size={26} color="#ABADB2" />
            </TouchableOpacity>

            {/* Chest progression row */}
            <View style={s.chestRow}>
              {/* Locked chest */}
              <View style={s.chestWrap}>
                <Image source={COINBOX_IMG} style={s.chestImgSmall} resizeMode="contain" />
              </View>

              {/* Arrows + key + level */}
              <View style={s.progressMiddle}>
                <Text style={s.arrowText}>»»</Text>
                <View style={s.keyWrap}>
                  <Text style={s.keyEmoji}>🔑</Text>
                  <Text style={s.levelLabel}>Level {level}</Text>
                </View>
                <Text style={s.arrowText}>»»</Text>
              </View>

              {/* Open chest */}
              <View style={s.chestWrap}>
                <Image source={COINBOX_IMG} style={s.chestImgLarge} resizeMode="contain" />
                {/* Coins spilling out */}
                <Image source={COIN_IMG} style={s.coinSpill} resizeMode="contain" />
              </View>
            </View>

            {/* Progress bar */}
            <View style={s.progressBarTrack}>
              <View style={[s.progressBarFill, { width: `${progress * 100}%` }]} />
            </View>

            {/* Description */}
            <Text style={s.boxDesc}>Send more gifts to open treasure box</Text>
          </View>

          {/* Winning items */}
          <View style={s.winningSection}>
            <Text style={s.winningTitle}>Winning Items</Text>
            <View style={s.itemsGrid}>
              {WINNING_ITEMS.map(item => (
                <View key={item.id} style={[s.itemCard, { backgroundColor: item.bg, borderColor: item.border }]}>
                  <Text style={s.itemEmoji}>{item.emoji}</Text>
                  {item.label.length > 2 && (
                    <Text style={s.itemLabel} numberOfLines={1}>{item.label}</Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        {/* <View style={s.footer}>
          <View style={s.customizeRow}>
            <Ionicons name="sparkles-outline" size={18} color="#7A7A8A" />
            <Text style={s.customizeText}>Customize your box</Text>
          </View>
          <TouchableOpacity style={s.editBtn} activeOpacity={0.85}>
            <Text style={s.editBtnText}>Edit</Text>
          </TouchableOpacity>
        </View> */}
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DDDAE8',
  },
  scroll: {
    paddingBottom: 8,
  },

  // ── Treasure box section ──────────────────────────────────────────────────
  boxSection: {
    backgroundColor: '#FFF5DC',
    marginHorizontal: 0,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 20,
    position: 'relative',
  },
  helpBtn: {
    position: 'absolute',
    top: 12,
    right: 14,
    zIndex: 1,
  },
  chestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  chestWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  chestImgSmall: {
    width: 80,
    height: 80,
  },
  chestImgLarge: {
    width: 90,
    height: 90,
    tintColor: undefined,
  },
  coinSpill: {
    position: 'absolute',
    bottom: -4,
    right: -8,
    width: 32,
    height: 32,
  },
  progressMiddle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  arrowText: {
    fontSize: 18,
    color: '#E8A030',
    fontWeight: '700',
  },
  keyWrap: {
    alignItems: 'center',
    gap: 2,
  },
  keyEmoji: {
    fontSize: 28,
  },
  levelLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1C1E22',
  },
  progressBarTrack: {
    height: 10,
    backgroundColor: '#2A0A00',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#E8A030',
    borderRadius: 5,
  },
  boxDesc: {
    fontSize: 14,
    color: '#E8A030',
    fontWeight: '500',
    textAlign: 'left',
  },

  // ── Winning items ─────────────────────────────────────────────────────────
  winningSection: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  winningTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1C1E22',
    marginBottom: 14,
  },
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  itemCard: {
    width: '47%',
    aspectRatio: 1.6,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: 8,
  },
  itemEmoji: {
    fontSize: 32,
  },
  itemLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#60626A',
    textAlign: 'center',
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EBEBEB',
  },
  customizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customizeText: {
    fontSize: 15,
    color: '#60626A',
    fontWeight: '500',
  },
  editBtn: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 10,
  },
  editBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
