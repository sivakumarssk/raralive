const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/db');
const walletModel = require('../models/wallet.model');
const friendZoneModel = require('../models/friend-zone.model');
const giftModel = require('../models/gift.model');
const { checkLevelUp } = require('../utils/room-levels');
const taskModel = require('../models/task.model');
const { getUserLevelFromDb } = require('../utils/user-levels');
const { coinsForMinute, gemsForCoins } = require('../utils/friend-zone-pricing');
const chatModel = require('../models/chat.model');
const liveBroadcastModel = require('../models/live-broadcast.model');

// ── In-memory state ───────────────────────────────────────────────────────────
const roomSockets     = new Map(); // roomId -> Set<socketId>
const roomMessages    = new Map(); // roomId -> last 100 msgs (in-memory cache)
const roomHosts       = new Map(); // roomId -> hostUserId
const roomHostSockets = new Map(); // roomId -> hostSocketId
const roomSeats       = new Map(); // roomId -> SeatSlot[]
const roomUsers       = new Map(); // roomId -> Map<socketId, {userId, userName, avatarUrl}>
const broadcastLikers = new Map(); // roomId -> Set<userId> who currently have the broadcast liked (toggle, not a tap counter)
const roomPinnedMessageId = new Map(); // roomId -> pinned chat message id (string), or unset if none

// Friend Zone global presence — not room-scoped, tracked app-wide
const friendZoneOnlineUsers = new Map(); // userId -> Set<socketId> (connections currently open)

// Friend Zone 1:1 calls — per-minute pricing is tiered (see
// utils/friend-zone-pricing.js), not a flat rate.
const FZ_CALL_GEMS_PER_COIN = 5; // matches the room-gift conversion rate — callee earns gems, not coins
const FZ_CALL_WARNING_LEAD_MS = 20 * 1000; // warn this long before the next minute is charged
const FZ_CALL_MINUTE_MS = 60 * 1000;
const friendZoneActiveCalls = new Map(); // callId -> { callerId, calleeId, callType, isFirstCall, minuteIndex, coinsCharged, gemsEarned, warnTimer, chargeTimer }

// ── Helpers ───────────────────────────────────────────────────────────────────

function onlineCount(roomId) { return roomSockets.get(roomId)?.size ?? 0; }
function getSeats(roomId)    { return roomSeats.get(roomId) ?? []; }
function isHostOnline(roomId){ return !!roomHostSockets.get(roomId); }
function serializeSeats(roomId) { return getSeats(roomId); }
function isFriendZoneUserOnline(userId) { return (friendZoneOnlineUsers.get(userId)?.size ?? 0) > 0; }
function debugFriendZonePresence() {
  const out = {};
  for (const [userId, sockets] of friendZoneOnlineUsers.entries()) out[userId] = Array.from(sockets);
  return out;
}

// Emit to every open socket a Friend Zone user currently has (they may have
// more than one device/tab connected).
function emitToFriendZoneUser(io, userId, event, payload) {
  const socketIds = friendZoneOnlineUsers.get(userId);
  if (!socketIds) return;
  for (const socketId of socketIds) io.to(socketId).emit(event, payload);
}

// Generic per-user delivery for features (like chat) that don't need their
// own presence map — every authenticated socket auto-joins `user_<id>` on
// connect (see io.on('connection') below), so this just targets that room.
function emitToUser(io, userId, event, payload) {
  io.to(`user_${userId}`).emit(event, payload);
}

// The first minute's cost was already confirmed affordable at invite time,
// so it's charged immediately when the call connects. Every minute after
// that: warn FZ_CALL_WARNING_LEAD_MS before the boundary if the balance
// looks short, then attempt the actual charge at the boundary — ending the
// call if it can't be covered. Price per minute comes from the tiered
// schedule (utils/friend-zone-pricing.js), keyed by call type, whether this
// is the caller's first-ever connected call, and how many minutes of this
// call have already been billed.
async function startFriendZoneCallBilling(io, call) {
  const isFirstCall = !(await friendZoneModel.hasPriorConnectedCall(call.caller_id, call.id));
  const entry = {
    callerId: call.caller_id, calleeId: call.callee_id, callType: call.call_type, isFirstCall,
    minuteIndex: 0, coinsCharged: 0, gemsEarned: 0, warnTimer: null, chargeTimer: null,
  };
  friendZoneActiveCalls.set(call.id, entry);

  // Charge the caller and credit the callee together for each minute —
  // mirrors the room-gift economy (sender pays coins, recipient earns gems).
  // The callee's gems are best-effort: if crediting them fails for some
  // reason, the call keeps going rather than penalizing the caller for it.
  const billMinute = async () => {
    entry.minuteIndex += 1;
    const coins = coinsForMinute({ callType: entry.callType, isFirstCall: entry.isFirstCall, minuteNumber: entry.minuteIndex });
    const gems = gemsForCoins(coins);

    await walletModel.debitCoins(entry.callerId, coins, `Friend Zone ${entry.callType} call`, call.id);
    entry.coinsCharged += coins;
    try {
      await walletModel.creditGems(entry.calleeId, gems);
      entry.gemsEarned += gems;
      emitToFriendZoneUser(io, entry.calleeId, 'friend_zone_call_earned', { callId: call.id, gems, totalGems: entry.gemsEarned });
    } catch (e) {
      console.error('friend_zone call gems credit error:', e.message);
    }
    emitToFriendZoneUser(io, entry.callerId, 'friend_zone_call_charged', { callId: call.id, coins, totalCoins: entry.coinsCharged });
  };

  try {
    await billMinute();
  } catch (e) {
    if (e.code === 'INSUFFICIENT_COINS') {
      await endFriendZoneCall(io, call.id, 'insufficient_coins');
    } else {
      console.error('friend_zone call initial billing error:', e.message);
    }
    return;
  }

  const scheduleNextMinute = () => {
    const warnDelay = FZ_CALL_MINUTE_MS - FZ_CALL_WARNING_LEAD_MS;
    // The upcoming minute's cost — used only for the low-balance warning,
    // the real charge is computed fresh inside billMinute() when it fires.
    const nextMinuteCoins = coinsForMinute({ callType: entry.callType, isFirstCall: entry.isFirstCall, minuteNumber: entry.minuteIndex + 1 });

    entry.warnTimer = setTimeout(async () => {
      try {
        const wallet = await walletModel.getWallet(entry.callerId);
        if (!wallet || wallet.coins < nextMinuteCoins) {
          emitToFriendZoneUser(io, entry.callerId, 'friend_zone_call_low_balance', {
            callId: call.id, secondsLeft: Math.round(FZ_CALL_WARNING_LEAD_MS / 1000),
          });
        }
      } catch (e) { console.error('friend_zone call balance warn error:', e.message); }
    }, warnDelay);

    entry.chargeTimer = setTimeout(async () => {
      try {
        await billMinute();
        scheduleNextMinute();
      } catch (e) {
        if (e.code === 'INSUFFICIENT_COINS') {
          await endFriendZoneCall(io, call.id, 'insufficient_coins');
        } else {
          console.error('friend_zone call billing error:', e.message);
        }
      }
    }, FZ_CALL_MINUTE_MS);
  };

  scheduleNextMinute();
}

