const chatModel = require('../models/chat.model');
const ioInstance = require('../utils/io-instance');
const { emitToUser } = require('../socket');

function mediaUrlFor(req, file) {
  return `/uploads/chat-media/${file.filename}`;
}

/**
 * GET /api/chat/conversations
 * Accepted conversations (+ pending ones I started) — the "Messages" tab.
 */
async function getConversations(req, res, next) {
  try {
    const rows = await chatModel.listConversations(req.user.id);
    return res.json({ success: true, data: rows });
  } catch (error) { next(error); }
}

/**
 * GET /api/chat/requests
 * Pending conversations someone else started — the "Requests" tab.
 */
async function getRequests(req, res, next) {
  try {
    const rows = await chatModel.listRequests(req.user.id);
    return res.json({ success: true, data: rows });
  } catch (error) { next(error); }
}

/**
 * GET /api/chat/unread-count
 */
async function getUnreadCount(req, res, next) {
  try {
    const count = await chatModel.totalUnreadCount(req.user.id);
    return res.json({ success: true, data: { count } });
  } catch (error) { next(error); }
}

/**
 * POST /api/chat/conversations
 * Body: { peerId }
 * Starts (or fetches) a conversation with peerId. Anyone can message anyone;
 * the conversation begins 'pending' unless it already exists/is accepted.
 */
async function startConversation(req, res, next) {
  try {
    const userId = req.user.id;
    const { peerId } = req.body;
    if (!peerId) return res.status(400).json({ success: false, message: 'peerId is required.' });
    if (peerId === userId) return res.status(400).json({ success: false, message: 'Cannot message yourself.' });

    const conversation = await chatModel.getOrCreateConversation(userId, peerId);
    return res.status(201).json({ success: true, data: conversation });
  } catch (error) { next(error); }
}

/**
 * POST /api/chat/conversations/:id/accept
 */
async function acceptConversation(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const updated = await chatModel.acceptConversation(id, userId);
    if (!updated) return res.status(404).json({ success: false, message: 'Request not found.' });

    const io = ioInstance.get();
    if (io) {
      const peerId = await chatModel.getPeerId(updated, userId);
      emitToUser(io, peerId, 'chat_request_accepted', { conversationId: id });
    }

    return res.json({ success: true, data: updated });
  } catch (error) { next(error); }
}

/**
 * POST /api/chat/conversations/:id/reject
 * Deletes the pending request entirely.
 */
async function rejectConversation(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const conversation = await chatModel.getConversationById(id);
    if (!conversation) return res.status(404).json({ success: false, message: 'Request not found.' });

    const removed = await chatModel.rejectConversation(id, userId);
    if (!removed) return res.status(404).json({ success: false, message: 'Request not found.' });

    const io = ioInstance.get();
    if (io) {
      const peerId = await chatModel.getPeerId(conversation, userId);
      emitToUser(io, peerId, 'chat_request_rejected', { conversationId: id });
    }

    return res.json({ success: true });
  } catch (error) { next(error); }
}

/**
 * GET /api/chat/conversations/:id
 */
async function getConversation(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const conversation = await chatModel.getConversationWithPeer(id, userId);
    if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found.' });
    return res.json({ success: true, data: conversation });
  } catch (error) { next(error); }
}

/**
 * GET /api/chat/conversations/:id/messages?before=<iso timestamp>
 */
async function getMessages(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { before } = req.query;

    if (!(await chatModel.isParticipant(id, userId))) {
      return res.status(403).json({ success: false, message: 'Not a participant in this conversation.' });
    }

    const rows = await chatModel.listMessages(id, { before: before || null });
    return res.json({ success: true, data: rows });
  } catch (error) { next(error); }
}

/**
 * POST /api/chat/conversations/:id/read
 */
async function markRead(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    if (!(await chatModel.isParticipant(id, userId))) {
      return res.status(403).json({ success: false, message: 'Not a participant in this conversation.' });
    }
    await chatModel.markRead(id, userId);

    const io = ioInstance.get();
    if (io) {
      const conversation = await chatModel.getConversationById(id);
      const peerId = await chatModel.getPeerId(conversation, userId);
      emitToUser(io, peerId, 'chat_read', { conversationId: id, readBy: userId });
    }

    return res.json({ success: true });
  } catch (error) { next(error); }
}

/**
 * POST /api/chat/conversations/:id/media
 * Multipart upload for image/audio/video/file messages — REST is used here
 * instead of the socket (sockets carry text/sticker messages) because the
 * file needs to land on disk via multer before a message row/URL can exist.
 * Body (multipart): file, type ('image'|'audio'|'video'|'file'), durationMs?
 */
async function sendMediaMessage(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { type, durationMs } = req.body;

    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
    if (!['image', 'audio', 'video', 'file'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid media type.' });
    }

    const conversation = await chatModel.getConversationById(id);
    if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found.' });
    if (conversation.user_a_id !== userId && conversation.user_b_id !== userId) {
      return res.status(403).json({ success: false, message: 'Not a participant in this conversation.' });
    }

    const message = await chatModel.createMessage({
      conversationId: id,
      senderId: userId,
      type,
      mediaUrl: mediaUrlFor(req, req.file),
      mediaName: req.file.originalname,
      mediaMime: req.file.mimetype,
      mediaDurationMs: durationMs ? parseInt(durationMs, 10) : null,
    });

    const preview = type === 'image' ? '📷 Photo' : type === 'audio' ? '🎤 Voice message' : type === 'video' ? '🎬 Video' : `📎 ${req.file.originalname}`;
    await chatModel.touchConversation(id, preview);

    const io = ioInstance.get();
    if (io) {
      const peerId = await chatModel.getPeerId(conversation, userId);
      emitToUser(io, peerId, 'chat_message', { conversationId: id, message });
      emitToUser(io, userId, 'chat_message', { conversationId: id, message });
    }

    return res.status(201).json({ success: true, data: message });
  } catch (error) { next(error); }
}

module.exports = {
  getConversations, getRequests, getUnreadCount,
  startConversation, getConversation, acceptConversation, rejectConversation,
  getMessages, markRead, sendMediaMessage,
};
