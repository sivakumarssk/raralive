const db = require('../config/db');

// ── Task definitions ──────────────────────────────────────────────────────────

async function listTasks({ activeOnly = false, type = null } = {}) {
  const conds = []; const vals = []; let i = 1;
  if (activeOnly) conds.push(`t.is_active = TRUE`);
  if (type) { conds.push(`t.type = $${i++}`); vals.push(type); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const r = await db.query(
    `SELECT t.*, g.name AS gift_name, g.image_url AS gift_image_url
     FROM tasks t
     LEFT JOIN gifts g ON g.id = t.target_gift_id
     ${where}
     ORDER BY t.type ASC, t.sort_order ASC, t.created_at ASC`,
    vals
  );
  return r.rows;
}

async function getTaskById(id) {
  const r = await db.query(
    `SELECT t.*, g.name AS gift_name, g.image_url AS gift_image_url
     FROM tasks t LEFT JOIN gifts g ON g.id = t.target_gift_id WHERE t.id = $1`, [id]
  );
  return r.rows[0] || null;
}

async function createTask(fields) {
  const r = await db.query(
    `INSERT INTO tasks (title, description, type, target_coins, target_gift_id, target_count,
       reward_gems, icon_type, icon_value, min_level, max_level, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [fields.title, fields.description, fields.type,
     fields.target_coins || null, fields.target_gift_id || null, fields.target_count || 1,
     fields.reward_gems || 0, fields.icon_type || 'emoji', fields.icon_value || '🎁',
     fields.min_level ?? 0, fields.max_level ?? 100, fields.sort_order ?? 0]
  );
  return r.rows[0];
}

async function updateTask(id, fields) {
  const sets = []; const vals = []; let i = 1;
  const map = {
    title: 'title', description: 'description', type: 'type',
    target_coins: 'target_coins', target_gift_id: 'target_gift_id',
    target_count: 'target_count', reward_gems: 'reward_gems',
    icon_type: 'icon_type', icon_value: 'icon_value',
    min_level: 'min_level', max_level: 'max_level',
    sort_order: 'sort_order', is_active: 'is_active',
  };
  for (const [k, col] of Object.entries(map)) {
    if (fields[k] !== undefined) { sets.push(`${col} = $${i++}`); vals.push(fields[k]); }
  }
  if (!sets.length) return getTaskById(id);
  sets.push(`updated_at = NOW()`); vals.push(id);
  const r = await db.query(`UPDATE tasks SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, vals);
  return r.rows[0] || null;
}

async function deleteTask(id) {
  await db.query('DELETE FROM tasks WHERE id = $1', [id]);
}

// ── Task progress ─────────────────────────────────────────────────────────────

function periodStart(type) {
  const now = new Date();
  if (type === 'weekly') {
    // Monday of current week
    const day = now.getDay();
    const diff = (day === 0 ? -6 : 1 - day);
    const mon = new Date(now);
    mon.setDate(now.getDate() + diff);
    return mon.toISOString().slice(0, 10);
  }
  return now.toISOString().slice(0, 10);
}

async function getOrCreateProgress(userId, taskId, type, roomId = null) {
  const ps = periodStart(type);
  const r = await db.query(
    `INSERT INTO task_progress (user_id, task_id, room_id, period_start)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id, task_id, period_start) DO UPDATE SET user_id = EXCLUDED.user_id
     RETURNING *`,
    [userId, taskId, roomId, ps]
  );
  return r.rows[0];
}

async function incrementProgress(userId, taskId, type, amount, targetCount) {
  const ps = periodStart(type);
  const r = await db.query(
    `INSERT INTO task_progress (user_id, task_id, period_start, progress)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id, task_id, period_start)
     DO UPDATE SET
       progress = LEAST(task_progress.progress + $4, $5),
       completed = (task_progress.progress + $4 >= $5),
       completed_at = CASE
         WHEN NOT task_progress.completed AND (task_progress.progress + $4 >= $5)
         THEN NOW() ELSE task_progress.completed_at END,
       updated_at = NOW()
     RETURNING *`,
    [userId, taskId, ps, amount, targetCount]
  );
  return r.rows[0];
}

async function getUserTaskProgress(userId, roomLevel) {
  const ps_daily = periodStart('daily');

  const r = await db.query(
    `SELECT t.id AS task_id, t.title, t.description, t.type, t.target_coins,
            t.target_gift_id, t.target_count, t.reward_gems,
            t.icon_type, t.icon_value, t.min_level, t.max_level,
            g.name AS gift_name, g.image_url AS gift_image_url,
            COALESCE(tp.progress, 0) AS progress,
            COALESCE(tp.completed, FALSE) AS completed,
            tp.completed_at, tp.reward_claimed
     FROM tasks t
     LEFT JOIN gifts g ON g.id = t.target_gift_id
     LEFT JOIN task_progress tp
       ON tp.task_id = t.id AND tp.user_id = $1
       AND tp.period_start = $2::date
     WHERE t.is_active = TRUE
       AND t.type = 'daily'
       AND $3 BETWEEN t.min_level AND t.max_level
     ORDER BY t.sort_order ASC`,
    [userId, ps_daily, roomLevel]
  );
  return r.rows;
}

async function claimReward(userId, taskId, type, rewardGems) {
  const ps = periodStart(type);
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    // Mark claimed
    const updated = await client.query(
      `UPDATE task_progress SET reward_claimed = TRUE WHERE user_id=$1 AND task_id=$2
       AND period_start=$3 AND completed=TRUE AND reward_claimed=FALSE RETURNING id`,
      [userId, taskId, ps]
    );
    if (!updated.rows.length) { await client.query('ROLLBACK'); return false; }
    // Add gems to wallet
    if (rewardGems > 0) {
      await client.query(
        `INSERT INTO wallets (user_id, gems) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET gems = wallets.gems + $2, updated_at = NOW()`,
        [userId, rewardGems]
      );
    }
    await client.query('COMMIT');
    return true;
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
}

module.exports = {
  listTasks, getTaskById, createTask, updateTask, deleteTask,
  getOrCreateProgress, incrementProgress, getUserTaskProgress,
  claimReward, periodStart,
};
