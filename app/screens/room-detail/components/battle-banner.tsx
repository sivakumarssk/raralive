import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  ImageSourcePropType,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { BASE_URL, MEDIA_BASE } from '@/services/api';
import { authStore } from '@/store/auth-store';
import { onBattleStarted, onBattleInviteAccepted } from '@/store/socket-store';

type BattleBannerProps = {
  /**
   * Remote image URL for the left player.
   * Example: "https://example.com/avatar.jpg"
   */
  leftAvatar?: string | null;

  /**
   * Remote image URL for the right player.
   */
  rightAvatar?: string | null;

  /**
   * Optional local fallback images.
   * Example: require('./avatar.png')
   */
  leftAvatarSource?: ImageSourcePropType;
  rightAvatarSource?: ImageSourcePropType;

  leftName?: string;
  rightName?: string;

  leftScore?: number;
  rightScore?: number;

  /**
   * Top gifter avatars for each side, ranked highest first.
   * Rendered as small overlapping circles in the gap between the
   * score ribbon and the timer, capped to however many fit on screen.
   */
  leftGifterAvatars?: (string | null)[];
  rightGifterAvatars?: (string | null)[];

  /**
   * Battle duration in seconds.
   * Reference screenshot uses 04:59, so default is 299 seconds.
   */
  durationSeconds?: number;

  /**
   * Set false if the parent/socket controls the timer externally.
   */
  running?: boolean;

  /**
   * Called when the battle card is pressed.
   */
  onPress?: () => void;
};

const REF_WIDTH = 1080;

/**
 * Geometry taken from the supplied 1080px reference:
 *
 * Card:
 *   height ≈ 214
 *
 * Avatar:
 *   128 × 128
 *
 * Timer:
 *   276 × 119
 *
 * Progress:
 *   starts ≈ 154px from left
 *   ends   ≈ 154px from right
 *   height ≈ 20px
 *
 * Bridge:
 *   ≈ 60px wide
 */
const REF = {
  cardHeight: 236,
  avatar: 128,

  scoreWidth: 244,
  scoreHeight: 100,

  timerWidth: 220,
  timerHeight: 78,

  progressLeft: 146,
  progressRight: 146,
  progressHeight: 40,

  bridgeWidth: 60,
  bridgeHeight: 24,

  avatarLeft: 12,
  avatarTop: 15,

  ribbonLeft: 76,
  ribbonRight: 76,
  ribbonTop: 43,

  timerTop: 45,
  progressTop: 110,
  bridgeTop: 122,
};

function formatScore(value: number): string {
  if (!Number.isFinite(value)) return '0';

  const n = Math.max(0, Math.round(value));

  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }

  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}K`;
  }

  return String(n);
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const secs = safe % 60;

  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(
    2,
    '0',
  )}`;
}

function isRemoteImage(value?: string | null): boolean {
  return !!value && /^https?:\/\//i.test(value);
}

/** Simple rounded-pill rect, used for each of the three step-levels. */
function pillRectPath(x: number, y: number, w: number, h: number): string {
  const r = h / 2;
  return `
    M ${x + r} ${y}
    L ${x + w - r} ${y}
    Q ${x + w} ${y} ${x + w} ${y + r}
    Q ${x + w} ${y + h} ${x + w - r} ${y + h}
    L ${x + r} ${y + h}
    Q ${x} ${y + h} ${x} ${y + r}
    Q ${x} ${y} ${x + r} ${y}
    Z
  `;
}

type AvatarProps = {
  url?: string | null;
  source?: ImageSourcePropType;
  name: string;
  size: number;
  borderColor: string;
};

type GifterAvatarRowProps = {
  avatars: (string | null)[];
  left: number;
  right: number;
  top: number;
  rowHeight: number;
  size: number;
  align: 'left' | 'right';
};

/**
 * Small overlapping gifter-avatar circles, filling the gap between a score
 * ribbon and the timer. Only renders as many as actually fit the available
 * width — never overflows onto the timer or wraps.
 */
