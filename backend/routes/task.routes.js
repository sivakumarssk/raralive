const express = require('express');
const { authenticate, authenticateAdmin } = require('../middleware/auth.middleware');
const { uploadShopGift } = require('../middleware/upload.middleware');
const ctrl = require('../controllers/task.controller');

const { userGiftHistory, roomGiftHistory, getMyGems, getMyGemHistory } = require('../controllers/gift-history.controller');

const router = express.Router();

// ── App routes ────────────────────────────────────────────────────────────────
router.get('/my',           authenticate, ctrl.getMyTasks);
router.post('/claim',       authenticate, ctrl.claimReward);
router.get('/gems',         authenticate, getMyGems);
router.get('/gem-history',  authenticate, getMyGemHistory);
router.get('/top-hosts',    authenticate, ctrl.getTopHosts);
router.get('/winners',      authenticate, ctrl.getWinners);

// ── Admin routes ──────────────────────────────────────────────────────────────
router.get('/admin',         authenticateAdmin, ctrl.listTasks);
router.post('/admin',        authenticateAdmin, uploadShopGift.single('icon_image'), ctrl.createTask);
router.patch('/admin/:id',   authenticateAdmin, uploadShopGift.single('icon_image'), ctrl.updateTask);
router.delete('/admin/:id',  authenticateAdmin, ctrl.deleteTask);

// Gift history (admin)
router.get('/admin/gift-history/user/:userId', authenticateAdmin, userGiftHistory);
router.get('/admin/gift-history/room/:roomId', authenticateAdmin, roomGiftHistory);

module.exports = router;
