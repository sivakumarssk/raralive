const db = require('../config/db');
const taskModel = require('../models/task.model');
const ioInstance = require('../utils/io-instance');

// ── helpers ───────────────────────────────────────────────────────────────────

function fileUrl(req, file, subfolder) {
  if (!file) return null;
  return `uploads/${subfolder}/${file.filename}`;
}

function parseDow(raw) {
  // Accept "1,2,3" or "[1,2,3]" or JSON array
  if (!raw) return [0,1,2,3,4,5,6];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(Number);
  } catch {}
  return String(raw).replace(/[\[\]]/g, '').split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
}

// ── Admin: Task CRUD ──────────────────────────────────────────────────────────

async function listTasks(req, res, next) {
  try {
    const rows = await taskModel.listTasks();
    return res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

async function createTask(req, res, next) {
  try {
    const {
      title, description, target_coins, target_gift_id,
      target_count, icon_type, icon_value, min_level, max_level, sort_order,
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'title and description required.' });
    }

    const files = req.files || {};
    const iconFile = files.icon_image?.[0];
    const bgFile   = files.reward_bg_image?.[0];
    const frameFile = files.reward_frame_image?.[0];

    const iconVal = iconFile
      ? `uploads/shop-gifts/${iconFile.filename}`
      : (icon_value || '🎁');

    const task = await taskModel.createTask({
      title: title.trim(),
      description: description.trim(),
      type: 'daily',
      target_coins: target_coins ? parseInt(target_coins, 10) : null,
      target_gift_id: target_gift_id || null,
      target_count: parseInt(target_count || '1', 10),
      icon_type: iconFile ? 'image' : (icon_type || 'emoji'),
      icon_value: iconVal,
      min_level: parseInt(min_level || '0', 10),
      max_level: parseInt(max_level || '100', 10),
      sort_order: parseInt(sort_order || '0', 10),
      day_of_week: parseDow(req.body.day_of_week),
      reward_bg_url: bgFile ? `uploads/task-bg/${bgFile.filename}` : null,
      reward_frame_url: frameFile ? `uploads/task-frames/${frameFile.filename}` : null,
    });
    return res.status(201).json({ success: true, data: task });
  } catch (err) { next(err); }
}

async function updateTask(req, res, next) {
  try {
    const { id } = req.params;
    const fields = { ...req.body };
    const files = req.files || {};
    const iconFile = files.icon_image?.[0];
    const bgFile   = files.reward_bg_image?.[0];
    const frameFile = files.reward_frame_image?.[0];

    if (iconFile) {
      fields.icon_type = 'image';
      fields.icon_value = `uploads/shop-gifts/${iconFile.filename}`;
    }
    if (bgFile)    fields.reward_bg_url    = `uploads/task-bg/${bgFile.filename}`;
    if (frameFile) fields.reward_frame_url = `uploads/task-frames/${frameFile.filename}`;

    // parse numbers
    ['target_coins','target_count','min_level','max_level','sort_order'].forEach(k => {
      if (fields[k] !== undefined) fields[k] = fields[k] === '' ? null : parseInt(fields[k], 10);
    });
    if (fields.is_active !== undefined) fields.is_active = fields.is_active === 'true' || fields.is_active === true;
    if (fields.day_of_week !== undefined) fields.day_of_week = parseDow(fields.day_of_week);

    const task = await taskModel.updateTask(id, fields);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });
    return res.json({ success: true, data: task });
  } catch (err) { next(err); }
}

async function deleteTask(req, res, next) {
  try {
    await taskModel.deleteTask(req.params.id);
    return res.json({ success: true });
  } catch (err) { next(err); }
}

// ── App: User task progress ───────────────────────────────────────────────────

async function getMyTasks(req, res, next) {
  try {
    const userId = req.user.id;
    const { room_id } = req.query;

    let roomLevel = 0;
    if (room_id) {
      const r = await db.query('SELECT current_level FROM rooms WHERE id = $1', [room_id]);
      if (r.rows.length) roomLevel = r.rows[0].current_level;
    }

    const tasks = await taskModel.getUserTaskProgress(userId, roomLevel, room_id || null);
    return res.json({ success: true, data: tasks });
  } catch (err) { next(err); }
}

