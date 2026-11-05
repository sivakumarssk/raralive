import Svg, { Path } from 'react-native-svg';

import { ICON_PATHS } from './icon-paths';

// Bottom tab icons, drawn bolder than the Ionicons font allows. The paths are
// the Ionicons glyph outlines themselves (see icon-paths.ts), so shapes and
// positions match the font icons exactly; stroking the outline in the same
// colour thickens every edge evenly — about 1.1× the normal line weight —
// while staying crisp at any size.

export type TabIconName =
  | 'home' | 'home-outline' | 'compass' | 'compass-outline' | 'add-circle' | 'add-circle-outline'
  | 'radio' | 'radio-outline' | 'person' | 'person-outline';

/** Extra weight added around each outline, in the 512-unit icon grid. */
const BOLD_STROKE = 4;

export function TabIcon({ name, size, color }: { name: TabIconName; size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512">
      <Path
        d={ICON_PATHS[name]}
        fill={color}
        stroke={color}
        strokeWidth={BOLD_STROKE}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
