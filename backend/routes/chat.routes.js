const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { uploadChatMedia } = require('../middleware/upload.middleware');
const ctrl = require('../controllers/chat.controller');

const router = express.Router();

router.get('/conversations', authenticate, ctrl.getConversations);
router.post('/conversations', authenticate, ctrl.startConversation);
router.get('/requests', authenticate, ctrl.getRequests);
router.get('/unread-count', authenticate, ctrl.getUnreadCount);

router.get('/conversations/:id', authenticate, ctrl.getConversation);
router.post('/conversations/:id/accept', authenticate, ctrl.acceptConversation);
router.post('/conversations/:id/reject', authenticate, ctrl.rejectConversation);
router.get('/conversations/:id/messages', authenticate, ctrl.getMessages);
router.post('/conversations/:id/read', authenticate, ctrl.markRead);
router.post('/conversations/:id/media', authenticate, uploadChatMedia.single('file'), ctrl.sendMediaMessage);

module.exports = router;
