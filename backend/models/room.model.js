const crypto = require('crypto');
const db = require('../config/db');

function generateRoomCode() {
  return 'RM-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

async function createRoom({ roomName, description, agencyId, hostUserId, roomImageUrl, visibility, createdBy }) {
  // Ensure unique room_code
  let roomCode;
  for (let i = 0; i < 10; i++) {
    roomCode = generateRoomCode();
    const exists = await db.query('SELECT id FROM rooms WHERE room_code = $1', [roomCode]);
    if (!exists.rows.length) break;
  }

  try {
    const result = await db.query(
      `INSERT INTO rooms (room_code, room_name, description, agency_id, host_user_id, room_image_url, visibility, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, room_code, room_name, description, agency_id, host_user_id, room_image_url, visibility, status, created_at`,
      [roomCode, roomName, description || null, agencyId, hostUserId, roomImageUrl || null, visibility || 'public', createdBy || null]
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
  const conds = ['($1 = \'\' OR r.room_name ILIKE $2 OR a.agency_name ILIKE $2)'];
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

async function getRoomsByHost(hostUserId) {
  const result = await db.query(
    `SELECT r.id, r.room_name, r.description, r.room_image_url, r.visibility, r.status,
            r.current_level, r.created_at,
            a.agency_name
     FROM rooms r
     LEFT JOIN agencies a ON r.agency_id = a.id
     WHERE r.host_user_id = $1 AND r.status = 'active'
     ORDER BY r.created_at DESC`,
    [hostUserId]
  );
  return result.rows;
}

async function getPublicRooms() {
  const result = await db.query(
    `SELECT r.id, r.room_name, r.room_image_url, r.current_level
     FROM rooms r
     WHERE r.visibility = 'public' AND r.status = 'active'
     ORDER BY r.total_coins_received DESC, r.created_at DESC`
  );
  return result.rows;
}

async function hasRoomOfVisibility(hostUserId, visibility) {
  const result = await db.query(
    `SELECT id FROM rooms WHERE host_user_id = $1 AND visibility = $2 AND status = 'active' LIMIT 1`,
    [hostUserId, visibility]
  );
  return result.rows.length > 0;
}

module.exports = { createRoom, listRooms, getRoomsCountByAgency, getRoomsByHost, hasRoomOfVisibility, getPublicRooms };
