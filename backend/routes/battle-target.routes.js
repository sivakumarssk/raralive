const express = require('express');
const multer = require('multer');
const path = require('path');
const { authenticateAdmin } = require('../middleware/auth.middleware');
const targets = require('../models/battle-target.model');

// Gifting Battle coin targets — public list for the app, CRUD for the admin.

const router = express.Router();

const storage = multer.diskStorage({
  destination: 'uploads/battle-targets/',
  filename: (req, file, cb) => {
    cb(null, `battletarget_${Date.now()}${path.extname(file.originalname)}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});

/** Parse "5000" / "5,000" into a positive whole number, or null. */
function parseCoins(v) {
  const n = Number(String(v ?? '').replace(/[,\s]/g, ''));
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Public: active targets, in display order
router.get('/', async (req, res, next) => {
  try {
    return res.json({ success: true, data: await targets.listActive() });
  } catch (err) { next(err); }
});

// Admin: all targets
router.get('/admin', authenticateAdmin, async (req, res, next) => {
  try {
    return res.json({ success: true, data: await targets.listAll() });
  } catch (err) { next(err); }
});

// Admin: create (image optional)
router.post('/admin', authenticateAdmin, upload.single('image'), async (req, res, next) => {
  try {
    const coinAmount = parseCoins(req.body.coin_amount);
    if (!coinAmount) return res.status(400).json({ success: false, message: 'Coin amount must be a whole number above 0.' });
    const row = await targets.create({
      label: req.body.label?.trim(),
      coinAmount,
      imageUrl: req.file ? `uploads/battle-targets/${req.file.filename}` : null,
      description: req.body.description?.trim(),
      sortOrder: parseInt(req.body.sort_order ?? '0', 10) || 0,
    });
    return res.status(201).json({ success: true, data: row });
  } catch (err) { next(err); }
});

// Admin: edit — send only the fields to change; remove_image=true clears the image
router.patch('/admin/:id', authenticateAdmin, upload.single('image'), async (req, res, next) => {
  try {
    const b = req.body;
    let coinAmount;
    if (b.coin_amount !== undefined) {
      coinAmount = parseCoins(b.coin_amount);
      if (!coinAmount) return res.status(400).json({ success: false, message: 'Coin amount must be a whole number above 0.' });
    }
    const row = await targets.update(req.params.id, {
      label: b.label !== undefined ? b.label.trim() : undefined,
      coinAmount,
      imageUrl: req.file ? `uploads/battle-targets/${req.file.filename}` : b.remove_image === 'true' ? null : undefined,
      description: b.description !== undefined ? b.description.trim() : undefined,
      sortOrder: b.sort_order !== undefined ? (parseInt(b.sort_order, 10) || 0) : undefined,
    });
    if (!row) return res.status(404).json({ success: false, message: 'Target not found.' });
    return res.json({ success: true, data: row });
  } catch (err) { next(err); }
});

// Admin: show / hide in the app
router.patch('/admin/:id/toggle', authenticateAdmin, async (req, res, next) => {
  try {
    const row = await targets.toggle(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: 'Target not found.' });
    return res.json({ success: true, data: row });
  } catch (err) { next(err); }
});

// Admin: delete (past battles keep the coin amount they were played for)
router.delete('/admin/:id', authenticateAdmin, async (req, res, next) => {
  try {
    await targets.remove(req.params.id);
    return res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
