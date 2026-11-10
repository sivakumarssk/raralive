const db = require('../config/db');
const {
  EARNING_SOURCES, monthKey, previousMonthKey, slabFor, nextSlabFor,
  loadConfigVersions, invalidateConfigCache, configFor, gemsForCoins, publicConfig,
  normaliseSlabs, ensureTable,
} = require('../utils/earning-slabs');
const {
  ensureBonusTable, loadBonusVersions, invalidateBonusCache, normaliseBonusSlabs, bonusSlabsFor,
} = require('../utils/task-bonus-slabs');

// How many months (including the current one) of history the app shows.
const HISTORY_MONTHS = 3;

/** Rupees to the paisa — slab totals are decimals, so sums/differences can drift (e.g. 20.200000000000003). */
const r2 = n => Math.round(n * 100) / 100;

// Every coin/gem event the user has earned from, tagged with its service.
// Gifts and Friend Zone calls are recorded in coins and converted with the
// admin's gem value for that service and month.
// Chat-room gifts are Audio Chat; gifts in a Go-Live room are Video Live.
// Private Live and Video Views don't produce events yet.
const GEM_EVENTS_SQL = `
  SELECT CASE WHEN lb.room_id IS NOT NULL THEN 'live' ELSE 'chatroom' END AS source,
         e.coins * e.quantity AS coins, NULL::numeric AS gems, e.created_at
  FROM room_gift_events e
  LEFT JOIN (SELECT DISTINCT room_id FROM live_broadcasts) lb ON lb.room_id = e.room_id
  WHERE e.recipient_id = $1
  UNION ALL
  SELECT 'friendzone', c.coins_charged, NULL::numeric, COALESCE(c.ended_at, c.created_at)
  FROM friend_zone_calls c
  WHERE c.callee_id = $1 AND c.coins_charged > 0
  UNION ALL
  SELECT 'friendzone', g.coins * g.quantity, NULL::numeric, g.created_at
  FROM call_gift_events g
  WHERE g.recipient_id = $1
  ORDER BY created_at ASC`;

/** Gems for one event row: ready gems, or coins × that month's gem value. */
function eventGems(versions, ev) {
  if (ev.gems != null) return Number(ev.gems);
  return gemsForCoins(versions, ev.source, ev.created_at, ev.coins ?? 0);
}

/**
 * Walks gem events in time order, accumulating gems per (source, month) and
 * emitting a credit each time a slab target is crossed. A credit's amount is
 * the increase over the previous slab's total, so credits sum to the highest
 * slab reached that month. `events` is the same history one row per gift/call
 * (coins count even if the service had no gem value set that month).
 *
 * `bonusCredits` are the Daily Task "Bonus Payment" slabs — a separate extra
 * bonus on the same Audio Chat Room gems: each bonus slab crossed adds its
 * own amount (credited to the wallet as "Extra Bonus"). Kept apart from
 * `credits` so the slab screens and agency figures stay as they were.
 */
async function computeEarnings(userId) {
  const [{ rows }, versions, bonusVersions] = await Promise.all([
    db.query(GEM_EVENTS_SQL, [userId]),
    loadConfigVersions(),
    loadBonusVersions(),
  ]);

  const monthGems = {};   // `${source}|${month}` -> gems
  const credits = [];
  const bonusCredits = [];
  const events = [];
  for (const ev of rows) {
    const month = monthKey(ev.created_at);
    const cfg = configFor(versions, ev.source, month);
    if (!cfg) {   // service not configured for that month → earns nothing
      events.push({ source: ev.source, coins: Number(ev.coins ?? 0), gems: 0, at: ev.created_at });
      continue;
    }
    const key = `${ev.source}|${month}`;
    const before = monthGems[key] ?? 0;
    const gems = eventGems(versions, ev);
    const after = before + gems;
    monthGems[key] = after;
    events.push({ source: ev.source, coins: Number(ev.coins ?? 0), gems, at: ev.created_at });

    // One event can cross several slabs; each gets its own credit.
    let prevTotal = slabFor(cfg, before)?.total ?? 0;
    for (const s of cfg.slabs) {
      if (before < s.gems && after >= s.gems) {
        credits.push({
          source: ev.source, slab: s.name, month,
          amount: r2(s.total - prevTotal), achieved_at: ev.created_at,
        });
        prevTotal = s.total;
      }
    }

    // Daily Task bonus slabs (Audio Chat Rooms only): each crossed pays its amount
    if (ev.source === 'chatroom') {
      for (const b of bonusSlabsFor(bonusVersions, month)) {
        if (b.amount > 0 && before < b.gems && after >= b.gems) {
          bonusCredits.push({
            source: ev.source, kind: 'bonus', slab: 'Extra Bonus', gems: b.gems, month,
            amount: r2(b.amount), achieved_at: ev.created_at,
          });
        }
      }
    }
  }

  return { monthGems, credits, bonusCredits, versions, events };
}

