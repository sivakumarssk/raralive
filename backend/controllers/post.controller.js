const db = require('../config/db');

/** POST /api/posts — create a post with media */
async function createPost(req, res, next) {
  try {
    const userId = req.user.id;
    const { caption, category, tags, allow_comments } = req.body;
    const files = req.files ?? [];

    if (!files.length) {
      return res.status(400).json({ success: false, message: 'At least one media file is required.' });
    }

    // Parse tags — sent as JSON string or comma-separated
    let parsedTags = [];
    if (tags) {
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
  const r = await db.query(
    `SELECT p.id, p.caption, p.category, p.tags, p.allow_comments,
            p.likes_count, p.comments_count, p.created_at,
            u.id AS user_id, u.full_name, u.username, u.avatar_url,
            json_agg(
              json_build_object('id', pm.id, 'media_url', pm.media_url,
                'media_type', pm.media_type, 'sort_order', pm.sort_order)
              ORDER BY pm.sort_order
            ) AS media
     FROM posts p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN post_media pm ON pm.post_id = p.id
     WHERE p.id = $1
     GROUP BY p.id, u.id`,
    [postId]
  );
  return r.rows[0] || null;
}

/** GET /api/posts/feed — paginated feed of all posts */
async function getFeed(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit ?? '20', 10), 50);
    const offset = parseInt(req.query.offset ?? '0', 10);

    const r = await db.query(
      `SELECT p.id, p.caption, p.category, p.tags, p.allow_comments,
              p.likes_count, p.comments_count, p.created_at,
              u.id AS user_id, u.full_name, u.username, u.avatar_url,
              json_agg(
                json_build_object('id', pm.id, 'media_url', pm.media_url,
                  'media_type', pm.media_type, 'sort_order', pm.sort_order)
                ORDER BY pm.sort_order
              ) AS media
       FROM posts p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN post_media pm ON pm.post_id = p.id
       GROUP BY p.id, u.id
       ORDER BY p.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const total = await db.query('SELECT COUNT(*) FROM posts');
    return res.json({
      success: true,
      data: r.rows,
      total: parseInt(total.rows[0].count, 10),
    });
  } catch (err) { next(err); }
}

/** GET /api/posts/my — current user's posts */
async function getMyPosts(req, res, next) {
  try {
    const r = await db.query(
      `SELECT p.id, p.caption, p.category, p.tags, p.allow_comments,
              p.likes_count, p.comments_count, p.created_at,
              u.id AS user_id, u.full_name, u.username, u.avatar_url,
              json_agg(
                json_build_object('id', pm.id, 'media_url', pm.media_url,
                  'media_type', pm.media_type, 'sort_order', pm.sort_order)
                ORDER BY pm.sort_order
              ) AS media
       FROM posts p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN post_media pm ON pm.post_id = p.id
       WHERE p.user_id = $1
       GROUP BY p.id, u.id
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    return res.json({ success: true, data: r.rows });
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

/** GET /api/posts/:id/liked — check if current user liked a post */
async function checkLiked(req, res, next) {
  try {
    const r = await db.query(
      'SELECT 1 FROM post_likes WHERE post_id=$1 AND user_id=$2',
      [req.params.id, req.user.id]
    );
    return res.json({ success: true, data: { liked: r.rows.length > 0 } });
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
    const r = await db.query(
      `SELECT p.id, p.caption, p.category, p.tags, p.allow_comments,
              p.likes_count, p.comments_count, p.created_at,
              u.id AS user_id, u.full_name, u.username, u.avatar_url,
              json_agg(
                json_build_object('id', pm.id, 'media_url', pm.media_url,
                  'media_type', pm.media_type, 'sort_order', pm.sort_order)
                ORDER BY pm.sort_order
              ) AS media
       FROM posts p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN post_media pm ON pm.post_id = p.id
       WHERE p.user_id = $1
       GROUP BY p.id, u.id
       ORDER BY p.created_at DESC`,
      [req.params.userId]
    );
    return res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

module.exports = { createPost, getFeed, getMyPosts, getUserPosts, toggleLike, checkLiked, addComment, getComments };
