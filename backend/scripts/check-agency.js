require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

async function check() {
  const r = await pool.query('SELECT agent_code, phone, plain_password, password_hash, is_default_password FROM agencies');
  for (const row of r.rows) {
    if (!row.plain_password) {
      console.log(`${row.agent_code}: plain_password is EMPTY — password unknown, needs reset`);
      continue;
    }
    const match = await bcrypt.compare(row.plain_password, row.password_hash);
    console.log(`${row.agent_code}: phone=${row.phone} | plain=${row.plain_password} | hash_matches=${match} | is_default=${row.is_default_password} (type: ${typeof row.is_default_password})`);
  }
  await pool.end();
}
check().catch(e => { console.error(e.message); process.exit(1); });
