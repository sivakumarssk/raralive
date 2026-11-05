const db = require('../config/db');

/**
 * App-user JWTs carry `tv`, the user's token_version when the token was signed.
 * "Log out of all devices" bumps the version, so every token signed before it
 * stops working at once (REST and sockets) without tracking tokens one by one.
 *
 * Versions are cached briefly so each request doesn't cost a query; a bump on
 * this server updates the cache immediately.
 */

const CACHE_TTL_MS = 30 * 1000;
const CACHE_MAX = 20000;
const cache = new Map(); // userId -> { version: number | null, at: number }

let columnReady = null;
function ensureColumn() {
  if (!columnReady) {
    columnReady = db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0')
      .catch((err) => { columnReady = null; throw err; });
  }
  return columnReady;
}

function remember(userId, version) {
  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(userId, { version, at: Date.now() });
}

/** The user's current version, or null when the user no longer exists. */
async function currentVersion(userId) {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.version;
  await ensureColumn();
  const { rows } = await db.query('SELECT token_version FROM users WHERE id = $1', [userId]);
  const version = rows[0] ? rows[0].token_version : null;
  remember(userId, version);
  return version;
}

/** True when a verified app-user token payload hasn't been revoked. */
async function isTokenCurrent(payload) {
  const version = await currentVersion(payload.sub);
  // Tokens issued before this feature have no tv and count as version 0.
  return version !== null && (payload.tv ?? 0) === version;
}

/** Invalidates every token the user holds. Returns the new version. */
async function revokeAllSessions(userId) {
  await ensureColumn();
  const { rows } = await db.query(
    'UPDATE users SET token_version = token_version + 1 WHERE id = $1 RETURNING token_version',
    [userId],
  );
  const version = rows[0] ? rows[0].token_version : null;
  remember(userId, version);
  return version;
}

module.exports = { currentVersion, isTokenCurrent, revokeAllSessions };
