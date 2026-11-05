const express = require('express');
const multer = require('multer');
const path = require('path');
const { authenticateAdmin } = require('../middleware/auth.middleware');
const db = require('../config/db');

const router = express.Router();

const storage = multer.diskStorage({
  destination: 'uploads/banners/',
  filename: (req, file, cb) => {
    const unique = `banner_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, unique);
  },
});
const upload = multer({ storage });

// Where a banner shows in the app. Old app builds call /public with no
// placement for both the Chat Rooms and Live tabs, so that defaults to chatroom.
const PLACEMENTS = ['home', 'chatroom', 'live'];
const placementOf = v => (PLACEMENTS.includes(v) ? v : 'chatroom');

// Adds app_banners.placement once. Before it existed, every banner showed in
// both Chat Rooms and Live — so existing rows become Chat Rooms banners and a
// copy of each is made for Live, keeping both tabs exactly as they were.
let placementReady = null;
function ensurePlacement() {
  if (!placementReady) {
    placementReady = (async () => {
      const col = await db.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'app_banners' AND column_name = 'placement'`
      );
      if (col.rows.length) return;
      await db.query(`ALTER TABLE app_banners ADD COLUMN IF NOT EXISTS placement TEXT NOT NULL DEFAULT 'chatroom'`);
      await db.query(
        `INSERT INTO app_banners (title, image_url, link_url, sort_order, is_active, placement)
         SELECT title, image_url, link_url, sort_order, is_active, 'live' FROM app_banners WHERE placement = 'chatroom'`
      );
    })().catch(err => { placementReady = null; throw err; });
  }
  return placementReady;
}

// Public: active banners for one placement (?placement=home|chatroom|live)
router.get('/public', async (req, res, next) => {
  try {
    await ensurePlacement();
    const r = await db.query(
      `SELECT id, title, image_url, link_url, sort_order
       FROM app_banners WHERE is_active = TRUE AND placement = $1
       ORDER BY sort_order ASC, created_at DESC`,
      [placementOf(req.query.placement)]
    );
    return res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
});

// Admin: list banners (?placement=… for one tab, otherwise all)
router.get('/admin', authenticateAdmin, async (req, res, next) => {
  try {
    await ensurePlacement();
    const one = PLACEMENTS.includes(req.query.placement) ? req.query.placement : null;
    const r = await db.query(
      `SELECT * FROM app_banners WHERE ($1::text IS NULL OR placement = $1)
       ORDER BY sort_order ASC, created_at DESC`,
      [one]
    );
    return res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
});

// Admin: create banner
router.post('/admin', authenticateAdmin, upload.single('image'), async (req, res, next) => {
  try {
    await ensurePlacement();
    const { title, link_url, sort_order, placement } = req.body;
    if (!req.file) return res.status(400).json({ success: false, message: 'Image required' });
    const image_url = `uploads/banners/${req.file.filename}`;
    const r = await db.query(
      `INSERT INTO app_banners (title, image_url, link_url, sort_order, placement)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [title || null, image_url, link_url || null, parseInt(sort_order ?? '0', 10) || 0, placementOf(placement)]
    );
    return res.status(201).json({ success: true, data: r.rows[0] });
  } catch (err) { next(err); }
});

// Admin: delete banner
router.delete('/admin/:id', authenticateAdmin, async (req, res, next) => {
  try {
    await db.query(`DELETE FROM app_banners WHERE id = $1`, [req.params.id]);
    return res.json({ success: true });
  } catch (err) { next(err); }
});

// Admin: toggle active
router.patch('/admin/:id/toggle', authenticateAdmin, async (req, res, next) => {
  try {
    const r = await db.query(
      `UPDATE app_banners SET is_active = NOT is_active WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    return res.json({ success: true, data: r.rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
