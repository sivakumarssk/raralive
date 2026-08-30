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
 * FriendZone gems come from friend_zone_calls (callee = me, gems_earned > 0).
 * Live: placeholder totals (0) until that feature awards gems.
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

    // Friend Zone gems have two sources, merged into one feed:
    // 1. Per-minute call billing (friend_zone_calls.gems_earned, callee side)
    // 2. In-call gifting (call_gift_events, recipient side) — same 1:5 ratio
    const fzCalls = await db.query(
      `SELECT c.id, c.call_type, c.duration_seconds, c.gems_earned, c.created_at,
              caller.full_name AS caller_name, caller.username AS caller_username,
              caller.avatar_url AS caller_avatar
       FROM friend_zone_calls c
       JOIN users caller ON caller.id = c.caller_id
       WHERE c.callee_id = $1 AND c.gems_earned > 0
       ORDER BY c.created_at DESC
       LIMIT 200`,
      [userId]
    );
    const callEvents = fzCalls.rows.map(ev => ({ ...ev, kind: 'call' }));

    const fzGifts = await db.query(
      `SELECT g.id, g.gift_name, g.gift_image_url, g.coins, g.quantity,
              (g.coins * g.quantity * 5) AS gems_earned, g.created_at,
              c.call_type,
              sender.full_name AS sender_name, sender.username AS sender_username,
              sender.avatar_url AS sender_avatar
       FROM call_gift_events g
       JOIN friend_zone_calls c ON c.id = g.call_id
       JOIN users sender ON sender.id = g.sender_id
       WHERE g.recipient_id = $1
       ORDER BY g.created_at DESC
       LIMIT 200`,
      [userId]
    );
    const giftEvents = fzGifts.rows.map(ev => ({ ...ev, kind: 'gift' }));

    const fzEvents = [...callEvents, ...giftEvents]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 200);
    const totalFriendZoneGems = fzEvents.reduce((s, e) => s + e.gems_earned, 0);

    return res.json({
      success: true,
      data: {
        chatroom: { total_gems: totalChatroomGems, events },
        friendzone: { total_gems: totalFriendZoneGems, events: fzEvents },
        live: { total_gems: 0, events: [] },
      },
    });
  } catch (err) { next(err); }
}

module.exports = { userGiftHistory, roomGiftHistory, getMyGems, getMyGemHistory };
