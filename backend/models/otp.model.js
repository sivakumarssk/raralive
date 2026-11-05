const db = require('../config/db');

/** Stores a new code and retires any earlier unused codes for the same phone + purpose. */
async function createOtp({ phone, code, purpose, expiresAt }) {
  await db.query(
    `UPDATE otp_codes SET consumed_at = NOW()
     WHERE phone = $1 AND purpose = $2 AND consumed_at IS NULL`,
    [phone, purpose]
  );
  const result = await db.query(
    `INSERT INTO otp_codes (phone, code, purpose, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id, phone, purpose, expires_at, created_at`,
    [phone, code, purpose, expiresAt]
  );
  return result.rows[0];
}

/** The one live (unused, unexpired) code for this phone + purpose, if any. */
async function findActiveOtp({ phone, purpose }) {
  const result = await db.query(
    `SELECT id, phone, code, purpose, attempts, expires_at
     FROM otp_codes
     WHERE phone = $1 AND purpose = $2
       AND consumed_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [phone, purpose]
  );
  return result.rows[0] || null;
}

async function incrementAttempts(otpId) {
  const result = await db.query(
    `UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1 RETURNING attempts`,
    [otpId]
  );
  return result.rows[0]?.attempts ?? 0;
}

async function consumeOtp(otpId) {
  await db.query(
    `UPDATE otp_codes SET consumed_at = NOW() WHERE id = $1`,
    [otpId]
  );
}

async function deleteOtp(otpId) {
  await db.query(`DELETE FROM otp_codes WHERE id = $1`, [otpId]);
}

/** Seconds since the last code was sent, and how many were sent in the last hour. */
async function getSendStats({ phone, purpose }) {
  const result = await db.query(
    `SELECT EXTRACT(EPOCH FROM (NOW() - MAX(created_at)))::int AS seconds_since_last,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour')::int AS sent_last_hour
     FROM otp_codes
     WHERE phone = $1 AND purpose = $2`,
    [phone, purpose]
  );
  const row = result.rows[0] || {};
  return { secondsSinceLast: row.seconds_since_last, sentLastHour: row.sent_last_hour || 0 };
}

module.exports = {
  createOtp,
  findActiveOtp,
  incrementAttempts,
  consumeOtp,
  deleteOtp,
  getSendStats,
};
