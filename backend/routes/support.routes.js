const express = require('express');
const { authenticate, authenticateAdmin } = require('../middleware/auth.middleware');
const db = require('../config/db');

// Chatroom "Help & Support" / "Report Chatroom" messages written in the app,
// reviewed by admins in the admin panel.

const router = express.Router();

const TYPES = ['help', 'report'];
const STATUSES = ['open', 'resolved'];

// Also created in database/migrate-all.js — kept here so the feature works on a
// server where the migration hasn't been re-run yet.
let tableReady = null;
function ensureTable() {
  if (!tableReady) {
    tableReady = db.query(`
      CREATE TABLE IF NOT EXISTS support_requests (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
        room_id     UUID,
        type        TEXT NOT NULL DEFAULT 'help',
        message     TEXT NOT NULL,
        status      TEXT NOT NULL DEFAULT 'open',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `).catch(err => { tableReady = null; throw err; });
  }
  return tableReady;
}

// User: submit a message
router.post('/', authenticate, async (req, res, next) => {
  try {
    await ensureTable();
    const message = String(req.body.message ?? '').trim();
    const type = TYPES.includes(req.body.type) ? req.body.type : 'help';
    const roomId = req.body.room_id || null;
    if (!message) return res.status(400).json({ success: false, message: 'Please write a message.' });
    if (message.length > 2000) return res.status(400).json({ success: false, message: 'Message is too long (max 2000 characters).' });
    const r = await db.query(
      `INSERT INTO support_requests (user_id, room_id, type, message)
       VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
      [req.user.id, roomId, type, message]
    );
    return res.status(201).json({ success: true, data: r.rows[0] });
  } catch (err) { next(err); }
});

// Admin: list (optionally ?status=open|resolved&type=help|report)
router.get('/admin', authenticateAdmin, async (req, res, next) => {
  try {
    await ensureTable();
    const where = [];
    const params = [];
    if (STATUSES.includes(req.query.status)) { params.push(req.query.status); where.push(`s.status = $${params.length}`); }
    if (TYPES.includes(req.query.type)) { params.push(req.query.type); where.push(`s.type = $${params.length}`); }
    const r = await db.query(
      `SELECT s.id, s.type, s.message, s.status, s.created_at, s.room_id,
              u.id AS user_id, u.full_name, u.username, u.phone,
              rm.room_name
       FROM support_requests s
       LEFT JOIN users u ON u.id = s.user_id
       LEFT JOIN rooms rm ON rm.id = s.room_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY s.created_at DESC
       LIMIT 500`,
      params
    );
    return res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
});

// Admin: mark open / resolved
router.patch('/admin/:id/status', authenticateAdmin, async (req, res, next) => {
  try {
    await ensureTable();
    const status = STATUSES.includes(req.body.status) ? req.body.status : null;
    if (!status) return res.status(400).json({ success: false, message: 'Invalid status' });
    const r = await db.query(
      `UPDATE support_requests SET status = $1 WHERE id = $2 RETURNING id, status`,
      [status, req.params.id]
    );
    return res.json({ success: true, data: r.rows[0] });
  } catch (err) { next(err); }
});

// Admin: delete
router.delete('/admin/:id', authenticateAdmin, async (req, res, next) => {
  try {
    await ensureTable();
    await db.query(`DELETE FROM support_requests WHERE id = $1`, [req.params.id]);
    return res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
