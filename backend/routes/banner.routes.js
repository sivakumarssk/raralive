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

// Public: get active banners
router.get('/public', async (req, res, next) => {
  try {
    const r = await db.query(
      `SELECT id, title, image_url, link_url, sort_order
       FROM app_banners WHERE is_active = TRUE
       ORDER BY sort_order ASC, created_at DESC`
    );
    return res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
});

// Admin: list all banners
router.get('/admin', authenticateAdmin, async (req, res, next) => {
  try {
    const r = await db.query(`SELECT * FROM app_banners ORDER BY sort_order ASC, created_at DESC`);
    return res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
});

// Admin: create banner
router.post('/admin', authenticateAdmin, upload.single('image'), async (req, res, next) => {
  try {
    const { title, link_url, sort_order } = req.body;
    if (!req.file) return res.status(400).json({ success: false, message: 'Image required' });
    const image_url = `uploads/banners/${req.file.filename}`;
    const r = await db.query(
      `INSERT INTO app_banners (title, image_url, link_url, sort_order)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [title || null, image_url, link_url || null, parseInt(sort_order ?? '0', 10)]
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
