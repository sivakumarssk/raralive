const db = require('../config/db');

/**
 * Create a new battle invite row.
 */
async function createInvite({ fromRoomId, toRoomId, fromUserId, toUserId, durationMinutes, mode = 'normal', targetId = null, targetCoins = null }) {
  const result = await db.query(
    `INSERT INTO battle_invites
       (from_room_id, to_room_id, from_user_id, to_user_id, duration_minutes, mode, target_id, target_coins)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [fromRoomId, toRoomId, fromUserId, toUserId, durationMinutes, mode, targetId, targetCoins]
  );
  return result.rows[0];
}

// Invite row joined with room + host names — the shape the app renders battles from.
const INVITE_DETAIL_SELECT = `
  SELECT bi.*,
         fr.room_name AS from_room_name, fr.room_image_url AS from_room_image_url,
         tr.room_name AS to_room_name,   tr.room_image_url AS to_room_image_url,
         fu.full_name AS from_host_name, fu.username AS from_host_username,
         tu.full_name AS to_host_name,   tu.username AS to_host_username
  FROM battle_invites bi
  JOIN rooms fr ON fr.id = bi.from_room_id
  JOIN rooms tr ON tr.id = bi.to_room_id
  JOIN users fu ON fu.id = bi.from_user_id
  JOIN users tu ON tu.id = bi.to_user_id`;

/**
 * Get a single invite by id, joined with room + user names.
 */
async function getInviteById(inviteId) {
  const result = await db.query(`${INVITE_DETAIL_SELECT} WHERE bi.id = $1`, [inviteId]);
  return result.rows[0] ?? null;
}

/**
 * The battle currently running in a room (either side), or null — skips one
 * whose time is already up but hasn't been marked finished yet.
 */
async function getActiveBattleForRoom(roomId) {
  const result = await db.query(
    `${INVITE_DETAIL_SELECT}
     WHERE bi.status = 'active'
       AND (bi.from_room_id = $1 OR bi.to_room_id = $1)
       AND bi.started_at + bi.duration_minutes * INTERVAL '1 minute' > NOW()
     ORDER BY bi.started_at DESC
     LIMIT 1`,
    [roomId]
  );
  return result.rows[0] ?? null;
}

/**
 * Top 5 gifters on each side since the battle started.
 * left = from_room, right = to_room.
 */
async function getTopGifters(battle) {
  if (!battle?.started_at) return { left: [], right: [] };
  const sideQuery = roomId => db.query(
    `SELECT u.id, u.full_name, u.username, u.avatar_url,
            SUM(e.coins * e.quantity)::int AS total_coins
     FROM room_gift_events e
     JOIN users u ON u.id = e.sender_id
     WHERE e.room_id = $1 AND e.created_at >= $2
     GROUP BY u.id, u.full_name, u.username, u.avatar_url
     ORDER BY total_coins DESC LIMIT 5`,
    [roomId, battle.started_at]
  );
  const [leftR, rightR] = await Promise.all([sideQuery(battle.from_room_id), sideQuery(battle.to_room_id)]);
  return { left: leftR.rows, right: rightR.rows };
}

/**
 * Every gift counted towards a battle so far (both rooms, since it started),
 * with the sender's profile — seeds the socket server's live tally.
 */
async function getBattleGiftEvents(battle) {
  if (!battle?.started_at) return [];
  const result = await db.query(
    `SELECT e.id, e.room_id, e.sender_id, (e.coins * e.quantity)::int AS total, e.created_at,
            u.full_name, u.username, u.avatar_url
     FROM room_gift_events e
     JOIN users u ON u.id = e.sender_id
     WHERE e.room_id IN ($1, $2) AND e.created_at >= $3
       AND e.created_at < $3::timestamptz + $4 * INTERVAL '1 minute'`,
    [battle.from_room_id, battle.to_room_id, battle.started_at, battle.duration_minutes ?? 0]
  );
  return result.rows;
}

/** Every battle still marked active (incl. ones whose time ran out while the server was down). */
async function getActiveBattles() {
  const result = await db.query(`${INVITE_DETAIL_SELECT} WHERE bi.status = 'active' AND bi.started_at IS NOT NULL`);
  return result.rows;
}

/**
 * Total coins gifted in each room since the battle started.
 * left = from_room, right = to_room.
 */
async function getBattleTotals(battle) {
  if (!battle?.started_at) return { left: 0, right: 0 };
  const result = await db.query(
    `SELECT room_id, COALESCE(SUM(coins * quantity), 0)::int AS total
     FROM room_gift_events
     WHERE room_id IN ($1, $2) AND created_at >= $3
     GROUP BY room_id`,
    [battle.from_room_id, battle.to_room_id, battle.started_at]
  );
  let left = 0, right = 0;
  for (const row of result.rows) {
    if (row.room_id === battle.from_room_id) left = parseInt(row.total, 10);
    else if (row.room_id === battle.to_room_id) right = parseInt(row.total, 10);
  }
  return { left, right };
}

/**
 * Update invite status (and optionally set started_at).
 */
async function updateInviteStatus(inviteId, status, setStartedAt = false) {
  const query = setStartedAt
    ? `UPDATE battle_invites SET status=$2, started_at=NOW(), updated_at=NOW() WHERE id=$1 RETURNING *`
    : `UPDATE battle_invites SET status=$2, updated_at=NOW() WHERE id=$1 RETURNING *`;
  const result = await db.query(query, [inviteId, status]);
  return result.rows[0] ?? null;
}

/**
 * End a running battle now. Returns the updated row, or null if it wasn't
 * active any more (already ended / cancelled by the other host) — the
 * status guard makes a double cancel a no-op.
 */
async function finishBattle(inviteId) {
  const result = await db.query(
    `UPDATE battle_invites SET status = 'finished', finished_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND status = 'active'
     RETURNING *`,
    [inviteId]
  );
  return result.rows[0] ?? null;
}

/**
 * Get all pending invites where the current user is the recipient (to_user_id).
 */
async function getPendingInvitesForUser(userId) {
  const result = await db.query(
    `SELECT bi.*,
            fr.room_name AS from_room_name, fr.room_image_url AS from_room_image_url,
            tr.room_name AS to_room_name,   tr.room_image_url AS to_room_image_url,
            fu.full_name AS from_host_name, fu.username AS from_host_username
     FROM battle_invites bi
     JOIN rooms fr ON fr.id = bi.from_room_id
     JOIN rooms tr ON tr.id = bi.to_room_id
     JOIN users fu ON fu.id = bi.from_user_id
     WHERE bi.to_user_id = $1 AND bi.status = 'pending'
     ORDER BY bi.created_at DESC`,
    [userId]
  );
  return result.rows;
}

// ── Notifications ─────────────────────────────────────────────────────────────

/**
 * Insert a notification row.
 */
async function createNotification({ userId, type, title, body, data }) {
  const result = await db.query(
    `INSERT INTO notifications (user_id, type, title, body, data)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, type, title, body, data ? JSON.stringify(data) : null]
  );
  return result.rows[0];
}

/**
 * Get all notifications for a user, latest first, limit 50.
 */
async function getNotificationsForUser(userId) {
  const result = await db.query(
    `SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`,
    [userId]
  );
  return result.rows;
}

/**
 * Mark all notifications as read for a user.
 */
async function markAllReadForUser(userId) {
  await db.query(
    `UPDATE notifications SET is_read=TRUE WHERE user_id=$1 AND is_read=FALSE`,
    [userId]
  );
}

/**
 * Count unread notifications for a user.
 */
async function countUnreadForUser(userId) {
  const result = await db.query(
    `SELECT COUNT(*) AS count FROM notifications WHERE user_id=$1 AND is_read=FALSE`,
    [userId]
  );
  return parseInt(result.rows[0].count, 10);
}

module.exports = {
  createInvite,
  getInviteById,
  getActiveBattleForRoom,
  getTopGifters,
  getBattleTotals,
  getBattleGiftEvents,
  getActiveBattles,
  updateInviteStatus,
  finishBattle,
  getPendingInvitesForUser,
  createNotification,
  getNotificationsForUser,
  markAllReadForUser,
  countUnreadForUser,
};