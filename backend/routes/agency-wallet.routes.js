const express = require('express');
const { authenticate, authenticateAdmin } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/agency-wallet.controller');

const router = express.Router();

// ── App routes (logged-in agency user) ───────────────────────────────────────
router.get('/me', authenticate, ctrl.getMyWallet);
router.get('/transactions', authenticate, ctrl.getMyTransactions);
router.get('/lookup', authenticate, ctrl.lookupUser);
router.post('/recharge', authenticate, ctrl.rechargeUser);
router.get('/requests', authenticate, ctrl.getMyRequests);
router.post('/requests', authenticate, ctrl.createRequest);

// ── Admin routes ──────────────────────────────────────────────────────────────
router.get('/admin/requests', authenticateAdmin, ctrl.adminListRequests);
router.patch('/admin/requests/:id', authenticateAdmin, ctrl.adminProcessRequest);
router.get('/admin/transactions', authenticateAdmin, ctrl.adminListTransactions);
router.get('/admin/agencies/:id', authenticateAdmin, ctrl.adminGetAgencyWallet);
router.post('/admin/agencies/:id/credit', authenticateAdmin, ctrl.adminCreditAgency);

module.exports = router;
