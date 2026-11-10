import { useState, type ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

type DiamondCutButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  /** Gradient stops, left to right. */
  colors: readonly [string, string, ...string[]];
  /** Rendered before the label (icon or emoji). */
  iconNode?: ReactNode;
  height?: number;
  fontSize?: number;
  textStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
};

/**
 * Hexagon outline: flat top and bottom, ends cut to a point at mid-height.
 * `inset` pulls every edge in (used for the inner highlight line).
 */
export function hexPath(w: number, h: number, cut: number, inset = 0) {
  // Each edge moved `inset` inward; corners are where the moved edges meet.
  const half = h / 2;
  const edge = Math.hypot(cut, half);
  const tip = (inset * edge) / half;
  const top = inset;
  const bottom = h - inset;
  const left = (inset * half) / edge + ((half + (inset * cut) / edge - inset) / half) * cut;
  return [
    `M ${tip} ${h / 2}`,
    `L ${left} ${top}`,
    `L ${w - left} ${top}`,
    `L ${w - tip} ${h / 2}`,
    `L ${w - left} ${bottom}`,
    `L ${left} ${bottom}`,
    'Z',
  ].join(' ');
}

/** Gradient button whose left and right ends are cut to a point, like a gem. */
export function DiamondCutButton({
  label, onPress, disabled, colors, iconNode, height = 46, fontSize = 15, textStyle, style,
}: DiamondCutButtonProps) {
  const [width, setWidth] = useState(0);
  const cut = Math.round(height * 0.38);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, { height }, style]}
      onLayout={onLayout}>
      {width > 0 && (
        // Disabled dims only the shape — the icon and label stay fully white
        <Svg width={width} height={height} style={[StyleSheet.absoluteFill, disabled && styles.disabled]}>
          <Defs>
            <LinearGradient id="fill" x1="0" y1="0" x2="1" y2="0">
              {colors.map((c, i) => (
                <Stop key={i} offset={i / (colors.length - 1)} stopColor={c} />
              ))}
            </LinearGradient>
          </Defs>
          <Path d={hexPath(width, height, cut)} fill="url(#fill)" />
          {/* Thin inner edge, like the bevel on a cut stone */}
          <Path d={hexPath(width, height, cut, 3)} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={1} />
        </Svg>
      )}
      <View style={[styles.content, { paddingHorizontal: cut }]}>
        {iconNode}
        <Text style={[styles.label, { fontSize }, textStyle]} numberOfLines={1}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { justifyContent: 'center' },
  disabled: { opacity: 0.45 },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { color: '#FFFFFF', fontWeight: '700' },
});
