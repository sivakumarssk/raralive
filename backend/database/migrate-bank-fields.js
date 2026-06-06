const db = require('../config/db');

async function migrate() {
  await db.query(`
    ALTER TABLE agencies
      ADD COLUMN IF NOT EXISTS bank_holder_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS bank_name         VARCHAR(100);
  `);
  console.log('Migration complete: bank_holder_name, bank_name added to agencies.');
  process.exit(0);
}

migrate().catch(err => { console.error(err); process.exit(1); });