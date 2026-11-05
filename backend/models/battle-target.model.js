const db = require('../config/db');

// Gifting Battle coin targets (5K, 20K, …), managed in the admin panel. The
// app lists the active ones; an invite stores the picked target's id and its
// coin amount at the time, so later admin edits don't change past battles.

// Also created in database/migrate-all.js — kept here so the feature works on a
// server where the migration hasn't been re-run yet.
let tableReady = null;
function ensureTable() {
  if (!tableReady) {
    tableReady = (async () => {
      await db.query(`
        CREATE TABLE IF NOT EXISTS battle_targets (
          id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          label        TEXT,
          coin_amount  BIGINT NOT NULL CHECK (coin_amount > 0),
          image_url    TEXT,
          description  TEXT,
          sort_order   INTEGER NOT NULL DEFAULT 0,
          is_active    BOOLEAN NOT NULL DEFAULT TRUE,
          created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await db.query(`
        ALTER TABLE battle_invites
          ADD COLUMN IF NOT EXISTS target_id UUID,
          ADD COLUMN IF NOT EXISTS target_coins BIGINT;
      `);
    })().catch(err => { tableReady = null; throw err; });
  }
  return tableReady;
}

const ORDER = `ORDER BY sort_order ASC, coin_amount ASC, created_at ASC`;

/** Active targets in the admin's order — what the app shows. */
async function listActive() {
  await ensureTable();
  const r = await db.query(
    `SELECT id, label, coin_amount, image_url, description, sort_order
     FROM battle_targets WHERE is_active = TRUE ${ORDER}`
  );
  return r.rows;
}

async function listAll() {
  await ensureTable();
  const r = await db.query(`SELECT * FROM battle_targets ${ORDER}`);
  return r.rows;
}

async function getActiveById(id) {
  await ensureTable();
  const r = await db.query(`SELECT * FROM battle_targets WHERE id = $1 AND is_active = TRUE`, [id]);
  return r.rows[0] ?? null;
}

async function create({ label, coinAmount, imageUrl, description, sortOrder }) {
  await ensureTable();
  const r = await db.query(
    `INSERT INTO battle_targets (label, coin_amount, image_url, description, sort_order)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [label || null, coinAmount, imageUrl || null, description || null, sortOrder ?? 0]
  );
  return r.rows[0];
}

/** Only the fields passed (not undefined) are changed. imageUrl: null clears the image. */
async function update(id, { label, coinAmount, imageUrl, description, sortOrder }) {
  await ensureTable();
  const sets = [];
  const vals = [id];
  const add = (col, val) => { vals.push(val); sets.push(`${col} = $${vals.length}`); };
  if (label !== undefined) add('label', label || null);
  if (coinAmount !== undefined) add('coin_amount', coinAmount);
  if (imageUrl !== undefined) add('image_url', imageUrl);
  if (description !== undefined) add('description', description || null);
  if (sortOrder !== undefined) add('sort_order', sortOrder);
  if (!sets.length) {
    const r = await db.query(`SELECT * FROM battle_targets WHERE id = $1`, [id]);
    return r.rows[0] ?? null;
  }
  const r = await db.query(
    `UPDATE battle_targets SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`,
    vals
  );
  return r.rows[0] ?? null;
}

async function toggle(id) {
  await ensureTable();
  const r = await db.query(
    `UPDATE battle_targets SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id]
  );
  return r.rows[0] ?? null;
}

async function remove(id) {
  await ensureTable();
  await db.query(`DELETE FROM battle_targets WHERE id = $1`, [id]);
}

module.exports = { ensureTable, listActive, listAll, getActiveById, create, update, toggle, remove };
