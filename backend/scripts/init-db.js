require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

async function initDatabase() {
  const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  try {
    await pool.query(sql);
    console.log('Database schema applied successfully.');
  } catch (error) {
    console.error('Failed to apply schema:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initDatabase();
