const db = require('../config/db');

async function createOtp({ phone, code, purpose, expiresAt }) {
  const result = await db.query(
    `INSERT INTO otp_codes (phone, code, purpose, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id, phone, purpose, expires_at, created_at`,
    [phone, code, purpose, expiresAt]
  );
  return result.rows[0];
}

async function findLatestValidOtp({ phone, code, purpose }) {
  const result = await db.query(
    `SELECT id, phone, code, purpose, expires_at
     FROM otp_codes
     WHERE phone = $1 AND code = $2 AND purpose = $3
       AND consumed_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [phone, code, purpose]
  );
  return result.rows[0] || null;
}

async function consumeOtp(otpId) {
  await db.query(
    `UPDATE otp_codes SET consumed_at = NOW() WHERE id = $1`,
    [otpId]
  );
}

module.exports = {
  createOtp,
  findLatestValidOtp,
  consumeOtp,
};
