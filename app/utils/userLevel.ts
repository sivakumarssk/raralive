import { MEDIA_BASE } from '@/services/api';
import { prefetchBadgesInBackground } from '@/utils/levelBadgeCache';

// Individual user level thresholds based on coins SPENT (gifted)
// Index i = coins needed to reach level i
// Source: official ID Levels table (Indian number format: 1,15,000 = 115000)
const THRESHOLDS: number[] = [
  0,           // Level 0
  5,           // Level 1
  250,         // Level 2
  650,         // Level 3
  1_200,       // Level 4
  2_000,       // Level 5
  3_000,       // Level 6
  4_500,       // Level 7
  6_500,       // Level 8
  9_000,       // Level 9
  12_000,      // Level 10
  16_000,      // Level 11
  21_000,      // Level 12
  27_000,      // Level 13
  34_000,      // Level 14
  42_000,      // Level 15
  52_000,      // Level 16
  64_000,      // Level 17
  78_000,      // Level 18
  95_000,      // Level 19
  1_15_000,    // Level 20  = 115,000
  1_38_000,    // Level 21  = 138,000
  1_65_000,    // Level 22  = 165,000
  1_96_000,    // Level 23  = 196,000
  2_32_000,    // Level 24  = 232,000
  2_74_000,    // Level 25  = 274,000
  3_23_000,    // Level 26  = 323,000
  3_80_000,    // Level 27  = 380,000
  4_46_000,    // Level 28  = 446,000
  5_22_000,    // Level 29  = 522,000
  6_10_000,    // Level 30  = 610,000
  7_12_000,    // Level 31  = 712,000
  8_30_000,    // Level 32  = 830,000
  9_66_000,    // Level 33  = 966,000
  11_23_000,   // Level 34  = 1,123,000
  13_05_000,   // Level 35  = 1,305,000
  15_15_000,   // Level 36  = 1,515,000
  17_58_000,   // Level 37  = 1,758,000
  20_38_000,   // Level 38  = 2,038,000
  23_61_000,   // Level 39  = 2,361,000
  27_33_000,   // Level 40  = 2,733,000
  31_62_000,   // Level 41  = 3,162,000
  36_56_000,   // Level 42  = 3,656,000
  42_24_000,   // Level 43  = 4,224,000
  48_76_000,   // Level 44  = 4,876,000
  56_25_000,   // Level 45  = 5,625,000
  64_83_000,   // Level 46  = 6,483,000
  74_66_000,   // Level 47  = 7,466,000
  85_91_000,   // Level 48  = 8,591,000
  98_76_000,   // Level 49  = 9,876,000
  1_13_42_000, // Level 50  = 11,342,000
  1_20_00_000, // Level 51  = 12,000,000
  1_27_00_000, // Level 52  = 12,700,000
  1_34_00_000, // Level 53  = 13,400,000
  1_41_00_000, // Level 54  = 14,100,000
  1_48_00_000, // Level 55  = 14,800,000
  1_55_00_000, // Level 56  = 15,500,000
  1_62_00_000, // Level 57  = 16,200,000
  1_69_00_000, // Level 58  = 16,900,000
  1_76_00_000, // Level 59  = 17,600,000
  1_83_00_000, // Level 60  = 18,300,000
  1_90_00_000, // Level 61  = 19,000,000
  1_97_00_000, // Level 62  = 19,700,000
  2_04_00_000, // Level 63  = 20,400,000
  2_11_00_000, // Level 64  = 21,100,000
  2_18_00_000, // Level 65  = 21,800,000
  2_24_00_000, // Level 66  = 22,400,000
  2_30_00_000, // Level 67  = 23,000,000
  2_36_00_000, // Level 68  = 23,600,000
  2_42_00_000, // Level 69  = 24,200,000
  2_48_00_000, // Level 70  = 24,800,000
  2_53_00_000, // Level 71  = 25,300,000
  2_58_00_000, // Level 72  = 25,800,000
  2_63_00_000, // Level 73  = 26,300,000
  2_68_00_000, // Level 74  = 26,800,000
  2_72_00_000, // Level 75  = 27,200,000
  2_76_00_000, // Level 76  = 27,600,000
  2_80_00_000, // Level 77  = 28,000,000
  2_83_00_000, // Level 78  = 28,300,000
  2_86_00_000, // Level 79  = 28,600,000
  2_89_00_000, // Level 80  = 28,900,000
  2_91_00_000, // Level 81  = 29,100,000
  2_93_00_000, // Level 82  = 29,300,000
  2_95_00_000, // Level 83  = 29,500,000
  2_96_00_000, // Level 84  = 29,600,000
  2_97_00_000, // Level 85  = 29,700,000
  2_97_50_000, // Level 86  = 29,750,000
  2_98_00_000, // Level 87  = 29,800,000
  2_98_30_000, // Level 88  = 29,830,000
  2_98_60_000, // Level 89  = 29,860,000
  2_98_90_000, // Level 90  = 29,890,000
  2_99_10_000, // Level 91  = 29,910,000
  2_99_25_000, // Level 92  = 29,925,000
  2_99_40_000, // Level 93  = 29,940,000
  2_99_50_000, // Level 94  = 29,950,000
  2_99_60_000, // Level 95  = 29,960,000
  2_99_70_000, // Level 96  = 29,970,000
  2_99_80_000, // Level 97  = 29,980,000
  2_99_90_000, // Level 98  = 29,990,000
  2_99_95_000, // Level 99  = 29,995,000
  3_00_00_000, // Level 100 = 30,000,000
];

