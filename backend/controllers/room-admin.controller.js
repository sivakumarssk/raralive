const roomModel = require('../models/room.model');
const agencyModel = require('../models/agency.model');
const db = require('../config/db');

/** GET /api/admin/rooms/agencies — active agencies for dropdown */
async function listActiveAgencies(req, res, next) {
  try {
    const { rows } = await agencyModel.listAgencies({ limit: 200, offset: 0, search: '' });
    const active = rows.filter(a => a.status === 'active');
    return res.json({
      success: true,
      data: active.map(a => ({ id: a.id, agency_name: a.agency_name, agent_code: a.agent_code })),
    });
  } catch (error) {
    next(error);
  }
}

/** GET /api/admin/rooms/users/search?q= — user search for host picker */
async function searchUsers(req, res, next) {
  try {
    const { q = '' } = req.query;
    const searchParam = `%${q}%`;
    const result = await db.query(
      `SELECT id, full_name, username, phone, avatar_url
       FROM users
       WHERE $1 = '' OR full_name ILIKE $2 OR username ILIKE $2 OR phone ILIKE $2
       ORDER BY created_at DESC LIMIT 20`,
      [q, searchParam]
    );
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
}

/** POST /api/admin/rooms */
async function createRoom(req, res, next) {
  try {
    const { room_name, description, agency_id, host_user_id } = req.body;
    if (!room_name || !agency_id || !host_user_id) {
      return res.status(400).json({ success: false, message: 'room_name, agency_id, and host_user_id are required.' });
    }

    const agency = await agencyModel.getAgencyById(agency_id);
    if (!agency || agency.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Invalid or inactive agency.' });
    }

    const userResult = await db.query(
      `SELECT id, full_name, username, phone, avatar_url FROM users WHERE id = $1`,
      [host_user_id]
    );
    if (!userResult.rows.length) {
      return res.status(400).json({ success: false, message: 'Host user not found.' });
    }
    const hostUser = userResult.rows[0];

    const room = await roomModel.createRoom({
      roomName: room_name.trim(),
      description: description?.trim() || null,
      agencyId: agency_id,
      hostUserId: host_user_id,
      roomImageUrl: hostUser.avatar_url || null,
      visibility: 'public',
      createdBy: req.admin?.id || null,
    });

    return res.status(201).json({
      success: true,
      data: { ...room, agency_name: agency.agency_name },
    });
  } catch (error) {
    next(error);
  }
}

/** GET /api/admin/rooms */
async function listRooms(req, res, next) {
  try {
    const { search = '', page = '1', limit = '50', visibility = '', status = '' } = req.query;
    const limitNum = Math.min(parseInt(limit, 10) || 50, 200);
    const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limitNum;

    const { rows, total } = await roomModel.listRooms({ limit: limitNum, offset, search, visibility, status });
    const agencyRoomCounts = await roomModel.getRoomsCountByAgency();

    return res.json({
      success: true,
      data: {
        rooms: rows,
        agency_room_counts: agencyRoomCounts,
        pagination: { total, page: parseInt(page, 10), limit: limitNum, pages: Math.ceil(total / limitNum) },
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { listActiveAgencies, searchUsers, createRoom, listRooms };
