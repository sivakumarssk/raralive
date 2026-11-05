import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ICON_PATHS, type IconPathName } from './icon-paths';

// An Ionicons icon with a heavier line weight — same shape, size and position
// as the font icon (the path is its own glyph outline), stroked in its colour
// so every edge thickens evenly and stays sharp.

/** Default extra weight in the 512-unit grid: lines ≈1.35× the font's. */
const DEFAULT_WEIGHT = 12;

export function BoldIcon({ name, size, color, weight = DEFAULT_WEIGHT, style }: {
  name: IconPathName;
  size: number;
  color: string;
  /** Extra stroke in the 512-unit grid (0 = same as the font icon). */
  weight?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
      <Path d={ICON_PATHS[name]} fill={color} stroke={color} strokeWidth={weight} strokeLinejoin="round" />
    </Svg>
  );
}