async function claimReward(req, res, next) {
  try {
    const userId = req.user.id;
    const { task_id, room_id } = req.body;
    if (!task_id) return res.status(400).json({ success: false, message: 'task_id required.' });

    const task = await taskModel.getTaskById(task_id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    const claimed = await taskModel.claimReward(userId, task_id);
    if (!claimed) return res.status(400).json({ success: false, message: 'Task not completed or already claimed.' });

    // Broadcast reward visuals to the room in real-time
    if (room_id && (task.reward_bg_url || task.reward_frame_url)) {
      const io = ioInstance.get();
      if (io) {
        io.to(room_id).emit('reward_applied', {
          reward_bg_url: task.reward_bg_url,
          reward_frame_url: task.reward_frame_url,
        });
      }
    }

    return res.json({ success: true, data: {
      reward_bg_url: task.reward_bg_url,
      reward_frame_url: task.reward_frame_url,
    }});
  } catch (err) { next(err); }
}

// Returns the active reward (bg + frame) for a room — valid for 24h after claim
async function getActiveReward(req, res, next) {
  try {
    const { room_id } = req.query;
    if (!room_id) return res.json({ success: true, data: null });

    // Find any user who completed a reward task in this room within 24h
    // Primary: match by room_id stored on task_progress (set since the fix)
    // Fallback: match by period_start = today for any user (pre-fix rows have NULL room_id)
    const r = await db.query(
      `SELECT t.reward_bg_url, t.reward_frame_url, tp.completed_at
       FROM task_progress tp
       JOIN tasks t ON t.id = tp.task_id
       WHERE tp.reward_claimed = TRUE
         AND tp.completed_at >= NOW() - INTERVAL '24 hours'
         AND (t.reward_bg_url IS NOT NULL OR t.reward_frame_url IS NOT NULL)
         AND (
           tp.room_id = $1
           OR EXISTS (
             SELECT 1 FROM room_gift_events rge
             WHERE rge.room_id = $1
               AND rge.sender_id = tp.user_id
               AND rge.created_at >= NOW() - INTERVAL '24 hours'
           )
         )
       ORDER BY tp.completed_at DESC
       LIMIT 1`,
      [room_id]
    );
    // Debug: dump all recent completions regardless of room
    const debug = await db.query(
      `SELECT tp.user_id, tp.task_id, tp.room_id, tp.completed, tp.reward_claimed,
              tp.completed_at, tp.period_start,
              t.reward_bg_url,
              EXISTS(SELECT 1 FROM room_gift_events rge WHERE rge.room_id=$1 AND rge.sender_id=tp.user_id) AS gifted_in_room
       FROM task_progress tp
       JOIN tasks t ON t.id = tp.task_id
       WHERE tp.completed_at >= NOW() - INTERVAL '24 hours'
         AND (t.reward_bg_url IS NOT NULL OR t.reward_frame_url IS NOT NULL)
       ORDER BY tp.completed_at DESC LIMIT 10`,
      [room_id]
    );
    console.log(`[ACTIVE-REWARD-DEBUG] recent completions with rewards:`, JSON.stringify(debug.rows));
    console.log(`[ACTIVE-REWARD] room=${room_id} found=${r.rows.length > 0}`);
    if (r.rows.length) console.log(`[ACTIVE-REWARD] bg=${r.rows[0].reward_bg_url} frame=${r.rows[0].reward_frame_url} completed_at=${r.rows[0].completed_at}`);
    const row = r.rows[0] || null;
    return res.json({ success: true, data: row ? {
      reward_bg_url: row.reward_bg_url,
      reward_frame_url: row.reward_frame_url,
    } : null });
  } catch (err) { next(err); }
}

async function getTopHosts(req, res, next) {
  try {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);

    const r = await db.query(
      `SELECT u.id, u.full_name, u.username, u.avatar_url,
              SUM(e.coins * e.quantity) AS total_coins
       FROM room_gift_events e
       JOIN users u ON u.id = e.recipient_id
       WHERE e.created_at >= $1
       GROUP BY u.id, u.full_name, u.username, u.avatar_url
       ORDER BY total_coins DESC
       LIMIT 10`,
      [weekStart.toISOString()]
    );
    return res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

async function getWinners(req, res, next) {
  try {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);
    const weekStartDate = weekStart.toISOString().slice(0, 10);

    const r = await db.query(
      `SELECT DISTINCT u.id, u.full_name, u.username, u.avatar_url,
              tp.completed_at, t.title AS task_title
       FROM task_progress tp
       JOIN users u ON u.id = tp.user_id
       JOIN tasks t ON t.id = tp.task_id
       WHERE tp.completed = TRUE
         AND tp.reward_claimed = TRUE
         AND tp.period_start >= $1
       ORDER BY tp.completed_at DESC
       LIMIT 20`,
      [weekStartDate]
    );
    return res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

async function getTopGifters(req, res, next) {
  try {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);

    const r = await db.query(
      `SELECT u.id, u.full_name, u.username, u.avatar_url,
              SUM(e.coins * e.quantity)::int AS total_coins
       FROM room_gift_events e
       JOIN users u ON u.id = e.sender_id
       WHERE e.created_at >= $1
       GROUP BY u.id, u.full_name, u.username, u.avatar_url
       ORDER BY total_coins DESC
       LIMIT 20`,
      [weekStart.toISOString()]
    );
    return res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

module.exports = { listTasks, createTask, updateTask, deleteTask, getMyTasks, claimReward, getActiveReward, getTopHosts, getWinners, getTopGifters };
