import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import type { BattleGifter, BattleResultSide } from '@/store/socket-store';
import { avatarSource } from '@/utils/default-avatar';
import {
  BattleResultShell,
  GOLD,
  OWN,
  RIVAL,
  RoomAvatar,
  SideLabel,
  VsMark,
  groupDigits,
  resolveUrl,
  type BattleResultCardProps,
} from './battle-result-parts';

/**
 * Result card for a normal battle: each room's photo with its name, "Audio
 * Chatroom" and host beside it, the VS between them, over a faint audio-wave
 * strip; top supporters as two panels with medals under a gold heading. The
 * rest of the card is shared (battle-result-parts.tsx).
 */
export function NormalBattleResultCard(props: BattleResultCardProps) {
  return (
    <BattleResultShell
      {...props}
      renderRooms={({ own, rival, ownWon, rivalWon }) => (
        <View style={s.roomsRow}>
          <WaveStrip left={OWN} right={RIVAL} />
          <RoomSide side={own} color={OWN} label="OUR GROUP" won={ownWon} align="left" />
          <View style={s.vsWrap}><VsMark /></View>
          <RoomSide side={rival} color={RIVAL} label="OPPONENT" won={rivalWon} align="right" />
        </View>
      )}
      renderSupporters={({ own, rival }) => (
        <>
          <View style={s.supportersHead}>
            <HeadingLine side="left" />
            <Text style={s.supportersTitle}>TOP SUPPORTERS</Text>
            <HeadingLine side="right" />
          </View>
          <View style={s.supportersRow}>
            <SupporterPanel side={own} color={OWN} />
            <SupporterPanel side={rival} color={RIVAL} />
          </View>
        </>
      )}
    />
  );
}

/** Faint audio-wave strip along the bottom of the rooms row: our colour left, theirs right. */
const WAVE = [3, 6, 10, 5, 14, 8, 4, 11, 6, 16, 9, 5, 12, 7, 3, 8, 13, 6, 10, 4, 7, 15, 9, 5, 11, 6, 3, 9, 12, 5];
function WaveStrip({ left, right }: { left: string; right: string }) {
  const n = WAVE.length * 2;
  return (
    <Svg pointerEvents="none" width="100%" height={24} viewBox={`0 0 ${n * 4} 24`} preserveAspectRatio="none" style={s.waveStrip}>
      {[...WAVE, ...[...WAVE].reverse()].map((h, i) => (
        <Rect key={i} x={i * 4 + 1} y={24 - h} width={1.4} height={h} fill={i < WAVE.length ? left : right} opacity={0.4} />
      ))}
    </Svg>
  );
}

function RoomSide({ side, color, label, won, align }: {
  side: BattleResultSide; color: string; label: string; won: boolean; align: 'left' | 'right';
}) {
  const right = align === 'right';
  const photo = (
    <View style={s.roomAvatarWrap}>
      <RoomAvatar uri={resolveUrl(side.room_image_url)} color={color} />
      <SideLabel color={color} label={label} />
    </View>
  );
  const text = (
    <View style={[s.roomText, right && s.roomTextRight]}>
      {/* Crown slot kept on both sides so the names line up */}
      <View style={s.crownSlot}>
        {won && <MaterialCommunityIcons name="crown" size={18} color={GOLD} />}
      </View>
      <Text style={[s.roomName, right && s.textRight]} numberOfLines={2}>{side.room_name || 'Room'}</Text>
      <Text style={[s.roomType, right && s.textRight]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>Audio Chatroom</Text>
      {!!side.host_name && (
        <View style={[s.hostRow, right && s.hostRowRight]}>
          <MaterialCommunityIcons name="account" size={13} color="#B57BFF" />
          <Text style={s.hostText} numberOfLines={1}>{side.host_name}</Text>
        </View>
      )}
    </View>
  );
  return <View style={s.roomSide}>{right ? <>{text}{photo}</> : <>{photo}{text}</>}</View>;
}

// ── Top supporters ──────────────────────────────────────────────────────────

const GIFT_PINK = '#FF4F93';
const MEDALS = [
  ['#FFE27A', '#F5A623'],
  ['#F2F4F7', '#A9AFBA'],
  ['#F2B27A', '#C0712F'],
] as const;

/** Photo filling a glowing ring exactly — the ring is drawn around it, never over it. */
function GlowAvatar({ uri, size, color }: { uri: string | null; size: number; color: string }) {
  const ring = Math.max(2, Math.round(size / 22));
  return (
    <View style={[s.glow, { width: size, height: size, borderRadius: size / 2, shadowColor: color }]}>
      <LinearGradient
        colors={[color, '#FFFFFF', color]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ width: size, height: size, borderRadius: size / 2, padding: ring }}>
        <View style={s.avatarClip}>
          <ExpoImage source={avatarSource(uri)} style={StyleSheet.absoluteFill} contentFit="cover" />
        </View>
      </LinearGradient>
    </View>
  );
}

