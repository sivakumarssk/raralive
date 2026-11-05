// Friend Zone 1:1 call pricing — charged every 5 seconds (not per-minute).
// The coin cost per 5-second tick depends only on which MINUTE of the call
// that tick falls in (every tick within the same minute costs the same);
// there's no first-call/existing-user distinction in this model. Gems
// earned by the recipient use the admin's Friend Zone gem value (Earning
// Slabs page); nothing is credited while that isn't configured.
//
// Confirmed schedule (minute -> coins per 5-sec tick):
//   Audio: 1=5, 2=10, 3=20, 4=25, 5=30, then +10 per minute after minute 5
//     (6=40, 7=50, 8=60, 9=70, 10=80, 11=90, ...)
//   Video: 1=10, 2=15, 3=30, 4=40, 5=50, then +10 per minute after minute 5
//     (6=60, 7=70, 8=80, 9=90, 10=100, 11=110, ...)

const TICK_SECONDS = 5;

const AUDIO_EARLY_MINUTES = { 1: 5, 2: 10, 3: 20, 4: 25, 5: 30 };
const VIDEO_EARLY_MINUTES = { 1: 10, 2: 15, 3: 30, 4: 40, 5: 50 };

// minuteNumber is 1-indexed (the first minute of the call is minute 1).
function coinsPerTickForMinute({ callType, minuteNumber }) {
  const early = callType === 'video' ? VIDEO_EARLY_MINUTES : AUDIO_EARLY_MINUTES;
  if (minuteNumber <= 5) return early[minuteNumber] ?? early[1];
  // From minute 5 onward, every further minute adds +10 to minute 5's rate.
  return early[5] + (minuteNumber - 5) * 10;
}

/** Gems the callee earns for `coins` at this month's Friend Zone gem value. */
async function gemsForCoins(coins) {
  const { loadConfigVersions, configFor, monthKey } = require('./earning-slabs');
  const cfg = configFor(await loadConfigVersions(), 'friendzone', monthKey(new Date()));
  return cfg ? Math.round(coins * cfg.gemsPerCoin) : 0;
}

module.exports = { coinsPerTickForMinute, gemsForCoins, TICK_SECONDS };
