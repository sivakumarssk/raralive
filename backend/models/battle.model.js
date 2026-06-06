const db = require('../config/db');

/**
 * Create a new battle invite row.
 */
async function createInvite({ fromRoomId, toRoomId, fromUserId, toUserId, durationMinutes }) {
  const result = await db.query(
    `INSERT INTO battle_invites
       (from_room_id, to_room_id, from_user_id, to_user_id, duration_minutes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [fromRoomId, toRoomId, fromUserId, toUserId, durationMinutes]
  );
  return result.rows[0];
}

/**
 * Get a single invite by id, joined with room + user names.
 */
async function getInviteById(inviteId) {
  const result = await db.query(
    `SELECT bi.*,
            fr.room_name AS from_room_name, fr.room_image_url AS from_room_image_url,
            tr.room_name AS to_room_name,   tr.room_image_url AS to_room_image_url,
            fu.full_name AS from_host_name, fu.username AS from_host_username,
            tu.full_name AS to_host_name,   tu.username AS to_host_username
     FROM battle_invites bi
     JOIN rooms fr ON fr.id = bi.from_room_id
     JOIN rooms tr ON tr.id = bi.to_room_id
     JOIN users fu ON fu.id = bi.from_user_id
     JOIN users tu ON tu.id = bi.to_user_id
     WHERE bi.id = $1`,
    [inviteId]
  );
  return result.rows[0] ?? null;
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
  updateInviteStatus,
  getPendingInvitesForUser,
  createNotification,
  getNotificationsForUser,
  markAllReadForUser,
  countUnreadForUser,
};