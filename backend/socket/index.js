const { Server } = require('socket.io');
const { verifyUserToken } = require('../middleware/auth.middleware');
const crypto = require('crypto');
const db = require('../config/db');
const walletModel = require('../models/wallet.model');
const friendZoneModel = require('../models/friend-zone.model');
const giftModel = require('../models/gift.model');
const { checkLevelUp } = require('../utils/room-levels');
const taskModel = require('../models/task.model');
const { getUserLevelFromDb } = require('../utils/user-levels');
const { coinsPerTickForMinute, gemsForCoins, TICK_SECONDS } = require('../utils/friend-zone-pricing');
const chatModel = require('../models/chat.model');
const earningSlabs = require('../utils/earning-slabs');
const liveBroadcastModel = require('../models/live-broadcast.model');
const battleModel = require('../models/battle.model');
const roomModel = require('../models/room.model');
const moderationModel = require('../models/moderation.model');

// ── In-memory state ───────────────────────────────────────────────────────────
const roomSockets     = new Map(); // roomId -> Set<socketId>
const roomMessages    = new Map(); // roomId -> last 100 msgs (in-memory cache)
const roomHosts       = new Map(); // roomId -> hostUserId
const roomHostSockets = new Map(); // roomId -> hostSocketId
// Rooms whose host chose to leave the audio stage. They stay connected (chat,
// seat requests, battle invites still reach them via roomHostSockets), but the
// stage shows them offline until they come back.
const roomHostOffStage = new Set();
const roomSeats       = new Map(); // roomId -> SeatSlot[]
const roomUsers       = new Map(); // roomId -> Map<socketId, {userId, userName, avatarUrl}>
const broadcastLikers = new Map(); // roomId -> Set<userId> who currently have the broadcast liked (toggle, not a tap counter)
const roomPinnedMessageId = new Map(); // roomId -> pinned chat message id (string), or unset if none
const pendingBroadcastEndTimers = new Map(); // roomId -> Timeout — grace period before auto-ending a live broadcast whose host disconnected

// Friend Zone global presence — not room-scoped, tracked app-wide
const friendZoneOnlineUsers = new Map(); // userId -> Set<socketId> (connections currently open)

// Friend Zone 1:1 calls — billed every 5 seconds (see
// utils/friend-zone-pricing.js for the per-minute rate schedule that each
// tick's cost is looked up from).
const FZ_CALL_TICK_MS = TICK_SECONDS * 1000;
const friendZoneActiveCalls = new Map(); // callId -> { callerId, calleeId, callType, tickIndex, coinsCharged, gemsEarned, chargeTimer }

// ── Helpers ───────────────────────────────────────────────────────────────────

function onlineCount(roomId) { return roomSockets.get(roomId)?.size ?? 0; }
function getSeats(roomId)    { return roomSeats.get(roomId) ?? []; }
function isHostOnline(roomId){ return !!roomHostSockets.get(roomId) && !roomHostOffStage.has(roomId); }
function hostStatusFor(roomId) {
  const hostSeat = getSeats(roomId).find(s => s.slotIndex === 0);
  return {
    isOnline: isHostOnline(roomId),
    offStage: roomHostOffStage.has(roomId),
    userName: hostSeat?.userName ?? 'Host',
    avatarUrl: hostSeat?.avatarUrl ?? null,
  };
}
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

// Whether a user has created a chatroom — gates the creator-only options in
// the app (Go Live, Friend Zone call toggles). Go-Live sessions also create
// a `rooms` row for the host, so those broadcast rooms don't count.
async function userHasChatroom(userId) {
  const r = await db.query(
    `SELECT EXISTS (
       SELECT 1 FROM rooms r
       WHERE r.host_user_id = $1 AND r.status = 'active'
         AND NOT EXISTS (SELECT 1 FROM live_broadcasts lb WHERE lb.room_id = r.id)
     ) AS has_chatroom`,
    [userId]
  );
  return r.rows[0].has_chatroom;
}

const TICKS_PER_MINUTE = Math.round(60 / TICK_SECONDS);

// The first 5-second tick's cost was already confirmed affordable at invite
// time, so it's charged immediately when the call connects. Every tick
// after that fires every FZ_CALL_TICK_MS and charges whatever that tick's
// minute-based rate is (utils/friend-zone-pricing.js) — ending the call the
// moment a tick can't be covered. A low-balance warning fires once per
// minute-boundary if the caller's balance can't cover a full minute
// (12 ticks) at the upcoming rate, giving real lead time instead of a
// pointless 5-second heads-up before a 5-second charge.
async function startFriendZoneCallBilling(io, call) {
  const entry = {
    callerId: call.caller_id, calleeId: call.callee_id, callType: call.call_type,
    tickIndex: 0, coinsCharged: 0, gemsEarned: 0, chargeTimer: null,
  };
  friendZoneActiveCalls.set(call.id, entry);

  // Charge the caller and credit the callee together for each tick —
  // mirrors the room-gift economy (sender pays coins, recipient earns gems).
  // The callee's gems are best-effort: if crediting them fails for some
  // reason, the call keeps going rather than penalizing the caller for it.
  const billTick = async () => {
    entry.tickIndex += 1;
    const minuteNumber = Math.floor((entry.tickIndex - 1) / TICKS_PER_MINUTE) + 1;
    const coins = coinsPerTickForMinute({ callType: entry.callType, minuteNumber });
    const gems = await gemsForCoins(coins);

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

    // Once per minute boundary (right after the tick that starts a new
    // minute), warn if the caller can't afford the coming minute's ticks.
    if ((entry.tickIndex - 1) % TICKS_PER_MINUTE === 0) {
      const nextMinuteNumber = minuteNumber + 1;
      const nextMinuteCoins = coinsPerTickForMinute({ callType: entry.callType, minuteNumber: nextMinuteNumber }) * TICKS_PER_MINUTE;
      try {
        const wallet = await walletModel.getWallet(entry.callerId);
        if (!wallet || wallet.coins < nextMinuteCoins) {
          emitToFriendZoneUser(io, entry.callerId, 'friend_zone_call_low_balance', { callId: call.id });
        }
      } catch (e) { console.error('friend_zone call balance warn error:', e.message); }
    }
  };

  try {
    await billTick();
  } catch (e) {
    if (e.code === 'INSUFFICIENT_COINS') {
      await endFriendZoneCall(io, call.id, 'insufficient_coins');
    } else {
      console.error('friend_zone call initial billing error:', e.message);
    }
    return;
  }

  const scheduleNextTick = () => {
    entry.chargeTimer = setTimeout(async () => {
      try {
        await billTick();
        scheduleNextTick();
      } catch (e) {
        if (e.code === 'INSUFFICIENT_COINS') {
          await endFriendZoneCall(io, call.id, 'insufficient_coins');
        } else {
          console.error('friend_zone call billing error:', e.message);
        }
      }
    }, FZ_CALL_TICK_MS);
  };

  scheduleNextTick();
}

