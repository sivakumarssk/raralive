const express = require('express');
const { authenticate, authenticateAdmin } = require('../middleware/auth.middleware');
const db = require('../config/db');
const moderationModel = require('../models/moderation.model');
const { applyModerationResult } = require('../socket');

// Admin review of reports made in the app:
//   messages — chat message reports (comment_reports): who reported, the
//              message, who wrote it, which chatroom
//   users    — user reports (user_reports) from the room profile card
//   rooms    — chat room reports (room_reports) from the room ⋮ menu
// plus the automatic warnings / 24h bans those reports trigger
// (models/moderation.model.js), which admins can review and lift.

const router = express.Router();
const STATUSES = ['open', 'reviewed', 'dismissed'];

// Tables come from database/migrate-all.js; an un-migrated DB just shows nothing
const isMissingTable = err => err && err.code === '42P01';

function statusFilter(req, params) {
  if (!STATUSES.includes(req.query.status)) return '';
  params.push(req.query.status);
  return `WHERE r.status = $${params.length}`;
}

// App: report a chat room (3 different reporters → 24h ban on the room + host ID)
router.post('/rooms/:roomId', authenticate, async (req, res, next) => {
  try {
    const reason = String(req.body.reason ?? '').trim();
    if (!reason) return res.status(400).json({ success: false, message: 'Please choose a reason.' });
    const result = await moderationModel.reportRoom({
      reporterId: req.user.id, roomId: req.params.roomId, reason: reason.slice(0, 200),
      note: req.body.note ? String(req.body.note).slice(0, 1000) : null,
    });
    if (result.duplicate) {
      return res.status(409).json({ success: false, duplicate: true, message: 'You have already reported this Chat Room.' });
    }
    applyModerationResult(result);
    return res.status(201).json({ success: true });
  } catch (err) {
    if (err instanceof moderationModel.ModerationError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    next(err);
  }
});

router.get('/admin/messages', authenticateAdmin, async (req, res, next) => {
  try {
    const params = [];
    const r = await db.query(
      `SELECT r.id, r.message_id, r.message_text, r.reason, r.status, r.created_at,
              r.room_id, rm.room_name,
              rep.id AS reporter_id, rep.full_name AS reporter_name, rep.username AS reporter_username, rep.phone AS reporter_phone,
              au.id AS author_id, au.full_name AS author_name, au.username AS author_username, au.phone AS author_phone
       FROM comment_reports r
       LEFT JOIN rooms rm  ON rm.id = r.room_id
       LEFT JOIN users rep ON rep.id = r.reporter_id
       LEFT JOIN users au  ON au.id = r.reported_user_id
       ${statusFilter(req, params)}
       ORDER BY r.created_at DESC
       LIMIT 500`,
      params
    );
    return res.json({ success: true, data: r.rows });
  } catch (err) {
    if (isMissingTable(err)) return res.json({ success: true, data: [] });
    next(err);
  }
});

router.get('/admin/users', authenticateAdmin, async (req, res, next) => {
  try {
    const params = [];
    const r = await db.query(
      `SELECT r.id, r.reason, r.note, r.status, r.created_at,
              r.room_id, rm.room_name,
              rep.id AS reporter_id, rep.full_name AS reporter_name, rep.username AS reporter_username, rep.phone AS reporter_phone,
              ru.id AS reported_id, ru.full_name AS reported_name, ru.username AS reported_username, ru.phone AS reported_phone
       FROM user_reports r
       LEFT JOIN rooms rm  ON rm.id = r.room_id
       LEFT JOIN users rep ON rep.id = r.reporter_id
       LEFT JOIN users ru  ON ru.id = r.reported_user_id
       ${statusFilter(req, params)}
       ORDER BY r.created_at DESC
       LIMIT 500`,
      params
    );
    return res.json({ success: true, data: r.rows });
  } catch (err) {
    if (isMissingTable(err)) return res.json({ success: true, data: [] });
    next(err);
  }
});

router.get('/admin/rooms', authenticateAdmin, async (req, res, next) => {
  try {
    const status = STATUSES.includes(req.query.status) ? req.query.status : null;
    return res.json({ success: true, data: await moderationModel.listRoomReports({ status }) });
  } catch (err) { next(err); }
});

// Automatic warnings / bans — evidence for review (reporter_ids, logs)
router.get('/admin/bans', authenticateAdmin, async (req, res, next) => {
  try {
    return res.json({ success: true, data: await moderationModel.listBans({ activeOnly: req.query.active === '1' }) });
  } catch (err) { next(err); }
});

router.get('/admin/warnings', authenticateAdmin, async (req, res, next) => {
  try {
    return res.json({ success: true, data: await moderationModel.listWarnings() });
  } catch (err) { next(err); }
});

router.get('/admin/logs', authenticateAdmin, async (req, res, next) => {
  try {
    return res.json({ success: true, data: await moderationModel.listLogs({ targetId: req.query.target_id || null }) });
  } catch (err) { next(err); }
});

// Reverse a wrong ban — access returns immediately
router.post('/admin/bans/:id/lift', authenticateAdmin, async (req, res, next) => {
  try {
    const ban = await moderationModel.liftBan({ banId: req.params.id, adminId: req.admin.id, note: req.body.note });
    if (!ban) return res.status(409).json({ success: false, message: 'This ban was already lifted.' });
    return res.json({ success: true, data: ban });
  } catch (err) { next(err); }
});

// PATCH /reports/admin/:kind/:id/status  { status: open | reviewed | dismissed }
// Dismissed reports no longer count towards a warning / ban.
router.patch('/admin/:kind/:id/status', authenticateAdmin, async (req, res, next) => {
  try {
    const table = req.params.kind === 'messages' ? 'comment_reports'
      : req.params.kind === 'users' ? 'user_reports'
        : req.params.kind === 'rooms' ? 'room_reports' : null;
    const status = STATUSES.includes(req.body.status) ? req.body.status : null;
    if (!table || !status) return res.status(400).json({ success: false, message: 'Invalid request' });
    const r = await db.query(`UPDATE ${table} SET status = $1 WHERE id = $2 RETURNING id, status`, [status, req.params.id]);
    return res.json({ success: true, data: r.rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