function GifterAvatarRow({ avatars, left, right, top, rowHeight, size, align }: GifterAvatarRowProps) {
  const gap = Math.max(0, right - left);
  const overlap = size * 0.48; // each circle overlaps the previous by this much
  const step = size - overlap;

  if (gap < size || avatars.length === 0) return null;

  const maxCount = Math.max(1, Math.floor((gap - size) / step) + 1);
  const shown = avatars.slice(0, Math.min(maxCount, avatars.length));

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left,
        width: gap,
        top,
        height: rowHeight,
        flexDirection: align === 'left' ? 'row' : 'row-reverse',
        alignItems: 'center',
        zIndex: 60,
      }}
    >
      {shown.map((url, i) => (
        <View
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            marginLeft: align === 'left' && i > 0 ? -overlap : 0,
            marginRight: align === 'right' && i > 0 ? -overlap : 0,
            borderWidth: Math.max(1.5, size * 0.08),
            borderColor: '#FFFFFF',
            backgroundColor: '#B9BCC4',
            overflow: 'hidden',
            zIndex: shown.length - i,
          }}
        >
          {url ? (
            <Image source={{ uri: url }} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
          ) : null}
        </View>
      ))}
    </View>
  );
}

function BattleAvatar({
  url,
  source,
  name,
  size,
  borderColor,
}: {
  url?: string | null;
  source?: ImageSourcePropType;
  name: string;
  size: number;
  borderColor: string;
}) {
  const imageSource: ImageSourcePropType | undefined =
    source ?? (isRemoteImage(url) ? { uri: url as string } : undefined);
  const border = Math.max(2, size * 0.025);
  const inner = size - border * 2;

  if (imageSource) {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: border, borderColor, backgroundColor: '#FFF', overflow: 'hidden' }}>
        <Image source={imageSource} resizeMode="cover" style={{ width: inner, height: inner, borderRadius: inner / 2 }} />
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: border, borderColor, backgroundColor: '#F4F4F7', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: borderColor, fontSize: size * 0.34, fontWeight: '900' }}>{name?.trim()?.charAt(0)?.toUpperCase() || '?'}</Text>
    </View>
  );
}



