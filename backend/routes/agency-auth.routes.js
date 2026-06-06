const express = require('express');
const { authenticateAgency } = require('../middleware/auth.middleware');
const agencyAuthController = require('../controllers/agency-auth.controller');

const router = express.Router();

// Public
router.get('/validate/:code', agencyAuthController.validateAgentCode);
router.post('/login', agencyAuthController.loginAgency);

// Protected (requires agency JWT)
router.post('/reset-password', authenticateAgency, agencyAuthController.resetPassword);

module.exports = router;