function stopFriendZoneCallBilling(callId) {
  const entry = friendZoneActiveCalls.get(callId);
  if (!entry) return;
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
    return r.rows.reverse().map(row => {
      // Gift rows are stored as the raw encoded payload; rebuild the same
      // fields the live gift message carries, or the card falls back to
      // defaults (no recipient, placeholder image) after a reload.
      const gift = row.type === 'gift' ? parseGiftPayload(row.content ?? '') : null;
      return {
        id: row.id,
        type: row.type,
        text: row.type === 'message' ? row.content : undefined,
        content: row.content,
        createdAt: row.created_at,
        user: row.user_id ? {
          id: row.user_id,
          name: row.full_name || row.username || 'User',
          avatarUri: row.avatar_url ?? '',
          level: getUserLevel(parseInt(row.coins_gifted ?? 0, 10)),
        } : undefined,
        ...(gift && {
          giftName: gift.giftName,
          giftTo: gift.toName,
          giftImageUrl: gift.imgUrl,
          giftBgColor: gift.bgColor,
          giftCoins: gift.coins,
          giftQty: gift.qty,
          giftRecipientId: gift.giftForUserId || gift.recipientId,
          giftId: gift.giftId,
          giftForId: gift.giftForUserId || gift.recipientId,
        }),
      };
    });
  } catch { return []; }
}

// Save a message to DB and prune old ones (keep 200 per room)
// Returns the new row's id (or null), so a live message can carry the same id
// it will have when chat history is later reloaded from the DB.
// Chat history + pinned message are cached in memory per room after the
// first join; this loads whichever is missing.
async function ensureRoomCache(roomId) {
  await Promise.all([
    roomMessages.has(roomId) ? null : loadMessages(roomId).then(msgs => {
      if (!roomMessages.has(roomId)) roomMessages.set(roomId, msgs);
    }),
    roomPinnedMessageId.has(roomId) ? null : db.query(`SELECT pinned_message_id FROM rooms WHERE id = $1`, [roomId])
      .then(r => r.rows[0]?.pinned_message_id ?? null)
      .catch(() => null)
      .then(id => { if (!roomPinnedMessageId.has(roomId)) roomPinnedMessageId.set(roomId, id); }),
  ]);
}

// The room's running battle (or null) with the scores and top gifters so
// far — sent on join so the battle banner shows with the rest of the room.
async function getBattleSnapshot(roomId) {
  try {
    const battle = await battleModel.getActiveBattleForRoom(roomId);
    if (!battle) return { roomId, battle: null };
    const live = await ensureLiveBattle(battle);
    return {
      roomId, battle,
      gifters: topBattleGifters(live),
      scores: { left: live.left, right: live.right },
      seq: live.seq,
    };
  } catch (e) {
    console.error('battle snapshot error:', e.message);
    return { roomId, battle: null };
  }
}

// ── Live battle tally ─────────────────────────────────────────────────────────
// Battle scores + top gifters kept in memory per running battle, so a gift
// updates both rooms the moment its wallet transaction commits instead of
// after re-summing room_gift_events. Each gift is counted by its
// room_gift_events id: the tally is seeded from the DB once, and a gift that
// landed in both the seed and the live path is still counted exactly once.
const liveBattles = new Map();     // inviteId -> tally (see newLiveBattle)
const liveBattleLoads = new Map(); // inviteId -> Promise<tally> while seeding
const LIVE_BATTLE_KEEP_MS = 10 * 60_000; // drop a tally this long after its battle ends

function newLiveBattle(battle) {
  const startedAt = new Date(battle.started_at).getTime();
  return {
    id: battle.id,
    fromRoomId: battle.from_room_id,
    toRoomId: battle.to_room_id,
    startedAt,
    endsAt: startedAt + (battle.duration_minutes ?? 0) * 60_000,
    left: 0,
    right: 0,
    seq: 0,               // bumped per counted gift — lets clients drop stale updates
    ended: false,         // set when the battle is cancelled — the totals are final
    counted: new Set(),   // room_gift_events ids already in the totals
    gifters: { left: new Map(), right: new Map() }, // senderId -> gifter row
  };
}

