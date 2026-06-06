const db = require('../config/db');

// ── Categories ────────────────────────────────────────────────────────────────

async function listCategories({ activeOnly = false } = {}) {
  const result = await db.query(
    `SELECT id, name, sort_order, is_active, created_at
     FROM gift_categories
     ${activeOnly ? 'WHERE is_active = TRUE' : ''}
     ORDER BY sort_order ASC, created_at ASC`
  );
  return result.rows;
}

async function createCategory({ name, sortOrder = 0 }) {
  const result = await db.query(
    `INSERT INTO gift_categories (name, sort_order)
     VALUES ($1, $2)
     RETURNING id, name, sort_order, is_active, created_at`,
    [name.trim(), sortOrder]
  );
  return result.rows[0];
}

async function updateCategory(id, fields) {
  const sets = []; const vals = []; let i = 1;
  if (fields.name      !== undefined) { sets.push(`name = $${i++}`);       vals.push(fields.name); }
  if (fields.sortOrder !== undefined) { sets.push(`sort_order = $${i++}`); vals.push(fields.sortOrder); }
  if (fields.isActive  !== undefined) { sets.push(`is_active = $${i++}`);  vals.push(fields.isActive); }
  if (!sets.length) return null;
  vals.push(id);
  const result = await db.query(
    `UPDATE gift_categories SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    vals
  );
  return result.rows[0] || null;
}

async function deleteCategory(id) {
  await db.query('DELETE FROM gift_categories WHERE id = $1', [id]);
}

// ── Shop gifts ────────────────────────────────────────────────────────────────

async function listShopGifts({ categoryId = null, activeOnly = false } = {}) {
  const conditions = [];
  const vals = [];
  let i = 1;
  if (activeOnly) { conditions.push(`g.is_active = TRUE`); }
  if (categoryId) { conditions.push(`g.category_id = $${i++}`); vals.push(categoryId); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await db.query(
    `SELECT g.id, g.name, g.image_url, g.coins, g.bg_color, g.sort_order, g.is_active,
            g.category_id, c.name AS category_name, g.created_at
     FROM gifts g
     LEFT JOIN gift_categories c ON c.id = g.category_id
     ${where}
     ORDER BY g.sort_order ASC, g.created_at ASC`,
    vals
  );
  return result.rows;
}

async function listCategoriesWithGifts() {
  const categories = await listCategories({ activeOnly: true });
  const gifts = await listShopGifts({ activeOnly: true });

  // Group gifts by category
  const map = new Map();
  for (const cat of categories) {
    map.set(cat.id, { ...cat, gifts: [] });
  }
  // Uncategorised bucket
  const uncategorised = { id: null, name: 'All', sort_order: -1, gifts: [] };

  for (const gift of gifts) {
    if (gift.category_id && map.has(gift.category_id)) {
      map.get(gift.category_id).gifts.push(gift);
    } else {
      uncategorised.gifts.push(gift);
    }
  }

  const result = [];
  if (uncategorised.gifts.length) result.push(uncategorised);
  result.push(...[...map.values()]);
  return result;
}

module.exports = {
  listCategories, createCategory, updateCategory, deleteCategory,
  listShopGifts, listCategoriesWithGifts,
};
