const chatModel = require('../models/chat.model');
const ioInstance = require('../utils/io-instance');
const { emitToUser } = require('../socket');

function mediaUrlFor(req, file) {
  return `/uploads/chat-media/${file.filename}`;
}

/**
 * GET /api/chat/conversations
 * The single chat list — accepted conversations plus pending requests both ways.
 */
async function getConversations(req, res, next) {
  try {
    const rows = await chatModel.listConversations(req.user.id);
    return res.json({ success: true, data: rows });
  } catch (error) { next(error); }
}

/**
 * GET /api/chat/requests
 * Pending conversations someone else started. The app now shows these inside
 * the single conversations list; kept for older app builds.
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

// Tell the other person's open chat that they can (no longer) message — it
// swaps the input for a "You can't send messages" bar in real time.
function notifyBlockStatus(peerId, conversationId, blocked) {
  const io = ioInstance.get();
  if (io && conversationId) emitToUser(io, peerId, 'chat_block_status', { conversationId, blocked });
}

/**
 * GET /api/chat/blocks — users I've blocked (chat list ⋮ → Blocked Users).
 */
async function getBlockedUsers(req, res, next) {
  try {
    const rows = await chatModel.listBlockedUsers(req.user.id);
    return res.json({ success: true, data: rows });
  } catch (error) { next(error); }
}

/**
 * DELETE /api/chat/blocks/:userId — unblock by user (from the Blocked Users list).
 */
async function unblockUserById(req, res, next) {
  try {
    const userId = req.user.id;
    const { userId: blockedId } = req.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(blockedId)) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    await chatModel.unblockUser(userId, blockedId);
    const conversation = await chatModel.getConversationBetween(userId, blockedId);
    if (conversation) {
      await chatModel.unhideForNewMessage(conversation.id, userId);
      notifyBlockStatus(blockedId, conversation.id, false);
    }
    return res.json({ success: true });
  } catch (error) { next(error); }
}

/**
 * POST /api/chat/conversations/:id/block
 * Blocks the peer: no DMs either way until unblocked, and the conversation
 * leaves the blocker's list. The blocked user isn't notified.
 */
async function blockConversationPeer(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const conversation = await chatModel.getConversationById(id);
    if (!conversation || (conversation.user_a_id !== userId && conversation.user_b_id !== userId)) {
      return res.status(404).json({ success: false, message: 'Conversation not found.' });
    }
    const peerId = await chatModel.getPeerId(conversation, userId);
    await chatModel.blockUser(userId, peerId);
    await chatModel.hideConversation(id, userId);
    notifyBlockStatus(peerId, id, true);
    return res.json({ success: true });
  } catch (error) { next(error); }
}

/**
 * DELETE /api/chat/conversations/:id/block
 * Unblocks the peer and brings the conversation back into the caller's list.
 */
async function unblockConversationPeer(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const conversation = await chatModel.getConversationById(id);
    if (!conversation || (conversation.user_a_id !== userId && conversation.user_b_id !== userId)) {
      return res.status(404).json({ success: false, message: 'Conversation not found.' });
    }
    const peerId = await chatModel.getPeerId(conversation, userId);
    await chatModel.unblockUser(userId, peerId);
    await chatModel.unhideForNewMessage(id, userId);
    notifyBlockStatus(peerId, id, false);
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
 * POST /api/chat/conversations/:id/pin
 */
async function pinConversation(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    if (!(await chatModel.isParticipant(id, userId))) {
      return res.status(403).json({ success: false, message: 'Not a participant in this conversation.' });
    }
    await chatModel.setPinned(id, userId, true);
    return res.json({ success: true });
  } catch (error) { next(error); }
}

/**
 * DELETE /api/chat/conversations/:id/pin
 */
async function unpinConversation(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    if (!(await chatModel.isParticipant(id, userId))) {
      return res.status(403).json({ success: false, message: 'Not a participant in this conversation.' });
    }
    await chatModel.setPinned(id, userId, false);
    return res.json({ success: true });
  } catch (error) { next(error); }
}

/**
 * DELETE /api/chat/conversations/:id
 * Hides the conversation from the caller's own list only — the peer keeps it.
 */
async function deleteConversation(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    if (!(await chatModel.isParticipant(id, userId))) {
      return res.status(403).json({ success: false, message: 'Not a participant in this conversation.' });
    }
    await chatModel.hideConversation(id, userId);
    return res.json({ success: true });
  } catch (error) { next(error); }
}

/**
 * POST /api/chat/conversations/:id/unread
 */
async function markUnread(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    if (!(await chatModel.isParticipant(id, userId))) {
      return res.status(403).json({ success: false, message: 'Not a participant in this conversation.' });
    }
    await chatModel.markUnread(id, userId);
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
    if (conversation.status === 'pending' && conversation.initiated_by !== userId) {
      return res.status(403).json({ success: false, message: 'Accept the request before replying.' });
    }
    if (await chatModel.isBlockedBetween(userId, await chatModel.getPeerId(conversation, userId))) {
      return res.status(403).json({ success: false, message: "You can't message this user." });
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

    const peerId = await chatModel.getPeerId(conversation, userId);
    await chatModel.unhideForNewMessage(id, peerId);

    const io = ioInstance.get();
    if (io) {
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
  pinConversation, unpinConversation, deleteConversation, markUnread,
  blockConversationPeer, unblockConversationPeer, getBlockedUsers, unblockUserById,
};
