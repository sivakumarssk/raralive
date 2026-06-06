require('dotenv').config();
const db = require('../config/db');

async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS rooms (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_name       VARCHAR(120) NOT NULL,
      description     TEXT,
      agency_id       UUID NOT NULL REFERENCES agencies(id) ON DELETE RESTRICT,
      host_user_id    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      room_image_url  TEXT,
      status          VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'banned')),
      created_by      UUID REFERENCES admins(id) ON DELETE SET NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_rooms_agency_id ON rooms (agency_id);`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_rooms_host_user_id ON rooms (host_user_id);`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms (status);`);
  console.log('rooms table migrated.');
  process.exit(0);
}

migrate().catch(e => { console.error(e); process.exit(1); });
