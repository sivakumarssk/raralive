import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, G, LinearGradient as SvgGradient, Path, Rect, Stop } from 'react-native-svg';

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
  type BattleRoomsInfo,
} from './battle-result-parts';

/**
 * Result card for a gifting battle: both photos on top, each over its name
 * plate, the VS between the plates; the score bar has no raised pill in the
 * middle, like the banner during a gifting battle. The rest of the card is shared
 * (battle-result-parts.tsx).
 */
export function GiftingBattleResultCard(props: BattleResultCardProps) {
  // Score bar as in the banner during a gifting battle: no raised pill in the
  // middle, the battle time sits in the gap between the capsules
  return (
    <BattleResultShell
      {...props}
      showBridge={false}
      renderRooms={rooms => <PlateRooms {...rooms} />}
      renderSupporters={({ own, rival }) => <SupportersBoard own={own} rival={rival} />}
    />
  );
}

/*
 * Plate geometry, measured from the design sample (965×265): each plate is
 * 2.25 : 1 — straight top with big rounded corners, straight sides, and a
 * bottom (PLATE_BOTTOM) easing down from the outer corner to a low point just
 * past the middle, then rising steeply and flattening toward the inner corner.
 * The right plate mirrors the left. Neon border, a separate gold trim a little
 * below the bottom edge (fading out at both ends), a flare at the top middle.
 */
const COIN_IMG = require('@/assets/tabs/coin.png');

const PLATE_RATIO = 2.25;     // width : height
const PLATE_GAP_RATIO = 0.04; // gap between plates, × plate width

// The plate's bottom edge — the sample's neon border line — from the outer
// side to the inner side, in unit coordinates (u across from the outer edge,
// v down from the top).
const PLATE_BOTTOM: [number, number][] = [
  [0, 0.6], [0.012, 0.65], [0.03, 0.703], [0.06, 0.74], [0.1, 0.76], [0.15, 0.775],
  [0.2, 0.787], [0.25, 0.808], [0.3, 0.835], [0.35, 0.86], [0.4, 0.888], [0.45, 0.918],
  [0.5, 0.948], [0.535, 0.966], [0.56, 0.968], [0.59, 0.951], [0.617, 0.914], [0.645, 0.877],
  [0.67, 0.85], [0.7, 0.817], [0.73, 0.787], [0.765, 0.762], [0.8, 0.73], [0.83, 0.707],
  [0.87, 0.688], [0.92, 0.672], [0.96, 0.66], [0.988, 0.643], [1, 0.61],
];

// Gold trim: follows the bottom edge just below it (a little further below in
// the middle, as in the sample), over the middle stretch only — it fades out
// toward both corners.
const GOLD_FROM = 0.15;
const GOLD_TO = 0.92;
const GOLD_TRIM: [number, number][] = PLATE_BOTTOM
  .filter(([u]) => u >= GOLD_FROM && u <= GOLD_TO)
  .map(([u, v]) => [u, v + 0.034 + 0.009 * Math.sin((Math.PI * (u - GOLD_FROM)) / (GOLD_TO - GOLD_FROM))]);

type PlateMap = (u: number, v: number) => string;