function SupporterPanel({ side, color }: { side: BattleResultSide; color: string }) {
  return (
    <View style={[s.supporterPanel, { borderColor: `${color}66`, backgroundColor: `${color}14` }]}>
      <Text style={[s.supporterPanelTitle, { color }]} numberOfLines={1}>
        {(side.room_name || 'Room').toUpperCase()} TOP 3
      </Text>
      {/* Always three places; an empty place shows a dash */}
      {[0, 1, 2].map(i => (
        side.supporters[i]
          ? <SupporterRow key={side.supporters[i].id} gifter={side.supporters[i]} rank={i} />
          : <EmptySupporterRow key={`empty-${i}`} rank={i} />
      ))}
    </View>
  );
}

function EmptySupporterRow({ rank }: { rank: number }) {
  const medal = MEDALS[rank] ?? MEDALS[2];
  return (
    <View style={s.supporterRow}>
      <LinearGradient colors={medal} style={s.medal}>
        <Text style={s.medalText}>{rank + 1}</Text>
      </LinearGradient>
      <View style={s.emptyAvatar} />
      <Text style={s.emptyName}>—</Text>
    </View>
  );
}

/** Fading gold line ending in a small diamond, either side of a heading. */
function HeadingLine({ side }: { side: 'left' | 'right' }) {
  const bar = (
    <LinearGradient
      colors={side === 'left' ? ['rgba(255,194,61,0)', GOLD] : [GOLD, 'rgba(255,194,61,0)']}
      start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
      style={s.headingLineBar}
    />
  );
  return (
    <View style={s.headingLine}>
      {side === 'left' ? <>{bar}<View style={s.headingDiamond} /></> : <><View style={s.headingDiamond} />{bar}</>}
    </View>
  );
}

function SupporterRow({ gifter, rank }: { gifter: BattleGifter; rank: number }) {
  const name = gifter.full_name || gifter.username || 'User';
  const medal = MEDALS[rank] ?? MEDALS[2];
  return (
    <View style={s.supporterRow}>
      <LinearGradient colors={medal} style={s.medal}>
        <Text style={s.medalText}>{rank + 1}</Text>
      </LinearGradient>
      <GlowAvatar uri={resolveUrl(gifter.avatar_url)} size={30} color={medal[1]} />
      <View style={s.supporterInfo}>
        <Text style={s.supporterName} numberOfLines={1}>{name}</Text>
        <View style={s.supporterCoins}>
          <MaterialCommunityIcons name="gift" size={11} color={GIFT_PINK} />
          <Text style={s.supporterCoinsText} numberOfLines={1}>{groupDigits(Number(gifter.total_coins) || 0)}</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  roomsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, paddingBottom: 6 },
  waveStrip: { position: 'absolute', left: -14, right: -14, bottom: -4 },
  roomSide: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  roomAvatarWrap: { alignItems: 'center' },
  roomText: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  roomTextRight: { alignItems: 'flex-end' },
  textRight: { textAlign: 'right' },
  crownSlot: { height: 18, justifyContent: 'flex-end' },
  roomName: { fontSize: 13, fontWeight: '800', color: '#FFFFFF', lineHeight: 17 },
  roomType: { marginTop: 2, fontSize: 10, fontWeight: '600', color: '#FFD84D' },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3, maxWidth: '100%' },
  hostRowRight: { flexDirection: 'row-reverse' },
  hostText: { flexShrink: 1, fontSize: 10, color: '#D9C9FF' },
  vsWrap: { marginHorizontal: 2 },

  // Top supporters
  glow: { shadowOpacity: 0.9, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 10 },
  avatarClip: { flex: 1, borderRadius: 999, overflow: 'hidden', backgroundColor: '#2A1650' },
  supportersHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, marginBottom: 10 },
  headingLine: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  headingLineBar: { flex: 1, height: 1.5 },
  headingDiamond: { width: 6, height: 6, backgroundColor: GOLD, transform: [{ rotate: '45deg' }], marginHorizontal: 4 },
  supportersTitle: { fontSize: 14, fontWeight: '900', color: GOLD, letterSpacing: 1 },
  supportersRow: { flexDirection: 'row', gap: 8 },
  supporterPanel: { flex: 1, minWidth: 0, borderRadius: 14, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 10 },
  supporterPanelTitle: { fontSize: 11, fontWeight: '900', textAlign: 'center', marginBottom: 6, letterSpacing: 0.4 },
  emptyAvatar: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)', borderStyle: 'dashed' },
  emptyName: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.35)' },
  supporterRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5 },
  medal: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  medalText: { fontSize: 10, fontWeight: '900', color: '#3A2400' },
  supporterInfo: { flex: 1, minWidth: 0 },
  supporterName: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  supporterCoins: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  supporterCoinsText: { fontSize: 11, fontWeight: '700', color: '#FFD6E6' },
});
