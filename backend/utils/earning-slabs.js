// Monthly earning slabs, per earning service. Everything here comes from the
// admin panel (Earning Slabs page) — there are no built-in defaults. A service
// the admin hasn't configured earns nothing and shows no slabs.
//
// Settings are versioned by month: saving in the admin panel writes a version
// for the current IST month, and each month uses the newest version that is
// not later than it. So changing the gem value or slabs never rewrites the
// earnings of months that are already over.
//
// Gems earned in a service are counted per calendar month (IST) and reset to 0
// at month end. Crossing a slab's gem target credits that slab's payout + bonus
// to the wallet; payouts are cumulative (each slab's total is the full amount
// for reaching it, not an increment).
const db = require('../config/db');

const EARNING_SOURCES = ['chatroom', 'live', 'private', 'friendzone', 'views'];

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** 'YYYY-MM' of a date in IST — the month a slab cycle belongs to. */
function monthKey(date) {
  return new Date(new Date(date).getTime() + IST_OFFSET_MS).toISOString().slice(0, 7);
}

function previousMonthKey(key) {
  const [y, m] = key.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

// ── Stored settings ───────────────────────────────────────────────────────────

let tableReady = null;
function ensureTable() {
  if (!tableReady) {
    tableReady = db.query(`
      CREATE TABLE IF NOT EXISTS earning_config_versions (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source           TEXT NOT NULL,
        effective_month  TEXT NOT NULL,          -- 'YYYY-MM' (IST)
        gems_per_coin    NUMERIC NOT NULL,
        bonus_pct        NUMERIC NOT NULL DEFAULT 0,
        slabs            JSONB NOT NULL DEFAULT '[]',
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (source, effective_month)
      );
    `).catch(err => { tableReady = null; throw err; });
  }
  return tableReady;
}

// Small cache — every wallet request reads the settings
let cache = null;
let cacheAt = 0;
const CACHE_MS = 60_000;

async function loadConfigVersions() {
  if (cache && Date.now() - cacheAt < CACHE_MS) return cache;
  await ensureTable();
  const { rows } = await db.query(
    `SELECT source, effective_month, gems_per_coin, bonus_pct, slabs, updated_at
     FROM earning_config_versions ORDER BY effective_month DESC`
  );
  cache = rows;
  cacheAt = Date.now();
  return rows;
}

function invalidateConfigCache() { cache = null; }

/**
 * Normalised slab list: sorted by gem target, with bonus and total worked out.
 * Each slab carries its own bonus amount (₹) set by the admin. Versions saved
 * before per-slab bonuses existed have no `bonus` on their slabs — those fall
 * back to the version's old flat `bonus_pct`, so past months keep their totals.
 */
function normaliseSlabs(slabs, legacyBonusPct = 0) {
  return (Array.isArray(slabs) ? slabs : [])
    .map(s => {
      const payout = Number(s.payout);
      const hasOwnBonus = s.bonus !== undefined && s.bonus !== null && s.bonus !== '';
      const bonus = hasOwnBonus ? Number(s.bonus) : Math.round(payout * (Number(legacyBonusPct) || 0)) / 100;
      return { name: String(s.name ?? '').trim(), gems: Number(s.gems), payout, bonus };
    })
    .filter(s => s.name && s.gems > 0 && s.payout >= 0 && s.bonus >= 0)
    .sort((a, b) => a.gems - b.gems)
    .map(s => ({ ...s, total: Math.round((s.payout + s.bonus) * 100) / 100 }));
}

/**
 * Settings for a service in a month: the newest version with
 * effective_month <= month, or null if the admin never configured it.
 */
function configFor(versions, source, month) {
  const row = versions.find(v => v.source === source && v.effective_month <= month);
  if (!row) return null;
  const bonusPct = Number(row.bonus_pct) || 0;
  return {
    source,
    effectiveMonth: row.effective_month,
    gemsPerCoin: Number(row.gems_per_coin) || 0,
    bonusPct,
    slabs: normaliseSlabs(row.slabs, bonusPct),
  };
}

/** Highest slab reached for a monthly gem count, or null. */
function slabFor(cfg, gems) {
  let reached = null;
  for (const s of cfg?.slabs ?? []) { if (gems >= s.gems) reached = s; else break; }
  return reached;
}

function nextSlabFor(cfg, gems) {
  return (cfg?.slabs ?? []).find(s => gems < s.gems) ?? null;
}

/** Gems for a coin amount under a service's settings for the month of `date`. */
function gemsForCoins(versions, source, date, coins) {
  const cfg = configFor(versions, source, monthKey(date));
  return cfg ? Math.round(Number(coins) * cfg.gemsPerCoin) : 0;
}

/** Shape sent to the app / admin panel. */
function publicConfig(cfg) {
  if (!cfg) return null;
  return {
    effective_month: cfg.effectiveMonth,
    gems_per_coin: cfg.gemsPerCoin,
    bonus_pct: cfg.bonusPct,
    slabs: cfg.slabs,
  };
}

module.exports = {
  EARNING_SOURCES, monthKey, previousMonthKey,
  ensureTable, loadConfigVersions, invalidateConfigCache, normaliseSlabs,
  configFor, slabFor, nextSlabFor, gemsForCoins, publicConfig,
};
