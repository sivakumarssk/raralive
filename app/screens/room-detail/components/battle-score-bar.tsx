import { useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

import { RC } from '../room-ui';

/**
 * Where the battle time's bottom edge should land, measured down from the
 * bar's top: on top of the raised bridge, or — with no bridge (gifting
 * battles) — on the flat connector in the gap between the two capsules.
 */
export function scoreBarTimeSeat(barHeight = 36, showBridge = true) {
  const neckHeight = barHeight * 0.42;
  const bridgeHeight = barHeight * 0.46;
  const capY = showBridge ? Math.max(0, bridgeHeight * 0.62 - (barHeight - neckHeight)) : 0;
  return showBridge
    ? capY + (barHeight - neckHeight) - bridgeHeight * 0.62
    : barHeight - neckHeight;
}

/** Height of the flat strip joining the two capsules (where the gifting bolt sits). */
export function scoreBarStripHeight(barHeight = 36) {
  return barHeight * 0.42;
}

/**
 * The battle banner's score capsules (see battle-banner.tsx) at any width:
 * blue left / red right capsules tapering to a neck, a flat connector along
 * the bottom, and the raised centre bridge with the gold VS bolt. Each side's
 * coins sit centred in its capsule. Used by the battle result cards.
 *
 * `showBridge={false}` is the gifting battle look (as in the banner during a
 * gifting battle): no raised pill or bolt, just the gap between the capsules.
 */
export function BattleScoreBar({ leftScore, rightScore, barHeight = 36, showBridge = true }: {
  leftScore: number;
  rightScore: number;
  barHeight?: number;
  showBridge?: boolean;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  // Same proportions as BattleBannerView
  const neckHeight = barHeight * 0.42;
  const taper = barHeight * 0.42;
  const bridgeHeight = barHeight * 0.46;
  const rowCenter = width / 2;
  // Without the bridge the gap is a little wider (as in the banner), so the
  // battle time fits between the capsules
  const gap = width * (showBridge ? 0.3 : 0.34);
  const leftNeckX = rowCenter - gap / 2;
  const rightNeckX = rowCenter + gap / 2;
  // A little shorter than the banner's: the card is narrower than the screen
  const bridgeWidth = Math.min(gap + bridgeHeight * 1.2, width * 0.4);
  const bridgeLeft = rowCenter - bridgeWidth / 2;
  const bridgeRight = rowCenter + bridgeWidth / 2;
  // Bridge rises above the capsule tops; the SVG starts at its top edge
  const bridgeRise = bridgeHeight * 0.62 - (barHeight - neckHeight);
  const capY = showBridge ? Math.max(0, bridgeRise) : 0;
  const bridgeY = capY + (barHeight - neckHeight) - bridgeHeight * 0.62;
  const svgHeight = capY + barHeight;

  const capsule = (side: 'left' | 'right', sheen: boolean) => {
    const bottom = sheen ? capY + barHeight * 0.5 : capY + barHeight;
    const r = barHeight / 2;
    if (side === 'left') {
      return `M ${r} ${capY} H ${leftNeckX - taper}
        C ${leftNeckX - taper * 0.45} ${capY} ${leftNeckX} ${capY + (barHeight - neckHeight) * 0.35} ${leftNeckX} ${capY + barHeight - neckHeight}
        V ${bottom} H ${r} A ${r} ${sheen ? barHeight * 0.5 : r} 0 0 1 ${r} ${capY} Z`;
    }
    return `M ${width - r} ${capY} H ${rightNeckX + taper}
      C ${rightNeckX + taper * 0.45} ${capY} ${rightNeckX} ${capY + (barHeight - neckHeight) * 0.35} ${rightNeckX} ${capY + barHeight - neckHeight}
      V ${bottom} H ${width - r} A ${r} ${sheen ? barHeight * 0.5 : r} 0 0 0 ${width - r} ${capY} Z`;
  };
  const pill = (h: number) => {
    const x0 = rowCenter - bridgeWidth / 2 + bridgeHeight / 2;
    const x1 = rowCenter + bridgeWidth / 2 - bridgeHeight / 2;
    return `M ${x0} ${bridgeY} H ${x1} A ${bridgeHeight / 2} ${h / 2} 0 0 1 ${x1} ${bridgeY + h} H ${x0} A ${bridgeHeight / 2} ${h / 2} 0 0 1 ${x0} ${bridgeY} Z`;
  };
  const scoreStyle = {
    position: 'absolute' as const,
    top: capY + barHeight * 0.16,
    textAlign: 'center' as const,
    color: RC.numberOnDark,
    fontSize: barHeight * 0.46,
    lineHeight: barHeight * 0.58,
    fontWeight: '900' as const,
    includeFontPadding: false,
  };
  const fmt = (n: number) => String(Math.max(0, Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return (
    <View style={{ height: svgHeight }} onLayout={onLayout}>
      {width > 0 && (
        <>
          <Svg width={width} height={svgHeight} style={{ position: 'absolute' }}>
            <Defs>
              <LinearGradient id="rbLeft" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#215BEA" />
                <Stop offset="1" stopColor="#1743D6" />
              </LinearGradient>
              <LinearGradient id="rbRight" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#F5273F" />
                <Stop offset="1" stopColor="#E01238" />
              </LinearGradient>
              <LinearGradient id="rbConnector" x1="0" y1="0" x2="1" y2="0">
                {/* Blended in the middle — no hard line where the colours meet */}
                <Stop offset="0" stopColor="#215BEA" />
                <Stop offset="0.3" stopColor="#215BEA" />
                <Stop offset="0.7" stopColor="#E01238" />
                <Stop offset="1" stopColor="#E01238" />
              </LinearGradient>
              <LinearGradient id="rbBridge" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#3174F3" />
                <Stop offset="0.3" stopColor="#3174F3" />
                <Stop offset="0.7" stopColor="#F8456A" />
                <Stop offset="1" stopColor="#F8456A" />
              </LinearGradient>
              <LinearGradient id="rbShine" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.5} />
                <Stop offset="0.6" stopColor="#FFFFFF" stopOpacity={0.04} />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
              </LinearGradient>
              <LinearGradient id="rbBolt" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#FFF3C4" />
                <Stop offset="0.5" stopColor="#FFCB3D" />
                <Stop offset="1" stopColor="#F5A623" />
              </LinearGradient>
              <RadialGradient id="rbShadow" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#000000" stopOpacity={0.35} />
                <Stop offset="1" stopColor="#000000" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Path d={capsule('left', false)} fill="url(#rbLeft)" />
            <Path d={capsule('left', true)} fill="url(#rbShine)" />
            <Path d={capsule('right', false)} fill="url(#rbRight)" />
            <Path d={capsule('right', true)} fill="url(#rbShine)" />
            <Path
              d={`M ${leftNeckX} ${capY + barHeight - neckHeight} H ${rightNeckX} V ${capY + barHeight} H ${leftNeckX} Z`}
              fill="url(#rbConnector)"
            />
            {showBridge && (<>
            <Ellipse cx={rowCenter} cy={bridgeY + bridgeHeight} rx={bridgeWidth * 0.56} ry={bridgeHeight * 0.34} fill="url(#rbShadow)" />
            <Path d={pill(bridgeHeight)} fill="url(#rbBridge)" />
            <Path d={pill(bridgeHeight * 0.5)} fill="url(#rbShine)" />
            <Path
              d={`M ${rowCenter + bridgeHeight * 0.1} ${bridgeY + bridgeHeight * 0.08}
                L ${rowCenter - bridgeHeight * 0.2} ${bridgeY + bridgeHeight * 0.52}
                L ${rowCenter - bridgeHeight * 0.02} ${bridgeY + bridgeHeight * 0.52}
                L ${rowCenter - bridgeHeight * 0.12} ${bridgeY + bridgeHeight * 0.94}
                L ${rowCenter + bridgeHeight * 0.24} ${bridgeY + bridgeHeight * 0.42}
                L ${rowCenter + bridgeHeight * 0.04} ${bridgeY + bridgeHeight * 0.42} Z`}
              fill="url(#rbBolt)"
              stroke="#FFFFFF"
              strokeWidth={Math.max(1, bridgeHeight * 0.045)}
            />
            </>)}
          </Svg>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}
            style={[scoreStyle, { left: barHeight * 0.35, right: width - (showBridge ? bridgeLeft - 4 : leftNeckX - taper * 0.3) }]}>
            {fmt(leftScore)}
          </Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}
            style={[scoreStyle, { left: showBridge ? bridgeRight + 4 : rightNeckX + taper * 0.3, right: barHeight * 0.35 }]}>
            {fmt(rightScore)}
          </Text>
        </>
      )}
    </View>
  );
}