// Also created in database/migrate-all.js — kept here so the wallet works on a
// server where the migration hasn't been re-run yet.
let withdrawalsReady = null;
function ensureWithdrawalsTable() {
  if (!withdrawalsReady) {
    withdrawalsReady = (async () => {
      await db.query(`
        CREATE TABLE IF NOT EXISTS earning_withdrawals (
          id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
          status       VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','rejected')),
          created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          processed_at TIMESTAMPTZ
        );
      `);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_earning_withdrawals_user ON earning_withdrawals(user_id, created_at DESC);`);
    })().catch(err => { withdrawalsReady = null; throw err; });
  }
  return withdrawalsReady;
}

async function getWithdrawals(userId, client = db) {
  await ensureWithdrawalsTable();
  const { rows } = await client.query(
    `SELECT id, amount, status, created_at, processed_at
     FROM earning_withdrawals WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return rows.map(w => ({ ...w, amount: Number(w.amount) }));
}

/** Slab credits minus every withdrawal that isn't rejected. */
function availableBalance(credits, withdrawals) {
  const earned = credits.reduce((sum, c) => sum + c.amount, 0);
  const out = withdrawals.filter(w => w.status !== 'rejected').reduce((sum, w) => sum + w.amount, 0);
  return Math.max(0, r2(earned - out));
}

/** Last N month keys, newest first, always starting with the current month. */
function recentMonths(n = HISTORY_MONTHS) {
  const keys = [monthKey(new Date())];
  while (keys.length < n) keys.push(previousMonthKey(keys[keys.length - 1]));
  return keys;
}

function sourceSummary(monthGems, versions, source, month) {
  const cfg = configFor(versions, source, month);
  const gems = monthGems[`${source}|${month}`] ?? 0;
  const slab = slabFor(cfg, gems);
  const next = nextSlabFor(cfg, gems);
  return {
    source,
    configured: !!cfg,
    gems_per_coin: cfg?.gemsPerCoin ?? null,
    month_gems: gems,
    month_earnings: slab?.total ?? 0,
    current_slab: slab?.name ?? null,
    next_slab: next ? { name: next.name, gems: next.gems } : null,
  };
}

/** GET /api/tasks/earnings — wallet Earnings tab overview */
async function getEarningsOverview(req, res, next) {
  try {
    const userId = req.user.id;
    const [{ monthGems, credits, bonusCredits, versions }, withdrawals] = await Promise.all([
      computeEarnings(userId), getWithdrawals(userId),
    ]);
    const [month, lastMonth] = recentMonths(2);
    const bonusIn = m => r2(bonusCredits.filter(c => c.month === m).reduce((sum, c) => sum + c.amount, 0));

    const sources = EARNING_SOURCES.map(src => sourceSummary(monthGems, versions, src, month));
    const bonusMonth = bonusIn(month);
    const totalMonth = r2(sources.reduce((sum, s) => sum + s.month_earnings, 0) + bonusMonth);
    const totalLastMonth = EARNING_SOURCES.reduce((sum, src) => {
      const cfg = configFor(versions, src, lastMonth);
      return sum + (slabFor(cfg, monthGems[`${src}|${lastMonth}`] ?? 0)?.total ?? 0);
    }, 0) + bonusIn(lastMonth);

    // Wallet transactions (slab credits + withdrawals) grouped by month,
    // newest first; months with no activity are skipped.
    const txns = [
      // reversed so slabs crossed by the same gift list highest-first (sort is stable)
      ...credits.slice().reverse().map(c => ({ type: 'credit', source: c.source, slab: c.slab, amount: c.amount, at: c.achieved_at })),
      // Daily Task bonus — shown as "Extra Bonus"
      ...bonusCredits.slice().reverse().map(c => ({ type: 'credit', kind: 'bonus', source: c.source, slab: c.slab, gems: c.gems, amount: c.amount, at: c.achieved_at })),
      ...withdrawals.map(w => ({ type: 'withdrawal', id: w.id, amount: w.amount, status: w.status, at: w.created_at })),
    ].sort((a, b) => new Date(b.at) - new Date(a.at));

    const months = recentMonths()
      .map(m => {
        const items = txns.filter(t => monthKey(t.at) === m);
        return {
          month: m,
          added: r2(items.filter(t => t.type === 'credit').reduce((sum, t) => sum + t.amount, 0)),
          withdrawn: r2(items.filter(t => t.type === 'withdrawal' && t.status !== 'rejected').reduce((sum, t) => sum + t.amount, 0)),
          transactions: items,
        };
      })
      .filter(m => m.transactions.length > 0);

    return res.json({
      success: true,
      data: {
        month,
        total_month_earnings: totalMonth,
        bonus_month: bonusMonth,
        growth_pct: totalLastMonth > 0 ? ((totalMonth - totalLastMonth) / totalLastMonth) * 100 : null,
        available_balance: availableBalance([...credits, ...bonusCredits], withdrawals),
        sources,
        months,
      },
    });
  } catch (err) { next(err); }
}

/**
 * POST /api/tasks/earnings/withdraw — requests the whole available balance.
 * The request is recorded as pending (and deducted right away); admin marks
 * it paid or rejected after settling it over WhatsApp.
 */
async function requestWithdrawal(req, res, next) {
  const client = await db.pool.connect();
  try {
    const userId = req.user.id;
    await client.query('BEGIN');
    // Serialise withdrawals per user so a double tap can't withdraw twice.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`earning_withdraw:${userId}`]);

    const { credits, bonusCredits } = await computeEarnings(userId);
    const available = availableBalance([...credits, ...bonusCredits], await getWithdrawals(userId, client));
    if (available <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'No balance available to withdraw' });
    }

    const { rows } = await client.query(
      `INSERT INTO earning_withdrawals (user_id, amount) VALUES ($1, $2)
       RETURNING id, amount, status, created_at`,
      [userId, available]
    );
    await client.query('COMMIT');
    return res.json({ success: true, data: { ...rows[0], amount: Number(rows[0].amount) } });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
}

// Individual gem events for one service over the history window.
async function sourceEvents(userId, source, versions) {
  const giftSql = (liveOnly) => `
    SELECT e.id, 'gift' AS kind, e.gift_name, e.quantity,
           e.coins * e.quantity AS coins, NULL::numeric AS gems, e.created_at,
           s.full_name AS person_name, s.username AS person_username,
           NULL::int AS duration_seconds, NULL::text AS call_type
    FROM room_gift_events e
    JOIN users s ON s.id = e.sender_id
    WHERE e.recipient_id = $1 AND e.created_at >= $2
      AND e.room_id ${liveOnly ? 'IN' : 'NOT IN'} (SELECT room_id FROM live_broadcasts)
    ORDER BY e.created_at DESC LIMIT 1000`;

  // Start of the oldest month in the window (a day early to cover IST offset;
  // rows are bucketed by monthKey below anyway).
  const oldest = recentMonths().pop();
  const since = new Date(`${oldest}-01T00:00:00Z`);
  since.setUTCDate(since.getUTCDate() - 1);

  let rows = [];
  if (source === 'chatroom') rows = (await db.query(giftSql(false), [userId, since])).rows;
  else if (source === 'live') rows = (await db.query(giftSql(true), [userId, since])).rows;
  else if (source === 'friendzone') {
    const [calls, gifts] = await Promise.all([
      db.query(
        `SELECT c.id, 'call' AS kind, NULL AS gift_name, 1 AS quantity,
                c.coins_charged AS coins, NULL::numeric AS gems, COALESCE(c.ended_at, c.created_at) AS created_at,
                u.full_name AS person_name, u.username AS person_username,
                c.duration_seconds, c.call_type
         FROM friend_zone_calls c JOIN users u ON u.id = c.caller_id
         WHERE c.callee_id = $1 AND c.coins_charged > 0 AND c.created_at >= $2
         ORDER BY c.created_at DESC LIMIT 1000`, [userId, since]),
      db.query(
        `SELECT g.id, 'gift' AS kind, g.gift_name, g.quantity,
                g.coins * g.quantity AS coins, NULL::numeric AS gems, g.created_at,
                u.full_name AS person_name, u.username AS person_username,
                NULL::int AS duration_seconds, c.call_type
         FROM call_gift_events g
         JOIN friend_zone_calls c ON c.id = g.call_id
         JOIN users u ON u.id = g.sender_id
         WHERE g.recipient_id = $1 AND g.created_at >= $2
         ORDER BY g.created_at DESC LIMIT 1000`, [userId, since]),
    ]);
    rows = [...calls.rows, ...gifts.rows];
  }

  return rows
    .map(r => {
      const { coins, ...rest } = r;
      return { ...rest, gems: eventGems(versions, { ...r, source }) };
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

/** GET /api/tasks/earnings/:source — per-service slab screen */
async function getSourceEarnings(req, res, next) {
  try {
    const { source } = req.params;
    if (!EARNING_SOURCES.includes(source)) {
      return res.status(400).json({ success: false, message: 'Unknown earning source' });
    }
    const userId = req.user.id;
    const versions = await loadConfigVersions();
    const [{ monthGems, credits }, events] = await Promise.all([
      computeEarnings(userId),
      // ?summary=1 (chatroom Gift Progress card) skips the per-event history
      req.query.summary ? [] : sourceEvents(userId, source, versions),
    ]);
    const month = monthKey(new Date());
    const cfg = configFor(versions, source, month);
    const summary = sourceSummary(monthGems, versions, source, month);

    const achieved = {};
    for (const c of credits) {
      if (c.source === source && c.month === month) achieved[c.slab] = c.achieved_at;
    }

    // Month-by-month history: each month's gem total, slab reached, earnings
    // and the individual gifts/calls. The current month is always included.
    const historyMonths = recentMonths()
      .map((m, i) => {
        const gems = monthGems[`${source}|${m}`] ?? 0;
        const slab = slabFor(configFor(versions, source, m), gems);
        return {
          month: m,
          gems,
          slab: slab?.name ?? null,
          earnings: slab?.total ?? 0,
          items: events.filter(ev => monthKey(ev.created_at) === m),
          current: i === 0,
        };
      })
      .filter(m => m.current || m.gems > 0);

    return res.json({
      success: true,
      data: {
        ...summary,
        month,
        bonus_pct: cfg?.bonusPct ?? null,
        slabs: (cfg?.slabs ?? []).map(s => ({
          name: s.name, gems: s.gems, payout: s.payout, bonus: s.bonus,
          reached: summary.month_gems >= s.gems,
          achieved_at: achieved[s.name] ?? null,
        })),
        history_months: historyMonths,
      },
    });
  } catch (err) { next(err); }
}

// ── Settings (admin-managed slabs + gem value) ───────────────────────────────

/** GET /api/tasks/earnings/config — this month's settings for every service */
async function getEarningConfig(req, res, next) {
  try {
    const versions = await loadConfigVersions();
    const month = monthKey(new Date());
    const sources = {};
    for (const src of EARNING_SOURCES) sources[src] = publicConfig(configFor(versions, src, month));
    return res.json({ success: true, data: { month, sources } });
  } catch (err) { next(err); }
}

/** GET /api/tasks/admin/earning-config — current settings + saved versions */
async function adminGetEarningConfig(req, res, next) {
  try {
    const versions = await loadConfigVersions();
    const month = monthKey(new Date());
    const sources = {};
    for (const src of EARNING_SOURCES) {
      sources[src] = {
        current: publicConfig(configFor(versions, src, month)),
        history: versions
          .filter(v => v.source === src)
          .map(v => ({ effective_month: v.effective_month, updated_at: v.updated_at })),
      };
    }
    return res.json({ success: true, data: { month, sources } });
  } catch (err) { next(err); }
}

/**
 * PUT /api/tasks/admin/earning-config/:source
 * { gems_per_coin, slabs: [{ name, gems, payout, bonus }] }
 * Each slab has its own bonus amount (₹); total = payout + bonus.
 * Saved as this month's version — applies to the whole current month and
 * later, never to months that are already over.
 */
async function adminSaveEarningConfig(req, res, next) {
  try {
    const { source } = req.params;
    if (!EARNING_SOURCES.includes(source)) {
      return res.status(400).json({ success: false, message: 'Unknown earning source' });
    }
    const gemsPerCoin = Number(req.body?.gems_per_coin);
    const rawSlabs = (Array.isArray(req.body?.slabs) ? req.body.slabs : [])
      .map(s => ({ ...s, bonus: s?.bonus === undefined || s?.bonus === '' ? 0 : s.bonus }));
    if (!(gemsPerCoin > 0)) return res.status(400).json({ success: false, message: 'Gem value must be more than 0' });

    // bonus_pct is no longer used for new versions (stored as 0); per-slab bonus wins
    const bonusPct = 0;
    const slabs = normaliseSlabs(rawSlabs).map(({ name, gems, payout, bonus }) => ({ name, gems, payout, bonus }));
    if (slabs.length !== rawSlabs.length) {
      return res.status(400).json({ success: false, message: 'Every slab needs a name, a gem target above 0, a payout and a bonus of 0 or more' });
    }
    if (new Set(slabs.map(s => s.gems)).size !== slabs.length) {
      return res.status(400).json({ success: false, message: 'Two slabs have the same gem target' });
    }

    await ensureTable();
    const month = monthKey(new Date());
    // The first save for a service also covers every earlier month (stored as
    // '0000-00'), so earnings people already made don't drop to 0 when the
    // service is first configured. Later saves only apply from this month on.
    const existing = await db.query(`SELECT 1 FROM earning_config_versions WHERE source = $1 LIMIT 1`, [source]);
    const effectiveMonth = existing.rows.length ? month : '0000-00';
    await db.query(
      `INSERT INTO earning_config_versions (source, effective_month, gems_per_coin, bonus_pct, slabs, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
       ON CONFLICT (source, effective_month)
       DO UPDATE SET gems_per_coin = $3, bonus_pct = $4, slabs = $5::jsonb, updated_at = NOW()`,
      [source, effectiveMonth, gemsPerCoin, bonusPct, JSON.stringify(slabs)]
    );
    invalidateConfigCache();
    const versions = await loadConfigVersions();
    return res.json({ success: true, data: publicConfig(configFor(versions, source, month)) });
  } catch (err) { next(err); }
}

// ── Daily Task bonus slabs ────────────────────────────────────────────────────

/**
 * GET /api/tasks/bonus — the chatroom Daily Task "Bonus Payment" tab: this
 * month's bonus slabs, the user's Audio Chat gems so far, and which slabs
 * they've reached (and when the bonus was credited).
 */
async function getTaskBonus(req, res, next) {
  try {
    const month = monthKey(new Date());
    const [{ monthGems, bonusCredits }, bonusVersions] = await Promise.all([
      computeEarnings(req.user.id), loadBonusVersions(),
    ]);
    const gems = monthGems[`chatroom|${month}`] ?? 0;
    const credited = {};
    for (const c of bonusCredits) if (c.month === month) credited[c.gems] = c.achieved_at;
    return res.json({
      success: true,
      data: {
        month,
        month_gems: gems,
        slabs: bonusSlabsFor(bonusVersions, month).map(b => ({
          gems: b.gems, amount: b.amount, reached: gems >= b.gems, credited_at: credited[b.gems] ?? null,
        })),
      },
    });
  } catch (err) { next(err); }
}

/** GET /api/tasks/admin/task-bonus — current bonus slabs + saved versions */
async function adminGetTaskBonus(req, res, next) {
  try {
    const versions = await loadBonusVersions();
    const month = monthKey(new Date());
    return res.json({
      success: true,
      data: {
        month,
        slabs: bonusSlabsFor(versions, month),
        history: versions.map(v => ({ effective_month: v.effective_month, updated_at: v.updated_at })),
      },
    });
  } catch (err) { next(err); }
}

/**
 * PUT /api/tasks/admin/task-bonus  { slabs: [{ gems, amount }] }
 * Only the slab targets and their bonus amounts. Saved as this month's
 * version — applies to the whole current month and later, never to months
 * already over (and never to months before the first save).
 */
async function adminSaveTaskBonus(req, res, next) {
  try {
    const raw = Array.isArray(req.body?.slabs) ? req.body.slabs : [];
    const slabs = normaliseBonusSlabs(raw);
    if (slabs.length !== raw.length) {
      return res.status(400).json({ success: false, message: 'Every slab needs a whole-number gem target above 0 and a bonus amount of 0 or more' });
    }
    if (new Set(slabs.map(s => s.gems)).size !== slabs.length) {
      return res.status(400).json({ success: false, message: 'Two slabs have the same gem target' });
    }
    await ensureBonusTable();
    const month = monthKey(new Date());
    await db.query(
      `INSERT INTO task_bonus_slab_versions (effective_month, slabs, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (effective_month) DO UPDATE SET slabs = $2::jsonb, updated_at = NOW()`,
      [month, JSON.stringify(slabs)]
    );
    invalidateBonusCache();
    const versions = await loadBonusVersions();
    return res.json({ success: true, data: { month, slabs: bonusSlabsFor(versions, month) } });
  } catch (err) { next(err); }
}

// ── Admin ─────────────────────────────────────────────────────────────────────

/** GET /api/tasks/admin/withdrawals?status=pending */
async function adminListWithdrawals(req, res, next) {
  try {
    await ensureWithdrawalsTable();
    const { status } = req.query;
    const { rows } = await db.query(
      `SELECT w.id, w.amount, w.status, w.created_at, w.processed_at,
              u.id AS user_id, u.full_name, u.username, u.phone
       FROM earning_withdrawals w JOIN users u ON u.id = w.user_id
       WHERE ($1::text IS NULL OR w.status = $1)
       ORDER BY w.created_at DESC LIMIT 500`,
      [status || null]
    );
    return res.json({ success: true, data: rows.map(r => ({ ...r, amount: Number(r.amount) })) });
  } catch (err) { next(err); }
}

/** PATCH /api/tasks/admin/withdrawals/:id  { status: 'paid' | 'rejected' } */
async function adminUpdateWithdrawal(req, res, next) {
  try {
    await ensureWithdrawalsTable();
    const { status } = req.body ?? {};
    if (!['paid', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: "status must be 'paid' or 'rejected'" });
    }
    const { rows } = await db.query(
      `UPDATE earning_withdrawals SET status = $2, processed_at = NOW()
       WHERE id = $1 AND status = 'pending'
       RETURNING id, amount, status, created_at, processed_at`,
      [req.params.id, status]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Pending withdrawal not found' });
    return res.json({ success: true, data: { ...rows[0], amount: Number(rows[0].amount) } });
  } catch (err) { next(err); }
}

module.exports = {
  computeEarnings,
  getEarningsOverview, getSourceEarnings, requestWithdrawal,
  getEarningConfig, adminGetEarningConfig, adminSaveEarningConfig,
  adminListWithdrawals, adminUpdateWithdrawal,
  getTaskBonus, adminGetTaskBonus, adminSaveTaskBonus,
};
