const db = require('../config/db');
const { isUuid } = require('./post-tag.controller');

// Every post response carries its media and its admin tags (`tag_list`:
// [{ id, name, parent_id }]). `tags` is the legacy free-text column.
const POST_SELECT = `
  SELECT p.id, p.caption, p.category, p.tags, p.allow_comments,
         p.likes_count, p.comments_count, p.created_at,
         u.id AS user_id, u.full_name, u.username, u.avatar_url,
         COALESCE((
           SELECT json_agg(json_build_object('id', pm.id, 'media_url', pm.media_url,
                    'media_type', pm.media_type, 'sort_order', pm.sort_order) ORDER BY pm.sort_order)
           FROM post_media pm WHERE pm.post_id = p.id
         ), '[]'::json) AS media,
         COALESCE((
           SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'parent_id', t.parent_id)
                    ORDER BY t.parent_id NULLS FIRST, t.sort_order, t.name)
           FROM post_tag_links l JOIN post_tags t ON t.id = l.tag_id
           WHERE l.post_id = p.id AND t.is_active
         ), '[]'::json) AS tag_list
  FROM posts p
  JOIN users u ON u.id = p.user_id`;

const MAX_POST_TAGS = 10;

/** Admin tags a post may use: active ones from the given ids (bad ids dropped). */
async function resolvePostTags(rawIds) {
  let ids = rawIds;
  if (typeof ids === 'string') { try { ids = JSON.parse(ids); } catch { ids = []; } }
  ids = [...new Set((Array.isArray(ids) ? ids : []).filter(isUuid))].slice(0, MAX_POST_TAGS);
  if (!ids.length) return [];
  const r = await db.query(
    `SELECT t.id, t.name FROM post_tags t
     LEFT JOIN post_tags parent ON parent.id = t.parent_id
     WHERE t.id = ANY($1::uuid[]) AND t.is_active AND (t.parent_id IS NULL OR parent.is_active)`,
    [ids]
  );
  return r.rows;
}

