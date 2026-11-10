const db = require('../config/db');
const battleModel = require('../models/battle.model');
const battleTargetModel = require('../models/battle-target.model');
const ioInstance = require('../utils/io-instance');
const { getHostSocketId, scheduleBattleEnd } = require('../socket');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Look up the host_user_id of a room, or null if not found.
 */
async function getRoomHost(roomId) {
  const r = await db.query(
    `SELECT host_user_id, room_name, room_image_url FROM rooms WHERE id=$1 AND status='active'`,
    [roomId]
  );
  return r.rows[0] ?? null;
}

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * POST /api/battle/invite
 * Body: { from_room_id, to_room_id, duration_minutes?, mode?, target_id? }
 * target_id (Gifting Battle) is one of the admin's active battle targets.
 */
async function sendBattleInvite(req, res, next) {
  try {
    const fromUserId = req.user.id;
    const { from_room_id, to_room_id, duration_minutes = 25, mode = 'normal', target_id } = req.body;
    if (!['normal', 'gifting'].includes(mode)) {
      return res.status(400).json({ success: false, message: 'mode must be "normal" or "gifting".' });
    }
    // The app offers 5–30 min; up to 60 stays accepted so older app versions
    // (which offered 45) keep working until users update.
    const durationMinutes = Number(duration_minutes);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 60) {
      return res.status(400).json({ success: false, message: 'Invalid battle duration.' });
    }

    // Gifting Battle target — validated against the admin's active list. Older
    // app versions send none, so it stays optional.
    let target = null;
    await battleTargetModel.ensureTable();
    if (mode === 'gifting' && target_id) {
      target = await battleTargetModel.getActiveById(target_id);
      if (!target) {
        return res.status(400).json({ success: false, message: 'That gift target is no longer available. Please pick another.' });
      }
    }

    if (!from_room_id || !to_room_id) {
      return res.status(400).json({ success: false, message: 'from_room_id and to_room_id are required.' });
    }
    if (from_room_id === to_room_id) {
      return res.status(400).json({ success: false, message: 'Cannot invite your own room.' });
    }

    // Validate sender owns from_room
    const fromRoom = await getRoomHost(from_room_id);
    if (!fromRoom) {
      return res.status(404).json({ success: false, message: 'Your room not found or inactive.' });
    }
    if (fromRoom.host_user_id !== fromUserId) {
      return res.status(403).json({ success: false, message: 'You are not the host of that room.' });
    }

    // Find target room + host
    const toRoom = await getRoomHost(to_room_id);
    if (!toRoom) {
      return res.status(404).json({ success: false, message: 'Target room not found or inactive.' });
    }
    const toUserId = toRoom.host_user_id;

    // Create invite
    const invite = await battleModel.createInvite({
      fromRoomId: from_room_id,
      toRoomId: to_room_id,
      fromUserId,
      toUserId,
      durationMinutes,
      mode,
      targetId: target?.id ?? null,
      targetCoins: target ? Number(target.coin_amount) : null,
    });

    // Real-time popup first — the DB notification and detail lookup below
    // shouldn't delay it.
    const io = ioInstance.get();
    if (io) {
      const hostSocketId = getHostSocketId(to_room_id);
      if (hostSocketId) {
        io.to(hostSocketId).emit('battle_invite', {
          invite_id: invite.id,
          from_room_id,
          from_room_name: fromRoom.room_name,
          from_room_image_url: fromRoom.room_image_url ?? null,
          duration_minutes: durationMinutes,
          mode,
          target_coins: target ? Number(target.coin_amount) : null,
        });
      }
      // Also notify the inviter's room to show waiting state
      io.to(from_room_id).emit('battle_invite_sent', { invite_id: invite.id });
    }

    // The invite reaches the other host only as the live popup above — no
    // notification is saved for it. Respond with the full invite (room
    // names/images) so the app needn't fetch it separately.
    const detail = await battleModel.getInviteById(invite.id);

    return res.status(201).json({ success: true, data: detail ?? invite });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/battle/accept
 * Body: { invite_id }
 */
async function acceptBattleInvite(req, res, next) {
  try {
    const userId = req.user.id;
    const { invite_id } = req.body;

    if (!invite_id) {
      return res.status(400).json({ success: false, message: 'invite_id is required.' });
    }

    const invite = await battleModel.getInviteById(invite_id);
    if (!invite) {
      return res.status(404).json({ success: false, message: 'Invite not found.' });
    }
    if (invite.to_user_id !== userId) {
      return res.status(403).json({ success: false, message: 'You cannot accept this invite.' });
    }
    if (invite.status !== 'pending') {
      return res.status(409).json({ success: false, message: `Invite is already ${invite.status}.` });
    }

    const updated = await battleModel.updateInviteStatus(invite_id, 'accepted');
    const battle = { ...invite, ...updated };

    // Emit real-time accepted event to the inviter's room host — carries the
    // full invite so the inviter can start the battle without re-fetching it.
    const io = ioInstance.get();
    if (io) {
      const hostSocketId = getHostSocketId(invite.from_room_id);
      if (hostSocketId) {
        io.to(hostSocketId).emit('battle_invite_accepted', {
          invite_id,
          to_room_name: invite.to_room_name,
          battle,
        });
      }
    }

    await battleModel.createNotification({
      userId: invite.from_user_id,
      type: 'battle_accepted',
      title: '✅ Battle Accepted!',
      body: `${invite.to_room_name} accepted your battle challenge!`,
      data: { invite_id },
    });

    return res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/battle/decline
 * Body: { invite_id }
 */
async function declineBattleInvite(req, res, next) {
  try {
    const userId = req.user.id;
    const { invite_id } = req.body;

    if (!invite_id) {
      return res.status(400).json({ success: false, message: 'invite_id is required.' });
    }

    const invite = await battleModel.getInviteById(invite_id);
    if (!invite) {
      return res.status(404).json({ success: false, message: 'Invite not found.' });
    }
    const isReceiver = invite.to_user_id === userId;
    const isInviter = invite.from_user_id === userId;
    if (!isReceiver && !isInviter) {
      return res.status(403).json({ success: false, message: 'You cannot decline this invite.' });
    }
    if (invite.status !== 'pending') {
      return res.status(409).json({ success: false, message: `Invite is already ${invite.status}.` });
    }

    const updated = await battleModel.updateInviteStatus(invite_id, 'declined');

    const io = ioInstance.get();
    if (io) {
      if (isReceiver) {
        // Receiver declined → notify inviter
        const hostSocketId = getHostSocketId(invite.from_room_id);
        if (hostSocketId) {
          io.to(hostSocketId).emit('battle_invite_declined', {
            invite_id,
            to_room_name: invite.to_room_name,
          });
        }
      } else {
        // Inviter cancelled → notify receiver to dismiss popup
        const hostSocketId = getHostSocketId(invite.to_room_id);
        if (hostSocketId) {
          io.to(hostSocketId).emit('battle_invite_cancelled', {
            invite_id,
            from_room_name: invite.from_room_name,
          });
        }
      }
    }

    return res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/battle/start
 * Body: { invite_id }
 */
async function startBattle(req, res, next) {
  try {
    const userId = req.user.id;
    const { invite_id } = req.body;

    if (!invite_id) {
      return res.status(400).json({ success: false, message: 'invite_id is required.' });
    }

    const invite = await battleModel.getInviteById(invite_id);
    if (!invite) {
      return res.status(404).json({ success: false, message: 'Invite not found.' });
    }
    if (invite.from_user_id !== userId) {
      return res.status(403).json({ success: false, message: 'Only the inviter can start the battle.' });
    }
    if (invite.status !== 'accepted') {
      return res.status(409).json({ success: false, message: `Battle must be accepted before starting (current: ${invite.status}).` });
    }

    const updated = await battleModel.updateInviteStatus(invite_id, 'active', true);
    // Ends it on time and sends both rooms the winner result
    scheduleBattleEnd({ ...invite, ...updated });

    // Emit battle_started to both rooms so stage UI shows immediately
    const io = ioInstance.get();
    if (io) {
      // Full battle (room names, images, started_at) so both rooms render the
      // banner straight from this event — no follow-up HTTP fetch.
      const battle = { ...invite, ...updated };
      const data = { invite_id, from_room_id: invite.from_room_id, to_room_id: invite.to_room_id, mode: invite.mode, battle };
      io.to(invite.from_room_id).emit('battle_started', data);
      io.to(invite.to_room_id).emit('battle_started', data);
    }

    return res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/battle/my-invites
 * Returns pending invites for the current user.
 */
async function getMyInvites(req, res, next) {
  try {
    const userId = req.user.id;
    const invites = await battleModel.getPendingInvitesForUser(userId);
    return res.json({ success: true, data: invites });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/battle/invite/:inviteId
 * Returns a single invite with full room/user info.
 */
async function getInviteDetail(req, res, next) {
  try {
    const { inviteId } = req.params;
    const invite = await battleModel.getInviteById(inviteId);
    if (!invite) {
      return res.status(404).json({ success: false, message: 'Invite not found.' });
    }
    return res.json({ success: true, data: invite });
  } catch (error) {
    next(error);
  }
}

// ── Notification controllers ──────────────────────────────────────────────────

/**
 * GET /api/battle/notifications
 */
async function getNotifications(req, res, next) {
  try {
    const userId = req.user.id;
    const notifications = await battleModel.getNotificationsForUser(userId);
    return res.json({ success: true, data: notifications });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/battle/notifications/read
 */
async function markNotificationsRead(req, res, next) {
  try {
    const userId = req.user.id;
    await battleModel.markAllReadForUser(userId);
    return res.json({ success: true, message: 'Notifications marked as read.' });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/battle/notifications/unread-count
 */
async function getUnreadCount(req, res, next) {
  try {
    const userId = req.user.id;
    const count = await battleModel.countUnreadForUser(userId);
    return res.json({ success: true, data: { count } });
  } catch (error) {
    next(error);
  }
}

async function getBattleScores(req, res, next) {
  try {
    const { invite_id } = req.params;
    if (!invite_id) return res.status(400).json({ success: false, message: 'invite_id required' });

    const invite = await battleModel.getInviteById(invite_id);
    if (!invite) return res.status(404).json({ success: false, message: 'Invite not found' });
    if (!invite.started_at) return res.json({ success: true, data: { left: 0, right: 0 } });

    const totals = await battleModel.getBattleTotals(invite);
    return res.json({ success: true, data: totals });
  } catch (err) { next(err); }
}

async function getBattleTopGifters(req, res, next) {
  try {
    const { invite_id } = req.params;
    if (!invite_id) return res.status(400).json({ success: false, message: 'invite_id required' });

    const invite = await battleModel.getInviteById(invite_id);
    if (!invite) return res.status(404).json({ success: false, message: 'Invite not found' });
    if (!invite.started_at) return res.json({ success: true, data: { left: [], right: [] } });

    const gifters = await battleModel.getTopGifters(invite);
    return res.json({ success: true, data: gifters });
  } catch (err) { next(err); }
}

async function getUnseenFinishedBattle(req, res, next) {
  try {
    const userId = req.user.id;
    const { room_id } = req.query;
    if (!room_id) return res.json({ success: true, data: null });

    // Auto-finish any active battles whose time has expired
    await db.query(
      `UPDATE battle_invites SET status = 'finished', finished_at = NOW()
       WHERE status = 'active'
         AND (from_room_id = $1 OR to_room_id = $1)
         AND started_at IS NOT NULL
         AND started_at + (duration_minutes || ' minutes')::INTERVAL <= NOW()`,
      [room_id]
    );

    const r = await db.query(
      `SELECT id, from_room_id, to_room_id, from_user_id, to_user_id,
              from_result_seen, to_result_seen, started_at, duration_minutes
       FROM battle_invites
       WHERE status = 'finished'
         AND (from_room_id = $1 OR to_room_id = $1)
         AND finished_at >= NOW() - INTERVAL '1 hour'
         AND (
           (from_user_id = $2 AND from_result_seen = FALSE) OR
           (to_user_id = $2 AND to_result_seen = FALSE)
         )
       ORDER BY finished_at DESC LIMIT 1`,
      [room_id, userId]
    );

    return res.json({ success: true, data: r.rows[0] ?? null });
  } catch (err) { next(err); }
}

async function markBattleResultSeen(req, res, next) {
  try {
    const userId = req.user.id;
    const { invite_id } = req.body;
    if (!invite_id) return res.status(400).json({ success: false, message: 'invite_id required' });

    const invite = await battleModel.getInviteById(invite_id);
    if (!invite) return res.status(404).json({ success: false, message: 'Invite not found' });

    if (invite.from_user_id === userId) {
      await db.query(`UPDATE battle_invites SET from_result_seen = TRUE WHERE id = $1`, [invite_id]);
    } else if (invite.to_user_id === userId) {
      await db.query(`UPDATE battle_invites SET to_result_seen = TRUE WHERE id = $1`, [invite_id]);
    }

    return res.json({ success: true });
  } catch (err) { next(err); }
}

module.exports = {
  sendBattleInvite,
  acceptBattleInvite,
  declineBattleInvite,
  startBattle,
  getMyInvites,
  getInviteDetail,
  getNotifications,
  markNotificationsRead,
  getUnreadCount,
  getBattleScores,
  getBattleTopGifters,
  getUnseenFinishedBattle,
  markBattleResultSeen,
};