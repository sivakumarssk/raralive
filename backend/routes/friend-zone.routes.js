const express = require('express');
const { authenticate, authenticateAdmin } = require('../middleware/auth.middleware');
const { uploadFriendZone } = require('../middleware/upload.middleware');
const ctrl = require('../controllers/friend-zone.controller');

const router = express.Router();

// Shared period → SQL date-filter builder for leaderboard-style endpoints —
// same logic as rooms.routes.js's buildDateFilter, kept local here rather
// than cross-importing between route files for one small pure function.
// Periods: today | this_week | this_month | this_year
function buildDateFilter(period, alias = 'e', column = 'created_at') {
  const now = new Date();
  let start = null;
  if (period === 'this_week') {
    const day = now.getDay(); const diff = day === 0 ? -6 : 1 - day;
    start = new Date(now); start.setDate(now.getDate() + diff); start.setHours(0, 0, 0, 0);
  } else if (period === 'this_month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (period === 'this_year') {
    start = new Date(now.getFullYear(), 0, 1);
  } else {
    start = new Date(now); start.setHours(0, 0, 0, 0);
  }
  return `AND ${alias}.${column} >= '${start.toISOString()}'`;
}

// ── App routes ────────────────────────────────────────────────────────────────
router.post('/apply', authenticate, uploadFriendZone.array('photos', 3), ctrl.apply);
router.get('/my-status', authenticate, ctrl.getMyStatus);
router.patch('/my-application', authenticate, uploadFriendZone.array('photos', 3), ctrl.updateMyApplication);
router.patch('/my-toggles', authenticate, ctrl.updateMyToggles);
router.get('/friends', authenticate, ctrl.getPublicFriends);
router.get('/call-history', authenticate, ctrl.getCallHistory);

// ── Leaderboards (public, no auth — same as the room leaderboard endpoints) ──

// Top gifters: users who sent the most coins via in-call gifts (call_gift_events)
router.get('/top-gifters', async (req, res, next) => {
  try {
    const db = require('../config/db');
    const period = req.query.period || 'today';
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const dateFilter = buildDateFilter(period, 'g', 'created_at');

    const r = await db.query(
      `SELECT u.id, u.full_name, u.username, u.avatar_url,
              COALESCE(SUM(g.coins * g.quantity), 0)::int AS total_coins
       FROM call_gift_events g
       JOIN users u ON u.id = g.sender_id
       WHERE 1=1 ${dateFilter}
       GROUP BY u.id, u.full_name, u.username, u.avatar_url
       HAVING COALESCE(SUM(g.coins * g.quantity), 0) > 0
       ORDER BY total_coins DESC
       LIMIT $1`,
      [limit]
    );

    return res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
});

// Top earners: call recipients who earned the most gems, combining
// per-minute call billing (friend_zone_calls.gems_earned) and in-call
// gifting (call_gift_events) — mirrors the wallet's merged Friend Zone
// gems feed so "top earner" here means the same thing the user's own
// gem history means.
router.get('/top-earners', async (req, res, next) => {
  try {
    const db = require('../config/db');
    const period = req.query.period || 'today';
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const callDateFilter = buildDateFilter(period, 'c', 'created_at');
    const giftDateFilter = buildDateFilter(period, 'g', 'created_at');

    const r = await db.query(
      `SELECT u.id, u.full_name, u.username, u.avatar_url,
              (COALESCE(call_gems.total, 0) + COALESCE(gift_gems.total, 0))::int AS total_coins
       FROM users u
       LEFT JOIN (
         SELECT c.callee_id AS user_id, SUM(c.gems_earned)::int AS total
         FROM friend_zone_calls c
         WHERE c.gems_earned > 0 ${callDateFilter}
         GROUP BY c.callee_id
       ) call_gems ON call_gems.user_id = u.id
       LEFT JOIN (
         SELECT g.recipient_id AS user_id, SUM(g.coins * g.quantity * 5)::int AS total
         FROM call_gift_events g
         WHERE 1=1 ${giftDateFilter}
         GROUP BY g.recipient_id
       ) gift_gems ON gift_gems.user_id = u.id
       WHERE COALESCE(call_gems.total, 0) + COALESCE(gift_gems.total, 0) > 0
       ORDER BY total_coins DESC
       LIMIT $1`,
      [limit]
    );

    return res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
});

// Top callers: users who spent the most call minutes (engagement metric,
// counts time as either caller or callee — total_coins field reused to
// carry "total minutes" so the app's shared Entry/metric-formatting code
// works unchanged; the app labels this tab with a "wins"-style unit).
router.get('/top-callers', async (req, res, next) => {
  try {
    const db = require('../config/db');
    const period = req.query.period || 'today';
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const dateFilter = buildDateFilter(period, 'c', 'created_at');

    const r = await db.query(
      `SELECT u.id, u.full_name, u.username, u.avatar_url,
              FLOOR(SUM(c.duration_seconds) / 60.0)::int AS total_coins
       FROM friend_zone_calls c
       JOIN users u ON u.id IN (c.caller_id, c.callee_id)
       WHERE c.duration_seconds > 0 ${dateFilter}
       GROUP BY u.id, u.full_name, u.username, u.avatar_url
       HAVING SUM(c.duration_seconds) > 0
       ORDER BY total_coins DESC
       LIMIT $1`,
      [limit]
    );

    return res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
});

// ── Admin routes ──────────────────────────────────────────────────────────────
// /admin/calls and /admin/gifts must come before /admin/:id, otherwise
// Express would match "calls"/"gifts" as the :id param and shadow these
// routes entirely.
router.get('/admin/calls', authenticateAdmin, ctrl.listCalls);
router.get('/admin/gifts', authenticateAdmin, ctrl.listCallGifts);
router.get('/admin', authenticateAdmin, ctrl.listApplications);
router.get('/admin/:id', authenticateAdmin, ctrl.getApplication);
router.patch('/admin/:id/status', authenticateAdmin, ctrl.updateStatus);

module.exports = router;
