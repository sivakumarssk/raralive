const express = require('express');
const { authenticateAdmin } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/coin-package.controller');

const router = express.Router();

// Public — app fetches active packages for wallet screen
router.get('/public', ctrl.listPublicPackages);

// Admin — full CRUD
router.get('/',        authenticateAdmin, ctrl.listPackages);
router.post('/',       authenticateAdmin, ctrl.createPackage);
router.patch('/:id',   authenticateAdmin, ctrl.updatePackage);
router.delete('/:id',  authenticateAdmin, ctrl.deletePackage);

module.exports = router;
