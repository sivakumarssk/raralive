require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'raralive',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

async function run(label, sql) {
  await pool.query(sql);
  console.log(`✓ ${label}`);
}

async function migrate() {
  console.log('Running all pending migrations…\n');

  // ── 1. rooms: total_coins_received + current_level ──────────────────────────
  await run('rooms.total_coins_received', `
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS total_coins_received BIGINT NOT NULL DEFAULT 0;
  `);
  await run('rooms.current_level', `
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS current_level SMALLINT NOT NULL DEFAULT 0;
  `);

  // ── 2. wallets: gems column ──────────────────────────────────────────────────
  await run('wallets.gems', `
    ALTER TABLE wallets ADD COLUMN IF NOT EXISTS gems BIGINT NOT NULL DEFAULT 0;
  `);

  // ── 3. gifts: category_id ───────────────────────────────────────────────────
  await run('gift_categories table', `
    CREATE TABLE IF NOT EXISTS gift_categories (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name       VARCHAR(60) NOT NULL UNIQUE,
      sort_order SMALLINT NOT NULL DEFAULT 0,
      is_active  BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await run('gifts.category_id', `
    ALTER TABLE gifts ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES gift_categories(id) ON DELETE SET NULL;
  `);

  // ── 4. tasks table ───────────────────────────────────────────────────────────
  await run('tasks table', `
    CREATE TABLE IF NOT EXISTS tasks (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title          TEXT NOT NULL,
      description    TEXT NOT NULL,
      type           VARCHAR(10) NOT NULL CHECK (type IN ('daily','weekly')),
      target_coins   INTEGER,
      target_gift_id UUID REFERENCES gifts(id) ON DELETE SET NULL,
      target_count   INTEGER NOT NULL DEFAULT 1,
      reward_gems    INTEGER NOT NULL DEFAULT 0,
      icon_type      VARCHAR(10) NOT NULL DEFAULT 'emoji' CHECK (icon_type IN ('emoji','image')),
      icon_value     TEXT NOT NULL DEFAULT '🎁',
      min_level      SMALLINT NOT NULL DEFAULT 0,
      max_level      SMALLINT NOT NULL DEFAULT 100,
      sort_order     SMALLINT NOT NULL DEFAULT 0,
      is_active      BOOLEAN NOT NULL DEFAULT TRUE,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await run('idx_tasks_type', `
    CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks (type, is_active);
  `);

  // ── 5. task_progress table ───────────────────────────────────────────────────
  await run('task_progress table', `
    CREATE TABLE IF NOT EXISTS task_progress (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      task_id        UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      room_id        UUID REFERENCES rooms(id) ON DELETE CASCADE,
      period_start   DATE NOT NULL,
      progress       INTEGER NOT NULL DEFAULT 0,
      completed      BOOLEAN NOT NULL DEFAULT FALSE,
      completed_at   TIMESTAMPTZ,
      reward_claimed BOOLEAN NOT NULL DEFAULT FALSE,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, task_id, period_start)
    );
  `);

  // ── 6. room_gift_events table ────────────────────────────────────────────────
  await run('room_gift_events table', `
    CREATE TABLE IF NOT EXISTS room_gift_events (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id        UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      sender_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipient_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      gift_id        UUID REFERENCES gifts(id) ON DELETE SET NULL,
      gift_name      TEXT NOT NULL,
      gift_image_url TEXT,
      coins          INTEGER NOT NULL CHECK (coins > 0),
      quantity       INTEGER NOT NULL DEFAULT 1,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await run('idx_room_gift_events_room', `
    CREATE INDEX IF NOT EXISTS idx_room_gift_events_room      ON room_gift_events (room_id, created_at DESC);
  `);
  await run('idx_room_gift_events_sender', `
    CREATE INDEX IF NOT EXISTS idx_room_gift_events_sender    ON room_gift_events (sender_id);
  `);
  await run('idx_room_gift_events_recipient', `
    CREATE INDEX IF NOT EXISTS idx_room_gift_events_recipient ON room_gift_events (recipient_id);
  `);

  // ── 7. agencies: bank_holder_name + bank_name ────────────────────────────────
  await run('agencies.bank_holder_name + bank_name', `
    ALTER TABLE agencies
      ADD COLUMN IF NOT EXISTS bank_holder_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS bank_name        VARCHAR(100);
  `);

  // ── 8. posts + post_media + post_likes + post_comments ──────────────────────
  await run('posts table', `
    CREATE TABLE IF NOT EXISTS posts (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      caption        TEXT,
      category       VARCHAR(40),
      tags           TEXT[],
      allow_comments BOOLEAN NOT NULL DEFAULT TRUE,
      likes_count    INTEGER NOT NULL DEFAULT 0,
      comments_count INTEGER NOT NULL DEFAULT 0,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await run('post_media table', `
    CREATE TABLE IF NOT EXISTS post_media (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      media_url  TEXT NOT NULL,
      media_type VARCHAR(10) NOT NULL CHECK (media_type IN ('photo','video')),
      sort_order SMALLINT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await run('post_likes table', `
    CREATE TABLE IF NOT EXISTS post_likes (
      post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (post_id, user_id)
    );
  `);
  await run('post_comments table', `
    CREATE TABLE IF NOT EXISTS post_comments (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      text       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // ── 9. battle_invites + notifications ────────────────────────────────────────
  await run('battle_invites table', `
    CREATE TABLE IF NOT EXISTS battle_invites (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      from_room_id     UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      to_room_id       UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      from_user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      duration_minutes INTEGER NOT NULL DEFAULT 25,
      status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','accepted','declined','active','finished')),
      started_at       TIMESTAMPTZ,
      finished_at      TIMESTAMPTZ,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await run('notifications table', `
    CREATE TABLE IF NOT EXISTS notifications (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type       VARCHAR(40) NOT NULL,
      title      TEXT NOT NULL,
      body       TEXT NOT NULL,
      data       JSONB,
      is_read    BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await run('idx_notifications_user', `
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
  `);

  // ── users: bio + cover_url + location + followers table ─────────────────────
  await run('users.bio', `
    ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
  `);
  await run('users.cover_url', `
    ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_url TEXT;
  `);
  await run('users.location', `
    ALTER TABLE users ADD COLUMN IF NOT EXISTS location TEXT;
  `);
  await run('user_follows table', `
    CREATE TABLE IF NOT EXISTS user_follows (
      follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (follower_id, following_id)
    );
  `);
  await run('idx_user_follows_follower', `
    CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id);
  `);
  await run('idx_user_follows_following', `
    CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id);
  `);

  console.log('\n✅ All migrations complete.');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
