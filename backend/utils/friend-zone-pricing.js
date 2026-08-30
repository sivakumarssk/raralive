// Friend Zone 1:1 call pricing — per-minute coin cost, tiered by minute
// number, call type, and whether this is the caller's first-ever Friend
// Zone call (first call gets a discounted rate for the first 3 minutes;
// every call after that, and every minute from minute 4 onward regardless,
// uses the same schedule). Gems earned by the recipient are always coins * 5,
// matching the room-gift and per-minute-billing conversion rate used
// everywhere else in the app.

const GEMS_PER_COIN = 5;

// Tier boundaries are inclusive minute ranges. Checked in order — the first
// matching tier wins.
const AUDIO_TIERS_FIRST_CALL = [
  { min: 1, max: 1, coins: 20 },
  { min: 2, max: 2, coins: 40 },
  { min: 3, max: 3, coins: 100 },
  { min: 4, max: 9, coins: 150 },
  { min: 10, max: 19, coins: 200 },
  { min: 20, max: 29, coins: 250 },
  { min: 30, max: 39, coins: 350 },
  { min: 40, max: 40, coins: 400 },
  { min: 41, max: 49, coins: 450 },
  { min: 50, max: 59, coins: 500 },
  { min: 60, max: Infinity, coins: 550 },
];

const AUDIO_TIERS_EXISTING = [
  { min: 1, max: 1, coins: 30 },
  { min: 2, max: 2, coins: 50 },
  { min: 3, max: 9, coins: 150 },
  { min: 10, max: 19, coins: 200 },
  { min: 20, max: 29, coins: 250 },
  { min: 30, max: 39, coins: 350 },
  { min: 40, max: 40, coins: 400 },
  { min: 41, max: 49, coins: 450 },
  { min: 50, max: 59, coins: 500 },
  { min: 60, max: Infinity, coins: 550 },
];

const VIDEO_TIERS_FIRST_CALL = [
  { min: 1, max: 1, coins: 30 },
  { min: 2, max: 2, coins: 60 },
  { min: 3, max: 3, coins: 150 },
  { min: 4, max: 9, coins: 300 },
  { min: 10, max: 19, coins: 400 },
  { min: 20, max: Infinity, coins: 500 },
];

const VIDEO_TIERS_EXISTING = [
  { min: 1, max: 1, coins: 50 },
  { min: 2, max: 2, coins: 80 },
  { min: 3, max: 3, coins: 170 },
  { min: 4, max: 9, coins: 300 },
  { min: 10, max: 19, coins: 400 },
  { min: 20, max: Infinity, coins: 500 },
];

function tiersFor(callType, isFirstCall) {
  if (callType === 'video') return isFirstCall ? VIDEO_TIERS_FIRST_CALL : VIDEO_TIERS_EXISTING;
  return isFirstCall ? AUDIO_TIERS_FIRST_CALL : AUDIO_TIERS_EXISTING;
}

// minuteNumber is 1-indexed (the first minute charged is minute 1).
function coinsForMinute({ callType, isFirstCall, minuteNumber }) {
  const tiers = tiersFor(callType, isFirstCall);
  const tier = tiers.find(t => minuteNumber >= t.min && minuteNumber <= t.max);
  // Minutes beyond the schedule's last defined tier (shouldn't normally
  // happen — calls this long are already at the plateau rate) fall back to
  // the final tier's rate rather than throwing.
  return tier ? tier.coins : tiers[tiers.length - 1].coins;
}

function gemsForCoins(coins) {
  return coins * GEMS_PER_COIN;
}

module.exports = { coinsForMinute, gemsForCoins, GEMS_PER_COIN };
