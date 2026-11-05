const db = require('../config/db');

async function getLatestForUser(userId) {
  const r = await db.query(
    `SELECT * FROM friend_zone_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  return r.rows[0] || null;
}

async function createApplication({ userId, photos, fullName, gender, dateOfBirth, city, language, aboutMe }) {
  const r = await db.query(
    `INSERT INTO friend_zone_applications
       (user_id, photos, full_name, gender, date_of_birth, city, language, about_me)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [userId, photos, fullName, gender, dateOfBirth, city, language, aboutMe || null]
  );
  return r.rows[0];
}

async function listApplications({ status = '', limit = 50, offset = 0 } = {}) {
  const conds = []; const vals = []; let i = 1;
  if (status) { conds.push(`fza.status = $${i++}`); vals.push(status); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  const r = await db.query(
    `SELECT fza.*, u.full_name AS user_full_name, u.username AS user_username, u.avatar_url AS user_avatar_url, u.phone AS user_phone
     FROM friend_zone_applications fza
     JOIN users u ON u.id = fza.user_id
     ${where}
     ORDER BY fza.created_at DESC
     LIMIT $${i++} OFFSET $${i++}`,
    [...vals, limit, offset]
  );
  const count = await db.query(
    `SELECT COUNT(*) FROM friend_zone_applications fza ${where}`,
    vals
  );
  return { rows: r.rows, total: parseInt(count.rows[0].count, 10) };
}

async function getApplicationById(id) {
  const r = await db.query(
    `SELECT fza.*, u.full_name AS user_full_name, u.username AS user_username, u.avatar_url AS user_avatar_url, u.phone AS user_phone
     FROM friend_zone_applications fza
     JOIN users u ON u.id = fza.user_id
     WHERE fza.id = $1`,
    [id]
  );
  return r.rows[0] || null;
}

async function setApplicationStatus(id, { status, rejectionReason, reviewedBy }) {
  const r = await db.query(
    `UPDATE friend_zone_applications SET
       status = $2,
       rejection_reason = $3,
       reviewed_by = $4,
       reviewed_at = NOW(),
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, status, rejectionReason || null, reviewedBy || null]
  );
  return r.rows[0] || null;
}

// Editing an approved/rejected application resubmits it for review (back to pending)
async function updateApplicationDetails(id, { photos, fullName, gender, dateOfBirth, city, language, aboutMe }) {
  const r = await db.query(
    `UPDATE friend_zone_applications SET
       photos = $2,
       full_name = $3,
       gender = $4,
       date_of_birth = $5,
       city = $6,
       language = $7,
       about_me = $8,
       status = 'pending',
       rejection_reason = NULL,
       reviewed_by = NULL,
       reviewed_at = NULL,
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, photos, fullName, gender, dateOfBirth, city, language, aboutMe || null]
  );
  return r.rows[0] || null;
}

async function updateTogglePrefs(userId, { receiveCalls, videoCalls }) {
  const params = [userId, receiveCalls ?? null, videoCalls ?? null];
  const r = await db.query(
    `UPDATE friend_zone_applications SET
       receive_calls = COALESCE($2, receive_calls),
       video_calls   = COALESCE($3, video_calls),
       updated_at    = NOW()
     WHERE id = (
       SELECT id FROM friend_zone_applications
       WHERE user_id = $1 AND status = 'approved'
       ORDER BY created_at DESC LIMIT 1
     )
     RETURNING *`,
    params
  );
  return r.rows[0] || null;
}

// Public list — approved users with at least one call toggle enabled
async function listPublicFriends() {
  const r = await db.query(
    `SELECT fza.id, fza.user_id, fza.photos, fza.full_name, fza.gender, fza.date_of_birth,
            fza.city, fza.language, fza.about_me, fza.receive_calls, fza.video_calls
     FROM friend_zone_applications fza
     WHERE fza.status = 'approved'
       AND (fza.receive_calls = TRUE OR fza.video_calls = TRUE)
       AND fza.id = (
         SELECT id FROM friend_zone_applications f2
         WHERE f2.user_id = fza.user_id
         ORDER BY f2.created_at DESC LIMIT 1
       )
     ORDER BY fza.updated_at DESC`
  );
  return r.rows;
}

// ── Calls ─────────────────────────────────────────────────────────────────────

async function createCall({ channelName, callerId, calleeId, callType }) {
  const r = await db.query(
    `INSERT INTO friend_zone_calls (channel_name, caller_id, callee_id, call_type)
     VALUES ($1,$2,$3,$4)
     RETURNING *`,
    [channelName, callerId, calleeId, callType]
  );
  return r.rows[0];
}

async function getCallById(id) {
  const r = await db.query(`SELECT * FROM friend_zone_calls WHERE id = $1`, [id]);
  return r.rows[0] || null;
}

async function setCallStatus(id, status) {
  const r = await db.query(
    `UPDATE friend_zone_calls SET status = $2 WHERE id = $1 RETURNING *`,
    [id, status]
  );
  return r.rows[0] || null;
}

async function markCallStarted(id) {
  const r = await db.query(
    `UPDATE friend_zone_calls SET status = 'accepted', started_at = NOW() WHERE id = $1 RETURNING *`,
    [id]
  );
  return r.rows[0] || null;
}

async function endCall(id, { durationSeconds, coinsCharged, gemsEarned, endReason }) {
  const r = await db.query(
    `UPDATE friend_zone_calls SET
       status = 'ended', ended_at = NOW(),
       duration_seconds = $2, coins_charged = $3, gems_earned = $4, end_reason = $5
     WHERE id = $1
     RETURNING *`,
    [id, durationSeconds, coinsCharged, gemsEarned || 0, endReason || null]
  );
  return r.rows[0] || null;
}