function BattleBannerView({
  leftAvatar,
  rightAvatar,
  leftAvatarSource,
  rightAvatarSource,
  leftName = 'You',
  rightName = 'Opponent',
  leftScore = 0,
  rightScore = 0,
  leftGifterAvatars = [],
  rightGifterAvatars = [],
  durationSeconds = 0,
  running = false,
  onPress,
}: BattleBannerProps) {
  const { width } = useWindowDimensions();
  const scale = Math.max(0.70, Math.min(1.20, width / 1080));

  // Local ticking countdown — the parent only gives us a snapshot
  // (re-derived every poll), so tick it down ourselves each second
  // between polls for a smooth-looking timer.
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds);
  useEffect(() => {
    setSecondsLeft(durationSeconds);
  }, [durationSeconds]);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSecondsLeft(s => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  // Exact client-reference composition: compact full-width strip,
  // circular edge avatars, red/blue score bars, center VS and two
  // overlapping small avatars per side.
  const height = 132 * scale;
  const avatar = 64 * scale;
  const barHeight = 52 * scale;
  const barTop = 22 * scale;
  const edge = 1 * scale;
  const gifterRowSize = 34 * scale; // must match GifterAvatarRow's own circle size
  const barStart = edge + avatar * 0.42; // capsule starts under the avatar, like the reference

  // The two capsules run one continuous FLAT bottom edge across the whole
  // strip. The TOP edge stays high and flat for most of the capsule's
  // length, then curves down gently only right near center, tapering to a
  // narrow neck. A small separate raised "bridge" pill (with the VS badge)
  // sits above that neck, straddling the seam — like the reference. Built
  // as ONE SVG spanning the full capsule row so there is no seam between
  // the capsule edges and the bridge.
  const rowWidth = Math.max(1, width - barStart * 2);
  const rowCenter = rowWidth / 2;
  const neckHeight = barHeight * 0.42;
  const taper = barHeight * 0.42; // small rounded corner only, top stays flat the rest of the way

  const bridgeHeight = barHeight * 0.46; // raised bridge, like the reference
  const bridgeGapWidth = rowWidth * 0.34; // gap between the two capsule necks — narrower capsules, wider bridge area
  // Each capsule's neck stops at the gap's edge (not the row center), so
  // the two capsules end as separate shapes with a gap between them.
  const leftNeckX = rowCenter - bridgeGapWidth / 2;
  const rightNeckX = rowCenter + bridgeGapWidth / 2;
  // The bridge itself is wider than that gap so its rounded ends visibly
  // overlap into each capsule, reading as if it starts/ends inside them —
  // but capped to a modest pill width, independent of how wide the gap is.
  const bridgeOverlap = bridgeHeight * 1.15;
  const bridgeWidth = Math.min(bridgeGapWidth + bridgeOverlap * 2, rowWidth * 0.48);
  // Raised above the capsule neck: its bottom sits at the neck line, and it
  // rises upward from there so it visibly protrudes above the capsule top.
  const bridgeTop = barTop + (barHeight - neckHeight) - bridgeHeight * 0.62;

  // The unified SVG must cover both the bridge (which may sit higher than
  // the capsule top) and the capsule row (bottom-aligned at barTop +
  // barHeight). Anchor the SVG at whichever top edge is highest, and offset
  // each shape's local y-coordinates from that shared origin.
  const svgTop = Math.min(barTop, bridgeTop);
  const svgHeight = (barTop + barHeight) - svgTop;
  const capOffsetY = barTop - svgTop;
  const bridgeOffsetY = bridgeTop - svgTop;

  return (
    <Pressable disabled={!onPress} onPress={onPress} style={{ width: '100%', height }}>
      <View style={{ width: '100%', height, position: 'relative', overflow: 'visible' }}>
        {/* Unified capsule + bridge shape: one SVG spanning the full row so
            both capsules and the raised bridge share one coordinate space
            and never show a seam where they meet. */}
        <View pointerEvents="none" style={{ position: 'absolute', left: barStart, top: svgTop, width: rowWidth, height: svgHeight, zIndex: 5 }}>
          <Svg width={rowWidth} height={svgHeight} style={{ position: 'absolute' }}>
            <Defs>
              <LinearGradient id="leftCap" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#F5273F" />
                <Stop offset="1" stopColor="#E01238" />
              </LinearGradient>
              <LinearGradient id="rightCap" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#215BEA" />
                <Stop offset="1" stopColor="#1743D6" />
              </LinearGradient>
              <LinearGradient id="connectorGrad" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#E01238" />
                <Stop offset="0.5" stopColor="#E01238" />
                <Stop offset="0.5" stopColor="#215BEA" />
                <Stop offset="1" stopColor="#215BEA" />
              </LinearGradient>
              <LinearGradient id="bridgeGrad" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#F8456A" />
                <Stop offset="0.5" stopColor="#F8456A" />
                <Stop offset="0.5" stopColor="#3174F3" />
                <Stop offset="1" stopColor="#3174F3" />
              </LinearGradient>
              <LinearGradient id="capShine" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.5} />
                <Stop offset="0.6" stopColor="#FFFFFF" stopOpacity={0.04} />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
              </LinearGradient>
              <LinearGradient id="bridgeShine" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.4} />
                <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity={0.08} />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
              </LinearGradient>
              <LinearGradient id="vsGoldGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#FFF3C4" />
                <Stop offset="0.5" stopColor="#FFCB3D" />
                <Stop offset="1" stopColor="#F5A623" />
              </LinearGradient>
              <RadialGradient id="bridgeShadow" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#241A45" stopOpacity={0.32} />
                <Stop offset="0.7" stopColor="#241A45" stopOpacity={0.14} />
                <Stop offset="1" stopColor="#241A45" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            {/* LEFT capsule: rounded outer cap, flat bottom the whole way,
                top edge curves down (not straight) as it nears center */}
            <Path
              d={`
                M ${barHeight / 2} ${capOffsetY}
                H ${leftNeckX - taper}
                C ${leftNeckX - taper * 0.45} ${capOffsetY}
                  ${leftNeckX} ${capOffsetY + (barHeight - neckHeight) * 0.35}
                  ${leftNeckX} ${capOffsetY + barHeight - neckHeight}
                V ${capOffsetY + barHeight}
                H ${barHeight / 2}
                A ${barHeight / 2} ${barHeight / 2} 0 0 1 ${barHeight / 2} ${capOffsetY}
                Z
              `}
              fill="url(#leftCap)"
            />
            {/* Glossy top-half sheen across the left capsule */}
            <Path
              d={`
                M ${barHeight / 2} ${capOffsetY}
                H ${leftNeckX - taper}
                C ${leftNeckX - taper * 0.45} ${capOffsetY}
                  ${leftNeckX} ${capOffsetY + (barHeight - neckHeight) * 0.35}
                  ${leftNeckX} ${capOffsetY + barHeight - neckHeight}
                V ${capOffsetY + barHeight * 0.5}
                H ${barHeight / 2}
                A ${barHeight / 2} ${barHeight * 0.5} 0 0 1 ${barHeight / 2} ${capOffsetY}
                Z
              `}
              fill="url(#capShine)"
            />
            {/* RIGHT capsule: mirror of the left */}
            <Path
              d={`
                M ${rowWidth - barHeight / 2} ${capOffsetY}
                H ${rightNeckX + taper}
                C ${rightNeckX + taper * 0.45} ${capOffsetY}
                  ${rightNeckX} ${capOffsetY + (barHeight - neckHeight) * 0.35}
                  ${rightNeckX} ${capOffsetY + barHeight - neckHeight}
                V ${capOffsetY + barHeight}
                H ${rowWidth - barHeight / 2}
                A ${barHeight / 2} ${barHeight / 2} 0 0 0 ${rowWidth - barHeight / 2} ${capOffsetY}
                Z
              `}
              fill="url(#rightCap)"
            />
            {/* Glossy top-half sheen across the right capsule */}
            <Path
              d={`
                M ${rowWidth - barHeight / 2} ${capOffsetY}
                H ${rightNeckX + taper}
                C ${rightNeckX + taper * 0.45} ${capOffsetY}
                  ${rightNeckX} ${capOffsetY + (barHeight - neckHeight) * 0.35}
                  ${rightNeckX} ${capOffsetY + barHeight - neckHeight}
                V ${capOffsetY + barHeight * 0.5}
                H ${rowWidth - barHeight / 2}
                A ${barHeight / 2} ${barHeight * 0.5} 0 0 0 ${rowWidth - barHeight / 2} ${capOffsetY}
                Z
              `}
              fill="url(#capShine)"
            />
            {/* CONNECTOR: thin flat bar at the bottom joining the two capsule
                necks, so the flat bottom edge reads as one continuous line
                running under the bridge instead of breaking in the gap. */}
            <Path
              d={`
                M ${leftNeckX} ${capOffsetY + barHeight - neckHeight}
                H ${rightNeckX}
                V ${capOffsetY + barHeight}
                H ${leftNeckX}
                Z
              `}
              fill="url(#connectorGrad)"
            />
            {/* Soft drop shadow under the bridge so it visually lifts off the
                capsules/background instead of blending flat into them. */}
            <Ellipse
              cx={rowCenter}
              cy={bridgeOffsetY + bridgeHeight}
              rx={bridgeWidth * 0.56}
              ry={bridgeHeight * 0.34}
              fill="url(#bridgeShadow)"
            />
            {/* BRIDGE: small raised pill sitting above the shared neck point,
                drawn in the same coordinate space so it never seams. */}
            <Path
              d={`
                M ${rowCenter - bridgeWidth / 2 + bridgeHeight / 2} ${bridgeOffsetY}
                H ${rowCenter + bridgeWidth / 2 - bridgeHeight / 2}
                A ${bridgeHeight / 2} ${bridgeHeight / 2} 0 0 1 ${rowCenter + bridgeWidth / 2 - bridgeHeight / 2} ${bridgeOffsetY + bridgeHeight}
                H ${rowCenter - bridgeWidth / 2 + bridgeHeight / 2}
                A ${bridgeHeight / 2} ${bridgeHeight / 2} 0 0 1 ${rowCenter - bridgeWidth / 2 + bridgeHeight / 2} ${bridgeOffsetY}
                Z
              `}
              fill="url(#bridgeGrad)"
            />
            {/* Subtle glossy sheen on the bridge's top half — a soft
                highlight, not a strong white wash */}
            <Path
              d={`
                M ${rowCenter - bridgeWidth / 2 + bridgeHeight / 2} ${bridgeOffsetY}
                H ${rowCenter + bridgeWidth / 2 - bridgeHeight / 2}
                A ${bridgeHeight / 2} ${bridgeHeight * 0.5} 0 0 1 ${rowCenter + bridgeWidth / 2 - bridgeHeight / 2} ${bridgeOffsetY + bridgeHeight * 0.5}
                H ${rowCenter - bridgeWidth / 2 + bridgeHeight / 2}
                A ${bridgeHeight / 2} ${bridgeHeight * 0.5} 0 0 1 ${rowCenter - bridgeWidth / 2 + bridgeHeight / 2} ${bridgeOffsetY}
                Z
              `}
              fill="url(#bridgeShine)"
            />
            {/* VS lightning bolt, centered on the bridge */}
            <Path
              d={`
                M ${rowCenter + bridgeHeight * 0.10} ${bridgeOffsetY + bridgeHeight * 0.08}
                L ${rowCenter - bridgeHeight * 0.20} ${bridgeOffsetY + bridgeHeight * 0.52}
                L ${rowCenter - bridgeHeight * 0.02} ${bridgeOffsetY + bridgeHeight * 0.52}
                L ${rowCenter - bridgeHeight * 0.12} ${bridgeOffsetY + bridgeHeight * 0.94}
                L ${rowCenter + bridgeHeight * 0.24} ${bridgeOffsetY + bridgeHeight * 0.42}
                L ${rowCenter + bridgeHeight * 0.04} ${bridgeOffsetY + bridgeHeight * 0.42}
                Z
              `}
              fill="url(#vsGoldGrad)"
              stroke="#FFFFFF"
              strokeWidth={Math.max(1, bridgeHeight * 0.045)}
            />
          </Svg>
          {/* Battle timer — centered above the bridge */}
          <Text
            numberOfLines={1}
            style={{
              position: 'absolute',
              left: 0,
              width: rowWidth,
              top: bridgeOffsetY - barHeight * 0.46,
              textAlign: 'center',
              color: '#3B2A55',
              fontSize: barHeight * 0.28,
              lineHeight: barHeight * 0.32,
              fontWeight: '800',
              includeFontPadding: false,
            }}
          >
            {formatTime(secondsLeft)}
          </Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            style={{ position: 'absolute', left: barHeight * 0.55, right: rowWidth - leftNeckX + taper, top: capOffsetY + barHeight * 0.18, textAlign: 'center', color: '#FFF', fontSize: 24 * scale, lineHeight: 28 * scale, fontWeight: '900', includeFontPadding: false }}
          >
            {formatScore(leftScore)}
          </Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            style={{ position: 'absolute', left: rightNeckX + taper, right: barHeight * 0.55, top: capOffsetY + barHeight * 0.18, textAlign: 'center', color: '#FFF', fontSize: 24 * scale, lineHeight: 28 * scale, fontWeight: '900', includeFontPadding: false }}
          >
            {formatScore(rightScore)}
          </Text>
        </View>

        {/* LEFT large avatar — sits a bit below the capsule's bottom edge */}
        <View pointerEvents="none" style={{ position: 'absolute', left: edge, top: barTop + barHeight - avatar + avatar * 0.1, width: avatar, height: avatar, zIndex: 50 }}>
          <BattleAvatar url={leftAvatar} source={leftAvatarSource} name={leftName} size={avatar} borderColor="#F02754" />
        </View>

        {/* RIGHT large avatar — sits a bit below the capsule's bottom edge */}
        <View pointerEvents="none" style={{ position: 'absolute', right: edge, top: barTop + barHeight - avatar + avatar * 0.1, width: avatar, height: avatar, zIndex: 50 }}>
          <BattleAvatar url={rightAvatar} source={rightAvatarSource} name={rightName} size={avatar} borderColor="#2876E6" />
        </View>

        {/* Top gifters (up to 5 per side) — small overlapping circles,
            below the capsule row, starting from that side's player avatar. */}
        <GifterAvatarRow
          avatars={leftGifterAvatars.slice(0, 5)}
          left={50*edge}
          right={rowCenter + barStart}
          top={barTop + barHeight - 12 * scale}
          rowHeight={gifterRowSize}
          size={gifterRowSize}
          align="left"
        />
        <GifterAvatarRow
          avatars={rightGifterAvatars.slice(0, 5)}
          left={rowCenter + barStart}
          right={width - 50*edge}
          top={barTop + barHeight - 12 * scale}
          rowHeight={gifterRowSize}
          size={gifterRowSize}
          align="right"
        />
      </View>
    </Pressable>
  );
}

