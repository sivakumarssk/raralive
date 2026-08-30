const db = require('../config/db');

async function getLatestForUser(userId) {
  const r = await db.query(
    `SELECT * FROM go_live_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  return r.rows[0] || null;
}

async function createRequest({ userId, fullName, dateOfBirth, language }) {
  const r = await db.query(
    `INSERT INTO go_live_requests (user_id, full_name, date_of_birth, language)
     VALUES ($1,$2,$3,$4)
     RETURNING *`,
    [userId, fullName, dateOfBirth, language]
  );
  return r.rows[0];
}

async function listRequests({ status = '', limit = 50, offset = 0 } = {}) {
  const conds = []; const vals = []; let i = 1;
  if (status) { conds.push(`glr.status = $${i++}`); vals.push(status); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  const r = await db.query(
    `SELECT glr.*, u.full_name AS user_full_name, u.username AS user_username, u.avatar_url AS user_avatar_url, u.phone AS user_phone
     FROM go_live_requests glr
     JOIN users u ON u.id = glr.user_id
     ${where}
     ORDER BY glr.created_at DESC
     LIMIT $${i++} OFFSET $${i++}`,
    [...vals, limit, offset]
  );
  const count = await db.query(
    `SELECT COUNT(*) FROM go_live_requests glr ${where}`,
    vals
  );
  return { rows: r.rows, total: parseInt(count.rows[0].count, 10) };
}

async function getRequestById(id) {
  const r = await db.query(
    `SELECT glr.*, u.full_name AS user_full_name, u.username AS user_username, u.avatar_url AS user_avatar_url, u.phone AS user_phone
     FROM go_live_requests glr
     JOIN users u ON u.id = glr.user_id
     WHERE glr.id = $1`,
    [id]
  );
  return r.rows[0] || null;
}

async function setRequestStatus(id, { status, rejectionReason, reviewedBy }) {
  const r = await db.query(
    `UPDATE go_live_requests SET
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

module.exports = {
  getLatestForUser, createRequest, listRequests, getRequestById, setRequestStatus,
};
