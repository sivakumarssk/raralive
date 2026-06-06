const taskModel = require('../models/task.model');
const { uploadShopGift } = require('../middleware/upload.middleware');

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
      title, description, type, target_coins, target_gift_id,
      target_count, reward_gems, icon_type, icon_value,
      min_level, max_level, sort_order,
    } = req.body;

    if (!title || !description || !type) {
      return res.status(400).json({ success: false, message: 'title, description, type required.' });
    }
    if (type !== 'daily') {
      return res.status(400).json({ success: false, message: 'type must be daily.' });
    }

    const iconVal = req.file
      ? `uploads/shop-gifts/${req.file.filename}`
      : (icon_value || '🎁');

    const task = await taskModel.createTask({
      title: title.trim(), description: description.trim(), type,
      target_coins: target_coins ? parseInt(target_coins, 10) : null,
      target_gift_id: target_gift_id || null,
      target_count: parseInt(target_count || '1', 10),
      reward_gems: parseInt(reward_gems || '0', 10),
      icon_type: req.file ? 'image' : (icon_type || 'emoji'),
      icon_value: iconVal,
      min_level: parseInt(min_level || '0', 10),
      max_level: parseInt(max_level || '100', 10),
      sort_order: parseInt(sort_order || '0', 10),
    });
    return res.status(201).json({ success: true, data: task });
  } catch (err) { next(err); }
}

async function updateTask(req, res, next) {
  try {
    const { id } = req.params;
    const fields = { ...req.body };
    if (req.file) {
      fields.icon_type = 'image';
      fields.icon_value = `uploads/shop-gifts/${req.file.filename}`;
    }
    // parse numbers
    ['target_coins','target_count','reward_gems','min_level','max_level','sort_order'].forEach(k => {
      if (fields[k] !== undefined) fields[k] = fields[k] === '' ? null : parseInt(fields[k], 10);
    });
    if (fields.is_active !== undefined) fields.is_active = fields.is_active === 'true' || fields.is_active === true;
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

    // Get room level for level-gated tasks
    let roomLevel = 0;
    if (room_id) {
      const r = await require('../config/db').query(
        'SELECT current_level FROM rooms WHERE id = $1', [room_id]
      );
      if (r.rows.length) roomLevel = r.rows[0].current_level;
    }

    const tasks = await taskModel.getUserTaskProgress(userId, roomLevel);
    return res.json({ success: true, data: tasks });
  } catch (err) { next(err); }
}

async function claimReward(req, res, next) {
  try {
    const userId = req.user.id;
    const { task_id } = req.body;
    if (!task_id) return res.status(400).json({ success: false, message: 'task_id required.' });

    const task = await taskModel.getTaskById(task_id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    const claimed = await taskModel.claimReward(userId, task_id, task.type, task.reward_gems);
    if (!claimed) return res.status(400).json({ success: false, message: 'Task not completed or already claimed.' });

    return res.json({ success: true, data: { gems_awarded: task.reward_gems } });
  } catch (err) { next(err); }
}

async function getTopHosts(req, res, next) {
  try {
    // Start of current week (Monday)
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);

    const r = await require('../config/db').query(
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
    // Start of current week (Monday)
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);
    const weekStartDate = weekStart.toISOString().slice(0, 10);

    const r = await require('../config/db').query(
      `SELECT DISTINCT u.id, u.full_name, u.username, u.avatar_url,
              tp.completed_at, t.title AS task_title, t.reward_gems
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

module.exports = { listTasks, createTask, updateTask, deleteTask, getMyTasks, claimReward, getTopHosts, getWinners };
