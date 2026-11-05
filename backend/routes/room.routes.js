const express = require('express');
const roomController = require('../controllers/room-admin.controller');
const { authenticateAdmin } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticateAdmin);

// Rooms are created by users in the app only — the admin panel lists them.
router.get('/', roomController.listRooms);

module.exports = router;
