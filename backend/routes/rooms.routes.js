const express = require('express');
const roomController = require('../controllers/room.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/online-counts', roomController.onlineCounts);
router.get('/public', roomController.publicRooms);
router.get('/my', authenticate, roomController.myRooms);
router.get('/by-code/:code', roomController.getRoomByCode);
router.get('/:id/supporters', async (req, res, next) => {
  try {
    const db = require('../config/db');
    const r = await db.query(
      `SELECT u.id, u.full_name, u.username, u.avatar_url,
              COALESCE(SUM(e.coins * e.quantity), 0) AS total_coins
       FROM room_gift_events e
       JOIN users u ON u.id = e.sender_id
       WHERE e.room_id = $1
       GROUP BY u.id, u.full_name, u.username, u.avatar_url
       ORDER BY total_coins DESC
       LIMIT 5`,
      [req.params.id]
    );
    return res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
});
router.get('/:id', roomController.getRoom);
router.post('/', authenticate, roomController.createRoom);

module.exports = router;
