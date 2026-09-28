const db = require('../config/db');

// user_a_id/user_b_id are always stored with the lower UUID first (see the
// CHECK constraint on the table), so every lookup/insert must normalize the
// pair the same way to hit the UNIQUE(user_a_id, user_b_id) index.
function orderPair(userId1, userId2) {
  return userId1 < userId2 ? [userId1, userId2] : [userId2, userId1];
}

async function getConversationBetween(userId1, userId2) {
  const [a, b] = orderPair(userId1, userId2);
  const r = await db.query(
    `SELECT * FROM conversations WHERE user_a_id = $1 AND user_b_id = $2`,
    [a, b]
  );
  return r.rows[0] || null;
}

async function getConversationById(id) {
  const r = await db.query(`SELECT * FROM conversations WHERE id = $1`, [id]);
  return r.rows[0] || null;
}

// Creates the conversation as 'pending' (a request) unless one already
// exists, in which case the existing row is returned untouched — this keeps
// sending a first message idempotent if the client retries.
async function getOrCreateConversation(fromUserId, toUserId) {
  const existing = await getConversationBetween(fromUserId, toUserId);
  if (existing) return existing;

  const [a, b] = orderPair(fromUserId, toUserId);
  const r = await db.query(
    `INSERT INTO conversations (user_a_id, user_b_id, initiated_by, status)
     VALUES ($1, $2, $3, 'pending')
     ON CONFLICT (user_a_id, user_b_id) DO NOTHING
     RETURNING *`,
    [a, b, fromUserId]
  );
  if (r.rows[0]) return r.rows[0];
  // Someone else created it concurrently — fetch what landed.
  return getConversationBetween(fromUserId, toUserId);
}

async function acceptConversation(id, userId) {
  const r = await db.query(
    `UPDATE conversations SET status = 'accepted', updated_at = NOW()
     WHERE id = $1 AND (user_a_id = $2 OR user_b_id = $2) AND status = 'pending'
     RETURNING *`,
    [id, userId]
  );
  return r.rows[0] || null;
}

// Rejecting deletes the conversation and its messages outright (ON DELETE
// CASCADE) rather than keeping a 'rejected' row around — the requester can
// always message again, which just opens a fresh request.
async function rejectConversation(id, userId) {
  const r = await db.query(
    `DELETE FROM conversations
     WHERE id = $1 AND (user_a_id = $2 OR user_b_id = $2) AND status = 'pending'
     RETURNING id`,
    [id, userId]
  );
  return r.rows.length > 0;
}

async function touchConversation(id, previewText) {
  await db.query(
    `UPDATE conversations SET last_message_at = NOW(), last_message_preview = $2, updated_at = NOW()
     WHERE id = $1`,
    [id, previewText.slice(0, 200)]
  );
}

// Requests = conversations initiated by the OTHER person, still pending.
async function listRequests(userId) {
  const r = await db.query(
    `SELECT c.*,
            peer.id AS peer_id, peer.full_name AS peer_name, peer.username AS peer_username, peer.avatar_url AS peer_avatar_url
     FROM conversations c
     JOIN users peer ON peer.id = (CASE WHEN c.user_a_id = $1 THEN c.user_b_id ELSE c.user_a_id END)
     WHERE (c.user_a_id = $1 OR c.user_b_id = $1)
       AND c.status = 'pending'
       AND c.initiated_by != $1
     ORDER BY c.created_at DESC`,
    [userId]
  );
  return r.rows;
}

// Messages = accepted conversations, OR pending conversations this user
// themself started (so their sent request shows in their own Messages tab
// while it waits on the other side). Conversations this user has hidden
// (deleted-for-me) are excluded; pinned ones sort first.
async function listConversations(userId) {
  const r = await db.query(
    `SELECT c.*,
            peer.id AS peer_id, peer.full_name AS peer_name, peer.username AS peer_username, peer.avatar_url AS peer_avatar_url,
            (SELECT COUNT(*) FROM direct_messages dm
              WHERE dm.conversation_id = c.id AND dm.sender_id != $1 AND dm.read_at IS NULL)::int AS unread_count,
            COALESCE(s.pinned, FALSE) AS pinned
     FROM conversations c
     JOIN users peer ON peer.id = (CASE WHEN c.user_a_id = $1 THEN c.user_b_id ELSE c.user_a_id END)
     LEFT JOIN user_conversation_state s ON s.conversation_id = c.id AND s.user_id = $1
     WHERE (c.user_a_id = $1 OR c.user_b_id = $1)
       AND (c.status = 'accepted' OR c.initiated_by = $1)
       AND COALESCE(s.hidden, FALSE) = FALSE
     ORDER BY COALESCE(s.pinned, FALSE) DESC, COALESCE(c.last_message_at, c.created_at) DESC`,
    [userId]
  );
  return r.rows;
}

