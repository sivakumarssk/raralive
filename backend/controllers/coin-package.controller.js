const packageModel = require('../models/coin-package.model');

async function listPackages(req, res, next) {
  try {
    const rows = await packageModel.listPackages({ activeOnly: false });
    return res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

async function listPublicPackages(req, res, next) {
  try {
    const rows = await packageModel.listPackages({ activeOnly: true });
    return res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

async function createPackage(req, res, next) {
  try {
    const { coins, price, original_price, discount, highlighted, sort_order } = req.body;
    if (!coins || !price) {
      return res.status(400).json({ success: false, message: 'coins and price are required.' });
    }
    const pkg = await packageModel.createPackage({
      coins: parseInt(coins, 10),
      price: parseFloat(price),
      originalPrice: original_price ? parseFloat(original_price) : null,
      discount: discount ? parseFloat(discount) : 0,
      highlighted: highlighted === true || highlighted === 'true',
      sortOrder: sort_order ? parseInt(sort_order, 10) : 0,
    });
    return res.status(201).json({ success: true, data: pkg });
  } catch (err) { next(err); }
}

async function updatePackage(req, res, next) {
  try {
    const { id } = req.params;
    const { coins, price, original_price, discount, highlighted, sort_order, is_active } = req.body;
    const fields = {};
    if (coins         !== undefined) fields.coins         = parseInt(coins, 10);
    if (price         !== undefined) fields.price         = parseFloat(price);
    if (original_price !== undefined) fields.originalPrice = original_price === '' ? null : parseFloat(original_price);
    if (discount      !== undefined) fields.discount      = parseFloat(discount);
    if (highlighted   !== undefined) fields.highlighted   = highlighted === true || highlighted === 'true';
    if (sort_order    !== undefined) fields.sortOrder     = parseInt(sort_order, 10);
    if (is_active     !== undefined) fields.isActive      = is_active === true || is_active === 'true';

    const pkg = await packageModel.updatePackage(id, fields);
    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found.' });
    return res.json({ success: true, data: pkg });
  } catch (err) { next(err); }
}

async function deletePackage(req, res, next) {
  try {
    const { id } = req.params;
    await packageModel.deletePackage(id);
    return res.json({ success: true });
  } catch (err) { next(err); }
}

module.exports = { listPackages, listPublicPackages, createPackage, updatePackage, deletePackage };
