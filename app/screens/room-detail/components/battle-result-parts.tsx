import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as MediaLibrary from 'expo-media-library';
import { useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import Svg, { Circle, Defs, Ellipse, LinearGradient as SvgGradient, Path, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';

import { BoldIcon } from '@/components/ui/bold-icon';
import { MEDIA_BASE } from '@/services/api';
import type { BattleResult, BattleResultSide } from '@/store/socket-store';
import { avatarSource } from '@/utils/default-avatar';
import { BattleScoreBar, scoreBarStripHeight, scoreBarTimeSeat } from './battle-score-bar';

/**
 * Pieces shared by both battle result cards — normal-battle-result.tsx and
 * gifting-battle-result.tsx. The cards differ in how the two rooms and the
 * top supporters are shown; everything else (header, battle time, score bar,
 * winner tab, download) is BattleResultShell here.
 */

const RARA_LOGO = require('@/assets/images/raralogo.png');

// Same side colours as the battle banner below the stage
export const OWN = '#3174F3';
export const RIVAL = '#F5273F';
export const GOLD = '#FFC23D';

const SCORE_BAR_H = 36;
// Battle time box height — fixed, so the gifting bolt lines up right under it
const TIME_BOX_H = 38;
const BOLT_H = 20;

export function resolveUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : `${MEDIA_BASE}/${url.replace(/^\//, '')}`;
}

export function groupDigits(n: number) {
  return String(Math.max(0, Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}


export type BattleResultCardProps = {
  result: BattleResult;
  /** The room being viewed — its side is shown on the left */
  roomId: string;
  onClose: () => void;
};

/** What a card's rooms section gets: our side (left) and theirs (right). */
export type BattleRoomsInfo = {
  own: BattleResultSide;
  rival: BattleResultSide;
  ownWon: boolean;
  rivalWon: boolean;
};

/**
 * The result card around a rooms section: neon background, logo + title,
 * rooms, battle time on the bar's bridge, score bar, winner tab, top
 * supporters, and the download button. Tap outside the card to close.
 */
export function BattleResultShell({ result, roomId, onClose, renderRooms, renderSupporters, showBridge = true }: BattleResultCardProps & {
  renderRooms: (rooms: BattleRoomsInfo) => ReactNode;
  renderSupporters: (rooms: BattleRoomsInfo) => ReactNode;
  /** Raised pill + bolt in the score bar's middle (normal battles). Gifting
   *  battles leave it out and the battle time sits in the gap instead. */
  showBridge?: boolean;
}) {
  const { width, height } = useWindowDimensions();

  const ownIsFrom = result.from.room_id === roomId;
  const own = ownIsFrom ? result.from : result.to;
  const rival = ownIsFrom ? result.to : result.from;
  const isDraw = result.winner === null;
  const ownWon = !isDraw && (result.winner === 'from') === ownIsFrom;
  const rooms: BattleRoomsInfo = { own, rival, ownWon: !isDraw && ownWon, rivalWon: !isDraw && !ownWon };

  // The battle's timer — how long it ran, as 00:07:45
  const played = Math.max(0, Math.round(result.played_seconds ?? 0));
  const two = (n: number) => String(n).padStart(2, '0');
  const battleTime = `${two(Math.floor(played / 3600))}:${two(Math.floor((played % 3600) / 60))}:${two(played % 60)}`;
  const cardWidth = Math.min(width - 24, 400);

  // Download: the card (logo, rooms, scores, supporters) saved as an image
  const cardRef = useRef<View>(null);
  const [saving, setSaving] = useState(false);
  const download = async () => {
    if (saving || !cardRef.current) return;
    setSaving(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(true);
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow gallery access to save the battle result.');
        return;
      }
      const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' });
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Saved!', 'The battle result is saved to your gallery.');
    } catch {
      Alert.alert('Error', 'Could not save the battle result.');
    } finally {
      setSaving(false);
    }
  };

  // Winner tab sized to fit its half of the bar
  const [verdictWidth, setVerdictWidth] = useState(0);
  const tabWidth = verdictWidth ? Math.max(72, Math.min(98, verdictWidth / 2 - 30)) : 0;
  // "IT'S A TIE" is longer than "WINNER"
  const tieWidth = verdictWidth ? Math.max(100, Math.min(124, verdictWidth * 0.36)) : 0;

  return (
    <Pressable style={s.resultOverlay} onPress={onClose}>
      {/* Taps on the card itself don't close it */}
      <Pressable>
      <View style={[s.card, { width: cardWidth, maxHeight: height * 0.9 }]}>
        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        {/* Everything in here is what Download saves */}
        <View ref={cardRef} collapsable={false} style={s.cardContent}>
          <LinearGradient
            colors={['#2A0F4F', '#160830', '#0D051F']}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Header: logo left, title centred */}
          <ExpoImage source={RARA_LOGO} style={s.logo} contentFit="contain" />
          <View style={s.header}>
            <MaterialCommunityIcons name="lightning-bolt" size={22} color={GOLD} />
            <Text style={s.headerTitle}>BATTLE</Text>
            <MaterialCommunityIcons name="lightning-bolt" size={22} color={GOLD} />
          </View>

          {renderRooms(rooms)}

          {/* Battle time sitting right on the bar's bridge — or, with no
              bridge, down in the gap between the capsules — coins below */}
          <View style={s.timeAndBar}>
            <View style={[s.endedBox, { marginBottom: -scoreBarTimeSeat(SCORE_BAR_H, showBridge) }]}>
              <Text style={s.endedLabel}>{result.reason === 'cancelled' ? 'Cancelled at' : 'Battle time'}</Text>
              <Text style={s.endedValue} numberOfLines={1}>{battleTime}</Text>
            </View>
            <BattleScoreBar leftScore={own.score} rightScore={rival.score} barHeight={SCORE_BAR_H} showBridge={showBridge} />
            {/* Gifting: a thunder bolt on the strip between the capsules, right under the time */}
            {!showBridge && <TimeBolt />}
          </View>

          {/* Winner tag hanging under the winning side — or, on a tie, one
              "It's a tie" tag hanging from the middle, under the bridge */}
          <View style={s.verdictRow} onLayout={e => setVerdictWidth(e.nativeEvent.layout.width)}>
            {isDraw ? (
              <View style={s.verdictMiddle}>{tieWidth > 0 && <VerdictTab width={tieWidth} kind="tie" />}</View>
            ) : (
              <>
                <View style={[s.verdictSide, s.verdictSideLeft]}>{ownWon && tabWidth > 0 && <VerdictTab width={tabWidth} kind="winner" />}</View>
                <View style={[s.verdictSide, s.verdictSideRight]}>{!ownWon && tabWidth > 0 && <VerdictTab width={tabWidth} kind="winner" />}</View>
              </>
            )}
          </View>

          {/* Top supporters — each card has its own design */}
          {renderSupporters(rooms)}

          {result.provisional && <Text style={s.finalizing}>Confirming final result…</Text>}
        </View>
        </ScrollView>

        {/* Download — outside the captured area, so it isn't in the saved image */}
        <TouchableOpacity style={s.downloadBtn} onPress={download} disabled={saving} hitSlop={10} accessibilityLabel="Download battle result">
          {saving
            ? <ActivityIndicator size="small" color="#FFFFFF" />
            : <BoldIcon name="download-outline" size={22} color="#FFFFFF" weight={16} />}
        </TouchableOpacity>
      </View>
      </Pressable>
    </Pressable>
  );
}

/** Glowing gold thunder bolt, centred on the score bar's middle strip (gifting battles). */
function TimeBolt() {
  const box = BOLT_H * 2.2;
  const c = box / 2;
  const h = BOLT_H;
  const t = c - h / 2;
  const bolt = `M ${c + h * 0.1} ${t + h * 0.04} L ${c - h * 0.22} ${t + h * 0.54} L ${c - h * 0.02} ${t + h * 0.54}
    L ${c - h * 0.13} ${t + h * 0.98} L ${c + h * 0.27} ${t + h * 0.42} L ${c + h * 0.05} ${t + h * 0.42} Z`;
  const stripMid = TIME_BOX_H + scoreBarStripHeight(SCORE_BAR_H) / 2;
  return (
    <View pointerEvents="none" style={[s.bolt, { top: stripMid - c, height: box }]}>
      <Svg width={box} height={box}>
        <Defs>
          <RadialGradient id="boltGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFE9A0" stopOpacity={0.75} />
            <Stop offset="0.45" stopColor="#FFC23D" stopOpacity={0.3} />
            <Stop offset="1" stopColor="#FFC23D" stopOpacity={0} />
          </RadialGradient>
          <SvgGradient id="boltFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFF3C4" />
            <Stop offset="0.5" stopColor="#FFCB3D" />
            <Stop offset="1" stopColor="#F5A623" />
          </SvgGradient>
        </Defs>
        <Ellipse cx={c} cy={c} rx={c} ry={c * 0.6} fill="url(#boltGlow)" />
        <Path d={bolt} fill="none" stroke="#FF9F1A" strokeOpacity={0.5} strokeWidth={4} strokeLinejoin="round" />
        <Path d={bolt} fill="url(#boltFill)" stroke="#FFFFFF" strokeWidth={1.2} strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

// ── Room pieces used by both layouts ────────────────────────────────────────

/** Small four-point sparkle centred on (x, y). */
const sparkle = (x: number, y: number, r: number) =>
  `M ${x} ${y - r} Q ${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y} Q ${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r}
   Q ${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y} Q ${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r} Z`;

/**
 * A room's photo in a thin neon ring: the ring glows in the side's colour
 * (soft wide strokes under a bright core) with a few sparkles around it.
 * Everything is drawn around the photo — the photo fills its circle.
 */
export function RoomAvatar({ uri, color, size = 58 }: { uri: string | null; color: string; size?: number }) {
  const pad = 14;
  const box = size + pad * 2;
  const c = box / 2;
  const r = size / 2 - 1.5;
  const photo = size - 8;
  return (
    <View style={{ width: size, height: size }}>
      <Svg pointerEvents="none" width={box} height={box} style={{ position: 'absolute', left: -pad, top: -pad }}>
        <Circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeOpacity={0.14} strokeWidth={16} />
        <Circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeOpacity={0.3} strokeWidth={8} />
        <Circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={3} />
        <Circle cx={c} cy={c} r={r} fill="none" stroke="#FFFFFF" strokeOpacity={0.8} strokeWidth={1} />
        <Path d={sparkle(c - r * 0.78, c - r * 0.62, 4)} fill="#FFFFFF" opacity={0.85} />
        <Path d={sparkle(c + r * 0.92, c - r * 0.2, 3)} fill={color} opacity={0.9} />
        <Path d={sparkle(c - r * 0.95, c + r * 0.35, 2.5)} fill="#FFFFFF" opacity={0.6} />
      </Svg>
      <View style={[s.photoClip, { width: photo, height: photo, borderRadius: photo / 2, left: (size - photo) / 2, top: (size - photo) / 2 }]}>
        <ExpoImage source={avatarSource(uri)} style={StyleSheet.absoluteFill} contentFit="cover" />
      </View>
    </View>
  );
}

/** "OUR GROUP" / "OPPONENT" pill overlapping the bottom of a room's ring. */
export function SideLabel({ color, label }: { color: string; label: string }) {
  return (
    <LinearGradient colors={[color, `${color}AA`]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={s.sideLabel}>
      <Text style={s.sideLabelText} numberOfLines={1}>{label}</Text>
    </LinearGradient>
  );
}

/** Tall glowing gold "VS" with a thin lightning bolt running through, past both ends. */
export function VsMark({ scale = 1 }: { scale?: number }) {
  const bolt = 'M 42 0 L 26 40 L 32 40 L 14 88 L 37 34 L 31 34 L 47 0 Z';
  const letters = (props: object) => (
    <SvgText x={29} y={57} textAnchor="middle" fontSize={40} fontWeight="900" fontStyle="italic" {...props}>VS</SvgText>
  );
  return (
    <Svg width={58 * scale} height={88 * scale} viewBox="0 0 58 88">
      <Defs>
        <SvgGradient id="vsText" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFF4B0" />
          <Stop offset="0.35" stopColor="#FFC93C" />
          <Stop offset="0.7" stopColor="#FF8C00" />
          <Stop offset="1" stopColor="#F06000" />
        </SvgGradient>
        <SvgGradient id="vsBolt" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFE680" />
          <Stop offset="1" stopColor="#FF9F1A" />
        </SvgGradient>
      </Defs>
      {/* Bolt behind, with glow */}
      <Path d={bolt} fill="none" stroke="#FF9F1A" strokeOpacity={0.25} strokeWidth={7} strokeLinejoin="round" />
      <Path d={bolt} fill="url(#vsBolt)" />
      {/* Letters with an orange glow */}
      {letters({ fill: 'none', stroke: '#FF8A00', strokeOpacity: 0.18, strokeWidth: 12, strokeLinejoin: 'round' })}
      {letters({ fill: 'none', stroke: '#FFB020', strokeOpacity: 0.32, strokeWidth: 6, strokeLinejoin: 'round' })}
      {letters({ fill: 'url(#vsText)', stroke: '#5A1C00', strokeWidth: 1.4, strokeLinejoin: 'round' })}
    </Svg>
  );
}

// ── Winner tab ──────────────────────────────────────────────────────────────

/**
 * Tab hanging from the score bar: flat top flush with the bar, sides angled
 * slightly in, rounded bottom; gold glowing edge on the sides and bottom only.
 * "winner": three stars, then WINNER (under the winning side's capsule).
 * "tie": a handshake, then IT'S A TIE (under the middle of the bar).
 */
function VerdictTab({ width: w, kind }: { width: number; kind: 'winner' | 'tie' }) {
  const k = Math.min(1, w / 100); // text and height designed at 100 wide
  const h = 42 * k;
  const inset = 6 * k;        // how much narrower the bottom is, each side
  const r = 8 * k;            // bottom corner radius
  const edge = `M 1 0 L ${inset} ${h - r} Q ${inset + 1} ${h - 1} ${inset + r} ${h - 1}
    H ${w - inset - r} Q ${w - inset - 1} ${h - 1} ${w - inset} ${h - r} L ${w - 1} 0`;
  return (
    <View style={{ width: w, height: h, alignItems: 'center', paddingTop: 6 * k }}>
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGradient id="winFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#1A0A00" />
            <Stop offset="1" stopColor="#3A1A02" />
          </SvgGradient>
          <SvgGradient id="winGold" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#F5A623" stopOpacity={0.3} />
            <Stop offset="1" stopColor="#FFD24A" />
          </SvgGradient>
        </Defs>
        <Path d={`${edge} Z`} fill="url(#winFill)" />
        {/* Glow, then the gold edge (open at the top, where it meets the bar) */}
        <Path d={edge} fill="none" stroke="#FFA21F" strokeOpacity={0.25} strokeWidth={6} strokeLinejoin="round" />
        <Path d={edge} fill="none" stroke="url(#winGold)" strokeWidth={1.8} strokeLinejoin="round" />
      </Svg>
      <View style={[s.winnerStars, { height: 13 * k, gap: 4 * k }]}>
        {kind === 'winner'
          ? [0, 1, 2].map(i => <MaterialCommunityIcons key={i} name="star" size={11 * k} color="#FFA21F" />)
          : <MaterialCommunityIcons name="handshake" size={13 * k} color="#FFA21F" />}
      </View>
      <Text style={[s.winnerText, { fontSize: 13 * k }]} numberOfLines={1}>{kind === 'winner' ? 'WINNER' : 'IT\'S A TIE'}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  resultOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center',
  },
  card: {
    borderRadius: 24, overflow: 'hidden', backgroundColor: '#0D051F',
    borderWidth: 1, borderColor: 'rgba(190,120,255,0.35)',
  },
  logo: { position: 'absolute', top: 12, left: 12, width: 54, height: 46 },
  downloadBtn: { position: 'absolute', top: 18, right: 14, padding: 4 },
  cardContent: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 },
  headerTitle: { fontSize: 22, fontWeight: '900', fontStyle: 'italic', color: '#FFFFFF', letterSpacing: 2 },

  photoClip: { position: 'absolute', overflow: 'hidden', backgroundColor: '#2A1650' },
  // Overlaps the bottom of the ring
  sideLabel: {
    marginTop: -10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
  },
  sideLabelText: { fontSize: 8, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.3 },

  // Small gap under the rooms; the time box then sits on the bar's bridge
  timeAndBar: { marginTop: 8 },
  endedBox: {
    // marginBottom (set inline) lands its bottom edge on the bridge / connector
    alignSelf: 'center', alignItems: 'center', justifyContent: 'center', zIndex: 2,
    height: TIME_BOX_H, paddingHorizontal: 8, borderRadius: 9,
    backgroundColor: '#120A1C', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  // Over the bar and the time box's bottom edge
  bolt: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 3 },
  endedLabel: { fontSize: 10, fontWeight: '500', color: '#CFC6DA', lineHeight: 12 },
  endedValue: {
    fontSize: 15, fontWeight: '800', color: '#FF3D86', lineHeight: 18, fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(255,61,134,0.35)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 4,
  },

  // The winner tab hangs straight off the bar
  verdictRow: { flexDirection: 'row', alignItems: 'flex-start' },
  // Tab toward the outer end of its capsule — under the flat part of the bar,
  // clear of the rounded end and of the bridge corner in the middle
  verdictSide: { flex: 1 },
  verdictSideLeft: { alignItems: 'flex-start', paddingLeft: 16 },
  verdictSideRight: { alignItems: 'flex-end', paddingRight: 16 },
  // Tie: centred under the bridge
  verdictMiddle: { flex: 1, alignItems: 'center' },
  winnerStars: { flexDirection: 'row' },
  winnerText: { marginTop: 0, fontSize: 15, fontWeight: '900', color: '#FFD45C', letterSpacing: 1.2, textShadowColor: 'rgba(255,170,0,0.6)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6 },

  finalizing: { marginTop: 10, fontSize: 11, color: '#B9A7E6', textAlign: 'center' },
});
