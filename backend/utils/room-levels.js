// Rara Group Level thresholds — coins needed to reach each level
// Index = level number (1–100), value = cumulative coins required
const LEVEL_THRESHOLDS = [
  0,          // level 0 (default, no coins yet)
  5,          // level 1
  300,        // level 2
  700,        // level 3
  2000,       // level 4
  3500,       // level 5
  6000,       // level 6
  10000,      // level 7
  15000,      // level 8
  22000,      // level 9
  32000,      // level 10
  45000,      // level 11
  65000,      // level 12
  90000,      // level 13
  125000,     // level 14
  170000,     // level 15
  225000,     // level 16
  295000,     // level 17
  375000,     // level 18
  435000,     // level 19
  500000,     // level 20
  600000,     // level 21
  800000,     // level 22
  1000000,    // level 23
  1250000,    // level 24
  1500000,    // level 25
  1800000,    // level 26
  2100000,    // level 27
  2400000,    // level 28
  2700000,    // level 29
  3000000,    // level 30
  3300000,    // level 31
  3600000,    // level 32
  3900000,    // level 33
  4200000,    // level 34
  4400000,    // level 35
  4600000,    // level 36
  4700000,    // level 37
  4800000,    // level 38
  4900000,    // level 39
  5000000,    // level 40
  5200000,    // level 41
  5400000,    // level 42
  5600000,    // level 43
  5800000,    // level 44
  6000000,    // level 45
  6200000,    // level 46
  6400000,    // level 47
  6600000,    // level 48
  6800000,    // level 49
  7000000,    // level 50
  7200000,    // level 51
  7400000,    // level 52
  7600000,    // level 53
  7800000,    // level 54
  8000000,    // level 55
  8200000,    // level 56
  8400000,    // level 57
  8600000,    // level 58
  8800000,    // level 59
  9000000,    // level 60
  9200000,    // level 61
  9400000,    // level 62
  9600000,    // level 63
  9800000,    // level 64
  10000000,   // level 65
  10300000,   // level 66
  10600000,   // level 67
  10900000,   // level 68
  11200000,   // level 69
  11500000,   // level 70
  11800000,   // level 71
  12100000,   // level 72
  12400000,   // level 73
  12700000,   // level 74
  13000000,   // level 75
  13300000,   // level 76
  13600000,   // level 77
  14000000,   // level 78
  14400000,   // level 79
  14800000,   // level 80
  15200000,   // level 81
  15600000,   // level 82
  16000000,   // level 83
  16400000,   // level 84
  16800000,   // level 85
  17200000,   // level 86
  17600000,   // level 87
  18000000,   // level 88
  18400000,   // level 89
  18800000,   // level 90
  19000000,   // level 91
  19200000,   // level 92
  19400000,   // level 93
  19500000,   // level 94
  19600000,   // level 95
  19700000,   // level 96
  19800000,   // level 97
  19900000,   // level 98
  19950000,   // level 99
  20000000,   // level 100
];

/**
 * Compute the level for a given total coins received.
 * Returns the highest level whose threshold has been met.
 */
function computeLevel(totalCoins) {
  let level = 0;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (totalCoins >= LEVEL_THRESHOLDS[i]) level = i;
    else break;
  }
  return level;
}

/**
 * Check if total coins crosses into a new level vs the stored level.
 * Returns new level if levelled up, null otherwise.
 */
function checkLevelUp(currentLevel, totalCoins) {
  const newLevel = computeLevel(totalCoins);
  if (newLevel > currentLevel) return newLevel;
  return null;
}

module.exports = { LEVEL_THRESHOLDS, computeLevel, checkLevelUp };
