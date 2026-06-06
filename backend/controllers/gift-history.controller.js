const db = require('../config/db');

/** GET /api/admin/gift-history/user/:userId */
async function userGiftHistory(req, res, next) {
  try {
    const { userId } = req.params;
    const limit = Math.min(parseInt(req.query.limit ?? '50', 10), 200);
    const offset = parseInt(req.query.offset ?? '0', 10);

    const r = await db.query(
      `SELECT e.id, e.coins, e.quantity, e.created_at,
              e.gift_name, e.gift_image_url,
              r.room_name, r.id AS room_id,
              rec.full_name AS recipient_name, rec.username AS recipient_username
       FROM room_gift_events e
       JOIN rooms r ON r.id = e.room_id
       JOIN users rec ON rec.id = e.recipient_id
       WHERE e.sender_id = $1
       ORDER BY e.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    const count = await db.query(
      'SELECT COUNT(*) FROM room_gift_events WHERE sender_id = $1', [userId]
    );
    return res.json({ success: true, data: r.rows, total: parseInt(count.rows[0].count, 10) });
  } catch (err) { next(err); }
}

/** GET /api/admin/gift-history/room/:roomId */
async function roomGiftHistory(req, res, next) {
  try {
    const { roomId } = req.params;
    const limit = Math.min(parseInt(req.query.limit ?? '50', 10), 200);
    const offset = parseInt(req.query.offset ?? '0', 10);

    const r = await db.query(
      `SELECT e.id, e.coins, e.quantity, e.created_at,
              e.gift_name, e.gift_image_url,
              s.full_name AS sender_name, s.username AS sender_username, s.avatar_url AS sender_avatar,
              rec.full_name AS recipient_name, rec.username AS recipient_username
       FROM room_gift_events e
       JOIN users s ON s.id = e.sender_id
       JOIN users rec ON rec.id = e.recipient_id
       WHERE e.room_id = $1
       ORDER BY e.created_at DESC
       LIMIT $2 OFFSET $3`,
      [roomId, limit, offset]
    );
    const count = await db.query(
      'SELECT COUNT(*), COALESCE(SUM(coins * quantity), 0) AS total_coins FROM room_gift_events WHERE room_id = $1',
      [roomId]
    );
    return res.json({
      success: true,
      data: r.rows,
      total: parseInt(count.rows[0].count, 10),
      total_coins: parseInt(count.rows[0].total_coins, 10),
    });
  } catch (err) { next(err); }
}

/** GET /api/wallet/me/gems */
async function getMyGems(req, res, next) {
  try {
    const r = await db.query(
      'SELECT COALESCE(gems, 0) AS gems FROM wallets WHERE user_id = $1', [req.user.id]
    );
    return res.json({ success: true, data: { gems: parseInt(r.rows[0]?.gems ?? 0, 10) } });
  } catch (err) { next(err); }
}

/**
 * GET /api/wallet/me/gem-history
 * Returns gem earning history grouped by source: chatroom, friendzone, live
 * Chatroom gems come from room_gift_events (recipient = me).
 * FriendZone / Live: placeholder totals (0) until those features award gems.
 */
async function getMyGemHistory(req, res, next) {
  try {
    const userId = req.user.id;

    // Chatroom gems: each gift event where user is recipient awards coins*qty*5 gems
    const r = await db.query(
      `SELECT e.id, e.coins, e.quantity, e.gift_name, e.gift_image_url, e.created_at,
              r.room_name, r.id AS room_id,
              s.full_name AS sender_name, s.username AS sender_username,
              s.avatar_url AS sender_avatar
       FROM room_gift_events e
       JOIN rooms r ON r.id = e.room_id
       JOIN users s ON s.id = e.sender_id
       WHERE e.recipient_id = $1
       ORDER BY e.created_at DESC
       LIMIT 200`,
      [userId]
    );

    const events = r.rows.map(ev => ({
      ...ev,
      gems_earned: ev.coins * ev.quantity * 5,
    }));

    const totalChatroomGems = events.reduce((s, e) => s + e.gems_earned, 0);

    return res.json({
      success: true,
      data: {
        chatroom: { total_gems: totalChatroomGems, events },
        friendzone: { total_gems: 0, events: [] },
        live: { total_gems: 0, events: [] },
      },
    });
  } catch (err) { next(err); }
}

module.exports = { userGiftHistory, roomGiftHistory, getMyGems, getMyGemHistory };
