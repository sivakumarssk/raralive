const db = require('../config/db');

async function createPackage({ coins, price, originalPrice, discount, highlighted, sortOrder }) {
  const result = await db.query(
    `INSERT INTO coin_packages (coins, price, original_price, discount, highlighted, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, coins, price, original_price, discount, highlighted, sort_order, is_active, created_at`,
    [coins, price, originalPrice ?? null, discount ?? 0, highlighted ?? false, sortOrder ?? 0]
  );
  return result.rows[0];
}

async function listPackages({ activeOnly = false } = {}) {
  const result = await db.query(
    `SELECT id, coins, price, original_price, discount, highlighted, sort_order, is_active, created_at
     FROM coin_packages
     ${activeOnly ? 'WHERE is_active = TRUE' : ''}
     ORDER BY sort_order ASC, created_at ASC`
  );
  return result.rows;
}

async function getPackageById(id) {
  const result = await db.query(
    `SELECT id, coins, price, original_price, discount, highlighted, sort_order, is_active, created_at
     FROM coin_packages WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function updatePackage(id, fields) {
  const sets = [];
  const vals = [];
  let i = 1;

  if (fields.coins         !== undefined) { sets.push(`coins = $${i++}`);          vals.push(fields.coins); }
  if (fields.price         !== undefined) { sets.push(`price = $${i++}`);          vals.push(fields.price); }
  if (fields.originalPrice !== undefined) { sets.push(`original_price = $${i++}`); vals.push(fields.originalPrice); }
  if (fields.discount      !== undefined) { sets.push(`discount = $${i++}`);       vals.push(fields.discount); }
  if (fields.highlighted   !== undefined) { sets.push(`highlighted = $${i++}`);    vals.push(fields.highlighted); }
  if (fields.sortOrder     !== undefined) { sets.push(`sort_order = $${i++}`);     vals.push(fields.sortOrder); }
  if (fields.isActive      !== undefined) { sets.push(`is_active = $${i++}`);      vals.push(fields.isActive); }

  if (!sets.length) return getPackageById(id);

  sets.push(`updated_at = NOW()`);
  vals.push(id);

  const result = await db.query(
    `UPDATE coin_packages SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    vals
  );
  return result.rows[0] || null;
}

async function deletePackage(id) {
  await db.query('DELETE FROM coin_packages WHERE id = $1', [id]);
}

module.exports = { createPackage, listPackages, getPackageById, updatePackage, deletePackage };