function stopFriendZoneCallBilling(callId) {
  const entry = friendZoneActiveCalls.get(callId);
  if (!entry) return;
  clearTimeout(entry.warnTimer);
  clearTimeout(entry.chargeTimer);
  friendZoneActiveCalls.delete(callId);
}

async function endFriendZoneCall(io, callId, reason) {
  const entry = friendZoneActiveCalls.get(callId);
  stopFriendZoneCallBilling(callId);

  try {
    const call = await friendZoneModel.getCallById(callId);
    if (!call || call.status === 'ended') return;

    const startedAt = call.started_at ? new Date(call.started_at).getTime() : null;
    const durationSeconds = startedAt ? Math.max(0, Math.round((Date.now() - startedAt) / 1000)) : 0;
    const coinsCharged = entry ? entry.coinsCharged : 0;
    const gemsEarned = entry ? entry.gemsEarned : 0;

    await friendZoneModel.endCall(callId, { durationSeconds, coinsCharged, gemsEarned, endReason: reason });

    emitToFriendZoneUser(io, call.caller_id, 'friend_zone_call_ended', { callId, reason, durationSeconds });
    emitToFriendZoneUser(io, call.callee_id, 'friend_zone_call_ended', { callId, reason, durationSeconds });
  } catch (e) { console.error('endFriendZoneCall error:', e.message); }
}

async function getHostUserId(roomId) {
  if (roomHosts.has(roomId)) return roomHosts.get(roomId);
  try {
    const r = await db.query(`SELECT host_user_id FROM rooms WHERE id = $1`, [roomId]);
    if (r.rows.length) { roomHosts.set(roomId, r.rows[0].host_user_id); return r.rows[0].host_user_id; }
  } catch { /* non-fatal */ }
  return null;
}

// Load last 100 messages from DB for a room
async function loadMessages(roomId) {
  try {
    const r = await db.query(
      `SELECT cm.id, cm.type, cm.content, cm.created_at,
              u.id AS user_id, u.full_name, u.username, u.avatar_url,
              COALESCE((SELECT SUM(coins * quantity) FROM room_gift_events WHERE sender_id = u.id), 0)::int AS coins_gifted
       FROM chat_messages cm
       LEFT JOIN users u ON u.id = cm.user_id
       WHERE cm.room_id = $1
       ORDER BY cm.created_at DESC
       LIMIT 100`,
      [roomId]
    );
    const { getUserLevel } = require('../utils/user-levels');
    return r.rows.reverse().map(row => ({
      id: row.id,
      type: row.type,
      text: row.type === 'message' ? row.content : undefined,
      content: row.content,
      user: row.user_id ? {
        id: row.user_id,
        name: row.full_name || row.username || 'User',
        avatarUri: row.avatar_url ?? '',
        level: getUserLevel(parseInt(row.coins_gifted ?? 0, 10)),
      } : undefined,
    }));
  } catch { return []; }
}

// Save a message to DB and prune old ones (keep 200 per room)
async function saveMessage(roomId, userId, type, content) {
  try {
    await db.query(
      `INSERT INTO chat_messages (room_id, user_id, type, content) VALUES ($1, $2, $3, $4)`,
      [roomId, userId || null, type, content]
    );
    // Prune to keep only latest 200
    await db.query(
      `DELETE FROM chat_messages WHERE room_id = $1
       AND id NOT IN (
         SELECT id FROM chat_messages WHERE room_id = $1
         ORDER BY created_at DESC LIMIT 200
       )`,
      [roomId]
    );
  } catch (e) { console.error('saveMessage error:', e.message); }
}

// Parse gift payload from encoded message text
// Format: __gift__<giftName>__to__<toName>__img__<imgUrl>__bg__<bgColor>__giftid__<giftId>__coins__<coins>__qty__<qty>__senderid__<senderId>__recipientid__<recipientId>[__giftfor__<targetId>]
const GIFT_RE = /^__gift__(.+)__to__(.+)__img__(.*)__bg__(.*)__giftid__(.*)__coins__(\d+)__qty__(\d+)__senderid__(.+)__recipientid__([^_]+(?:__[^g][^_]*)*)/;

function parseGiftPayload(text) {
  const m = text.match(GIFT_RE);
  if (!m) return null;
  const giftForMatch = text.match(/__giftfor__([a-f0-9-]+)/);
  return {
    giftName: m[1], toName: m[2], imgUrl: m[3] || null, bgColor: m[4],
    giftId: m[5] || null, coins: parseInt(m[6], 10), qty: parseInt(m[7], 10),
    senderId: m[8], recipientId: m[9].replace(/__giftfor__.*$/, ''),
    giftForUserId: giftForMatch ? giftForMatch[1] : null,
  };
}

