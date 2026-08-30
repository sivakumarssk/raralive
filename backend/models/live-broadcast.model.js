const crypto = require('crypto');
const db = require('../config/db');

function generateRoomCode() {
  return 'RM-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

// Broadcast rooms are private and agency-less — they exist purely to host
// the socket/chat/seat plumbing for a Go-Live session, not to appear in the
// public/agency chat-room directory.
async function createBroadcastRoom({ hostUserId, roomName, roomImageUrl }) {
  let roomCode;
  for (let i = 0; i < 10; i++) {
    roomCode = generateRoomCode();
    const exists = await db.query('SELECT id FROM rooms WHERE room_code = $1', [roomCode]);
    if (!exists.rows.length) break;
  }
  // room_name is globally UNIQUE — suffix with the code to avoid collisions
  // across repeated go-live sessions from the same or different hosts.
  const uniqueName = `${roomName} · ${roomCode}`;

  const roomResult = await db.query(
    `INSERT INTO rooms (room_code, room_name, agency_id, host_user_id, room_image_url, visibility, status)
     VALUES ($1, $2, NULL, $3, $4, 'private', 'active')
     RETURNING id, room_code`,
    [roomCode, uniqueName, hostUserId, roomImageUrl || null]
  );
  const room = roomResult.rows[0];

  const channelName = `live_${room.id}`;
  const broadcastResult = await db.query(
    `INSERT INTO live_broadcasts (room_id, host_user_id, channel_name)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [room.id, hostUserId, channelName]
  );

  return { broadcast: broadcastResult.rows[0], roomId: room.id, roomCode: room.room_code, channelName };
}

async function getActiveBroadcastForHost(hostUserId) {
  const r = await db.query(
    `SELECT * FROM live_broadcasts WHERE host_user_id = $1 AND status = 'active' ORDER BY started_at DESC LIMIT 1`,
    [hostUserId]
  );
  return r.rows[0] || null;
}

async function getBroadcastById(id) {
  const r = await db.query(`SELECT * FROM live_broadcasts WHERE id = $1`, [id]);
  return r.rows[0] || null;
}

async function getBroadcastByRoomId(roomId) {
  const r = await db.query(`SELECT * FROM live_broadcasts WHERE room_id = $1 AND status = 'active'`, [roomId]);
  return r.rows[0] || null;
}

async function incrementLikes(broadcastId, by = 1) {
  const r = await db.query(
    `UPDATE live_broadcasts SET likes_count = GREATEST(0, likes_count + $2) WHERE id = $1 AND status = 'active' RETURNING likes_count`,
    [broadcastId, by]
  );
  return r.rows[0]?.likes_count ?? null;
}

async function endBroadcast(id) {
  const r = await db.query(
    `UPDATE live_broadcasts SET status = 'ended', ended_at = NOW() WHERE id = $1 AND status = 'active' RETURNING *`,
    [id]
  );
  if (r.rows.length) {
    await db.query(`UPDATE rooms SET status = 'closed' WHERE id = $1`, [r.rows[0].room_id]);
  }
  return r.rows[0] || null;
}

// Live Now grid — active broadcasts with room + host display info
async function listActiveBroadcasts({ limit = 50, offset = 0 } = {}) {
  const r = await db.query(
    `SELECT lb.id, lb.room_id, lb.channel_name, lb.started_at,
            r.room_name, r.room_image_url,
            u.id AS host_user_id, u.full_name AS host_name, u.username AS host_username, u.avatar_url AS host_avatar_url
     FROM live_broadcasts lb
     JOIN rooms r ON r.id = lb.room_id
     JOIN users u ON u.id = lb.host_user_id
     WHERE lb.status = 'active'
     ORDER BY lb.started_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return r.rows;
}

module.exports = {
  createBroadcastRoom, getActiveBroadcastForHost, getBroadcastById, getBroadcastByRoomId,
  endBroadcast, listActiveBroadcasts, incrementLikes,
};
