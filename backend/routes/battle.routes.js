const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const {
  sendBattleInvite,
  acceptBattleInvite,
  declineBattleInvite,
  startBattle,
  getMyInvites,
  getInviteDetail,
  getNotifications,
  markNotificationsRead,
  getUnreadCount,
  getBattleScores,
  getBattleTopGifters,
  getUnseenFinishedBattle,
  markBattleResultSeen,
} = require('../controllers/battle.controller');

const router = express.Router();

// Battle invites
router.post('/invite', authenticate, sendBattleInvite);
router.post('/accept', authenticate, acceptBattleInvite);
router.post('/decline', authenticate, declineBattleInvite);
router.post('/start', authenticate, startBattle);
router.get('/my-invites', authenticate, getMyInvites);
router.get('/invite/:inviteId', authenticate, getInviteDetail);
router.get('/scores/:invite_id', authenticate, getBattleScores);
router.get('/top-gifters/:invite_id', authenticate, getBattleTopGifters);
router.get('/unseen-result', authenticate, getUnseenFinishedBattle);
router.post('/mark-result-seen', authenticate, markBattleResultSeen);

// Notifications
router.get('/notifications/unread-count', authenticate, getUnreadCount);
router.get('/notifications', authenticate, getNotifications);
router.post('/notifications/read', authenticate, markNotificationsRead);

module.exports = router;