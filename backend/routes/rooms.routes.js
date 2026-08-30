const express = require('express');
const roomController = require('../controllers/room.controller');
const { authenticate, optionalAuth } = require('../middleware/auth.middleware');
const { getRoomMembers, kickUserFromRoom } = require('../socket');

const router = express.Router();

// Shared period → SQL date-filter builder for leaderboard-style endpoints.
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
    // default: today
    start = new Date(now); start.setHours(0, 0, 0, 0);
  }
  return `AND ${alias}.${column} >= '${start.toISOString()}'`;
}

router.get('/online-counts', roomController.onlineCounts);
router.get('/public-for-battle', authenticate, roomController.publicRoomsForBattle);
router.get('/public', optionalAuth, roomController.publicRooms);
router.get('/my', authenticate, roomController.myRooms);
router.get('/by-code/:code', roomController.getRoomByCode);
// Top gifted chat rooms (ranked by total coins received) with time period filter
router.get('/top-gifted', async (req, res, next) => {
  try {
    const db = require('../config/db');
    const period = req.query.period || 'today';
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const dateFilter = buildDateFilter(period);

    const r = await db.query(
      `SELECT r.id, r.room_name, r.room_image_url,
              COALESCE(SUM(e.coins * e.quantity), 0)::int AS total_coins
       FROM room_gift_events e
       JOIN rooms r ON r.id = e.room_id
       WHERE 1=1 ${dateFilter}
       GROUP BY r.id, r.room_name, r.room_image_url
       HAVING COALESCE(SUM(e.coins * e.quantity), 0) > 0
       ORDER BY total_coins DESC
       LIMIT $1`,
      [limit]
    );

    return res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
});

// Top supporters app-wide (users who gifted the most coins across all rooms) with time period filter
router.get('/top-supporters', async (req, res, next) => {
  try {
    const db = require('../config/db');
    const period = req.query.period || 'today';
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const dateFilter = buildDateFilter(period);

    const r = await db.query(
      `SELECT u.id, u.full_name, u.username, u.avatar_url,
              COALESCE(SUM(e.coins * e.quantity), 0)::int AS total_coins
       FROM room_gift_events e
       JOIN users u ON u.id = e.sender_id
       WHERE 1=1 ${dateFilter}
       GROUP BY u.id, u.full_name, u.username, u.avatar_url
       HAVING COALESCE(SUM(e.coins * e.quantity), 0) > 0
       ORDER BY total_coins DESC
       LIMIT $1`,
      [limit]
    );

    return res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
});

// Top receivers app-wide (users who received the most gift coins across all rooms) with time period filter
router.get('/top-receivers', async (req, res, next) => {
  try {
    const db = require('../config/db');
    const period = req.query.period || 'today';
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const dateFilter = buildDateFilter(period);

    const r = await db.query(
      `SELECT u.id, u.full_name, u.username, u.avatar_url,
              COALESCE(SUM(e.coins * e.quantity), 0)::int AS total_coins
       FROM room_gift_events e
       JOIN users u ON u.id = e.recipient_id
       WHERE 1=1 ${dateFilter}
       GROUP BY u.id, u.full_name, u.username, u.avatar_url
       HAVING COALESCE(SUM(e.coins * e.quantity), 0) > 0
       ORDER BY total_coins DESC
       LIMIT $1`,
      [limit]
    );

    return res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
});

// Top battle-winning chat rooms (ranked by number of battles won) with time period filter.
// A battle's winner is the room with the higher gift total during its [started_at, started_at + duration) window.
router.get('/top-battle-winners', async (req, res, next) => {
  try {
    const db = require('../config/db');
    const period = req.query.period || 'today';
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const dateFilter = buildDateFilter(period, 'bi', 'finished_at');

    const r = await db.query(
      `WITH battle_scores AS (
         SELECT
           bi.id AS battle_id,
           bi.from_room_id,
           bi.to_room_id,
           COALESCE((
             SELECT SUM(e.coins * e.quantity) FROM room_gift_events e
             WHERE e.room_id = bi.from_room_id
               AND e.created_at >= bi.started_at
               AND e.created_at < bi.started_at + (bi.duration_minutes || ' minutes')::INTERVAL
           ), 0) AS from_score,
           COALESCE((
             SELECT SUM(e.coins * e.quantity) FROM room_gift_events e
             WHERE e.room_id = bi.to_room_id
               AND e.created_at >= bi.started_at
               AND e.created_at < bi.started_at + (bi.duration_minutes || ' minutes')::INTERVAL
           ), 0) AS to_score
         FROM battle_invites bi
         WHERE bi.status = 'finished' AND bi.started_at IS NOT NULL ${dateFilter}
       ),
       winners AS (
         SELECT CASE WHEN from_score > to_score THEN from_room_id
                     WHEN to_score > from_score THEN to_room_id
                     ELSE NULL END AS winner_room_id
         FROM battle_scores
       )
       SELECT r.id, r.room_name, r.room_image_url, COUNT(*)::int AS total_coins
       FROM winners w
       JOIN rooms r ON r.id = w.winner_room_id
       WHERE w.winner_room_id IS NOT NULL
       GROUP BY r.id, r.room_name, r.room_image_url
       ORDER BY total_coins DESC
       LIMIT $1`,
      [limit]
    );

    return res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
});

// Top battle supporters app-wide (users who gifted the most coins during battle windows) with time period filter.
router.get('/top-battle-supporters', async (req, res, next) => {
  try {
    const db = require('../config/db');
    const period = req.query.period || 'today';
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const dateFilter = buildDateFilter(period, 'bi', 'finished_at');

    const r = await db.query(
      `SELECT u.id, u.full_name, u.username, u.avatar_url,
              SUM(e.coins * e.quantity)::int AS total_coins
       FROM battle_invites bi
       JOIN room_gift_events e
         ON e.room_id IN (bi.from_room_id, bi.to_room_id)
        AND e.created_at >= bi.started_at
        AND e.created_at < bi.started_at + (bi.duration_minutes || ' minutes')::INTERVAL
       JOIN users u ON u.id = e.sender_id
       WHERE bi.status = 'finished' AND bi.started_at IS NOT NULL ${dateFilter}
       GROUP BY u.id, u.full_name, u.username, u.avatar_url
       ORDER BY total_coins DESC
       LIMIT $1`,
      [limit]
    );

    return res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
});

router.get('/:id/supporters', async (req, res, next) => {
  try {
    const db = require('../config/db');
    const r = await db.query(
      `SELECT u.id, u.full_name, u.username, u.avatar_url,
              COALESCE(SUM(e.coins * e.quantity), 0) AS total_coins
       FROM room_gift_events e
       JOIN users u ON u.id = e.sender_id
       WHERE e.room_id = $1
       GROUP BY u.id, u.full_name, u.username, u.avatar_url
       ORDER BY total_coins DESC
       LIMIT 5`,
      [req.params.id]
    );
    return res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
});
// Leaderboard: top gifters + top supporters with time period filter
router.get('/:id/leaderboard', async (req, res, next) => {
  try {
    const db = require('../config/db');
    const roomId = req.params.id;
    const period = req.query.period || 'this_week';
    const dateFilter = buildDateFilter(period);

    // Top gifters (senders)
    const giftersR = await db.query(
      `SELECT u.id, u.full_name, u.username, u.avatar_url,
              COALESCE(SUM(e.coins * e.quantity), 0)::int AS total_coins
       FROM room_gift_events e
       JOIN users u ON u.id = e.sender_id
       WHERE e.room_id = $1 ${dateFilter}
       GROUP BY u.id, u.full_name, u.username, u.avatar_url
       ORDER BY total_coins DESC LIMIT 10`,
      [roomId]
    );

    // Top supporters (recipients — who received gifts in this room)
    const supportersR = await db.query(
      `SELECT u.id, u.full_name, u.username, u.avatar_url,
              COALESCE(SUM(e.coins * e.quantity), 0)::int AS total_coins
       FROM room_gift_events e
       JOIN users u ON u.id = e.recipient_id
       WHERE e.room_id = $1 ${dateFilter}
       GROUP BY u.id, u.full_name, u.username, u.avatar_url
       ORDER BY total_coins DESC LIMIT 10`,
      [roomId]
    );

    return res.json({ success: true, data: { gifters: giftersR.rows, supporters: supportersR.rows } });
  } catch (err) { next(err); }
});

router.get('/:id/members', authenticate, (req, res) => {
  const members = getRoomMembers(req.params.id);
  res.json({ success: true, data: members });
});
// Block a user from a room (host only)
router.post('/:id/block', authenticate, async (req, res, next) => {
  try {
    const db = require('../config/db');
    const roomId = req.params.id;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'userId required' });

    // Verify caller is the host
    const room = await db.query(`SELECT host_user_id FROM rooms WHERE id = $1`, [roomId]);
    if (!room.rows.length) return res.status(404).json({ success: false, message: 'Room not found' });
    if (room.rows[0].host_user_id !== req.user.id) return res.status(403).json({ success: false, message: 'Only the host can block users' });
    if (userId === req.user.id) return res.status(400).json({ success: false, message: 'Cannot block yourself' });

    await db.query(
      `INSERT INTO room_blocked_users (room_id, user_id, blocked_by) VALUES ($1, $2, $3)
       ON CONFLICT (room_id, user_id) DO NOTHING`,
      [roomId, userId, req.user.id]
    );

    // Immediately kick the user if they're currently in the room
    kickUserFromRoom(roomId, userId);

    return res.json({ success: true });
  } catch (err) { next(err); }
});

// Unblock a user from a room (host only)
router.post('/:id/unblock', authenticate, async (req, res, next) => {
  try {
    const db = require('../config/db');
    const roomId = req.params.id;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'userId required' });

    const room = await db.query(`SELECT host_user_id FROM rooms WHERE id = $1`, [roomId]);
    if (!room.rows.length) return res.status(404).json({ success: false, message: 'Room not found' });
    if (room.rows[0].host_user_id !== req.user.id) return res.status(403).json({ success: false, message: 'Only the host can unblock users' });

    await db.query(`DELETE FROM room_blocked_users WHERE room_id = $1 AND user_id = $2`, [roomId, userId]);
    return res.json({ success: true });
  } catch (err) { next(err); }
});

// Get blocked users list (host only)
router.get('/:id/blocked', authenticate, async (req, res, next) => {
  try {
    const db = require('../config/db');
    const roomId = req.params.id;

    const room = await db.query(`SELECT host_user_id FROM rooms WHERE id = $1`, [roomId]);
    if (!room.rows.length) return res.status(404).json({ success: false, message: 'Room not found' });
    if (room.rows[0].host_user_id !== req.user.id) return res.status(403).json({ success: false, message: 'Only the host can view blocked users' });

    const r = await db.query(
      `SELECT u.id AS "userId", u.full_name AS "userName", u.avatar_url AS "avatarUrl", b.created_at
       FROM room_blocked_users b
       JOIN users u ON u.id = b.user_id
       WHERE b.room_id = $1
       ORDER BY b.created_at DESC`,
      [roomId]
    );
    return res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
});

router.get('/:id', roomController.getRoom);
router.post('/', authenticate, roomController.createRoom);

module.exports = router;
