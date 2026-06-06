const express = require('express');
const { authenticate, authenticateAdmin } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/wallet.controller');

const router = express.Router();

// User routes
router.get('/me',                 authenticate, ctrl.getMyWallet);
router.get('/me/transactions',    authenticate, ctrl.getMyTransactions);

// Admin routes
router.post('/recharge',                        authenticateAdmin, ctrl.adminRecharge);
router.get('/user/:userId',                     authenticateAdmin, ctrl.adminGetUserWallet);
router.get('/user/:userId/transactions',        authenticateAdmin, ctrl.adminGetUserTransactions);

module.exports = router;
