const db = require('../config/db');

// ── Task definitions ──────────────────────────────────────────────────────────

async function listTasks({ activeOnly = false } = {}) {
  const conds = []; const vals = []; let i = 1;
  if (activeOnly) conds.push(`t.is_active = TRUE`);
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const r = await db.query(
    `SELECT t.*, g.name AS gift_name, g.image_url AS gift_image_url
     FROM tasks t
     LEFT JOIN gifts g ON g.id = t.target_gift_id
     ${where}
     ORDER BY t.sort_order ASC, t.created_at ASC`,
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
       icon_type, icon_value, min_level, max_level, sort_order, day_of_week,
       reward_bg_url, reward_frame_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING *`,
    [fields.title, fields.description, fields.type || 'daily',
     fields.target_coins || null, fields.target_gift_id || null, fields.target_count || 1,
     fields.icon_type || 'emoji', fields.icon_value || '🎁',
     fields.min_level ?? 0, fields.max_level ?? 100, fields.sort_order ?? 0,
     fields.day_of_week || [0,1,2,3,4,5,6],
     fields.reward_bg_url || null, fields.reward_frame_url || null]
  );
  return r.rows[0];
}

async function updateTask(id, fields) {
  const sets = []; const vals = []; let i = 1;
  const scalarMap = {
    title: 'title', description: 'description', type: 'type',
    target_coins: 'target_coins', target_gift_id: 'target_gift_id',
    target_count: 'target_count',
    icon_type: 'icon_type', icon_value: 'icon_value',
    min_level: 'min_level', max_level: 'max_level',
    sort_order: 'sort_order', is_active: 'is_active',
    reward_bg_url: 'reward_bg_url', reward_frame_url: 'reward_frame_url',
  };
  for (const [k, col] of Object.entries(scalarMap)) {
    if (fields[k] !== undefined) { sets.push(`${col} = $${i++}`); vals.push(fields[k]); }
  }
  // day_of_week is an array — handle separately
  if (fields.day_of_week !== undefined) {
    sets.push(`day_of_week = $${i++}`);
    vals.push(fields.day_of_week);
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

function periodStart() {
  return new Date().toISOString().slice(0, 10); // always daily: YYYY-MM-DD
}

async function getOrCreateProgress(userId, taskId, roomId = null) {
  const ps = periodStart();
  const r = await db.query(
    `INSERT INTO task_progress (user_id, task_id, room_id, period_start)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id, task_id, period_start) DO UPDATE SET user_id = EXCLUDED.user_id
     RETURNING *`,
    [userId, taskId, roomId, ps]
  );
  return r.rows[0];
}

async function incrementProgress(userId, taskId, amount, targetCount, roomId = null) {
  const ps = periodStart();
  console.log(`[MODEL] incrementProgress userId=${userId} taskId=${taskId} amount=${amount} targetCount=${targetCount} roomId=${roomId} period=${ps}`);
  const r = await db.query(
    `WITH before AS (
       SELECT completed FROM task_progress
       WHERE user_id=$1 AND task_id=$2 AND period_start=$3
     )
     INSERT INTO task_progress (user_id, task_id, period_start, progress, completed, reward_claimed, completed_at, room_id)
     VALUES ($1, $2, $3, $4::int, ($4::int >= $5::int), ($4::int >= $5::int), CASE WHEN $4::int >= $5::int THEN NOW() ELSE NULL END, $6)
     ON CONFLICT (user_id, task_id, period_start)
     DO UPDATE SET
       progress = LEAST(task_progress.progress + $4, $5),
       completed = (task_progress.progress + $4 >= $5),
       reward_claimed = CASE
         WHEN NOT task_progress.completed AND (task_progress.progress + $4 >= $5)
         THEN TRUE ELSE task_progress.reward_claimed END,
       completed_at = CASE
         WHEN NOT task_progress.completed AND (task_progress.progress + $4 >= $5)
         THEN NOW() ELSE task_progress.completed_at END,
       room_id = COALESCE(task_progress.room_id, $6),
       updated_at = NOW()
     RETURNING *,
       (completed AND NOT COALESCE((SELECT completed FROM before), FALSE)) AS just_completed`,
    [userId, taskId, ps, amount, targetCount, roomId]
  );
  const row = r.rows[0];
  console.log(`[MODEL] incrementProgress result: progress=${row?.progress} completed=${row?.completed} just_completed=${row?.just_completed} reward_claimed=${row?.reward_claimed} room_id=${row?.room_id}`);
  return row;
}

async function getUserTaskProgress(userId, roomLevel, roomId = null) {
  const ps = periodStart();
  const todayDow = new Date().getDay();

  const r = await db.query(
    `SELECT t.id AS task_id, t.title, t.description, t.type, t.target_coins,
            t.target_gift_id, t.target_count,
            t.icon_type, t.icon_value, t.min_level, t.max_level,
            t.reward_bg_url, t.reward_frame_url,
            g.name AS gift_name, g.image_url AS gift_image_url,
            CASE
              WHEN tp.room_id = $5 OR tp.room_id IS NULL OR $5 IS NULL
              THEN COALESCE(tp.progress, 0)
              ELSE 0
            END AS progress,
            CASE
              WHEN tp.completed = TRUE AND (tp.room_id = $5 OR $5 IS NULL)
              THEN TRUE ELSE FALSE
            END AS completed,
            CASE
              WHEN tp.room_id = $5 OR $5 IS NULL THEN tp.completed_at ELSE NULL
            END AS completed_at,
            CASE
              WHEN tp.reward_claimed = TRUE AND (tp.room_id = $5 OR $5 IS NULL)
              THEN TRUE ELSE FALSE
            END AS reward_claimed
     FROM tasks t
     LEFT JOIN gifts g ON g.id = t.target_gift_id
     LEFT JOIN task_progress tp
       ON tp.task_id = t.id AND tp.user_id = $1
       AND tp.period_start = $2::date
     WHERE t.is_active = TRUE
       AND t.type = 'daily'
       AND $3 BETWEEN t.min_level AND t.max_level
       AND $4 = ANY(t.day_of_week)
     ORDER BY t.sort_order ASC`,
    [userId, ps, roomLevel, todayDow, roomId]
  );
  return r.rows;
}

async function claimReward(userId, taskId) {
  const ps = periodStart();
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE task_progress SET reward_claimed = TRUE WHERE user_id=$1 AND task_id=$2
       AND period_start=$3 AND completed=TRUE AND reward_claimed=FALSE RETURNING id`,
      [userId, taskId, ps]
    );
    if (!updated.rows.length) { await client.query('ROLLBACK'); return false; }
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
