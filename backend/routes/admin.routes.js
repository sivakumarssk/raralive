const express = require('express');
const adminController = require('../controllers/admin.controller');
const userAdminController = require('../controllers/user-admin.controller');
const { authenticateAdmin } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/register', adminController.registerAdmin);
router.post('/login', adminController.loginAdmin);

router.get('/users', authenticateAdmin, userAdminController.listUsers);

// Agency rooms + coin history
router.get('/agencies/:id/rooms',   authenticateAdmin, async (req, res, next) => {
  try {
    const db = require('../config/db');
    const { visibility, status } = req.query;
    const conds = ['r.agency_id = $1']; const vals = [req.params.id]; let i = 2;
    if (visibility) { conds.push(`r.visibility = $${i++}`); vals.push(visibility); }
    if (status)     { conds.push(`r.status = $${i++}`);     vals.push(status); }
    const r = await db.query(
      `SELECT r.id, r.room_name, r.room_code, r.visibility, r.status,
              r.total_coins_received, r.current_level, r.created_at,
              u.full_name AS host_name, u.username AS host_username, u.phone AS host_phone
       FROM rooms r JOIN users u ON u.id = r.host_user_id
       WHERE ${conds.join(' AND ')}
       ORDER BY r.created_at DESC`,
      vals
    );
    return res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
});

router.get('/agencies/:id/coin-history', authenticateAdmin, async (req, res, next) => {
  try {
    const db = require('../config/db');
    const { from, to } = req.query;
    const conds = [`r.agency_id = $1`]; const vals = [req.params.id]; let i = 2;
    if (from) { conds.push(`e.created_at >= $${i++}`); vals.push(from); }
    if (to)   { conds.push(`e.created_at <= $${i++}`); vals.push(to + 'T23:59:59Z'); }
    const r = await db.query(
      `SELECT e.id, e.coins, e.quantity, e.gift_name, e.gift_image_url, e.created_at,
              r.room_name, r.id AS room_id,
              s.full_name AS sender_name, s.username AS sender_username,
              rec.full_name AS recipient_name, rec.username AS recipient_username
       FROM room_gift_events e
       JOIN rooms r ON r.id = e.room_id
       JOIN users s ON s.id = e.sender_id
       JOIN users rec ON rec.id = e.recipient_id
       WHERE ${conds.join(' AND ')}
       ORDER BY e.created_at DESC
       LIMIT 200`,
      vals
    );
    const totals = await db.query(
      `SELECT COALESCE(SUM(e.coins * e.quantity), 0) AS total_coins, COUNT(*) AS total_gifts
       FROM room_gift_events e
       JOIN rooms r ON r.id = e.room_id
       WHERE r.agency_id = $1`,
      [req.params.id]
    );
    return res.json({
      success: true,
      data: r.rows,
      total_coins: parseInt(totals.rows[0].total_coins, 10),
      total_gifts: parseInt(totals.rows[0].total_gifts, 10),
    });
  } catch (err) { next(err); }
});

module.exports = router;
