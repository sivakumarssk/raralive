const db = require('../config/db');

async function findById(id) {
  const result = await db.query(
    `SELECT id, phone, email, password_hash, username, full_name, gender,
            date_of_birth, preferred_language, avatar_url, is_phone_verified,
            role, agency_id, created_at, updated_at
     FROM users
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function findByPhone(phone) {
  const result = await db.query(
    `SELECT id, phone, email, password_hash, username, full_name, gender,
            date_of_birth, preferred_language, avatar_url, is_phone_verified,
            role, agency_id, created_at, updated_at
     FROM users
     WHERE phone = $1`,
    [phone]
  );
  return result.rows[0] || null;
}

async function findByEmail(email) {
  const result = await db.query(
    `SELECT id, phone, email, password_hash, username, full_name, gender,
            date_of_birth, preferred_language, avatar_url, is_phone_verified,
            role, agency_id, created_at, updated_at
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
            date_of_birth, preferred_language, avatar_url, is_phone_verified,
            role, agency_id, created_at, updated_at
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

/** True when another account already uses this username (case-insensitive). */
async function isUsernameTaken(username, exceptUserId = null) {
  const result = await db.query(
    `SELECT 1 FROM users WHERE LOWER(username) = LOWER($1) AND ($2::uuid IS NULL OR id <> $2) LIMIT 1`,
    [username, exceptUserId]
  );
  return result.rowCount > 0;
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

async function updateProfile(userId, { fullName, username, gender, dateOfBirth, preferredLanguage, avatarUrl, bio, coverUrl, location }) {
  const result = await db.query(
    `UPDATE users
     SET full_name = COALESCE($2, full_name),
         username = COALESCE($3, username),
         gender = COALESCE($4, gender),
         date_of_birth = COALESCE($5, date_of_birth),
         preferred_language = COALESCE($6, preferred_language),
         avatar_url = COALESCE($7, avatar_url),
         bio = COALESCE($8, bio),
         cover_url = COALESCE($9, cover_url),
         location = COALESCE($10, location),
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, phone, email, username, full_name, gender, date_of_birth, preferred_language, avatar_url, bio, cover_url, location`,
    [userId, fullName || null, username || null, gender || null, dateOfBirth || null, preferredLanguage || null, avatarUrl || null, bio !== undefined ? bio : null, coverUrl || null, location !== undefined ? location : null]
  );
  return result.rows[0] || null;
}

async function getProfileWithStats(userId) {
  const result = await db.query(
    `SELECT u.id, u.phone, u.email, u.username, u.full_name, u.gender,
            u.date_of_birth, u.preferred_language, u.avatar_url, u.bio, u.cover_url, u.location,
            u.is_phone_verified, u.created_at, u.role, u.agency_id,
            (SELECT COUNT(*) FROM user_follows WHERE following_id = u.id) AS followers_count,
            (SELECT COUNT(*) FROM user_follows WHERE follower_id  = u.id) AS following_count,
            (SELECT COUNT(*) FROM posts WHERE user_id = u.id) AS posts_count,
            (SELECT COALESCE(SUM(coins * quantity), 0)::int FROM room_gift_events WHERE sender_id = u.id) AS coins_gifted
     FROM users u WHERE u.id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function followUser(followerId, followingId) {
  await db.query(
    `INSERT INTO user_follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [followerId, followingId]
  );
}

async function unfollowUser(followerId, followingId) {
  await db.query(
    `DELETE FROM user_follows WHERE follower_id = $1 AND following_id = $2`,
    [followerId, followingId]
  );
}

async function isFollowing(followerId, followingId) {
  const r = await db.query(
    `SELECT 1 FROM user_follows WHERE follower_id = $1 AND following_id = $2`,
    [followerId, followingId]
  );
  return r.rows.length > 0;
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

/** Re-registration of a phone that never finished OTP verification. */
async function updatePendingRegistration(userId, { email, passwordHash }) {
  const result = await db.query(
    `UPDATE users SET email = $2, password_hash = $3, updated_at = NOW()
     WHERE id = $1
     RETURNING id, phone, email, is_phone_verified, created_at`,
    [userId, email || null, passwordHash]
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

/**
 * Give an agency's phone+password a working app-user login (role='agency'),
 * so the same credentials work both in the agency panel and the regular app
 * login. Two cases:
 *  - phone not registered yet → creates a new users row.
 *  - phone already belongs to an existing user → links it to this agency
 *    (role, agency_id) and overwrites its password with the agency's, so the
 *    agency's password is authoritative for app login going forward.
 * Called whenever an agency is created and whenever its password is reset,
 * so the two stay in sync (see agency.controller.js).
 */
// Same shape as the app's generateUsername() (otp-verify-screen.tsx):
// lowercase name, [a-z0-9_] only, max 14 chars, plus a 4-digit suffix.
function usernameCandidate(seed) {
  const base = String(seed || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 14);
  return `${base || 'agency'}_${Math.floor(1000 + Math.random() * 9000)}`;
}

/**
 * Gives a user a unique username if they don't have one yet (agency accounts
 * never go through the app's profile step). Returns the user's username.
 */
async function ensureUsername(userId, seed) {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const r = await db.query(
        `UPDATE users SET username = COALESCE(username, $2), updated_at = NOW()
         WHERE id = $1 RETURNING username`,
        [userId, usernameCandidate(seed)]
      );
      return r.rows[0]?.username ?? null;
    } catch (err) {
      if (err.code !== '23505') throw err; // username taken — try another suffix
    }
  }
  return null;
}

async function linkAgencyUser({ agencyId, phone, passwordHash, fullName, usernameSeed }) {
  const existing = await findByPhone(phone);
  let row;
  if (existing) {
    const result = await db.query(
      `UPDATE users
       SET password_hash = $2, role = 'agency', agency_id = $3, updated_at = NOW()
       WHERE id = $1
       RETURNING id, phone, role, agency_id`,
      [existing.id, passwordHash, agencyId]
    );
    row = result.rows[0];
  } else {
    const result = await db.query(
      `INSERT INTO users (phone, password_hash, full_name, role, agency_id, is_phone_verified)
       VALUES ($1, $2, $3, 'agency', $4, TRUE)
       RETURNING id, phone, role, agency_id`,
      [phone, passwordHash, fullName || null, agencyId]
    );
    row = result.rows[0];
  }
  if (usernameSeed) row.username = await ensureUsername(row.id, usernameSeed);
  return row;
}

module.exports = {
  findById,
  findByPhone,
  findByPhoneFlexible,
  findByEmail,
  findByIdentifier,
  isUsernameTaken,
  createUser,
  updateProfile,
  updatePassword,
  updatePendingRegistration,
  markPhoneVerified,
  linkAgencyUser,
  ensureUsername,
  listUsers,
  getProfileWithStats,
  followUser,
  unfollowUser,
  isFollowing,
};
