const db = require('../config/db');

// Admin-managed post tags. Top-level tags are the custom Home tabs; sub tags
// (parent_id set) are the chips under a tab and what posts are usually tagged
// with. Users pick from these when creating a post.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

/** Nest flat rows: [{...tag, children: [...]}], both levels in sort order. */
function nest(rows) {
  const top = rows.filter(r => !r.parent_id);
  return top.map(t => ({ ...t, children: rows.filter(r => r.parent_id === t.id) }));
}

const SELECT_TAGS = `
  SELECT t.id, t.parent_id, t.name, t.sort_order, t.is_active, t.created_at,
         (SELECT COUNT(*)::int FROM post_tag_links l WHERE l.tag_id = t.id) AS post_count
  FROM post_tags t`;

/** GET /api/post-tags — active tags for the app (tabs + their sub tags). */
async function listPublic(req, res, next) {
  try {
    const r = await db.query(
      `${SELECT_TAGS}
       WHERE t.is_active = TRUE
         AND (t.parent_id IS NULL OR EXISTS (SELECT 1 FROM post_tags p WHERE p.id = t.parent_id AND p.is_active))
       ORDER BY t.sort_order, t.created_at`
    );
    return res.json({ success: true, data: nest(r.rows) });
  } catch (err) { next(err); }
}

/**
 * GET /api/post-tags/trending — the "Trending Now" chips on the Trending tab:
 * active tags used most in the last 7 days (falls back to admin order).
 */
async function listTrending(req, res, next) {
  try {
    const r = await db.query(
      `SELECT t.id, t.parent_id, t.name, COUNT(p.id)::int AS recent_posts
       FROM post_tags t
       LEFT JOIN post_tags parent ON parent.id = t.parent_id
       LEFT JOIN post_tag_links l ON l.tag_id = t.id
       LEFT JOIN posts p ON p.id = l.post_id AND p.created_at >= NOW() - INTERVAL '7 days'
       WHERE t.is_active = TRUE AND (t.parent_id IS NULL OR parent.is_active)
       GROUP BY t.id
       ORDER BY COUNT(p.id) DESC, t.parent_id NULLS FIRST, t.sort_order, t.created_at
       LIMIT 10`
    );
    return res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

// ── Admin ─────────────────────────────────────────────────────────────────────

/** GET /api/post-tags/admin — every tag (incl. hidden) with post counts. */
async function adminList(req, res, next) {
  try {
    const r = await db.query(`${SELECT_TAGS} ORDER BY t.sort_order, t.created_at`);
    return res.json({ success: true, data: nest(r.rows) });
  } catch (err) { next(err); }
}

function readBody(body) {
  const name = String(body?.name ?? '').trim();
  const sortOrder = Number.isInteger(Number(body?.sort_order)) ? Number(body.sort_order) : 0;
  const isActive = body?.is_active === undefined ? true : !!body.is_active;
  return { name, sortOrder, isActive };
}

/** POST /api/post-tags/admin  { name, parent_id?, sort_order?, is_active? } */
async function adminCreate(req, res, next) {
  try {
    const { name, sortOrder, isActive } = readBody(req.body);
    const parentId = req.body?.parent_id || null;
    if (!name || name.length > 60) return res.status(400).json({ success: false, message: 'Name is required (max 60 characters).' });
    if (parentId) {
      if (!isUuid(parentId)) return res.status(400).json({ success: false, message: 'Invalid parent tag.' });
      const p = await db.query(`SELECT parent_id FROM post_tags WHERE id = $1`, [parentId]);
      if (!p.rows.length) return res.status(404).json({ success: false, message: 'Parent tag not found.' });
      if (p.rows[0].parent_id) return res.status(400).json({ success: false, message: 'Sub tags can only be added under a main tag.' });
    }
    const dup = await db.query(
      `SELECT 1 FROM post_tags WHERE LOWER(name) = LOWER($1) AND parent_id IS NOT DISTINCT FROM $2`,
      [name, parentId]
    );
    if (dup.rows.length) return res.status(409).json({ success: false, message: 'A tag with this name already exists here.' });
    const r = await db.query(
      `INSERT INTO post_tags (parent_id, name, sort_order, is_active) VALUES ($1, $2, $3, $4) RETURNING *`,
      [parentId, name, sortOrder, isActive]
    );
    return res.status(201).json({ success: true, data: r.rows[0] });
  } catch (err) { next(err); }
}

/** PATCH /api/post-tags/admin/:id  { name?, sort_order?, is_active? } */
async function adminUpdate(req, res, next) {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(404).json({ success: false, message: 'Tag not found.' });
    const existing = await db.query(`SELECT * FROM post_tags WHERE id = $1`, [id]);
    if (!existing.rows.length) return res.status(404).json({ success: false, message: 'Tag not found.' });
    const cur = existing.rows[0];
    const name = req.body?.name !== undefined ? String(req.body.name).trim() : cur.name;
    if (!name || name.length > 60) return res.status(400).json({ success: false, message: 'Name is required (max 60 characters).' });
    if (name.toLowerCase() !== cur.name.toLowerCase()) {
      const dup = await db.query(
        `SELECT 1 FROM post_tags WHERE LOWER(name) = LOWER($1) AND parent_id IS NOT DISTINCT FROM $2 AND id <> $3`,
        [name, cur.parent_id, id]
      );
      if (dup.rows.length) return res.status(409).json({ success: false, message: 'A tag with this name already exists here.' });
    }
    const sortOrder = req.body?.sort_order !== undefined && Number.isInteger(Number(req.body.sort_order)) ? Number(req.body.sort_order) : cur.sort_order;
    const isActive = req.body?.is_active !== undefined ? !!req.body.is_active : cur.is_active;
    const r = await db.query(
      `UPDATE post_tags SET name = $2, sort_order = $3, is_active = $4 WHERE id = $1 RETURNING *`,
      [id, name, sortOrder, isActive]
    );
    return res.json({ success: true, data: r.rows[0] });
  } catch (err) { next(err); }
}

/** DELETE /api/post-tags/admin/:id — removes the tag (and its sub tags) from all posts. */
async function adminDelete(req, res, next) {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(404).json({ success: false, message: 'Tag not found.' });
    const r = await db.query(`DELETE FROM post_tags WHERE id = $1 RETURNING id`, [id]);
    if (!r.rows.length) return res.status(404).json({ success: false, message: 'Tag not found.' });
    return res.json({ success: true });
  } catch (err) { next(err); }
}

module.exports = { listPublic, listTrending, adminList, adminCreate, adminUpdate, adminDelete, isUuid };
