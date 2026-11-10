const db = require('../config/db');
const { isUuid } = require('./post-tag.controller');

// Every post response carries its media and its admin tags (`tag_list`:
// [{ id, name, parent_id }]). `tags` is the legacy free-text column.
const POST_SELECT = `
  SELECT p.id, p.caption, p.category, p.tags, p.allow_comments,
         p.likes_count, p.comments_count, p.views_count, p.downloads_count, p.created_at,
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

// views_count / downloads_count on posts, and the tables that make each count
// once: a view once per person per post per day (only after watching at least
// half the video — the app reports it then), a download once per person.
// Also created in database/migrate-all.js.
let statsReady = null;
function ensurePostStats() {
  if (!statsReady) {
    statsReady = db.query(`
    ALTER TABLE posts ADD COLUMN IF NOT EXISTS views_count INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE posts ADD COLUMN IF NOT EXISTS downloads_count INTEGER NOT NULL DEFAULT 0;
    CREATE TABLE IF NOT EXISTS post_views (
      post_id   UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      view_day  DATE NOT NULL,
      viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (post_id, user_id, view_day)
    );
    CREATE TABLE IF NOT EXISTS post_downloads (
      post_id       UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (post_id, user_id)
    );
    `).catch((err) => { statsReady = null; throw err; });
  }
  return statsReady;
}

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
    await ensurePostStats();
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

// Make sure the count columns exist before any post is read
ensurePostStats().catch(() => {});

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
    await ensurePostStats();
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
    await ensurePostStats();
    if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Post not found.' });
    const post = await getPostWithMedia(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });
    return res.json({ success: true, data: post });
  } catch (err) { next(err); }
}

/** GET /api/posts/my — current user's posts */
async function getMyPosts(req, res, next) {
  try {
    await ensurePostStats();
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
    await ensurePostStats();
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

// Every full search (not the while-typing suggestions) is logged, for the
// Explore page's "Most searched today". One person searching the same thing
// many times counts once.
let searchLogReady = null;
function ensureSearchLog() {
  if (!searchLogReady) {
    searchLogReady = db.query(`
    CREATE TABLE IF NOT EXISTS search_logs (
      id         BIGSERIAL PRIMARY KEY,
      term       TEXT NOT NULL,                 -- lower-cased, for grouping
      display    TEXT NOT NULL,                 -- as typed, for showing
      user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_search_logs_time ON search_logs (created_at DESC);
    `).catch((err) => { searchLogReady = null; throw err; });
  }
  return searchLogReady;
}

function logSearch(q, userId) {
  if (q.length < 2) return;
  ensureSearchLog()
    .then(() => db.query(
      'INSERT INTO search_logs (term, display, user_id) VALUES ($1, $2, $3)',
      [q.toLowerCase(), q, userId || null],
    ))
    .catch(() => { /* logging never breaks a search */ });
}

/**
 * GET /api/posts/search?q=&suggest=1
 * People by name or @username, posts by tag name (admin tags and older
 * free-text tags), and the matching tag names. `suggest=1` is the light
 * version used while typing: people + tags, no posts.
 */
async function search(req, res, next) {
  try {
    await ensurePostStats();
    // "#music" and "music" search the same; % and _ are literal, not wildcards
    const q = String(req.query.q ?? '').trim().replace(/^[#@]+/, '').slice(0, 50);
    if (!q) return res.json({ success: true, data: { users: [], tags: [], posts: [] } });
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const prefix = `${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const suggest = req.query.suggest === '1';
    if (!suggest) logSearch(q, req.user?.id);

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

/**
 * GET /api/posts/explore — the Explore page:
 *   top_searches: today's most searched terms (IST day), most people first
 *   most_liked:   posts with the most likes
 *   most_saved:   posts saved by the most people (save counts stay private —
 *                 only the order uses them)
 *   trending:     likes + views + saves + downloads, posts from the last 14 days first
 *   most_followed: people with the most followers
 *   most_viewed:  videos with the most views
 * Categories come from /api/post-tags (admin tabs + sub tags).
 */
async function getExplore(req, res, next) {
  try {
    await Promise.all([ensureSearchLog(), ensureSavesTable(), ensurePostStats()]);
    const [searches, liked, saved, trending, followed, viewed] = await Promise.all([
      db.query(
        `SELECT term,
                (array_agg(display ORDER BY created_at DESC))[1] AS display,
                COUNT(DISTINCT COALESCE(user_id::text, id::text))::int AS searches
         FROM search_logs
         WHERE created_at >= (date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')
         GROUP BY term
         ORDER BY searches DESC, MAX(created_at) DESC
         LIMIT 10`
      ),
      db.query(
        `${POST_SELECT}
         WHERE p.likes_count > 0
         ORDER BY p.likes_count DESC, p.created_at DESC
         LIMIT 12`
      ),
      db.query(
        `${POST_SELECT}
         JOIN (SELECT post_id, COUNT(*) AS saves FROM post_saves GROUP BY post_id) s ON s.post_id = p.id
         ORDER BY s.saves DESC, p.created_at DESC
         LIMIT 12`
      ),
      // Trending: rank ids by score (recent first), then load those posts in that order
      db.query(
        `SELECT q.* FROM (
           SELECT p.id,
                  p.likes_count + p.views_count + COALESCE(sv.saves, 0) + p.downloads_count AS score,
                  p.created_at > NOW() - INTERVAL '14 days' AS recent
           FROM posts p
           LEFT JOIN (SELECT post_id, COUNT(*)::int AS saves FROM post_saves GROUP BY post_id) sv ON sv.post_id = p.id
         ) q
         WHERE q.score > 0
         ORDER BY q.recent DESC, q.score DESC
         LIMIT 12`
      ).then(async ({ rows }) => {
        if (!rows.length) return { rows: [] };
        const ids = rows.map(r => r.id);
        const full = await db.query(`${POST_SELECT} WHERE p.id = ANY($1::uuid[])`, [ids]);
        const byId = new Map(full.rows.map(r => [r.id, r]));
        return { rows: ids.map(id => byId.get(id)).filter(Boolean) };
      }),
      db.query(
        `SELECT u.id, u.full_name, u.username, u.avatar_url, u.gender, f.followers::int AS followers_count
         FROM users u
         JOIN (SELECT following_id, COUNT(*) AS followers FROM user_follows GROUP BY following_id) f ON f.following_id = u.id
         WHERE u.username IS NOT NULL OR u.full_name IS NOT NULL
         ORDER BY f.followers DESC, u.created_at
         LIMIT 12`
      ),
      db.query(
        `${POST_SELECT}
         WHERE p.views_count > 0
           AND EXISTS (SELECT 1 FROM post_media pm WHERE pm.post_id = p.id AND pm.media_type = 'video')
         ORDER BY p.views_count DESC, p.created_at DESC
         LIMIT 12`
      ),
    ]);
    return res.json({
      success: true,
      data: {
        top_searches: searches.rows.map(r => ({ term: r.term, display: r.display, searches: r.searches })),
        most_liked: liked.rows,
        most_saved: saved.rows,
        trending: trending.rows,
        most_followed: followed.rows,
        most_viewed: viewed.rows,
      },
    });
  } catch (err) { next(err); }
}

/**
 * POST /api/posts/:id/view — the app calls this once someone has watched at
 * least half of the video. Counted once per person per post per IST day;
 * signed-out viewers aren't counted.
 */
async function recordView(req, res, next) {
  try {
    if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Post not found.' });
    await ensurePostStats();
    let counted = false;
    if (req.user?.id) {
      const ins = await db.query(
        `INSERT INTO post_views (post_id, user_id, view_day)
         SELECT id, $2, (NOW() AT TIME ZONE 'Asia/Kolkata')::date FROM posts WHERE id = $1
         ON CONFLICT DO NOTHING`,
        [req.params.id, req.user.id]
      );
      counted = ins.rowCount > 0;
    }
    const r = counted
      ? await db.query('UPDATE posts SET views_count = views_count + 1 WHERE id = $1 RETURNING views_count', [req.params.id])
      : await db.query('SELECT views_count FROM posts WHERE id = $1', [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ success: false, message: 'Post not found.' });
    return res.json({ success: true, data: { counted, views_count: r.rows[0].views_count } });
  } catch (err) { next(err); }
}

/** POST /api/posts/:id/download — counted once per person (Trending uses it). */
async function recordDownload(req, res, next) {
  try {
    if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Post not found.' });
    await ensurePostStats();
    const ins = await db.query(
      `INSERT INTO post_downloads (post_id, user_id)
       SELECT id, $2 FROM posts WHERE id = $1
       ON CONFLICT DO NOTHING`,
      [req.params.id, req.user.id]
    );
    if (ins.rowCount) await db.query('UPDATE posts SET downloads_count = downloads_count + 1 WHERE id = $1', [req.params.id]);
    return res.json({ success: true, data: { counted: ins.rowCount > 0 } });
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
    await ensurePostStats();
    const r = await db.query(`${POST_SELECT} WHERE p.user_id = $1 ORDER BY p.created_at DESC`, [req.params.userId]);
    return res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

module.exports = { search, getExplore, recordView, recordDownload, getPost, createPost, getFeed, getMyPosts, getUserPosts, toggleLike, checkLiked, toggleSave, getSavedPosts, addComment, getComments };
