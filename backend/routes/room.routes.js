const express = require('express');
const roomController = require('../controllers/room-admin.controller');
const { authenticateAdmin } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticateAdmin);

router.get('/agencies', roomController.listActiveAgencies);
router.get('/users/search', roomController.searchUsers);
router.get('/', roomController.listRooms);
router.post('/', roomController.createRoom);

module.exports = router;