/* -------------------------------------------------------
   DATA-FETCHING WRAPPER

   Polls for an active battle on this room and its live
   gifter totals, then feeds BattleBannerView's presentational
   props. This is the component the rest of the app imports.
------------------------------------------------------- */

type BattleInfo = {
  inviteId: string;
  fromRoomId: string;
  fromRoomName: string;
  fromRoomImageUrl: string | null;
  toRoomId: string;
  toRoomName: string;
  toRoomImageUrl: string | null;
  endsAt: string | null;
  startedAt?: string | null;
  durationMinutes?: number;
};

type TopGifter = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  total_coins: number;
};

function resolveBattleAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : `${MEDIA_BASE}/${url.replace(/^\//, '')}`;
}

function fmtGifterCoins(n: number): string {
  const v = Math.max(0, Math.round(n));
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return String(v);
}

function GifterListRow({ gifter, rank }: { gifter: TopGifter; rank: number }) {
  const url = resolveBattleAvatarUrl(gifter.avatar_url);
  const name = gifter.full_name || gifter.username || 'Guest';
  return (
    <View style={gifterModalStyles.row}>
      <Text style={gifterModalStyles.rank}>{rank}</Text>
      {url ? (
        <Image source={{ uri: url }} style={gifterModalStyles.avatar} />
      ) : (
        <View style={[gifterModalStyles.avatar, gifterModalStyles.avatarFallback]}>
          <Text style={gifterModalStyles.avatarInitial}>{name[0]?.toUpperCase() ?? '?'}</Text>
        </View>
      )}
      <Text style={gifterModalStyles.name} numberOfLines={1}>{name}</Text>
      <View style={gifterModalStyles.coinPill}>
        <Text style={gifterModalStyles.coinText}>🪙 {fmtGifterCoins(Number(gifter.total_coins))}</Text>
      </View>
    </View>
  );
}

