const express = require('express');
const multer = require('multer');
const path = require('path');
const { authenticateAdmin } = require('../middleware/auth.middleware');
const db = require('../config/db');

// Chat room stage backgrounds — admin uploads one or more images; each room
// shows one for 24 hours, then the next in order (see models/stage-bg.model.js),
// behind the status bar, header and seat stage.

const router = express.Router();

const storage = multer.diskStorage({
  destination: 'uploads/stage-bg/',
  filename: (req, file, cb) => {
    cb(null, `stagebg_${Date.now()}${path.extname(file.originalname)}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});

const { ensureTable, listActive } = require('../models/stage-bg.model');

// Public: all active backgrounds, in rotation order
router.get('/public', async (req, res, next) => {
  try {
    return res.json({ success: true, data: await listActive() });
  } catch (err) { next(err); }
});

// Admin: list all
router.get('/admin', authenticateAdmin, async (req, res, next) => {
  try {
    await ensureTable();
    const r = await db.query(`SELECT * FROM stage_backgrounds ORDER BY sort_order ASC, created_at DESC`);
    return res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
});

// Admin: upload
router.post('/admin', authenticateAdmin, upload.single('image'), async (req, res, next) => {
  try {
    await ensureTable();
    const { title, sort_order } = req.body;
    if (!req.file) return res.status(400).json({ success: false, message: 'Image required' });
    const image_url = `uploads/stage-bg/${req.file.filename}`;
    const r = await db.query(
      `INSERT INTO stage_backgrounds (title, image_url, sort_order)
       VALUES ($1, $2, $3) RETURNING *`,
      [title || null, image_url, parseInt(sort_order ?? '0', 10) || 0]
    );
    return res.status(201).json({ success: true, data: r.rows[0] });
  } catch (err) { next(err); }
});

// Admin: delete
router.delete('/admin/:id', authenticateAdmin, async (req, res, next) => {
  try {
    await ensureTable();
    await db.query(`DELETE FROM stage_backgrounds WHERE id = $1`, [req.params.id]);
    return res.json({ success: true });
  } catch (err) { next(err); }
});

// Admin: toggle active
router.patch('/admin/:id/toggle', authenticateAdmin, async (req, res, next) => {
  try {
    await ensureTable();
    const r = await db.query(
      `UPDATE stage_backgrounds SET is_active = NOT is_active WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    return res.json({ success: true, data: r.rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
