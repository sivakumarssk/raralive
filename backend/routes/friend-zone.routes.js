const express = require('express');
const { authenticate, authenticateAdmin } = require('../middleware/auth.middleware');
const { uploadFriendZone } = require('../middleware/upload.middleware');
const ctrl = require('../controllers/friend-zone.controller');

const router = express.Router();

// ── App routes ────────────────────────────────────────────────────────────────
router.post('/apply', authenticate, uploadFriendZone.array('photos', 3), ctrl.apply);
router.get('/my-status', authenticate, ctrl.getMyStatus);
router.patch('/my-application', authenticate, uploadFriendZone.array('photos', 3), ctrl.updateMyApplication);
router.patch('/my-toggles', authenticate, ctrl.updateMyToggles);
router.get('/friends', authenticate, ctrl.getPublicFriends);
router.get('/call-history', authenticate, ctrl.getCallHistory);

// ── Admin routes ──────────────────────────────────────────────────────────────
// /admin/calls and /admin/gifts must come before /admin/:id, otherwise
// Express would match "calls"/"gifts" as the :id param and shadow these
// routes entirely.
router.get('/admin/calls', authenticateAdmin, ctrl.listCalls);
router.get('/admin/gifts', authenticateAdmin, ctrl.listCallGifts);
router.get('/admin', authenticateAdmin, ctrl.listApplications);
router.get('/admin/:id', authenticateAdmin, ctrl.getApplication);
router.patch('/admin/:id/status', authenticateAdmin, ctrl.updateStatus);

module.exports = router;
