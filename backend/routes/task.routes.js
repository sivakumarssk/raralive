const express = require('express');
const { authenticate, authenticateAdmin } = require('../middleware/auth.middleware');
const { uploadTask } = require('../middleware/upload.middleware');
const ctrl = require('../controllers/task.controller');
const { userGiftHistory, roomGiftHistory, getMyGems, getMyGemHistory } = require('../controllers/gift-history.controller');

const router = express.Router();

const taskUpload = uploadTask.fields([
  { name: 'icon_image',        maxCount: 1 },
  { name: 'reward_bg_image',   maxCount: 1 },
  { name: 'reward_frame_image', maxCount: 1 },
]);

// ── App routes ────────────────────────────────────────────────────────────────
router.get('/my',             authenticate, ctrl.getMyTasks);
router.post('/claim',         authenticate, ctrl.claimReward);
router.get('/active-reward',  authenticate, ctrl.getActiveReward);
router.get('/gems',           authenticate, getMyGems);
router.get('/gem-history',    authenticate, getMyGemHistory);
router.get('/top-hosts',      authenticate, ctrl.getTopHosts);
router.get('/winners',        authenticate, ctrl.getWinners);
router.get('/top-gifters',    authenticate, ctrl.getTopGifters);

// ── Admin routes ──────────────────────────────────────────────────────────────
router.get('/admin',          authenticateAdmin, ctrl.listTasks);
router.post('/admin',         authenticateAdmin, taskUpload, ctrl.createTask);
router.patch('/admin/:id',    authenticateAdmin, taskUpload, ctrl.updateTask);
router.delete('/admin/:id',   authenticateAdmin, ctrl.deleteTask);

// Gift history (admin)
router.get('/admin/gift-history/user/:userId', authenticateAdmin, userGiftHistory);
router.get('/admin/gift-history/room/:roomId', authenticateAdmin, roomGiftHistory);

module.exports = router;
