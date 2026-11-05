const db = require('../config/db');

// Chat room stage backgrounds (admin-uploaded images behind the status bar,
// header and seat stage). Each room keeps the one it was given for 24 hours —
// stored on the room, so every viewer sees the same image and reopening /
// minimising the room never re-picks it. When the 24 hours are up the room
// moves on to the next image in the admin's order.

const STAGE_BG_HOLD_MS = 24 * 60 * 60 * 1000;

// Also created in database/migrate-all.js — kept here so the feature works on a
// server where the migration hasn't been re-run yet.
let tableReady = null;
function ensureTable() {
  if (!tableReady) {
    tableReady = (async () => {
      await db.query(`
        CREATE TABLE IF NOT EXISTS stage_backgrounds (
          id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title       TEXT,
          image_url   TEXT NOT NULL,
          sort_order  INTEGER NOT NULL DEFAULT 0,
          is_active   BOOLEAN NOT NULL DEFAULT TRUE,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await db.query(`
        ALTER TABLE rooms
          ADD COLUMN IF NOT EXISTS stage_bg_id UUID,
          ADD COLUMN IF NOT EXISTS stage_bg_selected_at TIMESTAMPTZ;
      `);
    })().catch(err => { tableReady = null; throw err; });
  }
  return tableReady;
}

/** Active backgrounds in the admin's order — the rotation order. */
async function listActive() {
  await ensureTable();
  const r = await db.query(
    `SELECT id, title, image_url, sort_order
     FROM stage_backgrounds WHERE is_active = TRUE
     ORDER BY sort_order ASC, created_at DESC`
  );
  return r.rows;
}

function toSelection(bg, selectedAt) {
  const at = new Date(selectedAt);
  return {
    id: bg.id,
    image_url: bg.image_url,
    selected_at: at.toISOString(),
    expires_at: new Date(at.getTime() + STAGE_BG_HOLD_MS).toISOString(),
  };
}

/**
 * The room's current stage background { id, image_url, selected_at,
 * expires_at }, or null when the admin has none uploaded (default stage).
 * Keeps the stored pick for 24h; after that takes the next image in order.
 * A room with no pick yet (or whose image was removed) gets a random one.
 */
async function getRoomStageBackground(roomId) {
  const list = await listActive();
  if (!list.length) return null;

  const cur = await db.query(`SELECT stage_bg_id, stage_bg_selected_at FROM rooms WHERE id = $1`, [roomId]);
  if (!cur.rows.length) return null;
  const { stage_bg_id: curId, stage_bg_selected_at: curAt } = cur.rows[0];

  const curIndex = curId ? list.findIndex(bg => bg.id === curId) : -1;
  const stillValid = curIndex !== -1 && curAt && Date.now() - new Date(curAt).getTime() < STAGE_BG_HOLD_MS;
  if (stillValid) return toSelection(list[curIndex], curAt);

  const nextIndex = curIndex !== -1
    ? (curIndex + 1) % list.length                 // 24h up → next in rotation
    : Math.floor(Math.random() * list.length);     // first pick / image removed
  const next = list[nextIndex];

  // Only if nobody else re-picked meanwhile — two viewers opening the room at
  // once must end up on the same image. Compared at millisecond precision:
  // Postgres stores microseconds but a JS Date keeps milliseconds, so an exact
  // match would never succeed.
  const upd = await db.query(
    `UPDATE rooms SET stage_bg_id = $2, stage_bg_selected_at = NOW()
     WHERE id = $1
       AND stage_bg_id IS NOT DISTINCT FROM $3
       AND date_trunc('milliseconds', stage_bg_selected_at) IS NOT DISTINCT FROM $4::timestamptz
     RETURNING stage_bg_selected_at`,
    [roomId, next.id, curId ?? null, curAt ?? null]
  );
  if (upd.rows.length) return toSelection(next, upd.rows[0].stage_bg_selected_at);

  // Lost the race — use what the other request stored
  const again = await db.query(`SELECT stage_bg_id, stage_bg_selected_at FROM rooms WHERE id = $1`, [roomId]);
  const won = list.find(bg => bg.id === again.rows[0]?.stage_bg_id);
  // Rooms never fall back to the default stage while the admin has images
  return won ? toSelection(won, again.rows[0].stage_bg_selected_at) : toSelection(next, new Date());
}

module.exports = { ensureTable, listActive, getRoomStageBackground, STAGE_BG_HOLD_MS };