async function setPinned(conversationId, userId, pinned) {
  await db.query(
    `INSERT INTO user_conversation_state (conversation_id, user_id, pinned, pinned_at)
     VALUES ($1, $2, $3, CASE WHEN $3 THEN NOW() ELSE NULL END)
     ON CONFLICT (conversation_id, user_id)
     DO UPDATE SET pinned = $3, pinned_at = CASE WHEN $3 THEN NOW() ELSE NULL END`,
    [conversationId, userId, pinned]
  );
}

// Hide-for-me (the app's "delete" for a conversation the other person still keeps).
async function hideConversation(conversationId, userId) {
  await db.query(
    `INSERT INTO user_conversation_state (conversation_id, user_id, hidden, hidden_at)
     VALUES ($1, $2, TRUE, NOW())
     ON CONFLICT (conversation_id, user_id)
     DO UPDATE SET hidden = TRUE, hidden_at = NOW()`,
    [conversationId, userId]
  );
}

// A conversation a user hid reappears in their list once new activity happens —
// call this whenever a message is sent so the recipient's hide doesn't stick forever.
async function unhideForNewMessage(conversationId, recipientUserId) {
  await db.query(
    `UPDATE user_conversation_state SET hidden = FALSE, hidden_at = NULL
     WHERE conversation_id = $1 AND user_id = $2 AND hidden = TRUE`,
    [conversationId, recipientUserId]
  );
}

// Marks the peer's messages unread again for this user (undo of markRead) —
// used by the chat list's "Mark as unread" action.
async function markUnread(conversationId, userId) {
  const conv = await getConversationById(conversationId);
  if (!conv) return;
  const peerId = conv.user_a_id === userId ? conv.user_b_id : conv.user_a_id;
  await db.query(
    `UPDATE direct_messages SET read_at = NULL
     WHERE conversation_id = $1 AND sender_id = $2 AND id = (
       SELECT id FROM direct_messages
       WHERE conversation_id = $1 AND sender_id = $2
       ORDER BY created_at DESC LIMIT 1
     )`,
    [conversationId, peerId]
  );
}

async function getConversationWithPeer(conversationId, userId) {
  const r = await db.query(
    `SELECT c.*,
            peer.id AS peer_id, peer.full_name AS peer_name, peer.username AS peer_username, peer.avatar_url AS peer_avatar_url
     FROM conversations c
     JOIN users peer ON peer.id = (CASE WHEN c.user_a_id = $2 THEN c.user_b_id ELSE c.user_a_id END)
     WHERE c.id = $1 AND (c.user_a_id = $2 OR c.user_b_id = $2)`,
    [conversationId, userId]
  );
  return r.rows[0] || null;
}

async function isParticipant(conversationId, userId) {
  const r = await db.query(
    `SELECT 1 FROM conversations WHERE id = $1 AND (user_a_id = $2 OR user_b_id = $2)`,
    [conversationId, userId]
  );
  return r.rows.length > 0;
}

async function getPeerId(conversation, userId) {
  return conversation.user_a_id === userId ? conversation.user_b_id : conversation.user_a_id;
}

async function listMessages(conversationId, { limit = 50, before = null } = {}) {
  const vals = [conversationId];
  let cond = '';
  if (before) { vals.push(before); cond = `AND dm.created_at < $${vals.length}`; }
  vals.push(limit);

  const r = await db.query(
    `SELECT dm.* FROM direct_messages dm
     WHERE dm.conversation_id = $1 ${cond}
     ORDER BY dm.created_at DESC
     LIMIT $${vals.length}`,
    vals
  );
  return r.rows.reverse();
}

async function createMessage({ conversationId, senderId, type, text, mediaUrl, mediaName, mediaMime, mediaDurationMs, stickerId }) {
  const r = await db.query(
    `INSERT INTO direct_messages (conversation_id, sender_id, type, text, media_url, media_name, media_mime, media_duration_ms, sticker_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [conversationId, senderId, type, text || null, mediaUrl || null, mediaName || null, mediaMime || null, mediaDurationMs || null, stickerId || null]
  );
  return r.rows[0];
}

async function markRead(conversationId, userId) {
  await db.query(
    `UPDATE direct_messages SET read_at = NOW()
     WHERE conversation_id = $1 AND sender_id != $2 AND read_at IS NULL`,
    [conversationId, userId]
  );
}

async function totalUnreadCount(userId) {
  const r = await db.query(
    `SELECT COUNT(*)::int AS count
     FROM direct_messages dm
     JOIN conversations c ON c.id = dm.conversation_id
     WHERE (c.user_a_id = $1 OR c.user_b_id = $1)
       AND c.status = 'accepted'
       AND dm.sender_id != $1
       AND dm.read_at IS NULL`,
    [userId]
  );
  return r.rows[0]?.count ?? 0;
}

module.exports = {
  getConversationBetween, getConversationById, getConversationWithPeer, getOrCreateConversation,
  acceptConversation, rejectConversation, touchConversation,
  listRequests, listConversations, isParticipant, getPeerId,
  listMessages, createMessage, markRead, totalUnreadCount,
  setPinned, hideConversation, unhideForNewMessage, markUnread,
};
