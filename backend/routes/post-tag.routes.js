const express = require('express');
const { authenticateAdmin } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/post-tag.controller');

const router = express.Router();

// App
router.get('/', ctrl.listPublic);
router.get('/trending', ctrl.listTrending);

// Admin
router.get('/admin', authenticateAdmin, ctrl.adminList);
router.post('/admin', authenticateAdmin, ctrl.adminCreate);
router.patch('/admin/:id', authenticateAdmin, ctrl.adminUpdate);
router.delete('/admin/:id', authenticateAdmin, ctrl.adminDelete);

module.exports = router;
