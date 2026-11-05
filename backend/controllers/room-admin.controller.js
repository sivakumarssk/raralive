const roomModel = require('../models/room.model');

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

module.exports = { listRooms };