/** Add one gift event to the tally; false if it was already counted or doesn't belong. */
function countBattleGift(live, ev) {
  if (live.ended || !ev?.id || live.counted.has(ev.id)) return false;
  const side = ev.room_id === live.fromRoomId ? 'left' : ev.room_id === live.toRoomId ? 'right' : null;
  const at = new Date(ev.created_at).getTime();
  if (!side || at < live.startedAt || at >= live.endsAt) return false;
  const total = Number(ev.total) || 0;
  live.counted.add(ev.id);
  live[side] += total;
  const g = live.gifters[side].get(ev.sender_id)
    ?? { id: ev.sender_id, full_name: ev.full_name ?? null, username: ev.username ?? null, avatar_url: ev.avatar_url ?? null, total_coins: 0 };
  g.total_coins += total;
  live.gifters[side].set(ev.sender_id, g);
  live.seq += 1;
  return true;
}

function topBattleGifters(live) {
  const top = map => [...map.values()].sort((a, b) => b.total_coins - a.total_coins).slice(0, 5);
  return { left: top(live.gifters.left), right: top(live.gifters.right) };
}

function pruneLiveBattles() {
  const cutoff = Date.now() - LIVE_BATTLE_KEEP_MS;
  for (const [id, live] of liveBattles) if (live.endsAt < cutoff) liveBattles.delete(id);
}

/** The in-memory tally for a battle, seeding it from the DB on first use. */
function ensureLiveBattle(battle) {
  const existing = liveBattles.get(battle.id);
  if (existing) return Promise.resolve(existing);
  if (!liveBattleLoads.has(battle.id)) {
    const load = battleModel.getBattleGiftEvents(battle)
      .then(rows => {
        pruneLiveBattles();
        const live = newLiveBattle(battle);
        rows.forEach(r => countBattleGift(live, r));
        liveBattles.set(battle.id, live);
        scheduleBattleEnd(battle);
        return live;
      })
      .finally(() => liveBattleLoads.delete(battle.id));
    liveBattleLoads.set(battle.id, load);
  }
  return liveBattleLoads.get(battle.id);
}

function emitBattleUpdate(io, live, clientGiftId) {
  const scoreData = { invite_id: live.id, left: live.left, right: live.right, seq: live.seq, client_gift_id: clientGiftId ?? null };
  const giftersData = { invite_id: live.id, seq: live.seq, ...topBattleGifters(live) };
  for (const roomId of [live.fromRoomId, live.toRoomId]) {
    io.to(roomId).emit('battle_scores', scoreData);
    io.to(roomId).emit('battle_gifters', giftersData);
  }
}

/**
 * Final result from the tally's confirmed totals. winner is 'from' / 'to', or
 * null when the scores are equal (a draw). Top 3 supporters per side.
 */
function buildBattleResult(battle, live, { reason, endedBy }) {
  const top = topBattleGifters(live);
  const side = (prefix, score, supporters) => ({
    room_id: battle[`${prefix}_room_id`],
    room_name: battle[`${prefix}_room_name`] ?? '',
    room_image_url: battle[`${prefix}_room_image_url`] ?? null,
    host_user_id: battle[`${prefix}_user_id`],
    host_name: battle[`${prefix}_host_name`] || battle[`${prefix}_host_username`] || null,
    score,
    supporters: supporters.slice(0, 3),
  });
  return {
    invite_id: battle.id,
    reason,
    ended_by: endedBy ?? null,
    winner: live.left > live.right ? 'from' : live.right > live.left ? 'to' : null,
    from: side('from', live.left, top.left),
    to: side('to', live.right, top.right),
  };
}

/**
 * End a running battle and send both rooms the result (battle_ended).
 * Used for Cancel Battle and when the timer runs out. Returns null if it
 * had already ended (the DB status guard makes a second end a no-op).
 */
async function endBattle(battleOrId, { reason, endedBy = null }) {
  const battle = typeof battleOrId === 'string' ? await battleModel.getInviteById(battleOrId) : battleOrId;
  if (!battle || battle.status !== 'active' || !battle.started_at) return null;
  // Seed the tally first (if this server hasn't yet), so the result has
  // every gift confirmed up to now.
  const live = await ensureLiveBattle(battle);
  const ended = await battleModel.finishBattle(battle.id);
  if (!ended) return null;

  live.ended = true; // gifts paid for from here on no longer count
  clearBattleEndTimer(battle.id);
  const result = buildBattleResult(battle, live, { reason, endedBy });
  if (_io) {
    _io.to(battle.from_room_id).emit('battle_ended', result);
    _io.to(battle.to_room_id).emit('battle_ended', result);
  }
  return result;
}

// Time-up: every running battle has a timer that ends it and sends the
// result. A short grace lets gifts paid in the last moment (whose wallet
// transaction is still committing) count — anything created after the end
// time is excluded by countBattleGift regardless.
const battleEndTimers = new Map(); // inviteId -> Timeout
const BATTLE_END_GRACE_MS = 1500;

function clearBattleEndTimer(inviteId) {
  const t = battleEndTimers.get(inviteId);
  if (t) { clearTimeout(t); battleEndTimers.delete(inviteId); }
}

function scheduleBattleEnd(battle) {
  if (!battle?.started_at || battleEndTimers.has(battle.id)) return;
  const endsAt = new Date(battle.started_at).getTime() + (battle.duration_minutes ?? 0) * 60_000;
  const delay = Math.max(0, endsAt - Date.now()) + BATTLE_END_GRACE_MS;
  battleEndTimers.set(battle.id, setTimeout(() => {
    battleEndTimers.delete(battle.id);
    // Re-read: it may have been cancelled meanwhile
    endBattle(battle.id, { reason: 'time_up' })
      .catch(e => console.error('battle time-up end error:', e.message));
  }, delay));
}