async function listCallHistory(userId, { limit = 30, offset = 0 } = {}) {
  const r = await db.query(
    `SELECT
       c.id, c.channel_name, c.call_type, c.status, c.duration_seconds, c.coins_charged, c.gems_earned,
       c.end_reason, c.started_at, c.ended_at, c.created_at,
       CASE WHEN c.caller_id = $1 THEN 'outgoing' ELSE 'incoming' END AS direction,
       peer.id AS peer_user_id, peer.full_name AS peer_name, peer.username AS peer_username,
       peer.avatar_url AS peer_avatar_url
     FROM friend_zone_calls c
     JOIN users peer ON peer.id = (CASE WHEN c.caller_id = $1 THEN c.callee_id ELSE c.caller_id END)
     WHERE c.caller_id = $1 OR c.callee_id = $1
     ORDER BY c.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  const count = await db.query(
    `SELECT COUNT(*) FROM friend_zone_calls WHERE caller_id = $1 OR callee_id = $1`,
    [userId]
  );
  return { rows: r.rows, total: parseInt(count.rows[0].count, 10) };
}

// Admin: all calls across every user, both directions, with caller/callee identities
// Admin call history: each call with both parties, the call billing, and the
// gifts sent during it (aggregated + the individual gifts for the detail row).
// `summary` covers every call matching the filters, not just this page.
async function listCalls({ status = '', callType = '', limit = 50, offset = 0 } = {}) {
  const conds = []; const vals = []; let i = 1;
  if (status) { conds.push(`c.status = $${i++}`); vals.push(status); }
  if (callType) { conds.push(`c.call_type = $${i++}`); vals.push(callType); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  const r = await db.query(
    `SELECT
       c.id, c.channel_name, c.call_type, c.status, c.duration_seconds,
       c.coins_charged, c.gems_earned, c.end_reason, c.started_at, c.ended_at, c.created_at,
       caller.id AS caller_id, caller.full_name AS caller_name, caller.username AS caller_username, caller.avatar_url AS caller_avatar_url,
       callee.id AS callee_id, callee.full_name AS callee_name, callee.username AS callee_username, callee.avatar_url AS callee_avatar_url,
       COALESCE(g.gift_count, 0)::int AS gift_count,
       COALESCE(g.gift_coins, 0)::int AS gift_coins,
       COALESCE(g.gift_gems, 0)::int AS gift_gems,
       COALESCE(g.gifts, '[]'::json) AS gifts
     FROM friend_zone_calls c
     JOIN users caller ON caller.id = c.caller_id
     JOIN users callee ON callee.id = c.callee_id
     LEFT JOIN LATERAL (
       SELECT SUM(e.quantity) AS gift_count,
              SUM(e.coins * e.quantity) AS gift_coins,
              SUM(e.gems_earned) AS gift_gems,
              json_agg(json_build_object(
                'id', e.id, 'gift_name', e.gift_name, 'gift_image_url', e.gift_image_url,
                'quantity', e.quantity, 'total_coins', e.coins * e.quantity, 'gems_earned', e.gems_earned,
                'sender_id', e.sender_id, 'created_at', e.created_at
              ) ORDER BY e.created_at) AS gifts
       FROM call_gift_events e WHERE e.call_id = c.id
     ) g ON TRUE
     ${where}
     ORDER BY c.created_at DESC
     LIMIT $${i++} OFFSET $${i++}`,
    [...vals, limit, offset]
  );
  const summary = await db.query(
    `SELECT COUNT(*)::int AS total,
            COALESCE(SUM(c.duration_seconds), 0)::bigint AS total_seconds,
            COALESCE(SUM(c.coins_charged), 0)::bigint AS call_coins,
            COALESCE(SUM(c.gems_earned), 0)::bigint AS call_gems,
            COALESCE(SUM(gs.gift_coins), 0)::bigint AS gift_coins,
            COALESCE(SUM(gs.gift_gems), 0)::bigint AS gift_gems
     FROM friend_zone_calls c
     LEFT JOIN (
       SELECT call_id, SUM(coins * quantity) AS gift_coins, SUM(gems_earned) AS gift_gems
       FROM call_gift_events GROUP BY call_id
     ) gs ON gs.call_id = c.id
     ${where}`,
    vals
  );
  const s = summary.rows[0];
  return {
    rows: r.rows,
    total: s.total,
    summary: {
      total_seconds: Number(s.total_seconds),
      call_coins: Number(s.call_coins),
      call_gems: Number(s.call_gems),
      gift_coins: Number(s.gift_coins),
      gift_gems: Number(s.gift_gems),
    },
  };
}

/** Call counts per type, for the Audio / Video tab badges. */
async function countCallsByType() {
  const r = await db.query(`SELECT call_type, COUNT(*)::int AS n FROM friend_zone_calls GROUP BY call_type`);
  const out = { audio: 0, video: 0 };
  for (const row of r.rows) out[row.call_type] = row.n;
  return out;
}

// ── Call gifts ────────────────────────────────────────────────────────────────

async function logCallGift({ callId, senderId, recipientId, giftId, giftName, giftImageUrl, coins, qty, gems = 0 }) {
  const r = await db.query(
    `INSERT INTO call_gift_events (call_id, sender_id, recipient_id, gift_id, gift_name, gift_image_url, coins, quantity, gems_earned)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [callId, senderId, recipientId, giftId || null, giftName, giftImageUrl || null, coins, qty, gems || 0]
  );
  return r.rows[0];
}

module.exports = {
  getLatestForUser, createApplication, listApplications, getApplicationById, setApplicationStatus,
  updateApplicationDetails, updateTogglePrefs, listPublicFriends,
  createCall, getCallById, setCallStatus, markCallStarted, endCall, listCallHistory, listCalls,
  logCallGift, countCallsByType,
};