// Process a gift: debit sender, credit host wallet, save gift event, update room total
async function processGift({ roomId, senderId, recipientId, giftId, giftName, giftImageUrl, coins, qty, targetUserId }) {
  const totalCoins = coins * qty;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Debit sender wallet
    const debitResult = await client.query(
      `UPDATE wallets SET coins = coins - $1, updated_at = NOW()
       WHERE user_id = $2 AND coins >= $1 RETURNING coins`,
      [totalCoins, senderId]
    );
    if (!debitResult.rows.length) {
      await client.query('ROLLBACK');
      return { ok: false, message: 'Insufficient coins.' };
    }
    const senderBalance = debitResult.rows[0].coins;

    // 2. Record debit transaction
    await client.query(
      `INSERT INTO wallet_transactions (user_id, type, coins, balance_after, description)
       VALUES ($1, 'debit', $2, $3, $4)`,
      [senderId, totalCoins, senderBalance, `Gift: ${qty}x ${giftName} to room`]
    );

    // 3. Award gems to recipient (1 coin = 5 gems) — host receives only gems, not coins
    await client.query(
      `INSERT INTO wallets (user_id, gems) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET gems = wallets.gems + $2, updated_at = NOW()`,
      [recipientId, totalCoins * 5]
    );

    // 5. Save gift event record
    await client.query(
      `INSERT INTO room_gift_events (room_id, sender_id, recipient_id, gift_id, gift_name, gift_image_url, coins, quantity, target_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [roomId, senderId, recipientId, giftId || null, giftName, giftImageUrl || null, coins, qty, targetUserId || recipientId]
    );

    // 6. Add to room total and return new total + old level for level-up check
    const roomResult = await client.query(
      `UPDATE rooms
       SET total_coins_received = total_coins_received + $1
       WHERE id = $2
       RETURNING total_coins_received, current_level`,
      [totalCoins, roomId]
    );
    const { total_coins_received, current_level } = roomResult.rows[0];

    await client.query('COMMIT');
    return { ok: true, senderBalance, totalCoins: total_coins_received, currentLevel: current_level };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('processGift error:', err.message);
    return { ok: false, message: 'Gift processing failed.' };
  } finally {
    client.release();
  }
}

// ── Socket setup ──────────────────────────────────────────────────────────────

function setupSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Missing token'));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = payload.sub;
      next();
    } catch { next(new Error('Invalid token')); }
  });

  setIo(io);

  io.on('connection', async (socket) => {
    const userId = socket.userId;

    // Every authenticated connection joins its own private room — used for
    // generic per-user delivery (chat) instead of a dedicated presence map.
    socket.join(`user_${userId}`);

    // ── Friend Zone global presence ──────────────────────────────────────────
    // Every authenticated connection is considered "online" for Friend Zone,
    // regardless of which screen/room the user is in.
    socket.join('friend_zone_presence');
    if (!friendZoneOnlineUsers.has(userId)) friendZoneOnlineUsers.set(userId, new Set());
    friendZoneOnlineUsers.get(userId).add(socket.id);
    console.log('[FZ-PRESENCE] connect', userId, 'socket', socket.id, 'set size now', friendZoneOnlineUsers.get(userId).size);
    io.to('friend_zone_presence').emit('friend_zone_user_status', { userId, isOnline: true });

    socket.on('friend_zone_toggle_update', ({ receiveCalls, videoCalls }) => {
      io.to('friend_zone_presence').emit('friend_zone_toggles_changed', {
        userId, receiveCalls, videoCalls,
      });
    });

    // Client asks for a full snapshot after (re)connecting — covers any
    // presence/toggle broadcasts it may have missed while disconnected.
    // The client replaces its whole online map with this snapshot, so every
    // approved friend-zone user must appear explicitly (true or false) —
    // omitting offline users here would leave stale `true`s uncleared.
    socket.on('friend_zone_resync', async () => {
      try {
        const r = await db.query(
          `SELECT user_id, receive_calls, video_calls FROM friend_zone_applications fza
           WHERE fza.status = 'approved'
             AND fza.id = (
               SELECT id FROM friend_zone_applications f2
               WHERE f2.user_id = fza.user_id
               ORDER BY f2.created_at DESC LIMIT 1
             )`
        );

        const online = {};
        const toggles = {};
        for (const row of r.rows) {
          online[row.user_id] = isFriendZoneUserOnline(row.user_id);
          toggles[row.user_id] = { receiveCalls: row.receive_calls, videoCalls: row.video_calls };
        }

        socket.emit('friend_zone_snapshot', { online, toggles });
      } catch (e) { console.error('friend_zone_resync error:', e.message); }
    });

    // ── Friend Zone 1:1 calling — signaling + per-minute billing ─────────────

    socket.on('friend_zone_call_invite', async ({ calleeId, callType }) => {
      try {
        if (!calleeId || !['audio', 'video'].includes(callType)) return;
        if (calleeId === userId) return;
        if (!isFriendZoneUserOnline(calleeId)) {
          socket.emit('friend_zone_call_failed', { reason: 'offline' });
          return;
        }
        const busy = [...friendZoneActiveCalls.values()].some(
          e => [e.callerId, e.calleeId].includes(userId) || [e.callerId, e.calleeId].includes(calleeId)
        );
        if (busy) {
          socket.emit('friend_zone_call_failed', { reason: 'busy' });
          return;
        }
        // Caller must be able to afford at least the first minute up front.
        // Minute 1's price depends on whether this caller has ever had a
        // call that actually connected before (see hasPriorConnectedCall).
        const isFirstCall = !(await friendZoneModel.hasPriorConnectedCall(userId, null));
        const firstMinuteCoins = coinsForMinute({ callType, isFirstCall, minuteNumber: 1 });
        const wallet = await walletModel.getWallet(userId);
        if (!wallet || wallet.coins < firstMinuteCoins) {
          socket.emit('friend_zone_call_failed', { reason: 'insufficient_coins' });
          return;
        }

        // Agora channel names must be <= 64 bytes — a short random suffix
        // keeps this well under the limit while staying unique per call
        // (uniqueness doesn't need to encode the participant IDs; the call
        // record already links channelName to callerId/calleeId).
        const channelName = `fz_${crypto.randomBytes(12).toString('hex')}`;
        const call = await friendZoneModel.createCall({ channelName, callerId: userId, calleeId, callType });

        const [callerInfo, calleeInfo] = await Promise.all([
          db.query(`SELECT id, full_name, username, avatar_url FROM users WHERE id = $1`, [userId]),
          db.query(`SELECT id, full_name, username, avatar_url FROM users WHERE id = $1`, [calleeId]),
        ]);

        emitToFriendZoneUser(io, calleeId, 'friend_zone_call_invite', {
          callId: call.id, channelName, callType,
          caller: callerInfo.rows[0] || { id: userId },
        });
        socket.emit('friend_zone_call_ringing', {
          callId: call.id, channelName, callType,
          callee: calleeInfo.rows[0] || { id: calleeId },
        });
      } catch (e) { console.error('friend_zone_call_invite error:', e.message); }
    });

    socket.on('friend_zone_call_accept', async ({ callId }) => {
      try {
        const call = await friendZoneModel.getCallById(callId);
        if (!call || call.callee_id !== userId || call.status !== 'ringing') return;

        await friendZoneModel.markCallStarted(callId);
        startFriendZoneCallBilling(io, call);

        emitToFriendZoneUser(io, call.caller_id, 'friend_zone_call_accepted', { callId });
        emitToFriendZoneUser(io, call.callee_id, 'friend_zone_call_accepted', { callId });
      } catch (e) { console.error('friend_zone_call_accept error:', e.message); }
    });

    socket.on('friend_zone_call_reject', async ({ callId }) => {
      try {
        const call = await friendZoneModel.getCallById(callId);
        if (!call || call.callee_id !== userId || call.status !== 'ringing') return;
        await friendZoneModel.setCallStatus(callId, 'rejected');
        emitToFriendZoneUser(io, call.caller_id, 'friend_zone_call_ended', { callId, reason: 'rejected' });
      } catch (e) { console.error('friend_zone_call_reject error:', e.message); }
    });

    socket.on('friend_zone_call_cancel', async ({ callId }) => {
      try {
        const call = await friendZoneModel.getCallById(callId);
        if (!call || call.caller_id !== userId || call.status !== 'ringing') return;
        await friendZoneModel.setCallStatus(callId, 'missed');
        emitToFriendZoneUser(io, call.callee_id, 'friend_zone_call_ended', { callId, reason: 'cancelled' });
      } catch (e) { console.error('friend_zone_call_cancel error:', e.message); }
    });

    socket.on('friend_zone_call_end', async ({ callId }) => {
      try {
        const call = await friendZoneModel.getCallById(callId);
        if (!call) return;
        if (call.caller_id !== userId && call.callee_id !== userId) return;
        await endFriendZoneCall(io, callId, 'ended');
      } catch (e) { console.error('friend_zone_call_end error:', e.message); }
    });

    // ── In-call gifting — 1:1, independent of per-minute call billing ────────
    socket.on('friend_zone_call_send_gift', async ({ callId, giftId, qty }) => {
      try {
        const call = await friendZoneModel.getCallById(callId);
        if (!call || call.status !== 'accepted') return;
        if (call.caller_id !== userId && call.callee_id !== userId) return;
        const recipientId = call.caller_id === userId ? call.callee_id : call.caller_id;

        const quantity = Math.max(1, Math.min(parseInt(qty, 10) || 1, 100));
        const gift = await giftModel.getGiftById(giftId);
        if (!gift || !gift.is_active) {
          socket.emit('friend_zone_call_gift_error', { message: 'Gift unavailable.' });
          return;
        }
        const totalCoins = gift.coins * quantity;

        const senderBalance = await walletModel.debitCoins(userId, totalCoins, `Call gift: ${quantity}x ${gift.name}`, callId);
        try {
          await walletModel.creditGems(recipientId, totalCoins * FZ_CALL_GEMS_PER_COIN);
        } catch (e) { console.error('friend_zone_call_send_gift gems credit error:', e.message); }

        await friendZoneModel.logCallGift({
          callId, senderId: userId, recipientId,
          giftId: gift.id, giftName: gift.name, giftImageUrl: gift.image_url,
          coins: gift.coins, qty: quantity,
        });

        const payload = {
          callId, id: `callgift_${socket.id}_${Date.now()}`,
          senderId: userId, recipientId,
          giftId: gift.id, giftName: gift.name, giftImageUrl: gift.image_url,
          coins: gift.coins, qty: quantity,
        };
        emitToFriendZoneUser(io, call.caller_id, 'friend_zone_call_gift', payload);
        emitToFriendZoneUser(io, call.callee_id, 'friend_zone_call_gift', payload);
        socket.emit('wallet_update', { coins: senderBalance });
      } catch (e) {
        if (e.code === 'INSUFFICIENT_COINS') {
          socket.emit('friend_zone_call_gift_error', { message: 'Insufficient coins.' });
        } else {
          console.error('friend_zone_call_send_gift error:', e.message);
        }
      }
    });

    // ── In-call chat — scoped to the call, not persisted beyond the socket event ─
    socket.on('friend_zone_call_send_message', async ({ callId, text }) => {
      try {
        const trimmed = (text || '').trim().slice(0, 500);
        if (!trimmed) return;
        const call = await friendZoneModel.getCallById(callId);
        if (!call || call.status !== 'accepted') return;
        if (call.caller_id !== userId && call.callee_id !== userId) return;

        const payload = {
          callId, id: `callmsg_${socket.id}_${Date.now()}`,
          senderId: userId, text: trimmed,
        };
        emitToFriendZoneUser(io, call.caller_id, 'friend_zone_call_message', payload);
        emitToFriendZoneUser(io, call.callee_id, 'friend_zone_call_message', payload);
      } catch (e) { console.error('friend_zone_call_send_message error:', e.message); }
    });

    // ── Direct-message chat — 1:1, request/accept gated ──────────────────────
    // Text and sticker messages travel over the socket for low latency;
    // image/audio/video/file messages go through the REST media endpoint
    // (chat.controller.js) since they need to hit disk via multer first —
    // that endpoint re-emits 'chat_message' the same way once the upload lands.

    socket.on('chat_send_message', async ({ conversationId, text, type = 'text', stickerId }) => {
      try {
        if (!conversationId) return;
        const conversation = await chatModel.getConversationById(conversationId);
        if (!conversation) return;
        if (conversation.user_a_id !== userId && conversation.user_b_id !== userId) return;

        // A pending request can only be replied to by the person who
        // initiated it (still just talking to themselves/no-op otherwise) —
        // the recipient must accept before they can send messages back.
        if (conversation.status === 'pending' && conversation.initiated_by !== userId) {
          socket.emit('chat_error', { conversationId, message: 'Accept the request before replying.' });
          return;
        }

        let message;
        if (type === 'sticker') {
          if (!stickerId) return;
          message = await chatModel.createMessage({ conversationId, senderId: userId, type: 'sticker', stickerId });
        } else {
          const trimmed = (text || '').trim().slice(0, 4000);
          if (!trimmed) return;
          message = await chatModel.createMessage({ conversationId, senderId: userId, type: 'text', text: trimmed });
        }

        const preview = type === 'sticker' ? '🎉 Sticker' : message.text;
        await chatModel.touchConversation(conversationId, preview);

        const peerId = await chatModel.getPeerId(conversation, userId);
        emitToUser(io, peerId, 'chat_message', { conversationId, message });
        emitToUser(io, userId, 'chat_message', { conversationId, message });
      } catch (e) { console.error('chat_send_message error:', e.message); }
    });

    socket.on('chat_typing', async ({ conversationId, isTyping }) => {
      try {
        if (!conversationId) return;
        const conversation = await chatModel.getConversationById(conversationId);
        if (!conversation) return;
        if (conversation.user_a_id !== userId && conversation.user_b_id !== userId) return;
        const peerId = await chatModel.getPeerId(conversation, userId);
        emitToUser(io, peerId, 'chat_typing', { conversationId, userId, isTyping: !!isTyping });
      } catch (e) { console.error('chat_typing error:', e.message); }
    });

    socket.on('join_room', async ({ roomId }) => {
      if (!roomId) return;

      // Check if user is blocked from this room
      try {
        const blockCheck = await db.query(
          `SELECT 1 FROM room_blocked_users WHERE room_id = $1 AND user_id = $2`,
          [roomId, userId]
        );
        if (blockCheck.rows.length > 0) {
          socket.emit('join_blocked', { message: 'You are blocked from this room' });
          return;
        }
      } catch { /* non-fatal, allow join */ }

      let userName = 'Someone', avatarUrl = null;
      try {
        const r = await db.query(
          `SELECT full_name, username, avatar_url FROM users WHERE id = $1`, [userId]
        );
        if (r.rows.length) {
          const u = r.rows[0];
          userName = u.full_name || u.username || 'Someone';
          avatarUrl = u.avatar_url || null;
        }
      } catch { /* non-fatal */ }

      socket.join(roomId);
      socket.currentRoomId = roomId;
      socket.userName = userName;
      socket.avatarUrl = avatarUrl;
      socket.userLevel = await getUserLevelFromDb(db, userId);

      if (!roomSockets.has(roomId)) roomSockets.set(roomId, new Set());
      roomSockets.get(roomId).add(socket.id);
      if (!roomSeats.has(roomId)) roomSeats.set(roomId, []);
      if (!roomUsers.has(roomId)) roomUsers.set(roomId, new Map());
      roomUsers.get(roomId).set(socket.id, { userId, userName, avatarUrl });

      const hostUserId = await getHostUserId(roomId);
      const userIsHost = hostUserId === userId;
      socket.isHost = userIsHost;

      if (userIsHost) {
        roomHostSockets.set(roomId, socket.id);
        const seats = roomSeats.get(roomId);
        const hostSlot = seats.find(s => s.slotIndex === 0);
        if (!hostSlot) seats.unshift({ slotIndex: 0, userId, userName, avatarUrl, isHost: true });
        else { hostSlot.userName = userName; hostSlot.avatarUrl = avatarUrl; }
        io.to(roomId).emit('host_status', { isOnline: true, userName, avatarUrl });
      }

      // Load messages from DB (or use cache if already loaded this session)
      if (!roomMessages.has(roomId)) {
        const dbMsgs = await loadMessages(roomId);
        roomMessages.set(roomId, dbMsgs);
      }
      if (!roomPinnedMessageId.has(roomId)) {
        try {
          const r = await db.query(`SELECT pinned_message_id FROM rooms WHERE id = $1`, [roomId]);
          roomPinnedMessageId.set(roomId, r.rows[0]?.pinned_message_id ?? null);
        } catch { roomPinnedMessageId.set(roomId, null); }
      }

      socket.emit('chat_history', roomMessages.get(roomId) ?? []);
      socket.emit('seats_update', serializeSeats(roomId));
      socket.emit('host_status', {
        isOnline: isHostOnline(roomId),
        userName: getSeats(roomId).find(s => s.slotIndex === 0)?.userName ?? 'Host',
        avatarUrl: getSeats(roomId).find(s => s.slotIndex === 0)?.avatarUrl ?? null,
      });
      socket.emit('broadcast_like_state', { roomId, liked: broadcastLikers.get(roomId)?.has(userId) ?? false });
      socket.emit('pinned_comment_update', { roomId, messageId: roomPinnedMessageId.get(roomId) ?? null });

      io.to(roomId).emit('online_count', { roomId, count: onlineCount(roomId) });

      // Send active reward to the joining user (so BG applies immediately on join/re-join)
      try {
        const rewardRow = await db.query(
          `SELECT t.reward_bg_url, t.reward_frame_url
           FROM task_progress tp
           JOIN tasks t ON t.id = tp.task_id
           WHERE tp.reward_claimed = TRUE
             AND tp.completed_at >= NOW() - INTERVAL '24 hours'
             AND (t.reward_bg_url IS NOT NULL OR t.reward_frame_url IS NOT NULL)
             AND (
               tp.room_id = $1
               OR EXISTS (
                 SELECT 1 FROM room_gift_events rge
                 WHERE rge.room_id = $1
                   AND rge.sender_id = tp.user_id
                   AND rge.created_at >= NOW() - INTERVAL '24 hours'
               )
             )
           ORDER BY tp.completed_at DESC LIMIT 1`,
          [roomId]
        );
        if (rewardRow.rows.length) {
          const { reward_bg_url, reward_frame_url } = rewardRow.rows[0];
          console.log(`[SOCKET] sending active reward on join to ${userId}: bg=${reward_bg_url}`);
          socket.emit('reward_applied', { reward_bg_url, reward_frame_url });
        }
      } catch (e) { /* non-fatal */ }

      // Join notice
      const joinMsg = {
        id: `join_${socket.id}_${Date.now()}`,
        type: 'join',
        user: { id: userId, name: userName, avatarUri: avatarUrl ?? '', level: socket.userLevel ?? 0 },
      };
      const msgs = roomMessages.get(roomId) ?? [];
      msgs.push(joinMsg);
      if (msgs.length > 100) msgs.shift();
      roomMessages.set(roomId, msgs);
      io.to(roomId).emit('chat_message', joinMsg);
      // Save join to DB
      await saveMessage(roomId, userId, 'join', `${userName} joined`);
    });

    // ── Seat management ────────────────────────────────────────────────────────

    socket.on('request_seat', ({ roomId, slotIndex }) => {
      if (!roomId) return;
      const hostSocketId = roomHostSockets.get(roomId);
      if (!hostSocketId) {
        socket.emit('seat_request_result', { slotIndex, accepted: false, reason: 'Host is offline.' });
        return;
      }
      io.to(hostSocketId).emit('incoming_seat_request', {
        slotIndex, fromUserId: userId,
        fromUserName: socket.userName, fromAvatarUrl: socket.avatarUrl, fromSocketId: socket.id,
      });
    });

    socket.on('accept_seat', ({ roomId, slotIndex, toUserId, toSocketId, toUserName, toAvatarUrl }) => {
      if (!roomId || !socket.isHost) return;
      const seats = roomSeats.get(roomId) ?? [];
      const existing = seats.findIndex(s => s.userId === toUserId && s.slotIndex !== 0);
      if (existing !== -1) seats.splice(existing, 1);
      if (seats.find(s => s.slotIndex === slotIndex)) {
        socket.emit('seat_error', { message: 'That slot is already taken.' }); return;
      }
      seats.push({ slotIndex, userId: toUserId, userName: toUserName, avatarUrl: toAvatarUrl, isHost: false });
      roomSeats.set(roomId, seats);
      io.to(toSocketId).emit('seat_request_result', { slotIndex, accepted: true });
      io.to(roomId).emit('seats_update', serializeSeats(roomId));
    });

    socket.on('reject_seat', ({ roomId, slotIndex, toSocketId }) => {
      if (!roomId || !socket.isHost) return;
      io.to(toSocketId).emit('seat_request_result', { slotIndex, accepted: false, reason: 'Host declined your request.' });
    });

    // Host invites a user to stage — sends invite to user, waits for accept/reject
    socket.on('invite_to_stage', ({ roomId, toUserId, slotIndex }) => {
      if (!roomId || !socket.isHost) return;
      const seats = roomSeats.get(roomId) ?? [];
      if (seats.find(s => s.slotIndex === slotIndex)) {
        socket.emit('seat_error', { message: 'That slot is already taken.' }); return;
      }
      const usersMap = roomUsers.get(roomId);
      if (!usersMap) return;
      let targetSocketId = null;
      for (const [sid, u] of usersMap.entries()) {
        if (u.userId === toUserId) { targetSocketId = sid; break; }
      }
      if (!targetSocketId) { socket.emit('seat_error', { message: 'User is no longer online.' }); return; }
      // Notify the target user — they decide to accept or reject
      io.to(targetSocketId).emit('incoming_stage_invite', {
        slotIndex,
        hostSocketId: socket.id,
        hostName: socket.userName ?? 'Host',
        hostAvatarUrl: socket.avatarUrl ?? null,
      });
    });

    // User accepts host's stage invite — place them on stage
    socket.on('accept_stage_invite', ({ roomId, slotIndex, hostSocketId }) => {
      if (!roomId) return;
      const seats = roomSeats.get(roomId) ?? [];
      if (seats.find(s => s.slotIndex === slotIndex)) {
        socket.emit('seat_error', { message: 'That slot is already taken.' }); return;
      }
      const existing = seats.findIndex(s => s.userId === socket.userId && s.slotIndex !== 0);
      if (existing !== -1) seats.splice(existing, 1);
      seats.push({ slotIndex, userId: socket.userId, userName: socket.userName, avatarUrl: socket.avatarUrl, isHost: false });
      roomSeats.set(roomId, seats);
      io.to(roomId).emit('seats_update', serializeSeats(roomId));
      // Confirm to the host
      io.to(hostSocketId).emit('stage_invite_accepted', { userId: socket.userId, userName: socket.userName });
    });

    // User rejects host's stage invite
    socket.on('reject_stage_invite', ({ roomId, hostSocketId }) => {
      if (!roomId) return;
      io.to(hostSocketId).emit('stage_invite_rejected', { userId: socket.userId, userName: socket.userName });
    });

    // Co-host steps down from their own seat (self-service — any non-host stage user)
    socket.on('leave_stage', ({ roomId }) => {
      if (!roomId || !socket.userId) return;
      const seats = roomSeats.get(roomId);
      if (!seats) return;
      const idx = seats.findIndex(s => s.userId === socket.userId && s.slotIndex !== 0);
      if (idx === -1) return;
      seats.splice(idx, 1);
      io.to(roomId).emit('seats_update', serializeSeats(roomId));
    });

    // Host removes a co-host from a seat
    socket.on('remove_from_stage', ({ roomId, slotIndex }) => {
      if (!roomId || !socket.isHost) return;
      const seats = roomSeats.get(roomId);
      if (!seats) return;
      const idx = seats.findIndex(s => s.slotIndex === slotIndex && s.slotIndex !== 0);
      if (idx === -1) return;
      const removedUserId = seats[idx].userId;
      seats.splice(idx, 1);
      io.to(roomId).emit('seats_update', serializeSeats(roomId));
      // Tell the removed user's socket(s) so their client can leave the Agora channel too
      const usersMap = roomUsers.get(roomId);
      if (usersMap) {
        for (const [sid, u] of usersMap.entries()) {
          if (u.userId === removedUserId) io.to(sid).emit('removed_from_stage', { roomId });
        }
      }
    });

    // ── Mute state broadcast ───────────────────────────────────────────────────

    socket.on('user_mute', ({ roomId, isMuted }) => {
      if (!roomId || !socket.userId) return;
      const seats = roomSeats.get(roomId);
      if (!seats) return;
      const seat = seats.find(s => s.userId === socket.userId);
      if (seat) seat.isMuted = !!isMuted;
      io.to(roomId).emit('seats_update', serializeSeats(roomId));
    });

    // ── Live broadcast likes (toggle like/unlike, not a tap counter) ─────────────

    socket.on('like_broadcast', async ({ roomId }) => {
      if (!roomId || !socket.userId) return;
      try {
        const broadcast = await liveBroadcastModel.getBroadcastByRoomId(roomId);
        if (!broadcast) return;

        if (!broadcastLikers.has(roomId)) broadcastLikers.set(roomId, new Set());
        const likers = broadcastLikers.get(roomId);
        const alreadyLiked = likers.has(socket.userId);
        const delta = alreadyLiked ? -1 : 1;
        if (alreadyLiked) likers.delete(socket.userId);
        else likers.add(socket.userId);

        const likesCount = await liveBroadcastModel.incrementLikes(broadcast.id, delta);
        if (likesCount === null) return;
        socket.emit('broadcast_like_state', { roomId, liked: !alreadyLiked });
        io.to(roomId).emit('broadcast_likes_update', { roomId, likesCount });
      } catch (e) { console.error('like_broadcast error:', e.message); }
    });

    // ── Chat messages ──────────────────────────────────────────────────────────

    socket.on('send_message', async ({ roomId, text }) => {
      if (!roomId || !text?.trim()) return;

      const trimmed = text.trim();

      // ── Gift message ───────────────────────────────────────────────────────
      const giftPayload = parseGiftPayload(trimmed);
      if (giftPayload) {
        const { giftName, toName, imgUrl, bgColor, giftId, coins, qty, senderId, recipientId, giftForUserId } = giftPayload;
        const totalCoins = coins * qty;

        // Process wallet transaction (gems go to host=recipientId, history tracks actual target)
        const result = await processGift({
          roomId, senderId, recipientId,
          giftId, giftName, giftImageUrl: imgUrl,
          coins, qty, targetUserId: giftForUserId,
        });

        if (!result.ok) {
          // Notify sender of failure (insufficient coins etc.)
          socket.emit('gift_error', { message: result.message });
          return;
        }

        // Build chat message
        const msg = {
          id: `gift_${socket.id}_${Date.now()}`,
          type: 'gift',
          user: { id: socket.userId, name: socket.userName ?? 'User', avatarUri: socket.avatarUrl ?? '', level: socket.userLevel ?? 0 },
          giftName,
          giftTo: toName,
          giftImageUrl: imgUrl,
          giftBgColor: bgColor,
          giftCoins: coins,
          giftQty: qty,
          giftRecipientId: giftForUserId || recipientId,
        };

        if (!roomMessages.has(roomId)) roomMessages.set(roomId, []);
        const msgs = roomMessages.get(roomId);
        msgs.push(msg);
        if (msgs.length > 100) msgs.shift();

        io.to(roomId).emit('chat_message', msg);
        // Notify sender of new balance
        socket.emit('wallet_update', { coins: result.senderBalance });

        // Emit real-time battle scores if this room has an active battle
        try {
          const battleResult = await db.query(
            `SELECT id, from_room_id, to_room_id, started_at
             FROM battle_invites
             WHERE status = 'active'
               AND (from_room_id = $1 OR to_room_id = $1)
             LIMIT 1`,
            [roomId]
          );
          if (battleResult.rows.length) {
            const b = battleResult.rows[0];
            const scoreResult = await db.query(
              `SELECT room_id, COALESCE(SUM(coins * quantity), 0)::int AS total
               FROM room_gift_events
               WHERE room_id IN ($1, $2) AND created_at >= $3
               GROUP BY room_id`,
              [b.from_room_id, b.to_room_id, b.started_at]
            );
            let left = 0, right = 0;
            for (const row of scoreResult.rows) {
              if (row.room_id === b.from_room_id) left = parseInt(row.total, 10);
              else if (row.room_id === b.to_room_id) right = parseInt(row.total, 10);
            }
            const scoreData = { invite_id: b.id, left, right };
            io.to(b.from_room_id).emit('battle_scores', scoreData);
            io.to(b.to_room_id).emit('battle_scores', scoreData);
          }
        } catch (e) { console.error('battle_scores emit error:', e.message); }

        // Check for level-up
        const newLevel = checkLevelUp(result.currentLevel, result.totalCoins);
        if (newLevel !== null) {
          // Save new level to DB
          await db.query(
            `UPDATE rooms SET current_level = $1 WHERE id = $2`,
            [newLevel, roomId]
          );
          // Broadcast level-up to everyone in room
          io.to(roomId).emit('room_level_up', { level: newLevel, roomId });
        }

        // Update task progress for sender (coin target + gift-specific tasks)
        try {
          const todayDow = new Date().getDay();
          const activeTasks = await taskModel.listTasks({ activeOnly: true });
          const todayTasks = activeTasks.filter(t => (t.day_of_week ?? [0,1,2,3,4,5,6]).includes(todayDow));
          console.log(`[TASK] gift received: senderId=${senderId} roomId=${roomId} giftId=${giftId} coins=${totalCoins}`);
          console.log(`[TASK] active tasks today (dow=${todayDow}): ${todayTasks.length} tasks`);
          todayTasks.forEach(t => console.log(`[TASK]   task id=${t.id} title="${t.title}" target_coins=${t.target_coins} target_gift_id=${t.target_gift_id} reward_bg=${t.reward_bg_url} reward_frame=${t.reward_frame_url}`));

          for (const task of todayTasks) {
            let justCompleted = false;

            if (task.target_coins) {
              const updated = await taskModel.incrementProgress(senderId, task.id, totalCoins, task.target_coins, roomId);
              console.log(`[TASK] incrementProgress(coins) task=${task.id}: progress=${updated?.progress}/${task.target_coins} completed=${updated?.completed} just_completed=${updated?.just_completed}`);
              if (updated?.just_completed) justCompleted = true;
            }
            if (!justCompleted && task.target_gift_id && task.target_gift_id === giftId) {
              const updated = await taskModel.incrementProgress(senderId, task.id, qty, task.target_count, roomId);
              console.log(`[TASK] incrementProgress(gift) task=${task.id}: progress=${updated?.progress}/${task.target_count} completed=${updated?.completed} just_completed=${updated?.just_completed}`);
              if (updated?.just_completed) justCompleted = true;
            }

            if (justCompleted) {
              console.log(`[TASK] task JUST COMPLETED: emitting task_completed + reward_applied to room ${roomId}`);
              try {
                socket.emit('task_completed', {
                  task_id: task.id,
                  title: task.title,
                  reward_bg_url: task.reward_bg_url,
                  reward_frame_url: task.reward_frame_url,
                });
                if (task.reward_bg_url || task.reward_frame_url) {
                  io.to(roomId).emit('reward_applied', {
                    reward_bg_url: task.reward_bg_url,
                    reward_frame_url: task.reward_frame_url,
                    completed_by: socket.userName ?? 'Someone',
                    task_title: task.title,
                  });
                }
              } catch (emitErr) {
                console.error('[TASK] emit error:', emitErr.message);
              }
            }
          }
        } catch (e) { console.error('[TASK] task progress error:', e.message, e.stack); }

        // Save to DB
        await saveMessage(roomId, senderId, 'gift', trimmed);
        return;
      }

      // ── Regular message ────────────────────────────────────────────────────
      const msg = {
        id: `msg_${socket.id}_${Date.now()}`,
        type: 'message',
        user: { id: socket.userId, name: socket.userName ?? 'User', avatarUri: socket.avatarUrl ?? '', level: socket.userLevel ?? 0 },
        text: trimmed,
      };

      if (!roomMessages.has(roomId)) roomMessages.set(roomId, []);
      const msgs = roomMessages.get(roomId);
      msgs.push(msg);
      if (msgs.length > 100) msgs.shift();

      io.to(roomId).emit('chat_message', msg);
      await saveMessage(roomId, userId, 'message', trimmed);
    });

    // ── Comment moderation (host only): pin, delete, report ─────────────────────

    socket.on('pin_comment', async ({ roomId, messageId }) => {
      if (!roomId || !messageId || !socket.isHost) return;
      try {
        roomPinnedMessageId.set(roomId, messageId);
        await db.query(`UPDATE rooms SET pinned_message_id = $2 WHERE id = $1`, [roomId, messageId]);
        io.to(roomId).emit('pinned_comment_update', { roomId, messageId });
      } catch (e) { console.error('pin_comment error:', e.message); }
    });

    socket.on('unpin_comment', async ({ roomId }) => {
      if (!roomId || !socket.isHost) return;
      try {
        roomPinnedMessageId.set(roomId, null);
        await db.query(`UPDATE rooms SET pinned_message_id = NULL WHERE id = $1`, [roomId]);
        io.to(roomId).emit('pinned_comment_update', { roomId, messageId: null });
      } catch (e) { console.error('unpin_comment error:', e.message); }
    });

    socket.on('delete_comment', ({ roomId, messageId }) => {
      if (!roomId || !messageId || !socket.isHost) return;
      const msgs = roomMessages.get(roomId);
      if (msgs) {
        const idx = msgs.findIndex(m => m.id === messageId);
        if (idx !== -1) msgs.splice(idx, 1);
      }
      if (roomPinnedMessageId.get(roomId) === messageId) {
        roomPinnedMessageId.set(roomId, null);
        db.query(`UPDATE rooms SET pinned_message_id = NULL WHERE id = $1`, [roomId]).catch(() => {});
        io.to(roomId).emit('pinned_comment_update', { roomId, messageId: null });
      }
      io.to(roomId).emit('comment_deleted', { roomId, messageId });
    });

    socket.on('report_comment', async ({ roomId, messageId, messageText, reportedUserId, reason }) => {
      if (!roomId || !messageText || !socket.userId) return;
      try {
        await db.query(
          `INSERT INTO comment_reports (room_id, message_id, reported_user_id, reporter_id, message_text, reason)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [roomId, messageId || null, reportedUserId || null, socket.userId, messageText, reason || null]
        );
        socket.emit('report_comment_result', { ok: true });
      } catch (e) {
        console.error('report_comment error:', e.message);
        socket.emit('report_comment_result', { ok: false });
      }
    });

    // ── Disconnect ─────────────────────────────────────────────────────────────

    socket.on('disconnect', () => {
      // Friend Zone presence cleanup — runs regardless of room membership
      const fzSockets = friendZoneOnlineUsers.get(userId);
      if (fzSockets) {
        fzSockets.delete(socket.id);
        console.log('[FZ-PRESENCE] disconnect', userId, 'socket', socket.id, 'set size now', fzSockets.size);
        if (fzSockets.size === 0) {
          friendZoneOnlineUsers.delete(userId);
          console.log('[FZ-PRESENCE] broadcasting OFFLINE for', userId);
          io.to('friend_zone_presence').emit('friend_zone_user_status', { userId, isOnline: false });

          // If this was the user's last open connection, end any Friend Zone
          // call they're currently in rather than leave it billing forever.
          for (const [callId, entry] of friendZoneActiveCalls.entries()) {
            if (entry.callerId === userId || entry.calleeId === userId) {
              endFriendZoneCall(io, callId, 'disconnected');
            }
          }
        }
      }

      const roomId = socket.currentRoomId;
      if (!roomId) return;

      roomSockets.get(roomId)?.delete(socket.id);
      roomUsers.get(roomId)?.delete(socket.id);
      io.to(roomId).emit('online_count', { roomId, count: onlineCount(roomId) });

      if (socket.isHost && roomHostSockets.get(roomId) === socket.id) {
        roomHostSockets.delete(roomId);
        const hostSeat = getSeats(roomId).find(s => s.slotIndex === 0);
        io.to(roomId).emit('host_status', {
          isOnline: false,
          userName: hostSeat?.userName ?? 'Host',
          avatarUrl: hostSeat?.avatarUrl ?? null,
        });
      }

      if (!socket.isHost) {
        const seats = roomSeats.get(roomId);
        if (seats) {
          const idx = seats.findIndex(s => s.userId === socket.userId && s.slotIndex !== 0);
          if (idx !== -1) {
            seats.splice(idx, 1);
            io.to(roomId).emit('seats_update', serializeSeats(roomId));
          }
        }
      }
    });
  });

  return io;
}