/** On boot: re-arm timers for running battles; end any that ran out while down. */
async function resumeBattleTimers() {
  try {
    const battles = await battleModel.getActiveBattles();
    battles.forEach(scheduleBattleEnd);
    if (battles.length) console.log(`[BATTLE] resumed ${battles.length} battle timer(s)`);
  } catch (e) { console.error('resumeBattleTimers error:', e.message); }
}

async function getRoomInfoSafe(roomId) {
  try { return await roomModel.getRoomDetail(roomId); } catch { return null; }
}

async function saveMessage(roomId, userId, type, content) {
  let id = null;
  try {
    const ins = await db.query(
      `INSERT INTO chat_messages (room_id, user_id, type, content) VALUES ($1, $2, $3, $4) RETURNING id`,
      [roomId, userId || null, type, content]
    );
    id = ins.rows[0]?.id ?? null;
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
  return id;
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
  // Read-only lookups run alongside getting a pool client, not inside the
  // transaction — every round trip here delays the gift for the whole room.
  const [clientRes, liveRoomRes, configRes] = await Promise.allSettled([
    db.pool.connect(),
    db.query(`SELECT 1 FROM live_broadcasts WHERE room_id = $1 LIMIT 1`, [roomId]),
    earningSlabs.loadConfigVersions(),
  ]);
  if (clientRes.status === 'rejected' || liveRoomRes.status === 'rejected' || configRes.status === 'rejected') {
    if (clientRes.status === 'fulfilled') clientRes.value.release();
    const failed = [clientRes, liveRoomRes, configRes].find(r => r.status === 'rejected');
    console.error('processGift error:', failed.reason?.message);
    return { ok: false, message: 'Gift processing failed.' };
  }
  const client = clientRes.value;
  const liveRoom = liveRoomRes.value;
  const configVersions = configRes.value;
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

    // 3. Award gems to recipient at the admin's gem value for this service
    //    (Video Live for Go-Live rooms, else Audio Chat) — host receives only gems
    const giftGems = earningSlabs.gemsForCoins(
      configVersions, liveRoom.rows.length ? 'live' : 'chatroom', new Date(), totalCoins,
    );
    if (giftGems > 0) {
      await client.query(
        `INSERT INTO wallets (user_id, gems) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET gems = wallets.gems + $2, updated_at = NOW()`,
        [recipientId, giftGems]
      );
    }

    // 5. Save gift event record
    const giftEventResult = await client.query(
      `INSERT INTO room_gift_events (room_id, sender_id, recipient_id, gift_id, gift_name, gift_image_url, coins, quantity, target_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, room_id, sender_id, (coins * quantity)::int AS total, created_at`,
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
    return {
      ok: true, senderBalance, totalCoins: total_coins_received, currentLevel: current_level,
      giftEvent: giftEventResult.rows[0],
    };
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

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Missing token'));
    try {
      const { payload, revoked } = await verifyUserToken(token);
      // The app logs out on this message (see the chat/Friend Zone socket stores).
      if (revoked) return next(new Error('Session revoked'));
      if (!payload) return next(new Error('Invalid token'));
      socket.userId = payload.sub;
      next();
    } catch { next(new Error('Invalid token')); }
  });

  setIo(io);
  resumeBattleTimers();

  io.on('connection', async (socket) => {
    const userId = socket.userId;

    // Every authenticated connection joins its own private room — used for
    // generic per-user delivery (chat) instead of a dedicated presence map.
    socket.join(`user_${userId}`);

    // ── Chatroom ownership ───────────────────────────────────────────────────
    // Pushed on every connect so the app's cached flag stays correct even if
    // a room was created (e.g. by an admin) while the user was offline.
    const sendChatroomStatus = () => userHasChatroom(userId)
      .then(hasChatroom => socket.emit('my_chatroom_status', { hasChatroom }))
      .catch(e => console.error('my_chatroom_status error:', e.message));
    sendChatroomStatus();
    socket.on('my_chatroom_status_request', sendChatroomStatus);

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
        // Caller must be able to afford at least the first 5-second tick up front.
        const firstTickCoins = coinsPerTickForMinute({ callType, minuteNumber: 1 });
        const wallet = await walletModel.getWallet(userId);
        if (!wallet || wallet.coins < firstTickCoins) {
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
        let callGiftGems = 0;
        try {
          // Callee earns gems (not coins) at the admin's Friend Zone gem value
          const gems = await gemsForCoins(totalCoins);
          if (gems > 0) {
            await walletModel.creditGems(recipientId, gems);
            callGiftGems = gems;
          }
        } catch (e) { console.error('friend_zone_call_send_gift gems credit error:', e.message); }

        await friendZoneModel.logCallGift({
          callId, senderId: userId, recipientId,
          giftId: gift.id, giftName: gift.name, giftImageUrl: gift.image_url,
          coins: gift.coins, qty: quantity, gems: callGiftGems,
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

        const peerId = await chatModel.getPeerId(conversation, userId);
        if (await chatModel.isBlockedBetween(userId, peerId)) {
          socket.emit('chat_error', { conversationId, message: "You can't message this user." });
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

        // If the recipient had hidden (deleted-for-me) this conversation, a new
        // message brings it back into their list — same as most chat apps.
        await chatModel.unhideForNewMessage(conversationId, peerId);
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

    // One-off online check for a DM peer (e.g. opening a conversation) — reuses
    // the same global presence map Friend Zone maintains, since "online" is an
    // app-wide concept, not scoped to any one feature. Live updates after this
    // come from the 'friend_zone_user_status' broadcast every socket already
    // receives (see the 'friend_zone_presence' room join above).
    socket.on('chat_check_online', async ({ userId: peerId }) => {
      if (!peerId) return;
      const isOnline = isFriendZoneUserOnline(peerId);
      let lastSeenAt = null;
      if (!isOnline) {
        try {
          const r = await db.query(`SELECT last_seen_at FROM users WHERE id = $1`, [peerId]);
          lastSeenAt = r.rows[0]?.last_seen_at ?? null;
        } catch { /* non-fatal */ }
      }
      socket.emit('chat_online_status', { userId: peerId, isOnline, lastSeenAt });
    });

    socket.on('join_room', async ({ roomId }) => {
      if (!roomId) return;

      // Every lookup the join needs runs in parallel — run one after another
      // they added up to the noticeable wait when opening a room.
      const [entryBan, blocked, userRow, userLevel, hostUserId, roomInfo, battleSnapshot] = await Promise.all([
        // 24h report ban on this user's ID or on this room — enforced here, so
        // switching rooms, reconnecting or restarting the app can't get past it
        moderationModel.getEntryBan(userId, roomId).catch(e => {
          console.error('ban check error:', e.message);
          return null;
        }),
        db.query(`SELECT 1 FROM room_blocked_users WHERE room_id = $1 AND user_id = $2`, [roomId, userId])
          .then(r => r.rows.length > 0)
          .catch(() => false), // non-fatal, allow join
        db.query(`SELECT full_name, username, avatar_url FROM users WHERE id = $1`, [userId])
          .then(r => r.rows[0] ?? null)
          .catch(() => null),
        getUserLevelFromDb(db, userId),
        getHostUserId(roomId),
        getRoomInfoSafe(roomId),
        getBattleSnapshot(roomId),
        ensureRoomCache(roomId),
      ]);

      if (entryBan) {
        socket.emit('join_blocked', { message: entryBan.message, kind: `${entryBan.kind}_ban`, expiresAt: entryBan.expiresAt });
        return;
      }
      if (blocked) {
        socket.emit('join_blocked', { message: 'You are blocked from this room', kind: 'room_block' });
        return;
      }

      const userName = userRow?.full_name || userRow?.username || 'Someone';
      const avatarUrl = userRow?.avatar_url || null;

      socket.join(roomId);
      socket.currentRoomId = roomId;
      socket.userName = userName;
      socket.avatarUrl = avatarUrl;
      socket.userLevel = userLevel;

      if (!roomSockets.has(roomId)) roomSockets.set(roomId, new Set());
      roomSockets.get(roomId).add(socket.id);
      if (!roomSeats.has(roomId)) roomSeats.set(roomId, []);
      if (!roomUsers.has(roomId)) roomUsers.set(roomId, new Map());
      roomUsers.get(roomId).set(socket.id, { userId, userName, avatarUrl });

      const userIsHost = hostUserId === userId;
      socket.isHost = userIsHost;

      if (userIsHost) {
        roomHostSockets.set(roomId, socket.id);
        const seats = roomSeats.get(roomId);
        const hostSlot = seats.find(s => s.slotIndex === 0);
        if (!hostSlot) seats.unshift({ slotIndex: 0, userId, userName, avatarUrl, isHost: true });
        else { hostSlot.userName = userName; hostSlot.avatarUrl = avatarUrl; }
        io.to(roomId).emit('host_status', hostStatusFor(roomId));

        // Host reconnected within the grace period — cancel the pending auto-end.
        const pendingTimer = pendingBroadcastEndTimers.get(roomId);
        if (pendingTimer) {
          clearTimeout(pendingTimer);
          pendingBroadcastEndTimers.delete(roomId);
        }
      }

      if (roomInfo) socket.emit('room_info', roomInfo);
      socket.emit('seats_update', serializeSeats(roomId));
      socket.emit('host_status', hostStatusFor(roomId));
      socket.emit('battle_state', battleSnapshot);
      socket.emit('chat_history', roomMessages.get(roomId) ?? []);
      socket.emit('broadcast_like_state', { roomId, liked: broadcastLikers.get(roomId)?.has(userId) ?? false });
      socket.emit('pinned_comment_update', { roomId, messageId: roomPinnedMessageId.get(roomId) ?? null });

      io.to(roomId).emit('online_count', { roomId, count: onlineCount(roomId) });

      // Send active reward to the joining user (so BG applies immediately on join/re-join)
      try {
        const rewardRow = await db.query(
          `SELECT t.reward_bg_url, t.reward_frame_url, tp.completed_at
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
          const { reward_bg_url, reward_frame_url, completed_at } = rewardRow.rows[0];
          console.log(`[SOCKET] sending active reward on join to ${userId}: bg=${reward_bg_url}`);
          // Rewards last 24h from completion — the app removes them then
          const expires_at = new Date(new Date(completed_at).getTime() + 24 * 60 * 60 * 1000).toISOString();
          socket.emit('reward_applied', { reward_bg_url, reward_frame_url, expires_at });
        }
      } catch (e) { /* non-fatal */ }

      // Join notice — live only (clients show a short welcome toast). Not kept
      // in roomMessages, so it never replays as a permanent line in chat_history.
      const joinMsg = {
        id: `join_${socket.id}_${Date.now()}`,
        type: 'join',
        createdAt: new Date().toISOString(),
        user: { id: userId, name: userName, avatarUri: avatarUrl ?? '', level: socket.userLevel ?? 0 },
      };
      io.to(roomId).emit('chat_message', joinMsg);
      // Save join to DB
      await saveMessage(roomId, userId, 'join', `${userName} joined`);
    });

    // "Refresh Room" from the app menu — re-send this room's state to the caller
    // only. Unlike join_room, no join notice / welcome toast for everyone.
    // Either host cancels a running battle: it ends at once and both rooms get
    // the result, decided by the confirmed gifting totals at this moment.
    socket.on('cancel_battle', async ({ inviteId } = {}, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        if (!inviteId) return reply({ ok: false, message: 'Battle not found.' });
        const battle = await battleModel.getInviteById(inviteId);
        if (!battle) return reply({ ok: false, message: 'Battle not found.' });
        if (battle.from_user_id !== userId && battle.to_user_id !== userId) {
          return reply({ ok: false, message: 'Only the two hosts can cancel this battle.' });
        }
        if (battle.status !== 'active') return reply({ ok: false, message: 'This battle has already ended.' });

        const result = await endBattle(battle, { reason: 'cancelled', endedBy: userId });
        if (!result) return reply({ ok: false, message: 'This battle has already ended.' });
        reply({ ok: true, result });
      } catch (e) {
        console.error('cancel_battle error:', e.message);
        reply({ ok: false, message: 'Could not cancel the battle. Please try again.' });
      }
    });

    socket.on('refresh_room', async ({ roomId }) => {
      if (!roomId || socket.currentRoomId !== roomId) return;
      const [roomInfo, battleSnapshot] = await Promise.all([
        getRoomInfoSafe(roomId),
        getBattleSnapshot(roomId),
        ensureRoomCache(roomId).catch(() => { /* send empty */ }),
      ]);
      if (roomInfo) socket.emit('room_info', roomInfo);
      socket.emit('seats_update', serializeSeats(roomId));
      socket.emit('host_status', hostStatusFor(roomId));
      socket.emit('battle_state', battleSnapshot);
      socket.emit('chat_history', roomMessages.get(roomId) ?? []);
      socket.emit('pinned_comment_update', { roomId, messageId: roomPinnedMessageId.get(roomId) ?? null });
      socket.emit('online_count', { roomId, count: onlineCount(roomId) });
    });

    // ── Seat management ────────────────────────────────────────────────────────

    socket.on('request_seat', ({ roomId, slotIndex }) => {
      if (!roomId) return;
      const hostSocketId = roomHostSockets.get(roomId);
      if (!isHostOnline(roomId)) {
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

    // Host leaves / returns to the audio stage while staying in the room
    socket.on('host_leave_stage', ({ roomId }) => {
      if (!roomId || roomHostSockets.get(roomId) !== socket.id) return;
      roomHostOffStage.add(roomId);
      io.to(roomId).emit('host_status', hostStatusFor(roomId));
    });

    socket.on('host_return_stage', ({ roomId }) => {
      if (!roomId || roomHostSockets.get(roomId) !== socket.id) return;
      roomHostOffStage.delete(roomId);
      io.to(roomId).emit('host_status', hostStatusFor(roomId));
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

    // Host or a currently-seated co-host force-mutes/unmutes another stage user.
    // "Co-host" isn't a persisted role — it's whoever currently occupies a
    // non-zero seat, same definition used on the live-broadcast screen.
    socket.on('force_mute_user', ({ roomId, targetUserId, isMuted }) => {
      if (!roomId || !socket.userId || !targetUserId) return;
      const seats = roomSeats.get(roomId);
      if (!seats) return;

      const callerIsHost = socket.isHost;
      const callerIsCoHost = seats.some(s => s.userId === socket.userId && s.slotIndex !== 0);
      if (!callerIsHost && !callerIsCoHost) return;

      const targetSeat = seats.find(s => s.userId === targetUserId);
      if (!targetSeat) return;
      targetSeat.isMuted = !!isMuted;
      io.to(roomId).emit('seats_update', serializeSeats(roomId));

      // Tell the target's socket(s) to actually stop/resume publishing audio —
      // seat.isMuted alone only updates the UI badge, it doesn't touch Agora.
      const usersMap = roomUsers.get(roomId);
      if (usersMap) {
        for (const [sid, u] of usersMap.entries()) {
          if (u.userId === targetUserId) io.to(sid).emit('forced_mute', { roomId, isMuted: !!isMuted });
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

    // Speaking level (0–1) from someone on a seat, for the stage's voice waves.
    // Only seated users (incl. the host on slot 0) are in the voice channel, so
    // only they can report; relayed to the rest of the room, not stored.
    socket.on('speaking_level', ({ roomId, level }) => {
      if (!roomId || !socket.userId || socket.currentRoomId !== roomId) return;
      const now = Date.now();
      if (socket.lastSpeakingAt && now - socket.lastSpeakingAt < 80) return; // cheap flood guard
      socket.lastSpeakingAt = now;
      const seated = (roomSeats.get(roomId) ?? []).some(s => s.userId === socket.userId);
      if (!seated) return;
      const l = Math.max(0, Math.min(1, Number(level) || 0));
      socket.to(roomId).emit('speaking_level', { userId: socket.userId, level: Math.round(l * 100) / 100 });
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

    socket.on('send_message', async ({ roomId, text, clientGiftId }) => {
      if (!roomId || !text?.trim()) return;

      const trimmed = text.trim();

      // ── Gift message ───────────────────────────────────────────────────────
      const giftPayload = parseGiftPayload(trimmed);
      if (giftPayload) {
        const { giftName, toName, imgUrl, bgColor, giftId, coins, qty, senderId, recipientId, giftForUserId } = giftPayload;
        const totalCoins = coins * qty;

        // Process wallet transaction (gems go to host=recipientId, history tracks actual target).
        // The room's running battle is looked up at the same time, not after.
        const battleLookup = battleModel.getActiveBattleForRoom(roomId).catch(() => null);
        const result = await processGift({
          roomId, senderId, recipientId,
          giftId, giftName, giftImageUrl: imgUrl,
          coins, qty, targetUserId: giftForUserId,
        });

        if (!result.ok) {
          // Notify sender of failure (insufficient coins etc.) — client_gift_id
          // lets the app take back the score it added optimistically.
          socket.emit('gift_error', { message: result.message, client_gift_id: clientGiftId ?? null });
          return;
        }

        socket.emit('wallet_update', { coins: result.senderBalance });

        // Battle score first — before saving the chat line etc. — so both rooms
        // see the gift's power the moment it's paid for.
        try {
          const b = await battleLookup;
          if (b) {
            const live = await ensureLiveBattle(b);
            countBattleGift(live, {
              ...result.giftEvent,
              full_name: socket.userName ?? null,
              avatar_url: socket.avatarUrl ?? null,
            });
            // Emitted even if the seed already held this gift, so the sender's
            // pending score is confirmed by these exact totals.
            emitBattleUpdate(io, live, clientGiftId);
          }
        } catch (e) { console.error('battle_scores emit error:', e.message); }
        // Always settle the sender's pending gift (also when there's no battle)
        if (clientGiftId) socket.emit('gift_ack', { client_gift_id: clientGiftId });

        // Save first so the live message carries its DB id (pin/delete survive a reload)
        const giftRowId = await saveMessage(roomId, senderId, 'gift', trimmed);

        // Build chat message
        const msg = {
          id: giftRowId ?? `gift_${socket.id}_${Date.now()}`,
          type: 'gift',
          user: { id: socket.userId, name: socket.userName ?? 'User', avatarUri: socket.avatarUrl ?? '', level: socket.userLevel ?? 0 },
          giftName,
          giftTo: toName,
          giftImageUrl: imgUrl,
          giftBgColor: bgColor,
          giftCoins: coins,
          giftQty: qty,
          giftRecipientId: giftForUserId || recipientId,
          giftId,
          giftForId: giftForUserId || recipientId,
          createdAt: new Date().toISOString(),
        };

        if (!roomMessages.has(roomId)) roomMessages.set(roomId, []);
        const msgs = roomMessages.get(roomId);
        msgs.push(msg);
        if (msgs.length > 100) msgs.shift();

        io.to(roomId).emit('chat_message', msg);

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
                    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                  });
                }
              } catch (emitErr) {
                console.error('[TASK] emit error:', emitErr.message);
              }
            }
          }
        } catch (e) { console.error('[TASK] task progress error:', e.message, e.stack); }

        return;
      }

      // ── Regular message ────────────────────────────────────────────────────
      const savedId = await saveMessage(roomId, userId, 'message', trimmed);
      const msg = {
        id: savedId ?? `msg_${socket.id}_${Date.now()}`,
        type: 'message',
        user: { id: socket.userId, name: socket.userName ?? 'User', avatarUri: socket.avatarUrl ?? '', level: socket.userLevel ?? 0 },
        text: trimmed,
        createdAt: new Date().toISOString(),
      };

      if (!roomMessages.has(roomId)) roomMessages.set(roomId, []);
      const msgs = roomMessages.get(roomId);
      msgs.push(msg);
      if (msgs.length > 100) msgs.shift();

      io.to(roomId).emit('chat_message', msg);
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
      // Stored rows have UUID ids (older live-only ids like msg_<socket>_<ts> aren't in the DB)
      if (/^[0-9a-f-]{36}$/i.test(messageId)) {
        db.query(`DELETE FROM chat_messages WHERE id = $1 AND room_id = $2`, [messageId, roomId]).catch(() => {});
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
        const result = await moderationModel.reportUser({
          reporterId: socket.userId, reportedUserId: reportedUserId || null, roomId,
          reason: reason || null, kind: 'message', messageId, messageText,
        });
        socket.emit('report_comment_result', { ok: true, duplicate: !!result.duplicate });
        applyModerationResult(result);
      } catch (e) {
        if (e instanceof moderationModel.ModerationError) {
          socket.emit('report_comment_result', { ok: false, message: e.message });
          return;
        }
        console.error('report_comment error:', e.message);
        socket.emit('report_comment_result', { ok: false });
      }
    });

    // The app asks (once its app-wide socket is up) for warnings that were
    // issued while it was offline.
    socket.on('moderation_sync', async () => {
      try {
        const warnings = await moderationModel.takeUndeliveredWarnings(userId);
        warnings.forEach(w => socket.emit('moderation_warning', {
          id: w.id, message: w.message, createdAt: new Date(w.created_at).toISOString(),
        }));
      } catch (e) { console.error('moderation_sync error:', e.message); }
    });

    // ── Disconnect ─────────────────────────────────────────────────────────────

    socket.on('disconnect', (reason) => {
      // Friend Zone presence cleanup — runs regardless of room membership
      const fzSockets = friendZoneOnlineUsers.get(userId);
      if (fzSockets) {
        fzSockets.delete(socket.id);
        console.log('[FZ-PRESENCE] disconnect', userId, 'socket', socket.id, 'set size now', fzSockets.size);
        if (fzSockets.size === 0) {
          friendZoneOnlineUsers.delete(userId);
          console.log('[FZ-PRESENCE] broadcasting OFFLINE for', userId);
          io.to('friend_zone_presence').emit('friend_zone_user_status', { userId, isOnline: false });
          db.query(`UPDATE users SET last_seen_at = NOW() WHERE id = $1`, [userId]).catch(() => {});

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
        // Left the room on purpose → next visit starts on stage. A dropped
        // connection keeps the choice, so a reconnect can't reopen their mic.
        if (reason === 'client namespace disconnect') roomHostOffStage.delete(roomId);
        io.to(roomId).emit('host_status', hostStatusFor(roomId));

        // Grace period before treating this as a real broadcast end (covers brief
        // network blips / app backgrounding) — if the host doesn't reconnect in
        // time, auto-end the live broadcast so it drops out of the Live Now list
        // for everyone instead of sitting there as a zombie session.
        const existingTimer = pendingBroadcastEndTimers.get(roomId);
        if (existingTimer) clearTimeout(existingTimer);
        pendingBroadcastEndTimers.set(roomId, setTimeout(async () => {
          pendingBroadcastEndTimers.delete(roomId);
          if (roomHostSockets.get(roomId)) return; // host reconnected under a different socket id
          roomHostOffStage.delete(roomId);
          try {
            const activeBroadcast = await liveBroadcastModel.getBroadcastByRoomId(roomId);
            if (!activeBroadcast) return;
            const ended = await liveBroadcastModel.endBroadcast(activeBroadcast.id);
            if (ended) {
              io.emit('live_broadcast_ended', { broadcastId: ended.id, roomId, hostUserId: ended.host_user_id });
            }
          } catch (err) {
            console.warn('[LiveBroadcast] auto-end on host disconnect failed:', err);
          }
        }, 20000));
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
function isRoomHostOnline(roomId) { return isHostOnline(roomId); }
function getHostSocketId(roomId) { return roomHostSockets.get(roomId) ?? null; }
// "Co-host" isn't a persisted role — it's whoever currently occupies a
// non-zero stage seat, same live definition used for force-mute and the
// stage-tap profile actions.
function isUserSeatedInRoom(roomId, userId) {
  const seats = roomSeats.get(roomId);
  if (!seats) return false;
  return seats.some(s => s.userId === userId && s.slotIndex !== 0);
}
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

// Push a user's current chatroom-ownership flag to all their open sockets —
// called after a room is created for them over HTTP (by them or an admin).
async function notifyChatroomStatus(userId) {
  if (!_io || !userId) return;
  try {
    const hasChatroom = await userHasChatroom(userId);
    _io.to(`user_${userId}`).emit('my_chatroom_status', { hasChatroom });
  } catch (e) { console.error('notifyChatroomStatus error:', e.message); }
}

function kickUserFromRoom(roomId, targetUserId, payload = { message: 'You have been blocked from this room', kind: 'room_block' }) {
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
      sock.emit('kicked_from_room', payload);
      sock.leave(roomId);
      sock.currentRoomId = null;
    }
    roomSockets.get(roomId)?.delete(socketId);
    usersMap.delete(socketId);
    if (roomHostSockets.get(roomId) === socketId) {
      roomHostSockets.delete(roomId);
      roomHostOffStage.delete(roomId);
      _io.to(roomId).emit('host_status', hostStatusFor(roomId));
    }

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

/** Rooms the user currently has a socket in. */
function roomsWithUser(targetUserId) {
  const out = [];
  for (const [roomId, usersMap] of roomUsers) {
    for (const u of usersMap.values()) {
      if (u.userId === targetUserId) { out.push(roomId); break; }
    }
  }
  return out;
}

/**
 * Carry out what a report triggered: deliver a warning live, or enforce a new
 * 24h ban — the host's ID is removed from every room they're in, and everyone
 * is removed from the banned room. (New entries are refused in join_room.)
 */
function applyModerationResult(result) {
  if (!_io || !result) return;
  if (result.warning) {
    const { id, userId, message, createdAt } = result.warning;
    emitToUser(_io, userId, 'moderation_warning', { id, message, createdAt });
    // Online now → delivered; otherwise sent on their next moderation_sync
    if (isFriendZoneUserOnline(userId)) moderationModel.markWarningDelivered(id).catch(() => {});
  }
  if (result.ban) {
    const { roomId, hostUserId, expiresAt } = result.ban;
    for (const rid of roomsWithUser(hostUserId)) {
      kickUserFromRoom(rid, hostUserId, { message: moderationModel.USER_BANNED_MESSAGE, kind: 'user_ban', expiresAt });
    }
    const others = new Set([...(roomUsers.get(roomId)?.values() ?? [])].map(u => u.userId));
    for (const uid of others) {
      kickUserFromRoom(roomId, uid, { message: moderationModel.ROOM_BANNED_MESSAGE, kind: 'room_ban', expiresAt });
    }
  }
}

module.exports = {
  applyModerationResult,
  setupSocket, setIo, getOnlineCount, getAllOnlineCounts, isRoomHostOnline, getHostSocketId, getRoomMembers, kickUserFromRoom,
  isFriendZoneUserOnline, debugFriendZonePresence, emitToUser, isUserSeatedInRoom, notifyChatroomStatus,
  scheduleBattleEnd,
};