/** POST /api/posts — create a post with media */
async function createPost(req, res, next) {
  try {
    const userId = req.user.id;
    const { caption, category, tags, tag_ids, allow_comments } = req.body;
    const files = req.files ?? [];

    if (!files.length) {
      return res.status(400).json({ success: false, message: 'At least one media file is required.' });
    }

    // Tags come from the admin list (tag_ids). Older app builds still send
    // free-text `tags`; those are kept in the legacy column only.
    const adminTags = await resolvePostTags(tag_ids);
    let parsedTags = adminTags.map(t => `#${t.name}`);
    if (tag_ids === undefined && tags) {
      try { parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags; }
      catch { parsedTags = String(tags).split(',').map(t => t.trim()).filter(Boolean); }
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const postResult = await client.query(
        `INSERT INTO posts (user_id, caption, category, tags, allow_comments)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, user_id, caption, category, tags, allow_comments, created_at`,
        [userId, caption || null, category || null, parsedTags, allow_comments !== 'false']
      );
      const post = postResult.rows[0];

      for (const t of adminTags) {
        await client.query(
          `INSERT INTO post_tag_links (post_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [post.id, t.id]
        );
      }

      // Insert media files
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const mediaUrl = `uploads/posts/${file.filename}`;
        const mediaType = file.mimetype.startsWith('video/') ? 'video' : 'photo';
        await client.query(
          `INSERT INTO post_media (post_id, media_url, media_type, sort_order) VALUES ($1,$2,$3,$4)`,
          [post.id, mediaUrl, mediaType, i]
        );
      }

      await client.query('COMMIT');

      // Return full post with media
      const fullPost = await getPostWithMedia(post.id);
      return res.status(201).json({ success: true, data: fullPost });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
}

async function getPostWithMedia(postId) {
  const r = await db.query(`${POST_SELECT} WHERE p.id = $1`, [postId]);
  return r.rows[0] || null;
}

/**
 * GET /api/posts/feed?tab=&tag=&limit=&offset=
 *   tab: 'trending' (default, everything) | 'video' (posts with a video)
 *        | 'following' (people the signed-in user follows) | <admin tag id>
 *   tag: optional tag id (a sub-tag chip) to narrow any tab
 * A main tag matches posts tagged with it or with any of its sub tags.
 */
async function getFeed(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit ?? '20', 10) || 20, 50);
    const offset = parseInt(req.query.offset ?? '0', 10) || 0;
    const tab = String(req.query.tab ?? 'trending');
    const tag = req.query.tag;

    const conds = []; const vals = [];
    const tagMatch = (param) => `EXISTS (
      SELECT 1 FROM post_tag_links l JOIN post_tags t ON t.id = l.tag_id
      WHERE l.post_id = p.id AND (t.id = ${param} OR t.parent_id = ${param}))`;

    if (tab === 'video') {
      conds.push(`EXISTS (SELECT 1 FROM post_media pm WHERE pm.post_id = p.id AND pm.media_type = 'video')`);
    } else if (tab === 'following') {
      if (!req.user?.id) return res.json({ success: true, data: [], total: 0 });
      vals.push(req.user.id);
      conds.push(`p.user_id IN (SELECT following_id FROM user_follows WHERE follower_id = $${vals.length})`);
    } else if (isUuid(tab)) {
      vals.push(tab);
      conds.push(tagMatch(`$${vals.length}`));
    }
    if (isUuid(tag)) {
      vals.push(tag);
      conds.push(tagMatch(`$${vals.length}`));
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const r = await db.query(
      `${POST_SELECT} ${where}
       ORDER BY p.created_at DESC
       LIMIT $${vals.length + 1} OFFSET $${vals.length + 2}`,
      [...vals, limit, offset]
    );
    const total = await db.query(`SELECT COUNT(*) FROM posts p ${where}`, vals);
    return res.json({
      success: true,
      data: r.rows,
      total: parseInt(total.rows[0].count, 10),
    });
  } catch (err) { next(err); }
}

/** GET /api/posts/:id — one post (shared links and the post page open this) */
async function getPost(req, res, next) {
  try {
    if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Post not found.' });
    const post = await getPostWithMedia(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });
    return res.json({ success: true, data: post });
  } catch (err) { next(err); }
}

/** GET /api/posts/my — current user's posts */
async function getMyPosts(req, res, next) {
  try {
    const r = await db.query(`${POST_SELECT} WHERE p.user_id = $1 ORDER BY p.created_at DESC`, [req.user.id]);
    return res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

// Saved posts are private to the user who saved them (shown on their own
// profile only) — unlike likes, there's no public count.
let savesReady = null;
function ensureSavesTable() {
  if (!savesReady) {
    savesReady = db.query(`
    CREATE TABLE IF NOT EXISTS post_saves (
      post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (post_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_post_saves_user ON post_saves (user_id, created_at DESC);
    `).catch((err) => { savesReady = null; throw err; });
  }
  return savesReady;
}

/** POST /api/posts/:id/save — toggle save */
async function toggleSave(req, res, next) {
  try {
    if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Post not found.' });
    await ensureSavesTable();
    const removed = await db.query(
      'DELETE FROM post_saves WHERE post_id=$1 AND user_id=$2', [req.params.id, req.user.id]
    );
    if (removed.rowCount) return res.json({ success: true, data: { saved: false } });
    const added = await db.query(
      `INSERT INTO post_saves (post_id, user_id)
       SELECT id, $2 FROM posts WHERE id = $1
       ON CONFLICT DO NOTHING`,
      [req.params.id, req.user.id]
    );
    if (!added.rowCount) return res.status(404).json({ success: false, message: 'Post not found.' });
    return res.json({ success: true, data: { saved: true } });
  } catch (err) { next(err); }
}

/** GET /api/posts/saved — the current user's saved posts, most recently saved first */
async function getSavedPosts(req, res, next) {
  try {
    await ensureSavesTable();
    const r = await db.query(
      `${POST_SELECT}
       JOIN post_saves ps ON ps.post_id = p.id AND ps.user_id = $1
       ORDER BY ps.created_at DESC`,
      [req.user.id]
    );
    return res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

/**
 * GET /api/posts/search?q=&suggest=1
 * People by name or @username, posts by tag name (admin tags and older
 * free-text tags), and the matching tag names. `suggest=1` is the light
 * version used while typing: people + tags, no posts.
 */
async function search(req, res, next) {
  try {
    // "#music" and "music" search the same; % and _ are literal, not wildcards
    const q = String(req.query.q ?? '').trim().replace(/^[#@]+/, '').slice(0, 50);
    if (!q) return res.json({ success: true, data: { users: [], tags: [], posts: [] } });
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const prefix = `${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const suggest = req.query.suggest === '1';

    const [users, tags, posts] = await Promise.all([
      db.query(
        `SELECT u.id, u.full_name, u.username, u.avatar_url, u.gender,
                (SELECT COUNT(*)::int FROM user_follows f WHERE f.following_id = u.id) AS followers_count
         FROM users u
         WHERE (u.username ILIKE $1 OR u.full_name ILIKE $1)
           AND (u.username IS NOT NULL OR u.full_name IS NOT NULL)
         ORDER BY (u.username ILIKE $2 OR u.full_name ILIKE $2) DESC, followers_count DESC, u.created_at DESC
         LIMIT $3`,
        [like, prefix, suggest ? 5 : 20]
      ),
      db.query(
        `SELECT t.id, t.name, t.parent_id,
                (SELECT COUNT(*)::int FROM post_tag_links l WHERE l.tag_id = t.id) AS posts_count
         FROM post_tags t
         WHERE t.is_active AND t.name ILIKE $1
         ORDER BY (t.name ILIKE $2) DESC, posts_count DESC, t.name
         LIMIT 8`,
        [like, prefix]
      ),
      suggest ? { rows: [] } : db.query(
        `${POST_SELECT}
         WHERE EXISTS (
                 SELECT 1 FROM post_tag_links l JOIN post_tags t ON t.id = l.tag_id
                 WHERE l.post_id = p.id AND t.is_active AND t.name ILIKE $1)
            OR EXISTS (SELECT 1 FROM unnest(p.tags) AS legacy(tag) WHERE ltrim(legacy.tag, '#') ILIKE $1)
         ORDER BY p.created_at DESC
         LIMIT 30`,
        [like]
      ),
    ]);

    return res.json({ success: true, data: { users: users.rows, tags: tags.rows, posts: posts.rows } });
  } catch (err) { next(err); }
}

/** POST /api/posts/:id/like — toggle like */
async function toggleLike(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    // Try insert; if it already exists, delete it
    const existing = await db.query(
      'SELECT 1 FROM post_likes WHERE post_id=$1 AND user_id=$2', [id, userId]
    );
    let liked;
    if (existing.rows.length) {
      await db.query('DELETE FROM post_likes WHERE post_id=$1 AND user_id=$2', [id, userId]);
      await db.query('UPDATE posts SET likes_count = GREATEST(likes_count-1,0) WHERE id=$1', [id]);
      liked = false;
    } else {
      await db.query('INSERT INTO post_likes (post_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, userId]);
      await db.query('UPDATE posts SET likes_count = likes_count+1 WHERE id=$1', [id]);
      liked = true;
    }
    const r = await db.query('SELECT likes_count FROM posts WHERE id=$1', [id]);
    return res.json({ success: true, data: { liked, likes_count: r.rows[0]?.likes_count ?? 0 } });
  } catch (err) { next(err); }
}

/** GET /api/posts/:id/liked — whether the current user liked (and saved) a post */
async function checkLiked(req, res, next) {
  try {
    await ensureSavesTable();
    const r = await db.query(
      `SELECT EXISTS (SELECT 1 FROM post_likes WHERE post_id=$1 AND user_id=$2) AS liked,
              EXISTS (SELECT 1 FROM post_saves WHERE post_id=$1 AND user_id=$2) AS saved`,
      [req.params.id, req.user.id]
    );
    return res.json({ success: true, data: r.rows[0] });
  } catch (err) { next(err); }
}

/** POST /api/posts/:id/comments — add a comment */
async function addComment(req, res, next) {
  try {
    const { id } = req.params;
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ success: false, message: 'Comment text is required.' });

    // Check if comments are allowed
    const post = await db.query('SELECT allow_comments FROM posts WHERE id=$1', [id]);
    if (!post.rows.length) return res.status(404).json({ success: false, message: 'Post not found.' });
    if (!post.rows[0].allow_comments) return res.status(403).json({ success: false, message: 'Comments are disabled for this post.' });

    const r = await db.query(
      `INSERT INTO post_comments (post_id, user_id, text)
       VALUES ($1,$2,$3)
       RETURNING id, post_id, text, created_at`,
      [id, req.user.id, text.trim()]
    );
    await db.query('UPDATE posts SET comments_count = comments_count+1 WHERE id=$1', [id]);

    // Fetch with user info
    const comment = await db.query(
      `SELECT c.id, c.text, c.created_at, u.id AS user_id, u.full_name, u.username, u.avatar_url
       FROM post_comments c JOIN users u ON u.id = c.user_id WHERE c.id=$1`, [r.rows[0].id]
    );
    return res.status(201).json({ success: true, data: comment.rows[0] });
  } catch (err) { next(err); }
}

/** GET /api/posts/:id/comments — list comments */
async function getComments(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit ?? '30', 10), 100);
    const offset = parseInt(req.query.offset ?? '0', 10);

    const r = await db.query(
      `SELECT c.id, c.text, c.created_at, u.id AS user_id, u.full_name, u.username, u.avatar_url
       FROM post_comments c JOIN users u ON u.id = c.user_id
       WHERE c.post_id=$1
       ORDER BY c.created_at ASC
       LIMIT $2 OFFSET $3`,
      [req.params.id, limit, offset]
    );
    return res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

/** GET /api/posts/user/:userId — public posts of any user */
async function getUserPosts(req, res, next) {
  try {
    const r = await db.query(`${POST_SELECT} WHERE p.user_id = $1 ORDER BY p.created_at DESC`, [req.params.userId]);
    return res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

module.exports = { search, getPost, createPost, getFeed, getMyPosts, getUserPosts, toggleLike, checkLiked, toggleSave, getSavedPosts, addComment, getComments };
