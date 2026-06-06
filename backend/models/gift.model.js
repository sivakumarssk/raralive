const db = require('../config/db');

async function createGift({ name, imageUrl, coins, bgColor, sortOrder }) {
  const result = await db.query(
    `INSERT INTO gifts (name, image_url, coins, bg_color, sort_order)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, image_url, coins, bg_color, sort_order, is_active, created_at`,
    [name, imageUrl, coins, bgColor || '#FFE4EE', sortOrder ?? 0]
  );
  return result.rows[0];
}

async function listGifts({ activeOnly = false } = {}) {
  const result = await db.query(
    `SELECT id, name, image_url, coins, bg_color, sort_order, is_active, created_at
     FROM gifts
     ${activeOnly ? 'WHERE is_active = TRUE' : ''}
     ORDER BY sort_order ASC, created_at ASC`
  );
  return result.rows;
}

async function getGiftById(id) {
  const result = await db.query(
    `SELECT id, name, image_url, coins, bg_color, sort_order, is_active, created_at
     FROM gifts WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function updateGift(id, fields) {
  const sets = [];
  const vals = [];
  let i = 1;

  if (fields.name     !== undefined) { sets.push(`name = $${i++}`);       vals.push(fields.name); }
  if (fields.coins    !== undefined) { sets.push(`coins = $${i++}`);      vals.push(fields.coins); }
  if (fields.bgColor  !== undefined) { sets.push(`bg_color = $${i++}`);   vals.push(fields.bgColor); }
  if (fields.sortOrder !== undefined){ sets.push(`sort_order = $${i++}`); vals.push(fields.sortOrder); }
  if (fields.isActive !== undefined) { sets.push(`is_active = $${i++}`);  vals.push(fields.isActive); }
  if (fields.imageUrl !== undefined) { sets.push(`image_url = $${i++}`);  vals.push(fields.imageUrl); }

  if (!sets.length) return getGiftById(id);

  sets.push(`updated_at = NOW()`);
  vals.push(id);

  const result = await db.query(
    `UPDATE gifts SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    vals
  );
  return result.rows[0] || null;
}

async function deleteGift(id) {
  await db.query('DELETE FROM gifts WHERE id = $1', [id]);
}

module.exports = { createGift, listGifts, getGiftById, updateGift, deleteGift };
