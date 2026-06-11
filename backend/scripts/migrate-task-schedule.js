require('dotenv').config();
const { pool } = require('../config/db');

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS day_of_week SMALLINT[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}';
    `);
    // Also add reward_bg_url and reward_frame_url if not present (previous migration may have missed)
    await client.query(`
      ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS reward_bg_url    TEXT,
        ADD COLUMN IF NOT EXISTS reward_frame_url TEXT;
    `);
    console.log('Migration complete: tasks.day_of_week added (0=Sun … 6=Sat), defaults to all days.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
