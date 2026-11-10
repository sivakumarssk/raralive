import Svg, { Path } from 'react-native-svg';

/**
 * Bracket with a solid arrow pointing out of it — "leave" (Exit Audio, Log Out).
 * Ionicons has no filled version of this shape, so it's drawn here.
 */
export function ExitIcon({ size = 20, color = '#E14C57' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M9.5 4H6.8A2.8 2.8 0 0 0 4 6.8v10.4A2.8 2.8 0 0 0 6.8 20h2.7" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      <Path
        d="M10.4 9.3H14V6.2c0-.6.7-.9 1.1-.5l6.2 5.6c.3.3.3.8 0 1.1l-6.2 5.6c-.4.4-1.1.1-1.1-.5v-3.1h-3.6c-.5 0-.9-.4-.9-.9V10.2c0-.5.4-.9.9-.9Z"
        fill={color}
      />
    </Svg>
  );
}
