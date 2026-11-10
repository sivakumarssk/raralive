const crypto = require('crypto');
const db = require('../config/db');
const stageBgModel = require('./stage-bg.model');

// Go Live creates a private `rooms` row per broadcast session (see
// live-broadcast.model.js). Those are session plumbing, not chatrooms, so
// chatroom lists and the one-room-per-visibility rule skip them.
const NOT_BROADCAST_ROOM = 'NOT EXISTS (SELECT 1 FROM live_broadcasts lb WHERE lb.room_id = r.id)';

// deleted_at: a host can delete their own private room. It's only marked (and
// status 'closed' so every "active rooms" query drops it) — the row and its
// history stay in the database.
// tags: the topic tags picked when creating the room (shown in room lists).
// Room names (case-insensitive) only clash with rooms that are still active:
// public names are unique among public rooms; a private room is personal, so
// its name only has to differ from the same host's other private rooms.
// Deleted or closed rooms never hold a name.
let columnsReady = null;
function ensureRoomColumns() {
  if (!columnsReady) {
    columnsReady = db.query(`
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
      DROP INDEX IF EXISTS idx_rooms_room_name_unique;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_public_room_name
        ON rooms (lower(room_name)) WHERE visibility = 'public' AND status = 'active' AND deleted_at IS NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_private_room_name
        ON rooms (host_user_id, lower(room_name)) WHERE visibility = 'private' AND status = 'active' AND deleted_at IS NULL;
    `).catch((err) => { columnsReady = null; throw err; });
  }
  return columnsReady;
}

