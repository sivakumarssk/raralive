require('dotenv').config();
const { pool } = require('../config/db');

async function migrate() {
  try {
    await pool.query(`
      ALTER TABLE rooms
      ADD COLUMN IF NOT EXISTS visibility VARCHAR(10) NOT NULL DEFAULT 'public'
        CHECK (visibility IN ('public', 'private'))
    `);
    console.log('Migration OK: rooms.visibility column.');
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
