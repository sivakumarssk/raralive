const db = require('../config/db');
const battleModel = require('../models/battle.model');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Look up the host_user_id of a room, or null if not found.
 */
async function getRoomHost(roomId) {
  const r = await db.query(
    `SELECT host_user_id, room_name FROM rooms WHERE id=$1 AND status='active'`,
    [roomId]
  );
  return r.rows[0] ?? null;
}

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * POST /api/battle/invite
 * Body: { from_room_id, to_room_id, duration_minutes? }
 */
async function sendBattleInvite(req, res, next) {
  try {
    const fromUserId = req.user.id;
    const { from_room_id, to_room_id, duration_minutes = 25 } = req.body;

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
      durationMinutes: Number(duration_minutes),
    });

    // Notify target room host
    await battleModel.createNotification({
      userId: toUserId,
      type: 'battle_invite',
      title: '⚔️ Battle Invite!',
      body: `${fromRoom.room_name} has challenged your room to a battle!`,
      data: {
        invite_id: invite.id,
        from_room_id,
        from_room_name: fromRoom.room_name,
      },
    });

    return res.status(201).json({ success: true, data: invite });
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

    // Notify inviter
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
    if (invite.to_user_id !== userId) {
      return res.status(403).json({ success: false, message: 'You cannot decline this invite.' });
    }
    if (invite.status !== 'pending') {
      return res.status(409).json({ success: false, message: `Invite is already ${invite.status}.` });
    }

    const updated = await battleModel.updateInviteStatus(invite_id, 'declined');
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
};