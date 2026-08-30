const goLiveModel = require('../models/go-live.model');
const liveBroadcastModel = require('../models/live-broadcast.model');
const db = require('../config/db');

const STATUSES = ['pending', 'approved', 'rejected'];

function validateRequestFields({ fullName, dateOfBirth, language }) {
  if (!fullName || !fullName.trim()) return 'Full name is required.';
  if (!dateOfBirth) return 'Date of birth is required.';
  if (!language || !language.trim()) return 'Language is required.';
  return null;
}

// ── App: submit go-live request ───────────────────────────────────────────────

async function apply(req, res, next) {
  try {
    const userId = req.user.id;
    const { fullName, dateOfBirth, language } = req.body;

    const validationError = validateRequestFields({ fullName, dateOfBirth, language });
    if (validationError) return res.status(400).json({ success: false, message: validationError });

    const existing = await goLiveModel.getLatestForUser(userId);
    if (existing && existing.status !== 'rejected') {
      return res.status(409).json({ success: false, message: 'You already have a Go Live request in progress.' });
    }

    const request = await goLiveModel.createRequest({
      userId,
      fullName: fullName.trim(),
      dateOfBirth,
      language: language.trim(),
    });

    return res.status(201).json({ success: true, data: request });
  } catch (err) { next(err); }
}

// ── App: get my latest request status ─────────────────────────────────────────

async function getMyStatus(req, res, next) {
  try {
    const userId = req.user.id;
    const request = await goLiveModel.getLatestForUser(userId);
    return res.json({ success: true, data: request });
  } catch (err) { next(err); }
}

// ── Admin: list requests ────────────────────────────────────────────────────────

async function listRequests(req, res, next) {
  try {
    const { status = '', limit = '50', offset = '0' } = req.query;
    const result = await goLiveModel.listRequests({
      status: STATUSES.includes(status) ? status : '',
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0,
    });
    return res.json({ success: true, data: { requests: result.rows, pagination: { total: result.total } } });
  } catch (err) { next(err); }
}

// ── Admin: get single request ───────────────────────────────────────────────────

async function getRequest(req, res, next) {
  try {
    const request = await goLiveModel.getRequestById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });
    return res.json({ success: true, data: request });
  } catch (err) { next(err); }
}

// ── Admin: approve/reject ───────────────────────────────────────────────────────

async function updateStatus(req, res, next) {
  try {
    const { status, rejectionReason } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be approved or rejected.' });
    }
    if (status === 'rejected' && (!rejectionReason || !rejectionReason.trim())) {
      return res.status(400).json({ success: false, message: 'A rejection reason is required.' });
    }

    const request = await goLiveModel.setRequestStatus(req.params.id, {
      status,
      rejectionReason: status === 'rejected' ? rejectionReason.trim() : null,
      reviewedBy: req.admin.id,
    });
    if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });

    return res.json({ success: true, message: `Request ${status}.`, data: request });
  } catch (err) { next(err); }
}

// ── App: start a broadcast session (requires an approved go-live request) ────

async function startBroadcast(req, res, next) {
  try {
    const userId = req.user.id;

    const latest = await goLiveModel.getLatestForUser(userId);
    if (!latest || latest.status !== 'approved') {
      return res.status(403).json({ success: false, message: 'You are not approved to go live yet.' });
    }

    // Already broadcasting — return the existing session instead of creating a duplicate
    const existing = await liveBroadcastModel.getActiveBroadcastForHost(userId);
    if (existing) {
      return res.json({ success: true, data: { broadcastId: existing.id, roomId: existing.room_id, channelName: existing.channel_name } });
    }

    const userResult = await db.query(`SELECT avatar_url FROM users WHERE id = $1`, [userId]);
    const avatarUrl = userResult.rows[0]?.avatar_url || null;

    const { broadcast, roomId, channelName } = await liveBroadcastModel.createBroadcastRoom({
      hostUserId: userId,
      roomName: latest.full_name,
      roomImageUrl: avatarUrl,
    });

    return res.status(201).json({
      success: true,
      data: { broadcastId: broadcast.id, roomId, channelName, maxCohosts: broadcast.max_cohosts },
    });
  } catch (err) { next(err); }
}

// ── App: end my active broadcast session ──────────────────────────────────────

async function endBroadcast(req, res, next) {
  try {
    const userId = req.user.id;
    const existing = await liveBroadcastModel.getActiveBroadcastForHost(userId);
    if (!existing) return res.status(404).json({ success: false, message: 'No active broadcast found.' });

    const ended = await liveBroadcastModel.endBroadcast(existing.id);
    return res.json({ success: true, data: ended });
  } catch (err) { next(err); }
}

// ── App: Live Now grid — list active broadcasts ───────────────────────────────

async function listActiveBroadcasts(req, res, next) {
  try {
    const { limit = '50', offset = '0' } = req.query;
    const rows = await liveBroadcastModel.listActiveBroadcasts({
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0,
    });
    return res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

module.exports = {
  apply, getMyStatus, listRequests, getRequest, updateStatus,
  startBroadcast, endBroadcast, listActiveBroadcasts,
};
