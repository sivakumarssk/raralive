const roomModel = require('../models/room.model');
const agencyModel = require('../models/agency.model');
const db = require('../config/db');
const { getAllOnlineCounts, isRoomHostOnline } = require('../socket');

/** GET /api/rooms/online-counts */
function onlineCounts(req, res) {
  return res.json({ success: true, data: getAllOnlineCounts() });
}

/** GET /api/rooms/public */
async function publicRooms(req, res, next) {
  try {
    const rooms = await roomModel.getPublicRooms();

    // If user is authenticated, filter out rooms where they are blocked
    const userId = req.user?.id;
    if (userId) {
      const blocked = await db.query(
        `SELECT room_id FROM room_blocked_users WHERE user_id = $1`,
        [userId]
      );
      const blockedRoomIds = new Set(blocked.rows.map(r => r.room_id));
      const filtered = rooms.filter(r => !blockedRoomIds.has(r.id));
      return res.json({ success: true, data: filtered });
    }

    return res.json({ success: true, data: rooms });
  } catch (error) {
    next(error);
  }
}

/** GET /api/rooms/:id */
async function getRoom(req, res, next) {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT r.id, r.room_code, r.room_name, r.room_image_url, r.visibility, r.status, r.host_user_id,
              r.current_level, r.total_coins_received,
              a.agency_name,
              u.full_name AS host_name, u.username AS host_username, u.avatar_url AS host_avatar_url,
              lb.likes_count
       FROM rooms r
       LEFT JOIN agencies a ON a.id = r.agency_id
       LEFT JOIN live_broadcasts lb ON lb.room_id = r.id AND lb.status = 'active'
       JOIN users u ON u.id = r.host_user_id
       WHERE r.id = $1`,
      [id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
}

/** GET /api/rooms/by-code/:code — resolve room_code → id for deep links */
async function getRoomByCode(req, res, next) {
  try {
    const { code } = req.params;
    const result = await db.query(
      `SELECT r.id, r.room_code, r.room_name, r.room_image_url, r.status
       FROM rooms r WHERE r.room_code = $1`,
      [code.toUpperCase()]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
}

/** GET /api/rooms/my */
async function myRooms(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized.' });
    const rooms = await roomModel.getRoomsByHost(userId);
    return res.json({ success: true, data: rooms });
  } catch (error) {
    next(error);
  }
}

/** POST /api/rooms — user creates a room using their agent_code */
async function createRoom(req, res, next) {
  try {
    const userId = req.user?.id;
    const { room_name, agent_code, visibility = 'public', city, state, district } = req.body;

    if (!room_name) {
      return res.status(400).json({ success: false, message: 'room_name is required.' });
    }
    if (visibility === 'public' && !agent_code) {
      return res.status(400).json({ success: false, message: 'agent_code is required for public rooms.' });
    }
    if (!['public', 'private'].includes(visibility)) {
      return res.status(400).json({ success: false, message: 'visibility must be public or private.' });
    }

    // Enforce one room per visibility type per user
    const alreadyHas = await roomModel.hasRoomOfVisibility(userId, visibility);
    if (alreadyHas) {
      return res.status(409).json({
        success: false,
        message: `You already have an active ${visibility} room.`,
      });
    }

    let agency = null;
    if (visibility === 'public') {
      agency = await agencyModel.findByAgentCode(agent_code.trim().toUpperCase());
      if (!agency || agency.status !== 'active') {
        return res.status(400).json({ success: false, message: 'Invalid or inactive agent code.' });
      }
    } else {
      // Private room — try to inherit agency from existing public room
      const publicRoom = await db.query(
        `SELECT r.agency_id, a.agency_name FROM rooms r
         JOIN agencies a ON a.id = r.agency_id
         WHERE r.host_user_id = $1 AND r.visibility = 'public' AND r.status = 'active'
         LIMIT 1`,
        [userId]
      );
      if (publicRoom.rows.length > 0) {
        agency = { id: publicRoom.rows[0].agency_id, agency_name: publicRoom.rows[0].agency_name };
      } else if (agent_code) {
        agency = await agencyModel.findByAgentCode(agent_code.trim().toUpperCase());
        if (!agency || agency.status !== 'active') {
          return res.status(400).json({ success: false, message: 'Invalid or inactive agent code.' });
        }
      }
      // No agency is fine for private rooms — agency_id is nullable
    }

    const userResult = await db.query(`SELECT avatar_url FROM users WHERE id = $1`, [userId]);
    const avatarUrl = userResult.rows[0]?.avatar_url || null;

    let room;
    try {
      room = await roomModel.createRoom({
        roomName: room_name.trim(),
        description: null,
        agencyId: agency?.id ?? null,
        hostUserId: userId,
        roomImageUrl: avatarUrl,
        visibility,
        city: city?.trim() || null,
        state: state?.trim() || null,
        district: district?.trim() || null,
        createdBy: null,
      });
    } catch (err) {
      if (err.code === 'ROOM_NAME_TAKEN') {
        return res.status(409).json({ success: false, message: 'A room with this name already exists. Please choose a different name.' });
      }
      throw err;
    }

    return res.status(201).json({
      success: true,
      data: {
        id: room.id,
        room_code: room.room_code,
        room_name: room.room_name,
        description: room.description,
        room_image_url: room.room_image_url,
        visibility: room.visibility,
        status: room.status,
        city: room.city,
        state: room.state,
        district: room.district,
        agency_name: agency?.agency_name ?? null,
        created_at: room.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
}

/** GET /api/rooms/public-for-battle?exclude_room_id=X */
async function publicRoomsForBattle(req, res, next) {
  try {
    const { exclude_room_id } = req.query;
    const rooms = await roomModel.getPublicRooms();
    // Only show active public rooms whose host is currently live in the room,
    // excluding the requester's own room — a battle invite is useless if the
    // host isn't there to accept it.
    const filtered = rooms.filter(r => r.id !== exclude_room_id && isRoomHostOnline(r.id));
    return res.json({ success: true, data: filtered });
  } catch (error) {
    next(error);
  }
}

module.exports = { onlineCounts, publicRooms, publicRoomsForBattle, getRoom, getRoomByCode, myRooms, createRoom };
