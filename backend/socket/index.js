const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const walletModel = require('../models/wallet.model');
const { checkLevelUp } = require('../utils/room-levels');
const taskModel = require('../models/task.model');

// ── In-memory state ───────────────────────────────────────────────────────────
const roomSockets     = new Map(); // roomId -> Set<socketId>
const roomMessages    = new Map(); // roomId -> last 100 msgs (in-memory cache)
const roomHosts       = new Map(); // roomId -> hostUserId
const roomHostSockets = new Map(); // roomId -> hostSocketId
const roomSeats       = new Map(); // roomId -> SeatSlot[]

// ── Helpers ───────────────────────────────────────────────────────────────────

function onlineCount(roomId) { return roomSockets.get(roomId)?.size ?? 0; }
function getSeats(roomId)    { return roomSeats.get(roomId) ?? []; }
function isHostOnline(roomId){ return !!roomHostSockets.get(roomId); }
function serializeSeats(roomId) { return getSeats(roomId); }

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
              u.id AS user_id, u.full_name, u.username, u.avatar_url
       FROM chat_messages cm
       LEFT JOIN users u ON u.id = cm.user_id
       WHERE cm.room_id = $1
       ORDER BY cm.created_at DESC
       LIMIT 100`,
      [roomId]
    );
    // Reverse so oldest first
    return r.rows.reverse().map(row => ({
      id: row.id,
      type: row.type,
      text: row.type === 'message' ? row.content : undefined,
      content: row.content,
      user: row.user_id ? {
        name: row.full_name || row.username || 'User',
        avatarUri: row.avatar_url ?? '',
        level: 0,
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
// Format: __gift__<giftName>__to__<toName>__img__<imgUrl>__bg__<bgColor>__giftid__<giftId>__coins__<coins>__qty__<qty>__senderid__<senderId>__recipientid__<recipientId>
const GIFT_RE = /^__gift__(.+)__to__(.+)__img__(.*)__bg__(.*)__giftid__(.*)__coins__(\d+)__qty__(\d+)__senderid__(.+)__recipientid__(.+)$/;

function parseGiftPayload(text) {
  const m = text.match(GIFT_RE);
  if (!m) return null;
  return {
    giftName: m[1], toName: m[2], imgUrl: m[3] || null, bgColor: m[4],
    giftId: m[5] || null, coins: parseInt(m[6], 10), qty: parseInt(m[7], 10),
    senderId: m[8], recipientId: m[9],
  };
}

// Process a gift: debit sender, credit host wallet, save gift event, update room total
async function processGift({ roomId, senderId, recipientId, giftId, giftName, giftImageUrl, coins, qty }) {
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
      `INSERT INTO room_gift_events (room_id, sender_id, recipient_id, gift_id, gift_name, gift_image_url, coins, quantity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [roomId, senderId, recipientId, giftId || null, giftName, giftImageUrl || null, coins, qty]
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

  io.on('connection', async (socket) => {
    const userId = socket.userId;

    socket.on('join_room', async ({ roomId }) => {
      if (!roomId) return;

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

      if (!roomSockets.has(roomId)) roomSockets.set(roomId, new Set());
      roomSockets.get(roomId).add(socket.id);
      if (!roomSeats.has(roomId)) roomSeats.set(roomId, []);

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

      socket.emit('chat_history', roomMessages.get(roomId) ?? []);
      socket.emit('seats_update', serializeSeats(roomId));
      socket.emit('host_status', {
        isOnline: isHostOnline(roomId),
        userName: getSeats(roomId).find(s => s.slotIndex === 0)?.userName ?? 'Host',
        avatarUrl: getSeats(roomId).find(s => s.slotIndex === 0)?.avatarUrl ?? null,
      });

      io.to(roomId).emit('online_count', { roomId, count: onlineCount(roomId) });

      // Join notice
      const joinMsg = {
        id: `join_${socket.id}_${Date.now()}`,
        type: 'join',
        user: { name: userName, avatarUri: avatarUrl ?? '', level: 0 },
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

    // ── Chat messages ──────────────────────────────────────────────────────────

    socket.on('send_message', async ({ roomId, text }) => {
      if (!roomId || !text?.trim()) return;

      const trimmed = text.trim();

      // ── Gift message ───────────────────────────────────────────────────────
      const giftPayload = parseGiftPayload(trimmed);
      if (giftPayload) {
        const { giftName, toName, imgUrl, bgColor, giftId, coins, qty, senderId, recipientId } = giftPayload;

        // Process wallet transaction
        const result = await processGift({
          roomId, senderId, recipientId,
          giftId, giftName, giftImageUrl: imgUrl,
          coins, qty,
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
          user: { name: socket.userName ?? 'User', avatarUri: socket.avatarUrl ?? '', level: 0 },
          giftName,
          giftTo: toName,
          giftImageUrl: imgUrl,
          giftBgColor: bgColor,
          coins,
          qty,
        };

        if (!roomMessages.has(roomId)) roomMessages.set(roomId, []);
        const msgs = roomMessages.get(roomId);
        msgs.push(msg);
        if (msgs.length > 100) msgs.shift();

        io.to(roomId).emit('chat_message', msg);
        // Notify sender of new balance
        socket.emit('wallet_update', { coins: result.senderBalance });

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
          const activeTasks = await taskModel.listTasks({ activeOnly: true });
          for (const task of activeTasks) {
            // Coin-target task: count total coins gifted
            if (task.target_coins) {
              const updated = await taskModel.incrementProgress(
                senderId, task.id, task.type, totalCoins, task.target_coins
              );
              if (updated.completed && !updated.reward_claimed) {
                socket.emit('task_completed', { task_id: task.id, title: task.title, reward_gems: task.reward_gems });
              }
            }
            // Gift-specific task: count gifts of that specific type
            if (task.target_gift_id && task.target_gift_id === giftId) {
              const updated = await taskModel.incrementProgress(
                senderId, task.id, task.type, qty, task.target_count
              );
              if (updated.completed && !updated.reward_claimed) {
                socket.emit('task_completed', { task_id: task.id, title: task.title, reward_gems: task.reward_gems });
              }
            }
          }
        } catch (e) { console.error('task progress error:', e.message); }

        // Save to DB
        await saveMessage(roomId, senderId, 'gift', trimmed);
        return;
      }

      // ── Regular message ────────────────────────────────────────────────────
      const msg = {
        id: `msg_${socket.id}_${Date.now()}`,
        type: 'message',
        user: { name: socket.userName ?? 'User', avatarUri: socket.avatarUrl ?? '', level: 0 },
        text: trimmed,
      };

      if (!roomMessages.has(roomId)) roomMessages.set(roomId, []);
      const msgs = roomMessages.get(roomId);
      msgs.push(msg);
      if (msgs.length > 100) msgs.shift();

      io.to(roomId).emit('chat_message', msg);
      await saveMessage(roomId, userId, 'message', trimmed);
    });

    // ── Disconnect ─────────────────────────────────────────────────────────────

    socket.on('disconnect', () => {
      const roomId = socket.currentRoomId;
      if (!roomId) return;

      roomSockets.get(roomId)?.delete(socket.id);
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

module.exports = { setupSocket, getOnlineCount, getAllOnlineCounts };