/** Smooth curve through points (Catmull-Rom as cubic Béziers), continuing an open path. */
function smoothThrough(pts: [number, number][], map: PlateMap) {
  let d = '';
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1: [number, number] = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: [number, number] = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${map(...c1)} ${map(...c2)} ${map(...p2)}`;
  }
  return d;
}

const openCurve = (pts: [number, number][], map: PlateMap) => `M ${map(...pts[0])}${smoothThrough(pts, map)}`;

/** Left plate outline (pass a mirrored map for the right one). */
function plateOutline(map: PlateMap) {
  return `${openCurve(PLATE_BOTTOM, map)} V ${map(1, 0.16).split(' ')[1]}
    Q ${map(1, 0)} ${map(0.94, 0)} H ${map(0.08, 0).split(' ')[0]}
    Q ${map(0, 0)} ${map(0, 0.19)} Z`;
}

function PlateRooms({ own, rival, ownWon, rivalWon }: BattleRoomsInfo) {
  const [w, setW] = useState(0);
  const plateW = w / (2 + PLATE_GAP_RATIO);
  const plateH = plateW ? plateW / PLATE_RATIO : 76;
  const pad = 4;                        // room for the glow above/below
  const leftMap: PlateMap = (u, v) => `${(u * plateW).toFixed(1)} ${(pad + v * plateH).toFixed(1)}`;
  const rightMap: PlateMap = (u, v) => `${(w - u * plateW).toFixed(1)} ${(pad + v * plateH).toFixed(1)}`;
  const vsScale = (plateH * 0.74) / 88;
  const plates = w ? [
    { d: plateOutline(leftMap), trim: openCurve(GOLD_TRIM, leftMap), fill: 'url(#plateL)', color: OWN, x0: 0 },
    { d: plateOutline(rightMap), trim: openCurve(GOLD_TRIM, rightMap), fill: 'url(#plateR)', color: RIVAL, x0: w - plateW },
  ] : [];

  return (
    <View style={s.plateBlock}>
      <View style={s.platePhotos}>
        {[{ side: own, color: OWN, label: 'OUR GROUP', won: ownWon }, { side: rival, color: RIVAL, label: 'OPPONENT', won: rivalWon }].map(x => (
          <View key={x.label} style={s.platePhotoCol}>
            <View style={s.crownSlotTop}>{x.won && <MaterialCommunityIcons name="crown" size={20} color={GOLD} />}</View>
            <RoomAvatar uri={resolveUrl(x.side.room_image_url)} color={x.color} />
            <SideLabel color={x.color} label={x.label} />
          </View>
        ))}
      </View>

      <View style={[s.plates, { height: plateH + pad * 2 }]} onLayout={e => setW(Math.round(e.nativeEvent.layout.width))}>
        {w > 0 && (
          <Svg width={w} height={plateH + pad * 2} style={StyleSheet.absoluteFill}>
            <Defs>
              <SvgGradient id="plateL" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#1B347E" />
                <Stop offset="1" stopColor="#070F2E" />
              </SvgGradient>
              <SvgGradient id="plateR" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#6E0F2B" />
                <Stop offset="1" stopColor="#25040F" />
              </SvgGradient>
              {/* Gold trim: brightest in the middle, fading out at both ends */}
              <SvgGradient id="goldTrim" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#B8862B" stopOpacity={0} />
                <Stop offset="0.18" stopColor="#C99A3A" stopOpacity={1} />
                <Stop offset="0.5" stopColor="#FFE9A0" stopOpacity={1} />
                <Stop offset="0.82" stopColor="#C99A3A" stopOpacity={1} />
                <Stop offset="1" stopColor="#B8862B" stopOpacity={0} />
              </SvgGradient>
              <SvgGradient id="flare" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
                <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.95} />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
              </SvgGradient>
              <SvgGradient id="plateShine" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.14} />
                <Stop offset="0.4" stopColor="#FFFFFF" stopOpacity={0} />
              </SvgGradient>
            </Defs>
            {plates.map(pl => (
              <G key={pl.x0}>
                <Path d={pl.d} fill={pl.fill} />
                <Path d={pl.d} fill="url(#plateShine)" />
                {/* Neon border: glow, then the line */}
                <Path d={pl.d} fill="none" stroke={pl.color} strokeOpacity={0.35} strokeWidth={6} strokeLinejoin="round" />
                <Path d={pl.d} fill="none" stroke={pl.color} strokeWidth={2} strokeLinejoin="round" />
                {/* Gold trim just below the bottom edge */}
                <Path d={pl.trim} fill="none" stroke="url(#goldTrim)" strokeWidth={1.6} strokeLinecap="round" />
                {/* Light flare at the top middle */}
                <Rect x={pl.x0 + plateW * 0.22} y={pad - 0.5} width={plateW * 0.56} height={1.6} fill="url(#flare)" />
              </G>
            ))}
          </Svg>
        )}
        {w > 0 && (
          <>
            <PlateText side={own} color={OWN} style={{ left: 0, width: plateW, top: pad, height: plateH * 0.72 }} />
            <PlateText side={rival} color={RIVAL} style={{ left: w - plateW, width: plateW, top: pad, height: plateH * 0.72 }} />
            {/* VS between the plates, a little below centre (as in the sample) */}
            <View pointerEvents="none" style={[s.plateVs, { top: pad + plateH * 0.6 - 44 * vsScale }]}>
              <VsMark scale={vsScale} />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

function PlateText({ side, color, style }: { side: BattleResultSide; color: string; style: object }) {
  return (
    <View style={[s.plateText, style]}>
      <View style={s.plateNameRow}>
        <Text style={s.plateName} numberOfLines={1}>{side.room_name || 'Room'}</Text>
        <MaterialCommunityIcons name="check-circle" size={16} color={color} />
      </View>
      <Text style={s.plateType} numberOfLines={1}>Audio Chatroom</Text>
      {!!side.host_name && <Text style={s.plateHost} numberOfLines={1}>{side.host_name}</Text>}
    </View>
  );
}

/** Supporter coins: 38,800 in full; a lakh and up shortened (1.2L, 3.4Cr) so it fits the row. */
function supporterCoins(n: number) {
  const v = Math.max(0, Math.round(n));
  const short = (x: number, unit: string) => `${x.toFixed(x < 100 ? 1 : 0).replace(/\.0$/, '')}${unit}`;
  if (v >= 10_000_000) return short(v / 10_000_000, 'Cr');
  if (v >= 100_000) return short(v / 100_000, 'L');
  return groupDigits(v);
}

// ── Top supporters ──────────────────────────────────────────────────────────

const BOARD_TAB_H = 30;        // depth of the notch the title sits in
const BOARD_TAB_BOTTOM = 150;  // notch width at its floor (wider at the top — slanted sides)

/**
 * One framed board: "TOP SUPPORTERS" in a notch cut into the top edge, each
 * half tinted in its side's colour, and a panel per side — header strip with
 * the room name, then three rows split by thin lines.
 */
function SupportersBoard({ own, rival }: { own: BattleResultSide; rival: BattleResultSide }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const { w, h } = size;
  const cx = w / 2;
  const r = 14;
  const top = 9;               // tinted halves start a little below the frame's top
  const tTop = BOARD_TAB_BOTTOM / 2 + 16;
  const tBot = BOARD_TAB_BOTTOM / 2;
  // Left half: rounded outer corners; its top edge dips into the notch at the middle
  const leftHalf = `M ${cx} ${BOARD_TAB_H} H ${cx - tBot} L ${cx - tTop} ${top} H ${r + 1}
    Q 1 ${top} 1 ${top + r} V ${h - r - 1} Q 1 ${h - 1} ${r + 1} ${h - 1} H ${cx} Z`;
  const rightHalf = `M ${cx} ${BOARD_TAB_H} H ${cx + tBot} L ${cx + tTop} ${top} H ${w - r - 1}
    Q ${w - 1} ${top} ${w - 1} ${top + r} V ${h - r - 1} Q ${w - 1} ${h - 1} ${w - r - 1} ${h - 1} H ${cx} Z`;
  const leftEdge = `M ${cx - tBot} ${BOARD_TAB_H} L ${cx - tTop} ${top} H ${r + 1} Q 1 ${top} 1 ${top + r} V ${h - r - 1} Q 1 ${h - 1} ${r + 1} ${h - 1} H ${cx}`;
  const rightEdge = `M ${cx + tBot} ${BOARD_TAB_H} L ${cx + tTop} ${top} H ${w - r - 1} Q ${w - 1} ${top} ${w - 1} ${top + r} V ${h - r - 1} Q ${w - 1} ${h - 1} ${w - r - 1} ${h - 1} H ${cx}`;

  return (
    <View
      style={s.board}
      onLayout={e => setSize({ w: Math.round(e.nativeEvent.layout.width), h: Math.round(e.nativeEvent.layout.height) })}>
      {w > 0 && (
        <Svg pointerEvents="none" width={w} height={h} style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgGradient id="boardL" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={OWN} stopOpacity={0.42} />
              <Stop offset="0.45" stopColor={OWN} stopOpacity={0.16} />
              <Stop offset="1" stopColor={OWN} stopOpacity={0.06} />
            </SvgGradient>
            <SvgGradient id="boardR" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={RIVAL} stopOpacity={0.42} />
              <Stop offset="0.45" stopColor={RIVAL} stopOpacity={0.16} />
              <Stop offset="1" stopColor={RIVAL} stopOpacity={0.06} />
            </SvgGradient>
          </Defs>
          {/* Outer frame, title notch included */}
          <Path d={`M ${r} 0.5 H ${w - r} Q ${w - 0.5} 0.5 ${w - 0.5} ${r} V ${h - r} Q ${w - 0.5} ${h - 0.5} ${w - r} ${h - 0.5} H ${r} Q 0.5 ${h - 0.5} 0.5 ${h - r} V ${r} Q 0.5 0.5 ${r} 0.5 Z`}
            fill="#0A0A22" stroke="rgba(150,160,255,0.22)" strokeWidth={1} />
          <Path d={leftHalf} fill="url(#boardL)" />
          <Path d={rightHalf} fill="url(#boardR)" />
          <Path d={leftEdge} fill="none" stroke={OWN} strokeOpacity={0.55} strokeWidth={1.2} strokeLinejoin="round" />
          <Path d={rightEdge} fill="none" stroke={RIVAL} strokeOpacity={0.55} strokeWidth={1.2} strokeLinejoin="round" />
        </Svg>
      )}
      <View style={s.boardTitleWrap}>
        <Text style={s.boardTitle} numberOfLines={1}>TOP SUPPORTERS</Text>
      </View>
      <View style={s.boardPanels}>
        <SupporterPanel side={own} color={OWN} />
        <SupporterPanel side={rival} color={RIVAL} />
      </View>
    </View>
  );
}

function SupporterPanel({ side, color }: { side: BattleResultSide; color: string }) {
  return (
    <View style={[s.supporterPanel, { borderColor: `${color}55` }]}>
      <View style={[s.supporterPanelHead, { backgroundColor: `${color}40` }]}>
        <Text style={s.supporterPanelTitle} numberOfLines={1}>
          {(side.room_name || 'Room').toUpperCase()} TOP 3
        </Text>
      </View>
      {/* Always three places; an empty place shows a dash */}
      {[0, 1, 2].map(i => (
        <View key={side.supporters[i]?.id ?? `empty-${i}`} style={[s.supporterRow, i > 0 && s.supporterRowLine]}>
          <Text style={s.supporterRank}>{i + 1}</Text>
          {side.supporters[i] ? <SupporterInfo gifter={side.supporters[i]} /> : (
            <>
              <View style={s.emptyAvatar} />
              <Text style={s.emptyName}>—</Text>
            </>
          )}
        </View>
      ))}
    </View>
  );
}

function SupporterInfo({ gifter }: { gifter: BattleGifter }) {
  return (
    <>
      <View style={s.supporterAvatar}>
        <ExpoImage source={avatarSource(resolveUrl(gifter.avatar_url))} style={StyleSheet.absoluteFill} contentFit="cover" />
      </View>
      <Text style={s.supporterName} numberOfLines={1}>{gifter.full_name || gifter.username || 'User'}</Text>
      <View style={s.supporterCoins}>
        <ExpoImage source={COIN_IMG} style={s.supporterCoin} contentFit="contain" />
        <Text style={s.supporterCoinsText} numberOfLines={1}>{supporterCoins(Number(gifter.total_coins) || 0)}</Text>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  plateBlock: { marginTop: 12 },
  platePhotos: { flexDirection: 'row' },
  platePhotoCol: { flex: 1, alignItems: 'center' },
  crownSlotTop: { height: 20, justifyContent: 'flex-end', marginBottom: 2 },
  plates: { marginTop: 8 },
  // Upper part of each plate (above the sloping bottom), clear of the VS
  plateText: { position: 'absolute', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  // Tick sits right after the name (the name only takes the width it needs)
  plateNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, maxWidth: '100%' },
  plateName: { flexShrink: 1, fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  plateType: { marginTop: 2, fontSize: 9, fontWeight: '600', color: '#FFD84D' },
  plateHost: { marginTop: 1, fontSize: 9, color: '#D9C9FF' },
  plateVs: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },

  // Top supporters board — a little wider than the content, to give the rows room
  board: { marginTop: 16, marginHorizontal: -6, paddingTop: BOARD_TAB_H + 6, paddingHorizontal: 6, paddingBottom: 6 },
  boardTitleWrap: { position: 'absolute', top: 0, left: 0, right: 0, height: BOARD_TAB_H, alignItems: 'center', justifyContent: 'center' },
  boardTitle: { fontSize: 14, fontWeight: '900', color: GOLD, letterSpacing: 0.8, maxWidth: BOARD_TAB_BOTTOM },
  boardPanels: { flexDirection: 'row', gap: 6 },
  supporterPanel: { flex: 1, minWidth: 0, borderRadius: 10, borderWidth: 1, overflow: 'hidden', backgroundColor: 'rgba(5,5,25,0.35)' },
  supporterPanelHead: { paddingVertical: 7, paddingHorizontal: 6 },
  supporterPanelTitle: { fontSize: 11, fontWeight: '800', color: '#EDE6FF', textAlign: 'center', letterSpacing: 0.3 },
  supporterRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 7, paddingHorizontal: 6 },
  supporterRowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.12)' },
  supporterRank: { width: 10, fontSize: 15, fontWeight: '600', color: '#E8A83A', textAlign: 'center' },
  supporterAvatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: '#D9A441', overflow: 'hidden', backgroundColor: '#2A1650' },
  supporterName: { flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: '600', color: '#FFFFFF' },
  supporterCoins: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  supporterCoin: { width: 12, height: 12 },
  supporterCoinsText: { fontSize: 11.5, fontWeight: '700', color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  emptyAvatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(217,164,65,0.35)', borderStyle: 'dashed' },
  emptyName: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.35)' },
});
