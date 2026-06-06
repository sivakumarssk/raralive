const userModel = require('../models/user.model');

/** GET /api/admin/users */
async function listUsers(req, res, next) {
  try {
    const { search = '', page = '1', limit = '50' } = req.query;
    const limitNum = Math.min(parseInt(limit, 10) || 50, 200);
    const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limitNum;

    const { rows, total } = await userModel.listUsers({ limit: limitNum, offset, search });

    return res.json({
      success: true,
      data: {
        users: rows,
        pagination: { total, page: parseInt(page, 10), limit: limitNum, pages: Math.ceil(total / limitNum) },
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { listUsers };