function generateRoomCode() {
  return 'RM-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

async function createRoom({ roomName, description, agencyId, hostUserId, roomImageUrl, visibility, city, state, district, createdBy, tags = [] }) {
  await ensureRoomColumns();
  // Ensure unique room_code
  let roomCode;
  for (let i = 0; i < 10; i++) {
    roomCode = generateRoomCode();
    const exists = await db.query('SELECT id FROM rooms WHERE room_code = $1', [roomCode]);
    if (!exists.rows.length) break;
  }

  try {
    const result = await db.query(
      `INSERT INTO rooms (room_code, room_name, description, agency_id, host_user_id, room_image_url, visibility, city, state, district, created_by, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, room_code, room_name, description, agency_id, host_user_id, room_image_url, visibility, status, city, state, district, tags, created_at`,
      [roomCode, roomName, description || null, agencyId, hostUserId, roomImageUrl || null, visibility || 'public', city || null, state || null, district || null, createdBy || null, tags]
    );
    return result.rows[0];
  } catch (err) {
    if (err.code === '23505' && err.constraint?.includes('room_name')) {
      throw Object.assign(new Error('A room with this name already exists.'), { code: 'ROOM_NAME_TAKEN' });
    }
    throw err;
  }
}

async function listRooms({ limit = 50, offset = 0, search = '', visibility = '', status = '' }) {
  const searchParam = `%${search}%`;
  const conds = ['($1 = \'\' OR r.room_name ILIKE $2 OR a.agency_name ILIKE $2)', NOT_BROADCAST_ROOM];
  const vals = [search, searchParam];
  let i = 3;
  if (visibility) { conds.push(`r.visibility = $${i++}`); vals.push(visibility); }
  if (status)     { conds.push(`r.status = $${i++}`);     vals.push(status); }

  const result = await db.query(
    `SELECT r.id, r.room_name, r.description, r.room_image_url, r.visibility, r.status, r.created_at,
            a.id AS agency_id, a.agency_name,
            u.id AS host_id, u.full_name AS host_name, u.username AS host_username,
            u.phone AS host_phone, u.avatar_url AS host_avatar_url
     FROM rooms r
     LEFT JOIN agencies a ON r.agency_id = a.id
     JOIN users u ON r.host_user_id = u.id
     WHERE ${conds.join(' AND ')}
     ORDER BY r.created_at DESC
     LIMIT $${i++} OFFSET $${i++}`,
    [...vals, limit, offset]
  );
  const count = await db.query(
    `SELECT COUNT(*) FROM rooms r
     LEFT JOIN agencies a ON r.agency_id = a.id
     WHERE ${conds.join(' AND ')}`,
    vals
  );
  return { rows: result.rows, total: parseInt(count.rows[0].count, 10) };
}

async function getRoomsCountByAgency() {
  const result = await db.query(
    `SELECT agency_id, COUNT(*) AS room_count FROM rooms GROUP BY agency_id`
  );
  const map = {};
  for (const row of result.rows) {
    map[row.agency_id] = parseInt(row.room_count, 10);
  }
  return map;
}

// A room's picture is its host's current profile picture, read live (h =
// the host's users row) so a new photo shows at once. No photo → null, and
// the app shows the same default avatar as the profile, picked by gender.
const HOST_PICTURE = 'h.avatar_url AS room_image_url, h.gender AS host_gender';

async function getRoomsByHost(hostUserId) {
  await ensureRoomColumns();
  const result = await db.query(
    `SELECT r.id, r.room_name, r.description, ${HOST_PICTURE}, r.visibility, r.status,
            r.current_level, r.city, r.state, r.district, r.tags, r.created_at,
            a.agency_name
     FROM rooms r
     JOIN users h ON h.id = r.host_user_id
     LEFT JOIN agencies a ON r.agency_id = a.id
     WHERE r.host_user_id = $1 AND r.status = 'active' AND ${NOT_BROADCAST_ROOM}
     ORDER BY r.created_at DESC`,
    [hostUserId]
  );
  return result.rows;
}

// A room's language is its host's current app language — read live from the
// host's account, so changing language moves all their rooms with them.
// Hosts who never picked one count as English (the old default).
const ROOM_LANGUAGE = `COALESCE(h.preferred_language, 'en')`;

/** Active public rooms; pass `language` to list only rooms in that language. */
async function getPublicRooms({ language = null } = {}) {
  await ensureRoomColumns();
  const result = await db.query(
    `SELECT r.id, r.room_name, ${HOST_PICTURE}, r.current_level, r.city, r.state, r.district, r.tags,
            ${ROOM_LANGUAGE} AS language
     FROM rooms r
     JOIN users h ON h.id = r.host_user_id
     WHERE r.visibility = 'public' AND r.status = 'active'
       AND ($1::text IS NULL OR ${ROOM_LANGUAGE} = $1)
     ORDER BY r.total_coins_received DESC, r.created_at DESC`,
    [language]
  );
  return result.rows;
}

async function hasRoomOfVisibility(hostUserId, visibility) {
  const result = await db.query(
    `SELECT r.id FROM rooms r
     WHERE r.host_user_id = $1 AND r.visibility = $2 AND r.status = 'active' AND ${NOT_BROADCAST_ROOM}
     LIMIT 1`,
    [hostUserId, visibility]
  );
  return result.rows.length > 0;
}

/**
 * Lazy-expiry for a paid room-name change — no scheduled job, just a
 * conditional UPDATE run whenever the room is read, reverting room_name back
 * to previous_room_name once room_name_expires_at has passed.
 */
async function applyRoomNameExpiry(roomId) {
  await db.query(
    `UPDATE rooms
     SET room_name = previous_room_name, previous_room_name = NULL, room_name_expires_at = NULL
     WHERE id = $1
       AND room_name_expires_at IS NOT NULL
       AND room_name_expires_at <= NOW()`,
    [roomId]
  );
}

/**
 * Room header/detail data — shared by GET /rooms/:id and the socket join_room
 * snapshot. Includes the room's stage background (stage_bg_url, kept for 24h;
 * stage_bg_expires_at is when the next one takes over).
 */
async function getRoomDetail(roomId) {
  await ensureRoomColumns();
  await applyRoomNameExpiry(roomId);
  const stageBg = await stageBgModel.getRoomStageBackground(roomId).catch(e => {
    console.error('stage background error:', e.message);
    return null;
  });
  const result = await db.query(
    `SELECT r.id, r.room_code, r.room_name, r.room_image_url, r.visibility, r.status, r.host_user_id,
            r.current_level, r.total_coins_received, r.deleted_at,
            r.previous_room_name, r.room_name_expires_at,
            r.agency_id, a.agency_name,
            u.full_name AS host_name, u.username AS host_username, u.avatar_url AS host_avatar_url,
            lb.likes_count
     FROM rooms r
     LEFT JOIN agencies a ON a.id = r.agency_id
     LEFT JOIN live_broadcasts lb ON lb.room_id = r.id AND lb.status = 'active'
     JOIN users u ON u.id = r.host_user_id
     WHERE r.id = $1`,
    [roomId]
  );
  const room = result.rows[0];
  if (!room) return null;
  return { ...room, stage_bg_url: stageBg?.image_url ?? null, stage_bg_expires_at: stageBg?.expires_at ?? null };
}

/**
 * A room's picture is its host's profile picture (copied in at creation —
 * rooms have no image of their own). Called whenever the host changes their
 * picture so every room list shows the new one.
 */
async function syncHostRoomImage(hostUserId, avatarUrl) {
  await db.query(
    `UPDATE rooms SET room_image_url = $2 WHERE host_user_id = $1 AND room_image_url IS DISTINCT FROM $2`,
    [hostUserId, avatarUrl]
  );
}

/** Marks a room deleted. The caller checks it's the host's own private room. */
async function softDeleteRoom(roomId) {
  await ensureRoomColumns();
  await db.query(`UPDATE rooms SET deleted_at = NOW(), status = 'closed' WHERE id = $1 AND deleted_at IS NULL`, [roomId]);
}

module.exports = { softDeleteRoom, createRoom, listRooms, getRoomsCountByAgency, getRoomsByHost, hasRoomOfVisibility, getPublicRooms, applyRoomNameExpiry, getRoomDetail, syncHostRoomImage };
