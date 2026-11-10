import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
import Svg, { ClipPath, Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';

import { hexPath } from './diamond-cut-button';

export type DiamondCutTab<K extends string> = {
  key: K;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Icon when not selected (e.g. the outline variant). */
  inactiveIcon?: keyof typeof Ionicons.glyphMap;
  /** Gradient of the selected segment, left to right. */
  activeColors: readonly [string, string, ...string[]];
};

type Props<K extends string> = {
  tabs: DiamondCutTab<K>[];
  value: K;
  onChange: (key: K) => void;
  height?: number;
};

const PAD = 3;          // track edge → segments
const CUT_RATIO = 0.38; // pointed ends, same as DiamondCutButton
const LEAN = 0.5;       // how far the curved break between tabs runs sideways, × segment height
const BEND = 0.6;       // how round the break's S-curve is (0 = straight, 1 = very round)
const GAP = 3;          // width of the break between tabs

/**
 * Segment i of n inside a w × h area, as an SVG path. The outer ends are
 * pointed like the track; neighbouring segments meet along an S-curve that
 * runs from top-left down to bottom-right.
 */
function segmentPath(i: number, n: number, w: number, h: number, ox: number, oy: number): string {
  const cut = h * CUT_RATIO;
  const lean = h * LEAN;
  const bend = lean * BEND;
  const mid = (k: number) => (k * w) / n;
  const P = (x: number, y: number) => `${x + ox} ${y + oy}`;
  const first = i === 0;
  const last = i === n - 1;

  // Break k: top end at mid(k) - lean/2, bottom end at mid(k) + lean/2
  const rightTop = mid(i + 1) - lean / 2 - GAP / 2;
  const rightBottom = mid(i + 1) + lean / 2 - GAP / 2;
  const leftTop = mid(i) - lean / 2 + GAP / 2;
  const leftBottom = mid(i) + lean / 2 + GAP / 2;

  const d = [`M ${P(first ? cut : leftTop, 0)}`];
  if (last) {
    d.push(`L ${P(w - cut, 0)}`, `L ${P(w, h / 2)}`, `L ${P(w - cut, h)}`);
  } else {
    d.push(`L ${P(rightTop, 0)}`, `C ${P(rightTop + bend, 0)} ${P(rightBottom - bend, h)} ${P(rightBottom, h)}`);
  }
  if (first) {
    d.push(`L ${P(cut, h)}`, `L ${P(0, h / 2)}`);
  } else {
    d.push(`L ${P(leftBottom, h)}`, `C ${P(leftBottom - bend, h)} ${P(leftTop + bend, 0)} ${P(leftTop, 0)}`);
  }
  return d.join(' ') + ' Z';
}

/** Segmented tabs in a track with pointed ends; tabs are split by a curved break. */
export function DiamondCutTabs<K extends string>({ tabs, value, onChange, height = 42 }: Props<K>) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  const activeIndex = Math.max(0, tabs.findIndex(t => t.key === value));
  const active = tabs[activeIndex];
  const innerW = width - PAD * 2;
  const innerH = height - PAD * 2;
  const gradientId = `tab-${String(active.key)}`;
  const activePath = segmentPath(activeIndex, tabs.length, innerW, innerH, PAD, PAD);

  return (
    <View style={[styles.row, { height }]} onLayout={onLayout}>
      {width > 0 && (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
              {active.activeColors.map((c, i) => (
                <Stop key={i} offset={i / (active.activeColors.length - 1)} stopColor={c} />
              ))}
            </LinearGradient>
            <ClipPath id={`${gradientId}-clip`}>
              <Path d={activePath} />
            </ClipPath>
          </Defs>
          {/* Track */}
          <Path d={hexPath(width, height, height * CUT_RATIO, 0.5)} fill="#F4EEFF" stroke="#EADDFF" strokeWidth={1} />
          {tabs.map((tab, i) => i === activeIndex ? null : (
            <Path key={tab.key} d={segmentPath(i, tabs.length, innerW, innerH, PAD, PAD)} fill="#EADFFC" />
          ))}
          <Path d={activePath} fill={`url(#${gradientId})`} />
          {/* Inner facet line that follows every edge, curve included: a light
              band inside the outline, mostly covered again by the fill colour */}
          <G clipPath={`url(#${gradientId}-clip)`}>
            <Path d={activePath} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={7} />
            <Path d={activePath} fill="none" stroke={`url(#${gradientId})`} strokeWidth={5} />
          </G>
        </Svg>
      )}
      {tabs.map(tab => {
        const selected = tab.key === value;
        return (
          <TouchableOpacity
            key={tab.key}
            activeOpacity={0.85}
            onPress={() => onChange(tab.key)}
            style={[styles.tab, { paddingHorizontal: innerH * CUT_RATIO }]}
            accessibilityRole="button"
            accessibilityState={{ selected }}>
            <Ionicons name={selected ? tab.icon : (tab.inactiveIcon ?? tab.icon)} size={14} color={selected ? '#FFFFFF' : '#9B6FE0'} />
            <Text style={[styles.label, selected && styles.labelActive]} numberOfLines={1}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: PAD },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  label: { fontSize: 13, fontWeight: '700', color: '#8A63D2', flexShrink: 1 },
  labelActive: { color: '#FFFFFF' },
});