function getOnlineCount(roomId) { return onlineCount(roomId); }
function getAllOnlineCounts() {
  const result = {};
  for (const [roomId, sockets] of roomSockets.entries()) result[roomId] = sockets.size;
  return result;
}
function isRoomHostOnline(roomId) { return !!roomHostSockets.get(roomId); }
function getHostSocketId(roomId) { return roomHostSockets.get(roomId) ?? null; }
function getRoomMembers(roomId) {
  const usersMap = roomUsers.get(roomId);
  if (!usersMap) return [];
  // Deduplicate by userId (same user may reconnect with multiple sockets)
  const seen = new Map();
  for (const u of usersMap.values()) {
    if (!seen.has(u.userId)) seen.set(u.userId, u);
  }
  return Array.from(seen.values());
}

let _io = null;
function setIo(io) { _io = io; }

function kickUserFromRoom(roomId, targetUserId) {
  if (!_io) return;
  const usersMap = roomUsers.get(roomId);
  if (!usersMap) return;

  // Find all sockets for this user in this room
  const socketsToKick = [];
  for (const [socketId, u] of usersMap.entries()) {
    if (u.userId === targetUserId) socketsToKick.push(socketId);
  }

  for (const socketId of socketsToKick) {
    const sock = _io.sockets.sockets.get(socketId);
    if (sock) {
      sock.emit('kicked_from_room', { message: 'You have been blocked from this room' });
      sock.leave(roomId);
      sock.currentRoomId = null;
    }
    roomSockets.get(roomId)?.delete(socketId);
    usersMap.delete(socketId);

    // Remove from seat if on stage
    const seats = getSeats(roomId);
    const seatIdx = seats.findIndex(s => s.userId === targetUserId);
    if (seatIdx >= 0) {
      seats.splice(seatIdx, 1);
      _io.to(roomId).emit('seats_update', serializeSeats(roomId));
    }
  }

  _io.to(roomId).emit('online_count', { roomId, count: onlineCount(roomId) });
}

module.exports = {
  setupSocket, setIo, getOnlineCount, getAllOnlineCounts, isRoomHostOnline, getHostSocketId, getRoomMembers, kickUserFromRoom,
  isFriendZoneUserOnline, debugFriendZonePresence, emitToUser,
};
