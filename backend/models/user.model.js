const db = require('../config/db');

async function findByPhone(phone) {
  const result = await db.query(
    `SELECT id, phone, email, password_hash, username, full_name, gender,
            date_of_birth, preferred_language, avatar_url, is_phone_verified, created_at, updated_at
     FROM users
     WHERE phone = $1`,
    [phone]
  );
  return result.rows[0] || null;
}

async function findByEmail(email) {
  const result = await db.query(
    `SELECT id, phone, email, password_hash, username, full_name, gender,
            date_of_birth, preferred_language, avatar_url, is_phone_verified, created_at, updated_at
     FROM users
     WHERE email = $1`,
    [email]
  );
  return result.rows[0] || null;
}

async function findByPhoneFlexible(phone) {
  // Try exact match first
  const exact = await findByPhone(phone);
  if (exact) return exact;
  // Fall back to suffix match on last 10 digits (handles +91 prefix differences)
  const digits = phone.replace(/\D/g, '');
  const suffix = digits.slice(-10);
  if (suffix.length < 6) return null;
  const result = await db.query(
    `SELECT id, phone, email, password_hash, username, full_name, gender,
            date_of_birth, preferred_language, avatar_url, is_phone_verified, created_at, updated_at
     FROM users
     WHERE phone LIKE $1`,
    [`%${suffix}`]
  );
  return result.rows[0] || null;
}

async function findByIdentifier(identifier) {
  const trimmed = identifier.trim();
  const isEmail = trimmed.includes('@');
  return isEmail ? findByEmail(trimmed.toLowerCase()) : findByPhone(trimmed);
}

async function createUser({ phone, email, passwordHash }) {
  const result = await db.query(
    `INSERT INTO users (phone, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, phone, email, is_phone_verified, created_at`,
    [phone, email || null, passwordHash]
  );
  return result.rows[0];
}

async function updateProfile(userId, { fullName, username, gender, dateOfBirth, preferredLanguage, avatarUrl }) {
  const result = await db.query(
    `UPDATE users
     SET full_name = COALESCE($2, full_name),
         username = COALESCE($3, username),
         gender = COALESCE($4, gender),
         date_of_birth = COALESCE($5, date_of_birth),
         preferred_language = COALESCE($6, preferred_language),
         avatar_url = COALESCE($7, avatar_url),
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, phone, email, username, full_name, gender, date_of_birth, preferred_language, avatar_url`,
    [userId, fullName || null, username || null, gender || null, dateOfBirth || null, preferredLanguage || null, avatarUrl || null]
  );
  return result.rows[0] || null;
}

async function listUsers({ limit = 50, offset = 0, search = '' }) {
  const searchParam = `%${search}%`;
  const result = await db.query(
    `SELECT id, phone, email, username, full_name, gender,
            avatar_url, is_phone_verified, created_at
     FROM users
     WHERE ($1 = '' OR full_name ILIKE $2 OR username ILIKE $2 OR phone ILIKE $2 OR email ILIKE $2)
     ORDER BY created_at DESC
     LIMIT $3 OFFSET $4`,
    [search, searchParam, limit, offset]
  );
  const count = await db.query(
    `SELECT COUNT(*) FROM users
     WHERE ($1 = '' OR full_name ILIKE $2 OR username ILIKE $2 OR phone ILIKE $2 OR email ILIKE $2)`,
    [search, searchParam]
  );
  return { rows: result.rows, total: parseInt(count.rows[0].count, 10) };
}

async function updatePassword(userId, passwordHash) {
  const result = await db.query(
    `UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1 RETURNING id`,
    [userId, passwordHash]
  );
  return result.rows[0] || null;
}

async function markPhoneVerified(userId) {
  const result = await db.query(
    `UPDATE users SET is_phone_verified = TRUE, updated_at = NOW() WHERE id = $1 RETURNING id, is_phone_verified`,
    [userId]
  );
  return result.rows[0] || null;
}

module.exports = {
  findByPhone,
  findByPhoneFlexible,
  findByEmail,
  findByIdentifier,
  createUser,
  updateProfile,
  updatePassword,
  markPhoneVerified,
  listUsers,
};