function GifterList({ gifters }: { gifters: TopGifter[] }) {
  if (gifters.length === 0) {
    return <Text style={gifterModalStyles.empty}>No gifts yet</Text>;
  }
  return (
    <>
      {gifters.map((g, i) => <GifterListRow key={g.id} gifter={g} rank={i + 1} />)}
    </>
  );
}

type TopGiftersModalProps = {
  visible: boolean;
  onClose: () => void;
  ownName: string;
  rivalName: string;
  ownGifters: TopGifter[];
  rivalGifters: TopGifter[];
};

const GIFTERS_SHEET_HEIGHT = Dimensions.get('window').height * 0.55;

function TopGiftersModal({ visible, onClose, ownName, rivalName, ownGifters, rivalGifters }: TopGiftersModalProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(GIFTERS_SHEET_HEIGHT)).current;
  const [activeTab, setActiveTab] = useState<'own' | 'rival'>('own');

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 5,
      onPanResponderMove: (_, g) => { if (g.dy > 0) translateY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 100) close();
        else Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  function open() {
    setActiveTab('own');
    translateY.setValue(GIFTERS_SHEET_HEIGHT);
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
  }

  function close() {
    Animated.timing(translateY, { toValue: GIFTERS_SHEET_HEIGHT, duration: 220, useNativeDriver: true }).start(onClose);
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close} onShow={open}>
      <TouchableOpacity style={gifterModalStyles.backdrop} activeOpacity={1} onPress={close} />

      <Animated.View
        style={[
          gifterModalStyles.sheet,
          { height: GIFTERS_SHEET_HEIGHT, paddingBottom: insets.bottom + 8, transform: [{ translateY }] },
        ]}
      >
        {/* Drag handle */}
        <View {...panResponder.panHandlers} style={gifterModalStyles.handleArea}>
          <View style={gifterModalStyles.handle} />
        </View>

        <View style={gifterModalStyles.header}>
          <Text style={gifterModalStyles.title}>Top Gifters</Text>
        </View>

        <View style={gifterModalStyles.tabs}>
          <TouchableOpacity
            style={[gifterModalStyles.tab, activeTab === 'own' && { borderBottomColor: '#DE2850' }]}
            onPress={() => setActiveTab('own')}
          >
            <Text style={[gifterModalStyles.tabText, activeTab === 'own' && { color: '#DE2850' }]} numberOfLines={1}>
              {ownName || 'You'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[gifterModalStyles.tab, activeTab === 'rival' && { borderBottomColor: '#246CDE' }]}
            onPress={() => setActiveTab('rival')}
          >
            <Text style={[gifterModalStyles.tabText, activeTab === 'rival' && { color: '#246CDE' }]} numberOfLines={1}>
              {rivalName || 'Opponent'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={gifterModalStyles.body}
          contentContainerStyle={gifterModalStyles.bodyContent}
          showsVerticalScrollIndicator={false}
        >
          <GifterList gifters={activeTab === 'own' ? ownGifters : rivalGifters} />
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const gifterModalStyles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
  },
  handleArea: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DDDAE8' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  title: { fontSize: 16, fontWeight: '800', color: '#1C1E22' },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    paddingHorizontal: 12,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 14, fontWeight: '700', color: '#999' },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 12 },
  empty: { fontSize: 12, color: '#999', textAlign: 'center', marginTop: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  rank: { width: 20, fontSize: 14, fontWeight: '700', color: '#999' },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { backgroundColor: '#B9BCC4', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  name: { flex: 1, fontSize: 15, fontWeight: '600', color: '#333' },
  coinPill: {
    backgroundColor: '#FFF4E0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  coinText: { fontSize: 13, fontWeight: '700', color: '#B8720A' },
});

function resolveBattleEndsAt(info: BattleInfo): number | null {
  if (info.endsAt) return new Date(info.endsAt).getTime();
  if (info.startedAt && info.durationMinutes) {
    return new Date(info.startedAt).getTime() + info.durationMinutes * 60 * 1000;
  }
  return null;
}

function mapBattleApiData(data: Record<string, unknown>): BattleInfo {
  return {
    inviteId:         (data.invite_id ?? data.id ?? data.inviteId) as string,
    fromRoomId:       (data.from_room_id ?? data.fromRoomId) as string,
    fromRoomName:     (data.from_room_name ?? data.fromRoomName ?? '') as string,
    fromRoomImageUrl: (data.from_room_image_url ?? data.fromRoomImageUrl ?? null) as string | null,
    toRoomId:         (data.to_room_id ?? data.toRoomId) as string,
    toRoomName:       (data.to_room_name ?? data.toRoomName ?? '') as string,
    toRoomImageUrl:   (data.to_room_image_url ?? data.toRoomImageUrl ?? null) as string | null,
    endsAt:           (data.ends_at ?? data.endsAt ?? null) as string | null,
    startedAt:        (data.started_at ?? data.startedAt ?? null) as string | null,
    durationMinutes:  (data.duration_minutes ?? data.durationMinutes ?? null) as number | undefined,
  };
}

type Props = { roomId: string; coinsByUserId?: Map<string, number>; giftersByUserId?: Map<string, unknown> };

export function BattleBanner({ roomId }: Props) {
  const [battle, setBattle] = useState<BattleInfo | null>(null);
  const [leftGifters, setLeftGifters] = useState<TopGifter[]>([]);
  const [rightGifters, setRightGifters] = useState<TopGifter[]>([]);
  const [showGiftersModal, setShowGiftersModal] = useState(false);
  const endsAtMs = battle ? resolveBattleEndsAt(battle) : null;

  // Fetch active battle
  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    const fetchBattle = async () => {
      const token = authStore.getToken();
      if (!token) return;
      try {
        const nr = await fetch(`${BASE_URL}/battle/notifications`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const nj = await nr.json();
        if (cancelled || !nj.success) return;

        const notifs: Array<{ type: string; data: Record<string, string> | null }> = nj.data ?? [];
        const match = notifs.find(n =>
          (n.type === 'battle_invite' || n.type === 'battle_accepted' || n.type === 'battle_started') &&
          n.data?.invite_id
        );
        if (!match?.data?.invite_id) { if (!cancelled) setBattle(null); return; }

        const ir = await fetch(`${BASE_URL}/battle/invite/${match.data.invite_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const ij = await ir.json();
        if (cancelled || !ij.success || !ij.data) return;

        const d = ij.data;
        if (d.status !== 'active') { if (!cancelled) setBattle(null); return; }
        if (d.from_room_id !== roomId && d.to_room_id !== roomId) { if (!cancelled) setBattle(null); return; }

        const startMs = d.started_at ? new Date(d.started_at).getTime() : null;
        const durMs = (d.duration_minutes ?? 0) * 60_000;
        const endsMs = startMs ? startMs + durMs : null;
        if (endsMs && endsMs <= Date.now()) { if (!cancelled) setBattle(null); return; }

        if (!cancelled) setBattle(mapBattleApiData({ ...d, invite_id: match.data.invite_id }));
      } catch { if (!cancelled) setBattle(null); }
    };
    fetchBattle();
    const id = setInterval(fetchBattle, 15_000);
    const unsubStarted = onBattleStarted(() => fetchBattle());
    const unsubAccepted = onBattleInviteAccepted(() => fetchBattle());
    return () => { cancelled = true; clearInterval(id); unsubStarted(); unsubAccepted(); };
  }, [roomId]);

  // Fetch top gifters per side — poll every 15s
  useEffect(() => {
    if (!battle?.inviteId) return;
    let cancelled = false;
    const fetchGifters = async () => {
      const token = authStore.getToken();
      if (!token) return;
      try {
        const r = await fetch(`${BASE_URL}/battle/top-gifters/${battle.inviteId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = await r.json();
        if (cancelled || !j.success) return;
        if (!cancelled) {
          setLeftGifters((j.data.left ?? []).slice(0, 5));
          setRightGifters((j.data.right ?? []).slice(0, 5));
        }
      } catch {}
    };
    fetchGifters();
    const id = setInterval(fetchGifters, 15_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [battle?.inviteId]);

  if (!battle) return null;

  const isFrom      = battle.fromRoomId === roomId;
  const ownName     = isFrom ? battle.fromRoomName     : battle.toRoomName;
  const rivalName   = isFrom ? battle.toRoomName       : battle.fromRoomName;
  const ownImgUrl   = isFrom ? battle.fromRoomImageUrl : battle.toRoomImageUrl;
  const rivalImgUrl = isFrom ? battle.toRoomImageUrl   : battle.fromRoomImageUrl;
  // left = from_room, right = to_room (API convention)
  const ownGifters   = isFrom ? leftGifters  : rightGifters;
  const rivalGifters = isFrom ? rightGifters : leftGifters;
  const ownScore   = ownGifters.reduce((s, g) => s + Number(g.total_coins), 0);
  const rivalScore = rivalGifters.reduce((s, g) => s + Number(g.total_coins), 0);
  const durationSeconds = endsAtMs ? Math.max(0, Math.floor((endsAtMs - Date.now()) / 1000)) : 0;

  return (
    <>
      <BattleBannerView
        leftAvatar={resolveBattleAvatarUrl(ownImgUrl)}
        rightAvatar={resolveBattleAvatarUrl(rivalImgUrl)}
        leftName={ownName || 'Room'}
        rightName={rivalName || 'Room'}
        leftScore={ownScore}
        rightScore={rivalScore}
        leftGifterAvatars={ownGifters.map(g => resolveBattleAvatarUrl(g.avatar_url))}
        rightGifterAvatars={rivalGifters.map(g => resolveBattleAvatarUrl(g.avatar_url))}
        durationSeconds={durationSeconds}
        running={durationSeconds > 0}
        onPress={() => setShowGiftersModal(true)}
      />
      <TopGiftersModal
        visible={showGiftersModal}
        onClose={() => setShowGiftersModal(false)}
        ownName={ownName || 'Us'}
        rivalName={rivalName || 'Opponent'}
        ownGifters={ownGifters}
        rivalGifters={rivalGifters}
      />
    </>
  );
}

const styles = StyleSheet.create({
  battleRoot: {
    width: '100%',
    position: 'relative',
    backgroundColor: 'transparent',
  },
});