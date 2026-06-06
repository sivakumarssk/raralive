const express = require('express');
const { authenticateAdmin } = require('../middleware/auth.middleware');
const { uploadShopGift } = require('../middleware/upload.middleware');
const ctrl = require('../controllers/shop-gift.controller');

const router = express.Router();

// ── Public ────────────────────────────────────────────────────────────────────
router.get('/public', ctrl.publicShopGifts);

// ── Categories (admin) ────────────────────────────────────────────────────────
router.get('/categories',        authenticateAdmin, ctrl.listCategories);
router.post('/categories',       authenticateAdmin, ctrl.createCategory);
router.patch('/categories/:id',  authenticateAdmin, ctrl.updateCategory);
router.delete('/categories/:id', authenticateAdmin, ctrl.deleteCategory);

// ── Shop gifts (admin) ────────────────────────────────────────────────────────
router.get('/',        authenticateAdmin, ctrl.listShopGifts);
router.post('/',       authenticateAdmin, uploadShopGift.single('image'), ctrl.createShopGift);
router.patch('/:id',   authenticateAdmin, uploadShopGift.single('image'), ctrl.updateShopGift);
router.delete('/:id',  authenticateAdmin, ctrl.deleteShopGift);

module.exports = router;
