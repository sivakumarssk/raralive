const path = require('path');
const fs = require('fs');
const giftModel = require('../models/gift.model');

/** POST /api/admin/gifts — create gift with PNG image upload */
async function createGift(req, res, next) {
  try {
    const { name, coins, bg_color, sort_order } = req.body;

    if (!name || !coins) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: 'name and coins are required.' });
    }

    const coinsNum = parseInt(coins, 10);
    if (isNaN(coinsNum) || coinsNum < 1) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: 'coins must be a positive integer.' });
    }

    const imageUrl = req.file ? `/uploads/gifts/${req.file.filename}` : null;

    const gift = await giftModel.createGift({
      name: name.trim(),
      imageUrl,
      coins: coinsNum,
      bgColor: bg_color || '#FFE4EE',
      sortOrder: sort_order ? parseInt(sort_order, 10) : 0,
    });

    return res.status(201).json({ success: true, data: gift });
  } catch (err) {
    next(err);
  }
}

/** GET /api/admin/gifts */
async function listGifts(req, res, next) {
  try {
    const gifts = await giftModel.listGifts({ activeOnly: false });
    return res.json({ success: true, data: gifts });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/admin/gifts/:id */
async function updateGift(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await giftModel.getGiftById(id);
    if (!existing) return res.status(404).json({ success: false, message: 'Gift not found.' });

    const { name, coins, bg_color, sort_order, is_active } = req.body;
    const fields = {};

    if (name       !== undefined) fields.name       = name.trim();
    if (coins      !== undefined) fields.coins      = parseInt(coins, 10);
    if (bg_color   !== undefined) fields.bgColor    = bg_color;
    if (sort_order !== undefined) fields.sortOrder  = parseInt(sort_order, 10);
    if (is_active  !== undefined) fields.isActive   = is_active === 'true' || is_active === true;

    if (req.file) {
      // Delete old image if it was a gift upload
      if (existing.image_url?.startsWith('/uploads/gifts/')) {
        const oldPath = path.join(__dirname, '..', existing.image_url);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      fields.imageUrl = `/uploads/gifts/${req.file.filename}`;
    }

    const updated = await giftModel.updateGift(id, fields);
    return res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/admin/gifts/:id */
async function deleteGift(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await giftModel.getGiftById(id);
    if (!existing) return res.status(404).json({ success: false, message: 'Gift not found.' });

    if (existing.image_url?.startsWith('/uploads/gifts/')) {
      const filePath = path.join(__dirname, '..', existing.image_url);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await giftModel.deleteGift(id);
    return res.json({ success: true, message: 'Gift deleted.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { createGift, listGifts, updateGift, deleteGift };
