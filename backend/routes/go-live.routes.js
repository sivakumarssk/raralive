const express = require('express');
const { authenticate, authenticateAdmin } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/go-live.controller');

const router = express.Router();

// ── App routes ────────────────────────────────────────────────────────────────
router.post('/apply', authenticate, ctrl.apply);
router.get('/my-status', authenticate, ctrl.getMyStatus);
router.post('/broadcast/start', authenticate, ctrl.startBroadcast);
router.post('/broadcast/end', authenticate, ctrl.endBroadcast);
router.get('/broadcast/active', authenticate, ctrl.listActiveBroadcasts);

// ── Admin routes ──────────────────────────────────────────────────────────────
router.get('/admin', authenticateAdmin, ctrl.listRequests);
router.get('/admin/:id', authenticateAdmin, ctrl.getRequest);
router.patch('/admin/:id/status', authenticateAdmin, ctrl.updateStatus);

module.exports = router;
