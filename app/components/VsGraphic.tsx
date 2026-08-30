import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Text as SvgText,
  G,
  Path,
  Ellipse,
} from 'react-native-svg';

// Brush-stroke paint splash behind the VS letters
const BRUSH_LEFT =
  'M18 42 C10 30 6 18 14 10 C22 2 36 6 44 14 C50 20 52 30 48 40 C44 52 32 58 22 54 C14 50 16 46 18 42Z';
const BRUSH_RIGHT =
  'M72 42 C68 28 70 14 80 8 C92 2 108 10 112 24 C116 38 108 54 96 56 C84 58 74 52 72 42Z';

// Lightning bolt
const BOLT = 'M5.5 0 L1.5 5.5 L4.5 5.5 L0 12 L8 5 L4.5 5 Z';

export function VsGraphic({ size = 130 }: { size?: number }) {
  const W = 130;
  const H = 100;

  return (
    <Svg width={size} height={(size / W) * H} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        {/* Main VS gradient — purple to hot pink */}
        <LinearGradient id="vsG" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#A855F7" />
          <Stop offset="0.45" stopColor="#D946EF" />
          <Stop offset="1" stopColor="#F43F8E" />
        </LinearGradient>
        {/* Soft glow behind VS */}
        <RadialGradient id="glowG" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#E879F9" stopOpacity="0.22" />
          <Stop offset="1" stopColor="#E879F9" stopOpacity="0" />
        </RadialGradient>
        {/* Gold bolt gradient */}
        <LinearGradient id="boltG" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FDE68A" />
          <Stop offset="1" stopColor="#F59E0B" />
        </LinearGradient>
        {/* Paint splash gradient left */}
        <LinearGradient id="splashL" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#C084FC" stopOpacity="0.35" />
          <Stop offset="1" stopColor="#A855F7" stopOpacity="0.1" />
        </LinearGradient>
        {/* Paint splash gradient right */}
        <LinearGradient id="splashR" x1="1" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#F472B6" stopOpacity="0.3" />
          <Stop offset="1" stopColor="#EC4899" stopOpacity="0.08" />
        </LinearGradient>
      </Defs>

      {/* Glow blob */}
      <Ellipse cx="65" cy="50" rx="42" ry="36" fill="url(#glowG)" />

      {/* Paint brush splash shapes behind text */}
      <Path d={BRUSH_LEFT} fill="url(#splashL)" />
      <Path d={BRUSH_RIGHT} fill="url(#splashR)" />

      {/* ── Lightning bolts ── */}
      {/* top-left large */}
      <G transform="translate(6,4) rotate(-20) scale(1.1)">
        <Path d={BOLT} fill="url(#boltG)" />
      </G>
      {/* top-left tiny */}
      <G transform="translate(20,1) rotate(8) scale(0.55)">
        <Path d={BOLT} fill="url(#boltG)" opacity="0.75" />
      </G>
      {/* top-right large */}
      <G transform="translate(106,3) rotate(18) scale(0.95)">
        <Path d={BOLT} fill="url(#boltG)" />
      </G>
      {/* top-right tiny */}
      <G transform="translate(118,14) rotate(-12) scale(0.5)">
        <Path d={BOLT} fill="url(#boltG)" opacity="0.7" />
      </G>
      {/* bottom-left */}
      <G transform="translate(3,72) rotate(12) scale(0.75)">
        <Path d={BOLT} fill="url(#boltG)" opacity="0.85" />
      </G>
      {/* bottom-right large */}
      <G transform="translate(110,68) rotate(-18) scale(0.85)">
        <Path d={BOLT} fill="url(#boltG)" />
      </G>
      {/* bottom-right tiny */}
      <G transform="translate(100,82) rotate(6) scale(0.48)">
        <Path d={BOLT} fill="url(#boltG)" opacity="0.6" />
      </G>

      {/* ── VS text ── */}
      {/* Deep shadow */}
      <SvgText
        x="65" y="76"
        textAnchor="middle"
        fontSize="76"
        fontWeight="900"
        fontStyle="italic"
        fill="rgba(80,0,120,0.20)"
        transform="translate(4,4) skewX(-8)"
      >VS</SvgText>

      {/* White edge highlight for paint-like pop */}
      <SvgText
        x="65" y="76"
        textAnchor="middle"
        fontSize="76"
        fontWeight="900"
        fontStyle="italic"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="6"
        strokeLinejoin="round"
        fill="none"
        transform="skewX(-8)"
      >VS</SvgText>

      {/* Main gradient fill */}
      <SvgText
        x="65" y="76"
        textAnchor="middle"
        fontSize="76"
        fontWeight="900"
        fontStyle="italic"
        fill="url(#vsG)"
        transform="skewX(-8)"
      >VS</SvgText>
    </Svg>
  );
}
