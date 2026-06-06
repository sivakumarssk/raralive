const express = require('express');
const { authenticateAdmin } = require('../middleware/auth.middleware');
const { uploadGift } = require('../middleware/upload.middleware');
const giftAdminController = require('../controllers/gift-admin.controller');
const giftModel = require('../models/gift.model');

const router = express.Router();

// ── Admin routes (require admin token) ───────────────────────────────────────

router.post(
  '/',
  authenticateAdmin,
  uploadGift.single('image'),
  giftAdminController.createGift
);

router.get('/', authenticateAdmin, giftAdminController.listGifts);

router.patch(
  '/:id',
  authenticateAdmin,
  uploadGift.single('image'),
  giftAdminController.updateGift
);

router.delete('/:id', authenticateAdmin, giftAdminController.deleteGift);

// ── Public route — app fetches active gifts for GiftBar ───────────────────────

router.get('/public', async (req, res, next) => {
  try {
    const gifts = await giftModel.listGifts({ activeOnly: true });
    return res.json({ success: true, data: gifts });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
