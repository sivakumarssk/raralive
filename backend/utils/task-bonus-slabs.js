// Daily Task "Bonus Payment" slabs — an extra bonus, separate from the earning
// slabs' own payout + bonus (utils/earning-slabs.js). The admin sets only a
// list of slabs: a gem target and the bonus amount (₹) for reaching it.
//
// Progress is the same Audio Chat Room gems the chatroom earning slabs count
// (per IST calendar month, reset at month end). Each slab crossed credits its
// bonus amount to the Earnings wallet as "Extra Bonus" (see computeEarnings).
//
// Settings are versioned by month like the earning slabs: saving writes a
// version for the current IST month, and each month uses the newest version
// not later than it — changing the slabs never rewrites months already over.
const db = require('../config/db');

let tableReady = null;
function ensureBonusTable() {
  if (!tableReady) {
    tableReady = db.query(`
      CREATE TABLE IF NOT EXISTS task_bonus_slab_versions (
        effective_month  TEXT PRIMARY KEY,         -- 'YYYY-MM' (IST)
        slabs            JSONB NOT NULL DEFAULT '[]',
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `).catch(err => { tableReady = null; throw err; });
  }
  return tableReady;
}

// Small cache — every wallet request reads the settings
let cache = null;
let cacheAt = 0;
const CACHE_MS = 60_000;

async function loadBonusVersions() {
  if (cache && Date.now() - cacheAt < CACHE_MS) return cache;
  await ensureBonusTable();
  const { rows } = await db.query(
    `SELECT effective_month, slabs, updated_at FROM task_bonus_slab_versions ORDER BY effective_month DESC`
  );
  cache = rows;
  cacheAt = Date.now();
  return rows;
}

function invalidateBonusCache() { cache = null; }

/** Clean slab list: whole-number gem target above 0, amount (₹) 0 or more, sorted by target. */
function normaliseBonusSlabs(slabs) {
  return (Array.isArray(slabs) ? slabs : [])
    .map(s => ({ gems: Number(s?.gems), amount: Math.round(Number(s?.amount) * 100) / 100 }))
    .filter(s => Number.isInteger(s.gems) && s.gems > 0 && Number.isFinite(s.amount) && s.amount >= 0)
    .sort((a, b) => a.gems - b.gems);
}

/** Bonus slabs in force for a month ('YYYY-MM'), or [] if none were set. */
function bonusSlabsFor(versions, month) {
  const row = versions.find(v => v.effective_month <= month);
  return row ? normaliseBonusSlabs(row.slabs) : [];
}

module.exports = {
  ensureBonusTable, loadBonusVersions, invalidateBonusCache,
  normaliseBonusSlabs, bonusSlabsFor,
};
