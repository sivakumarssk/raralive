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

  // ── battle_invites.result_seen flags ──────────────────────────────────────
  await run('battle_invites.result_seen', `
    ALTER TABLE battle_invites
      ADD COLUMN IF NOT EXISTS from_result_seen BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS to_result_seen BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  // ── room_gift_events.target_user_id — actual gift recipient for history ──
  await run('room_gift_events.target_user_id', `
    ALTER TABLE room_gift_events ADD COLUMN IF NOT EXISTS target_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
  `);

  // ── room_blocked_users table ──────────────────────────────────────────────
  await run('room_blocked_users table', `
    CREATE TABLE IF NOT EXISTS room_blocked_users (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id     UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_by  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(room_id, user_id)
    );
  `);
  await run('idx_room_blocked_users_room', `
    CREATE INDEX IF NOT EXISTS idx_room_blocked_users_room ON room_blocked_users(room_id);
  `);

  // ── app_banners table ────────────────────────────────────────────────────────
  await run('app_banners table', `
    CREATE TABLE IF NOT EXISTS app_banners (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title       TEXT,
      image_url   TEXT NOT NULL,
      link_url    TEXT,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      is_active   BOOLEAN NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // ── friend_zone_applications table ──────────────────────────────────────────
  await run('friend_zone_applications table', `
    CREATE TABLE IF NOT EXISTS friend_zone_applications (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      photos           TEXT[] NOT NULL DEFAULT '{}',
      full_name        VARCHAR(120) NOT NULL,
      gender           VARCHAR(20) NOT NULL,
      date_of_birth    DATE NOT NULL,
      city             VARCHAR(120) NOT NULL,
      language         VARCHAR(10) NOT NULL,
      about_me         TEXT,
      status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','approved','rejected')),
      rejection_reason TEXT,
      reviewed_by      UUID REFERENCES admins(id) ON DELETE SET NULL,
      reviewed_at      TIMESTAMPTZ,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await run('idx_friend_zone_applications_user', `
    CREATE INDEX IF NOT EXISTS idx_friend_zone_applications_user ON friend_zone_applications(user_id, created_at DESC);
  `);
  await run('idx_friend_zone_applications_status', `
    CREATE INDEX IF NOT EXISTS idx_friend_zone_applications_status ON friend_zone_applications(status);
  `);

  // ── friend_zone_applications: receive_calls + video_calls toggle prefs ──────
  await run('friend_zone_applications.receive_calls + video_calls', `
    ALTER TABLE friend_zone_applications
      ADD COLUMN IF NOT EXISTS receive_calls BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS video_calls   BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  // ── friend_zone_calls table ──────────────────────────────────────────────────
  await run('friend_zone_calls table', `
    CREATE TABLE IF NOT EXISTS friend_zone_calls (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      channel_name      VARCHAR(120) NOT NULL,
      caller_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      callee_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      call_type         VARCHAR(10) NOT NULL CHECK (call_type IN ('audio','video')),
      status            VARCHAR(20) NOT NULL DEFAULT 'ringing'
                            CHECK (status IN ('ringing','accepted','rejected','missed','ended','failed')),
      started_at        TIMESTAMPTZ,
      ended_at          TIMESTAMPTZ,
      duration_seconds  INTEGER NOT NULL DEFAULT 0,
      coins_charged     INTEGER NOT NULL DEFAULT 0,
      end_reason        VARCHAR(30),
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await run('idx_friend_zone_calls_caller', `
    CREATE INDEX IF NOT EXISTS idx_friend_zone_calls_caller ON friend_zone_calls(caller_id, created_at DESC);
  `);
  await run('idx_friend_zone_calls_callee', `
    CREATE INDEX IF NOT EXISTS idx_friend_zone_calls_callee ON friend_zone_calls(callee_id, created_at DESC);
  `);

  // ── friend_zone_calls: gems_earned (callee's side of the call economy) ──────
  await run('friend_zone_calls.gems_earned', `
    ALTER TABLE friend_zone_calls
      ADD COLUMN IF NOT EXISTS gems_earned INTEGER NOT NULL DEFAULT 0;
  `);

  // ── call_gift_events table — gifts sent during a Friend Zone 1:1 call ───────
  await run('call_gift_events table', `
    CREATE TABLE IF NOT EXISTS call_gift_events (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      call_id        UUID NOT NULL REFERENCES friend_zone_calls(id) ON DELETE CASCADE,
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
  await run('idx_call_gift_events_call', `
    CREATE INDEX IF NOT EXISTS idx_call_gift_events_call ON call_gift_events (call_id, created_at DESC);
  `);

  // ── rooms: city/state/district (auto-detected location) ────────────────────
  await run('rooms.city', `
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS city VARCHAR(120);
  `);
  await run('rooms.state', `
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS state VARCHAR(120);
  `);
  await run('rooms.district', `
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS district VARCHAR(120);
  `);

  // ── conversations + direct_messages tables (1:1 chat) ───────────────────────
  await run('conversations table', `
    CREATE TABLE IF NOT EXISTS conversations (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_a_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_b_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      initiated_by      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status            VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
      last_message_at   TIMESTAMPTZ,
      last_message_preview TEXT,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (user_a_id < user_b_id),
      UNIQUE (user_a_id, user_b_id)
    );
  `);
  await run('idx_conversations_user_a', `
    CREATE INDEX IF NOT EXISTS idx_conversations_user_a ON conversations (user_a_id, status, last_message_at DESC);
  `);
  await run('idx_conversations_user_b', `
    CREATE INDEX IF NOT EXISTS idx_conversations_user_b ON conversations (user_b_id, status, last_message_at DESC);
  `);
  await run('direct_messages table', `
    CREATE TABLE IF NOT EXISTS direct_messages (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type            VARCHAR(20) NOT NULL DEFAULT 'text'
                         CHECK (type IN ('text','image','audio','video','file','sticker')),
      text            TEXT,
      media_url       TEXT,
      media_name      TEXT,
      media_mime      TEXT,
      media_duration_ms INTEGER,
      sticker_id      TEXT,
      read_at         TIMESTAMPTZ,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await run('idx_direct_messages_conversation', `
    CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation ON direct_messages (conversation_id, created_at DESC);
  `);

  // ── go_live_requests table ──────────────────────────────────────────────────
  await run('go_live_requests table', `
    CREATE TABLE IF NOT EXISTS go_live_requests (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      full_name        VARCHAR(120) NOT NULL,
      date_of_birth    DATE NOT NULL,
      language         VARCHAR(10) NOT NULL,
      status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','approved','rejected')),
      rejection_reason TEXT,
      reviewed_by      UUID REFERENCES admins(id) ON DELETE SET NULL,
      reviewed_at      TIMESTAMPTZ,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await run('idx_go_live_requests_user', `
    CREATE INDEX IF NOT EXISTS idx_go_live_requests_user ON go_live_requests(user_id, created_at DESC);
  `);
  await run('idx_go_live_requests_status', `
    CREATE INDEX IF NOT EXISTS idx_go_live_requests_status ON go_live_requests(status);
  `);

  // ── live_broadcasts table ───────────────────────────────────────────────────
  // One row per Go-Live session. room_id points at a private `rooms` row
  // created just for this broadcast (reuses the existing socket/chat/seat
  // infrastructure — join_room, seats_update, chat_message — instead of
  // forking a parallel system). max_cohosts caps invited co-hosts at 3, so
  // together with the host that's a 4-person stream.
  await run('live_broadcasts table', `
    CREATE TABLE IF NOT EXISTS live_broadcasts (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id       UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      host_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      channel_name  VARCHAR(120) NOT NULL,
      status        VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended')),
      max_cohosts   INTEGER NOT NULL DEFAULT 3,
      started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ended_at      TIMESTAMPTZ,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await run('idx_live_broadcasts_host', `
    CREATE INDEX IF NOT EXISTS idx_live_broadcasts_host ON live_broadcasts(host_user_id, status);
  `);
  await run('idx_live_broadcasts_room', `
    CREATE INDEX IF NOT EXISTS idx_live_broadcasts_room ON live_broadcasts(room_id);
  `);
  await run('live_broadcasts.likes_count', `
    ALTER TABLE live_broadcasts ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0;
  `);

  // ── Comment moderation: pin, delete, report ─────────────────────────────────
  // message_id/pinned_message_id are TEXT, not a UUID FK to chat_messages.id —
  // chat messages are identified in-memory (and over the socket wire) by a
  // generated string like "msg_<socketId>_<timestamp>", not the DB row's UUID,
  // so moderation actions (pin/delete/report) key off that same string id.
  // Delete removes the message from the live in-memory room cache (and thus
  // future chat_history for new joiners) rather than soft-deleting a DB row,
  // since there's no id mapping back to the chat_messages row to update.
  await run('rooms.pinned_message_id (drop legacy FK if present)', `
    ALTER TABLE rooms DROP COLUMN IF EXISTS pinned_message_id;
  `);
  await run('rooms.pinned_message_id', `
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS pinned_message_id TEXT;
  `);
  await run('comment_reports table', `
    CREATE TABLE IF NOT EXISTS comment_reports (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id       UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      message_id    TEXT,
      reported_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      reporter_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message_text  TEXT NOT NULL,
      reason        TEXT,
      status        VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed')),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await run('idx_comment_reports_room', `
    CREATE INDEX IF NOT EXISTS idx_comment_reports_room ON comment_reports(room_id, created_at DESC);
  `);
  await run('idx_comment_reports_status', `
    CREATE INDEX IF NOT EXISTS idx_comment_reports_status ON comment_reports(status);
  `);

  console.log('\n✅ All migrations complete.');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
