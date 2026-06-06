const path = require('path');
const fs = require('fs');
const shopGiftModel = require('../models/shop-gift.model');
const giftModel = require('../models/gift.model');

// ── Categories (admin) ────────────────────────────────────────────────────────

async function listCategories(req, res, next) {
  try {
    const rows = await shopGiftModel.listCategories();
    return res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

async function createCategory(req, res, next) {
  try {
    const { name, sort_order } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'name is required.' });
    const cat = await shopGiftModel.createCategory({ name, sortOrder: sort_order ? parseInt(sort_order, 10) : 0 });
    return res.status(201).json({ success: true, data: cat });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, message: 'Category name already exists.' });
    next(err);
  }
}

async function updateCategory(req, res, next) {
  try {
    const { id } = req.params;
    const { name, sort_order, is_active } = req.body;
    const fields = {};
    if (name      !== undefined) fields.name      = name.trim();
    if (sort_order !== undefined) fields.sortOrder = parseInt(sort_order, 10);
    if (is_active !== undefined) fields.isActive  = is_active === true || is_active === 'true';
    const cat = await shopGiftModel.updateCategory(id, fields);
    if (!cat) return res.status(404).json({ success: false, message: 'Category not found.' });
    return res.json({ success: true, data: cat });
  } catch (err) { next(err); }
}

async function deleteCategory(req, res, next) {
  try {
    await shopGiftModel.deleteCategory(req.params.id);
    return res.json({ success: true });
  } catch (err) { next(err); }
}

// ── Shop gifts (admin) ────────────────────────────────────────────────────────

async function listShopGifts(req, res, next) {
  try {
    const rows = await shopGiftModel.listShopGifts();
    return res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

async function createShopGift(req, res, next) {
  try {
    const { name, coins, bg_color, sort_order, category_id } = req.body;
    if (!name || !coins) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: 'name and coins are required.' });
    }
    const imageUrl = req.file ? `uploads/shop-gifts/${req.file.filename}` : null;
    const gift = await giftModel.createGift({
      name: name.trim(),
      imageUrl,
      coins: parseInt(coins, 10),
      bgColor: bg_color || '#FFE4EE',
      sortOrder: sort_order ? parseInt(sort_order, 10) : 0,
    });
    // Assign category if provided
    if (category_id) {
      await require('../config/db').query(
        'UPDATE gifts SET category_id = $1 WHERE id = $2', [category_id, gift.id]
      );
      gift.category_id = category_id;
    }
    return res.status(201).json({ success: true, data: gift });
  } catch (err) { next(err); }
}

async function updateShopGift(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await giftModel.getGiftById(id);
    if (!existing) return res.status(404).json({ success: false, message: 'Gift not found.' });

    const { name, coins, bg_color, sort_order, is_active, category_id } = req.body;
    const fields = {};
    if (name      !== undefined) fields.name      = name.trim();
    if (coins     !== undefined) fields.coins     = parseInt(coins, 10);
    if (bg_color  !== undefined) fields.bgColor   = bg_color;
    if (sort_order !== undefined) fields.sortOrder = parseInt(sort_order, 10);
    if (is_active !== undefined) fields.isActive  = is_active === true || is_active === 'true';

    if (req.file) {
      if (existing.image_url) {
        const oldPath = path.join(__dirname, '..', existing.image_url.replace(/^\//, ''));
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      fields.imageUrl = `uploads/shop-gifts/${req.file.filename}`;
    }

    const updated = await giftModel.updateGift(id, fields);

    // Update category separately (not in gift model)
    if (category_id !== undefined) {
      await require('../config/db').query(
        'UPDATE gifts SET category_id = $1 WHERE id = $2',
        [category_id || null, id]
      );
    }

    return res.json({ success: true, data: updated });
  } catch (err) { next(err); }
}

async function deleteShopGift(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await giftModel.getGiftById(id);
    if (!existing) return res.status(404).json({ success: false, message: 'Gift not found.' });
    if (existing.image_url) {
      const filePath = path.join(__dirname, '..', existing.image_url.replace(/^\//, ''));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await giftModel.deleteGift(id);
    return res.json({ success: true });
  } catch (err) { next(err); }
}

// ── Public ────────────────────────────────────────────────────────────────────

async function publicShopGifts(req, res, next) {
  try {
    const data = await shopGiftModel.listCategoriesWithGifts();
    return res.json({ success: true, data });
  } catch (err) { next(err); }
}

module.exports = {
  listCategories, createCategory, updateCategory, deleteCategory,
  listShopGifts, createShopGift, updateShopGift, deleteShopGift,
  publicShopGifts,
};
