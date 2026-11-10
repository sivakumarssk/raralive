const roomModel = require('../models/room.model');
const agencyModel = require('../models/agency.model');
const walletModel = require('../models/wallet.model');
const db = require('../config/db');
const { ROOM_NAME_MAX, charCount } = require('../utils/text-limits');
const { getAllOnlineCounts, isRoomHostOnline, notifyChatroomStatus, removeEveryoneFromRoom } = require('../socket');

/** GET /api/rooms/online-counts */
function onlineCounts(req, res) {
  return res.json({ success: true, data: getAllOnlineCounts() });
}

// Chatroom name change durations → coin cost. Kept here (not DB-driven) since
// this is a small fixed price list, same as TIME_OPTIONS/TARGET_OPTIONS in
// the app's battle-modal.tsx.
const ROOM_NAME_DURATION_PRICING = {
  1:  100,
  7:  500,
  30: 1500,
  90: 4000,
};

/** GET /api/rooms/public */
async function publicRooms(req, res, next) {
  try {
    // Only rooms in the viewer's language: their account's language (read
    // fresh, so a change applies at once), else what a guest's app sends.
    let language = null;
    if (req.user?.id) {
      const me = await db.query(`SELECT preferred_language FROM users WHERE id = $1`, [req.user.id]);
      language = me.rows[0]?.preferred_language ?? null;
    }
    if (!language && typeof req.query.language === 'string' && req.query.language.trim()) {
      language = req.query.language.trim();
    }
    const rooms = await roomModel.getPublicRooms({ language });

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
    const room = await roomModel.getRoomDetail(id);
    if (!room || room.deleted_at) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }
    return res.json({ success: true, data: room });
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
       FROM rooms r WHERE r.room_code = $1 AND r.deleted_at IS NULL`,
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
    // Revert any of this host's rooms whose paid name change has expired
    // before listing them, so a stale renamed room doesn't linger here.
    await db.query(
      `UPDATE rooms
       SET room_name = previous_room_name, previous_room_name = NULL, room_name_expires_at = NULL
       WHERE host_user_id = $1
         AND room_name_expires_at IS NOT NULL
         AND room_name_expires_at <= NOW()`,
      [userId]
    );
    const rooms = await roomModel.getRoomsByHost(userId);
    return res.json({ success: true, data: rooms });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/rooms/:id — the host deletes their own private room. Public
 * rooms can't be deleted. Soft delete: the room is only marked and disappears
 * from the app; anyone inside is sent out.
 */
async function deleteRoom(req, res, next) {
  try {
    const userId = req.user.id;
    const room = await roomModel.getRoomDetail(req.params.id);
    if (!room || room.deleted_at) return res.status(404).json({ success: false, message: 'Room not found.' });
    if (room.host_user_id !== userId) return res.status(403).json({ success: false, message: 'Only the room owner can delete this room.' });
    if (room.visibility !== 'private') return res.status(403).json({ success: false, message: 'Only private chat rooms can be deleted.' });

    await roomModel.softDeleteRoom(room.id);
    removeEveryoneFromRoom(room.id, { message: 'This chat room has been deleted by its owner.', kind: 'room_deleted' });
    notifyChatroomStatus(userId);
    return res.json({ success: true, message: 'Chat room deleted.' });
  } catch (error) {
    next(error);
  }
}

// Topic tags a room can have — the app has an icon for each.
const ROOM_TAGS = [
  'Music', 'Gaming', 'Talk', 'Comedy', 'Podcast',
  'EDM', 'Hip-Hop', 'Sports', 'News', 'Tech',
  'Chill', 'Study', 'Fitness', 'Art', 'Food',
];

function roomNameTakenMessage(visibility) {
  return visibility === 'private'
    ? 'You already have a private room with this name. Please choose a different name.'
    : 'A public room with this name already exists. Please choose a different name.';
}

const MAX_ROOM_TAGS = 2;

/** Known tags only, each once, in the order picked, at most MAX_ROOM_TAGS. */
function cleanRoomTags(tags) {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.filter(t => ROOM_TAGS.includes(t)))].slice(0, MAX_ROOM_TAGS);
}

/** POST /api/rooms — user creates a room using their agent_code */
async function createRoom(req, res, next) {
  try {
    const userId = req.user?.id;
    const { room_name, agent_code, visibility = 'public', city, state, district, tags } = req.body;

    if (!room_name) {
      return res.status(400).json({ success: false, message: 'room_name is required.' });
    }
    if (charCount(room_name.trim()) > ROOM_NAME_MAX) {
      return res.status(400).json({ success: false, message: `Chatroom name must be ${ROOM_NAME_MAX} characters or fewer.` });
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

    const userResult = await db.query(`SELECT avatar_url, gender FROM users WHERE id = $1`, [userId]);
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
        tags: cleanRoomTags(tags),
      });
    } catch (err) {
      if (err.code === 'ROOM_NAME_TAKEN') {
        return res.status(409).json({ success: false, message: roomNameTakenMessage(visibility) });
      }
      throw err;
    }

    notifyChatroomStatus(userId);

    return res.status(201).json({
      success: true,
      data: {
        id: room.id,
        room_code: room.room_code,
        room_name: room.room_name,
        description: room.description,
        room_image_url: room.room_image_url,
        host_gender: userResult.rows[0]?.gender ?? null,
        visibility: room.visibility,
        status: room.status,
        current_level: 0,
        city: room.city,
        state: room.state,
        district: room.district,
        tags: room.tags ?? [],
        agency_name: agency?.agency_name ?? null,
        created_at: room.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
}

/** POST /api/rooms/:id/rename — host pays coins for a time-limited name change */
async function renameRoom(req, res, next) {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { room_name, duration_days } = req.body;

    const newName = (room_name ?? '').trim();
    if (!newName) {
      return res.status(400).json({ success: false, message: 'room_name is required.' });
    }
    if (charCount(newName) > ROOM_NAME_MAX) {
      return res.status(400).json({ success: false, message: `Chatroom name must be ${ROOM_NAME_MAX} characters or fewer.` });
    }

    const durationDays = Number(duration_days);
    const cost = ROOM_NAME_DURATION_PRICING[durationDays];
    if (!cost) {
      return res.status(400).json({
        success: false,
        message: `duration_days must be one of: ${Object.keys(ROOM_NAME_DURATION_PRICING).join(', ')}.`,
      });
    }

    const roomResult = await db.query(`SELECT id, host_user_id, room_name, visibility FROM rooms WHERE id = $1`, [id]);
    const room = roomResult.rows[0];
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }
    if (room.host_user_id !== userId) {
      return res.status(403).json({ success: false, message: 'Only the room host can rename this room.' });
    }

    let balanceAfter;
    try {
      balanceAfter = await walletModel.debitCoins(
        userId, cost, `Chatroom name change (${durationDays} day${durationDays === 1 ? '' : 's'})`, id
      );
    } catch (err) {
      if (err.code === 'INSUFFICIENT_COINS') {
        return res.status(400).json({ success: false, code: 'INSUFFICIENT_COINS', message: 'Not enough coins for this duration.' });
      }
      throw err;
    }

    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    let updated;
    try {
      const result = await db.query(
        `UPDATE rooms
         SET previous_room_name = COALESCE(previous_room_name, room_name),
             room_name = $1,
             room_name_expires_at = $2
         WHERE id = $3
         RETURNING id, room_name, previous_room_name, room_name_expires_at`,
        [newName, expiresAt, id]
      );
      updated = result.rows[0];
    } catch (err) {
      // Roll the coin spend back if the rename itself fails (e.g. unique name clash).
      await walletModel.creditCoins(userId, cost, 'Refund: chatroom name change failed', null, id);
      if (err.code === '23505' && err.constraint?.includes('room_name')) {
        return res.status(409).json({ success: false, message: roomNameTakenMessage(room.visibility) });
      }
      throw err;
    }

    return res.json({
      success: true,
      data: {
        room_name: updated.room_name,
        previous_room_name: updated.previous_room_name,
        room_name_expires_at: updated.room_name_expires_at,
        coins_spent: cost,
        balance_after: balanceAfter,
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

module.exports = {
  onlineCounts, publicRooms, publicRoomsForBattle, getRoom, getRoomByCode, myRooms, createRoom, renameRoom, deleteRoom,
  ROOM_NAME_DURATION_PRICING,
};