export function getUserLevel(coinsSpent: number): number {
  let level = 0;
  for (let i = 1; i <= 100; i++) {
    if (coinsSpent >= THRESHOLDS[i]) {
      level = i;
    } else {
      break;
    }
  }
  return level;
}

export function getLevelThreshold(level: number): number {
  return THRESHOLDS[Math.min(level, 100)] ?? 0;
}

export function getNextLevelThreshold(level: number): number | null {
  if (level >= 100) return null;
  return THRESHOLDS[level + 1] ?? null;
}

export function formatCoins(coins: number): string {
  if (coins >= 1_00_00_000) return `${(coins / 1_00_00_000).toFixed(1)}Cr`;
  if (coins >= 1_00_000) return `${(coins / 1_00_000).toFixed(1)}L`;
  if (coins >= 1000) return `${(coins / 1000).toFixed(1)}K`;
  return `${coins}`;
}

// Level badges 0-5 are bundled into the app (every account starts there, so they must
// render instantly with no network). Levels 6-100 are served from the backend
// (backend/public/levels) and cached to disk in the background — see levelBadgeCache.ts.
// This keeps the app bundle small (previously 202 files / ~280MB) while still bundling
// the handful of badges every user sees immediately.
const BUNDLED_INDIVIDUAL_LEVELS: Record<number, any> = {
  0: require('@/assets/tabs/chatroom/levels-bundled/individual/l-0.png'),
  1: require('@/assets/tabs/chatroom/levels-bundled/individual/l-1.png'),
  2: require('@/assets/tabs/chatroom/levels-bundled/individual/l-2.png'),
  3: require('@/assets/tabs/chatroom/levels-bundled/individual/l-3.png'),
  4: require('@/assets/tabs/chatroom/levels-bundled/individual/l-4.png'),
  5: require('@/assets/tabs/chatroom/levels-bundled/individual/l-5.png'),
};

function individualLevelUrl(level: number) {
  return `${MEDIA_BASE}/levels/individual/l-${level}.png`;
}

export const USER_LEVEL_IMAGES: Record<number, any> = Object.fromEntries(
  Array.from({ length: 101 }, (_, level) => [
    level,
    BUNDLED_INDIVIDUAL_LEVELS[level] ?? { uri: individualLevelUrl(level) },
  ])
);

// Silently caches badges just above the user's current level in the background, so the
// next few level-up badges are already on-disk (no loading state, no network wait) by
// the time the user reaches them. Bundled levels (0-5) need no prefetch.
export function prefetchUpcomingLevelBadges(currentLevel: number, lookahead = 10) {
  const start = Math.max(currentLevel + 1, 6);
  const end = Math.min(currentLevel + lookahead, 100);
  if (start > end) return;
  const urls = Array.from({ length: end - start + 1 }, (_, i) => individualLevelUrl(start + i));
  prefetchBadgesInBackground(urls);
}
