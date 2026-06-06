require('dotenv').config();
const { pool } = require('../config/db');

async function migrate() {
  try {
    await pool.query(`ALTER TABLE agencies ADD COLUMN IF NOT EXISTS plain_password VARCHAR(64) NOT NULL DEFAULT ''`);
    console.log('Migration OK: plain_password column.');
    await pool.query(`ALTER TABLE agencies ADD COLUMN IF NOT EXISTS is_default_password BOOLEAN NOT NULL DEFAULT TRUE`);
    console.log('Migration OK: is_default_password column.');
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
