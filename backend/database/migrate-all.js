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
  // Posts a user saved (their profile's Saved tab)
  await run('post_saves table', `
    CREATE TABLE IF NOT EXISTS post_saves (
      post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (post_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_post_saves_user ON post_saves (user_id, created_at DESC);
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

  // ── battle_invites.mode — 'normal' (no per-user coin badges on stage) vs
  // 'gifting' (coin totals shown under each stage profile during the battle) ──
  await run('battle_invites.mode', `
    ALTER TABLE battle_invites
      ADD COLUMN IF NOT EXISTS mode VARCHAR(20) NOT NULL DEFAULT 'normal'
        CHECK (mode IN ('normal', 'gifting'));
  `);

  // ── battle_targets — Gifting Battle coin targets, managed in the admin panel.
  // Seeded with the old built-in options only when the table is first created,
  // so re-running never brings back targets an admin deleted. ──
  await run('battle_targets table', `
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'battle_targets') THEN
        CREATE TABLE battle_targets (
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
        INSERT INTO battle_targets (label, coin_amount, sort_order) VALUES
          ('5K', 5000, 1), ('20K', 20000, 2), ('50K', 50000, 3), ('100K', 100000, 4), ('200K', 200000, 5);
      END IF;
    END $$;
  `);
  // The target an invite was played for — coin amount copied at invite time.
  await run('battle_invites target columns', `
    ALTER TABLE battle_invites
      ADD COLUMN IF NOT EXISTS target_id UUID,
      ADD COLUMN IF NOT EXISTS target_coins BIGINT;
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

  // ── stage_backgrounds table (chat room stage/header background images) ──
  await run('stage_backgrounds table', `
    CREATE TABLE IF NOT EXISTS stage_backgrounds (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title       TEXT,
      image_url   TEXT NOT NULL,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      is_active   BOOLEAN NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // ── rooms: stage background held for 24h per room ──
  await run('rooms stage_bg columns', `
    ALTER TABLE rooms
      ADD COLUMN IF NOT EXISTS stage_bg_id UUID,
      ADD COLUMN IF NOT EXISTS stage_bg_selected_at TIMESTAMPTZ;
  `);

  // ── earning_config_versions (admin-managed slabs + gem value, per service/month) ──
  await run('earning_config_versions table', `
    CREATE TABLE IF NOT EXISTS earning_config_versions (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source           TEXT NOT NULL,
      effective_month  TEXT NOT NULL,
      gems_per_coin    NUMERIC NOT NULL,
      bonus_pct        NUMERIC NOT NULL DEFAULT 0,
      slabs            JSONB NOT NULL DEFAULT '[]',
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (source, effective_month)
    );
  `);

  // ── task_bonus_slab_versions (Daily Task "Bonus Payment" slabs, per month) ──
  // Extra bonus on Audio Chat Room gems, separate from the earning slabs.
  await run('task_bonus_slab_versions table', `
    CREATE TABLE IF NOT EXISTS task_bonus_slab_versions (
      effective_month  TEXT PRIMARY KEY,
      slabs            JSONB NOT NULL DEFAULT '[]',
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // ── support_requests table (chatroom Help & Support / Report messages) ──
  await run('support_requests table', `
    CREATE TABLE IF NOT EXISTS support_requests (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
      room_id     UUID,
      type        TEXT NOT NULL DEFAULT 'help',
      message     TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'open',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // ── app_banners.placement (home | chatroom | live) ──
  // (routes/banner.routes.js also adds it on first use and copies existing
  // banners for Live, since they used to show in both Chat Rooms and Live)
  await run('app_banners.placement', `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'app_banners' AND column_name = 'placement'
      ) THEN
        ALTER TABLE app_banners ADD COLUMN placement TEXT NOT NULL DEFAULT 'chatroom';
        INSERT INTO app_banners (title, image_url, link_url, sort_order, is_active, placement)
        SELECT title, image_url, link_url, sort_order, is_active, 'live' FROM app_banners WHERE placement = 'chatroom';
      END IF;
    END $$;
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
  await run('user_reports table', `
    CREATE TABLE IF NOT EXISTS user_reports (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      reported_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reporter_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      room_id           UUID REFERENCES rooms(id) ON DELETE SET NULL,
      reason            TEXT NOT NULL,
      note              TEXT,
      status            VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed')),
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await run('idx_user_reports_reported_user', `
    CREATE INDEX IF NOT EXISTS idx_user_reports_reported_user ON user_reports(reported_user_id, created_at DESC);
  `);
  await run('idx_user_reports_status', `
    CREATE INDEX IF NOT EXISTS idx_user_reports_status ON user_reports(status);
  `);
  // Per-user chat-list preferences (pin / hide-for-me) — conversations rows are
  // shared by both participants, so these can't live as columns on that table.
  await run('user_conversation_state table', `
    CREATE TABLE IF NOT EXISTS user_conversation_state (
      conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      pinned          BOOLEAN NOT NULL DEFAULT FALSE,
      pinned_at       TIMESTAMPTZ,
      hidden          BOOLEAN NOT NULL DEFAULT FALSE,
      hidden_at       TIMESTAMPTZ,
      PRIMARY KEY (conversation_id, user_id)
    );
  `);
  await run('idx_user_conversation_state_user', `
    CREATE INDEX IF NOT EXISTS idx_user_conversation_state_user ON user_conversation_state(user_id);
  `);
  // Written on a user's last socket disconnect (see socket/index.js) — powers
  // the "last seen X ago" fallback in DM chat when a peer is offline.
  await run('users.last_seen_at', `
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
  `);

  // Paid, time-limited chatroom name changes — the host spends coins to set a
  // new room_name for a fixed duration; previous_room_name + expires_at let
  // us lazily revert it back the next time the room is read (see
  // room.controller.js applyRoomNameExpiry()), the same lazy-expiry pattern
  // battle.controller.js already uses for auto-finishing battles.
  await run('rooms.previous_room_name', `
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS previous_room_name VARCHAR(120);
  `);
  await run('rooms.room_name_expires_at', `
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS room_name_expires_at TIMESTAMPTZ;
  `);
  // Set when a host deletes their private room (soft delete, status 'closed')
  await run('rooms.deleted_at', `
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
  `);
  // Topic tags picked when creating a room, shown in the app's room lists
  await run('rooms.tags', `
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
  `);
  // Room names only clash with active rooms: unique among public rooms, and
  // per host among private rooms. Replaces the old every-room-ever unique name.
  await run('rooms name uniqueness', `
      DROP INDEX IF EXISTS idx_rooms_room_name_unique;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_public_room_name
        ON rooms (lower(room_name)) WHERE visibility = 'public' AND status = 'active' AND deleted_at IS NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_private_room_name
        ON rooms (host_user_id, lower(room_name)) WHERE visibility = 'private' AND status = 'active' AND deleted_at IS NULL;
  `);

  // Bumped by "log out of all devices"; app JWTs carry it as `tv`.
  await run('users.token_version', `
    ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
  `);

  // Lets an agency's phone+password also log into the app itself (not just
  // the separate agency panel), tagged with role='agency' so app code can
  // role-gate agency-specific features later. agency_id links back to the
  // owning agencies row; kept nullable/SET NULL so deleting an agency never
  // cascades into deleting the person's app account.
  await run('users.role', `
    ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';
  `);
  await run('users.agency_id', `
    ALTER TABLE users ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL;
  `);
  await run('idx_users_agency_id', `
    CREATE INDEX IF NOT EXISTS idx_users_agency_id ON users(agency_id) WHERE agency_id IS NOT NULL;
  `);

  // Which app services an agency may use, managed by admin on create/edit.
  // Values: 'chatroom' | 'friend_zone' | 'live'. Existing agencies default to
  // chat rooms only (the one service that existed before this column).
  await run('agencies.service_access', `
    ALTER TABLE agencies ADD COLUMN IF NOT EXISTS service_access TEXT[] NOT NULL DEFAULT ARRAY['chatroom']::TEXT[];
  `);

  // ── earning_withdrawals — money taken out of the slab-earnings wallet ───────
  // The wallet balance is computed from slab credits (see earnings.controller)
  // minus pending + paid rows here; a rejected request returns the money.
  await run('earning_withdrawals table', `
    CREATE TABLE IF NOT EXISTS earning_withdrawals (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
      status       VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','rejected')),
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      processed_at TIMESTAMPTZ
    );
  `);
  await run('idx_earning_withdrawals_user', `
    CREATE INDEX IF NOT EXISTS idx_earning_withdrawals_user ON earning_withdrawals(user_id, created_at DESC);
  `);

  // ── user_blocks — 1:1 chat blocking ─────────────────────────────────────────
  // While a row exists neither side can send DMs in their conversation, and
  // the blocker no longer sees it in their chat list.
  await run('user_blocks table', `
    CREATE TABLE IF NOT EXISTS user_blocks (
      blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (blocker_id, blocked_id),
      CHECK (blocker_id <> blocked_id)
    );
  `);
  await run('idx_user_blocks_blocked', `
    CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_id);
  `);

  // ── Agency coin wallet ───────────────────────────────────────────────────────
  // Agencies buy coins from RaRa Live Official (credited by admin, usually in
  // answer to an agency_coin_requests row) and recharge users from them.
  // Every movement is one agency_wallet_transactions row with a readable
  // txn_code (RRL-OFF-… for official credits, RRL-USR-… for user recharges).
  await run('agency_wallets table', `
    CREATE TABLE IF NOT EXISTS agency_wallets (
      agency_id  UUID PRIMARY KEY REFERENCES agencies(id) ON DELETE CASCADE,
      coins      BIGINT NOT NULL DEFAULT 0 CHECK (coins >= 0),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await run('agency_wallet_code_seq', `CREATE SEQUENCE IF NOT EXISTS agency_wallet_code_seq;`);
  await run('agency_coin_requests table', `
    CREATE TABLE IF NOT EXISTS agency_coin_requests (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_code   VARCHAR(40) NOT NULL UNIQUE,
      agency_id      UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
      requested_by   UUID REFERENCES users(id) ON DELETE SET NULL,
      coins          BIGINT NOT NULL CHECK (coins > 0),
      status         VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
      extra_coins    BIGINT NOT NULL DEFAULT 0 CHECK (extra_coins >= 0),
      admin_note     TEXT,
      processed_by   UUID REFERENCES admins(id) ON DELETE SET NULL,
      processed_at   TIMESTAMPTZ,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await run('idx_agency_coin_requests_status', `
    CREATE INDEX IF NOT EXISTS idx_agency_coin_requests_status ON agency_coin_requests(status, created_at DESC);
  `);
  await run('idx_agency_coin_requests_agency', `
    CREATE INDEX IF NOT EXISTS idx_agency_coin_requests_agency ON agency_coin_requests(agency_id, created_at DESC);
  `);
  await run('agency_wallet_transactions table', `
    CREATE TABLE IF NOT EXISTS agency_wallet_transactions (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      txn_code        VARCHAR(40) NOT NULL UNIQUE,
      agency_id       UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
      type            VARCHAR(20) NOT NULL CHECK (type IN ('official_credit','user_recharge')),
      coins           BIGINT NOT NULL CHECK (coins > 0),
      slab_coins      BIGINT NOT NULL DEFAULT 0,
      extra_coins     BIGINT NOT NULL DEFAULT 0,
      balance_after   BIGINT NOT NULL,
      user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
      user_handle     VARCHAR(120),
      user_name       VARCHAR(160),
      request_id      UUID REFERENCES agency_coin_requests(id) ON DELETE SET NULL,
      admin_id        UUID REFERENCES admins(id) ON DELETE SET NULL,
      note            TEXT,
      idempotency_key VARCHAR(80),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (agency_id, idempotency_key)
    );
  `);
  await run('idx_agency_wallet_txn_agency', `
    CREATE INDEX IF NOT EXISTS idx_agency_wallet_txn_agency ON agency_wallet_transactions(agency_id, created_at DESC);
  `);
  await run('idx_agency_wallet_txn_created', `
    CREATE INDEX IF NOT EXISTS idx_agency_wallet_txn_created ON agency_wallet_transactions(created_at DESC);
  `);

  // Gems the receiver earned for a gift sent during a Friend Zone call —
  // recorded per gift so admin call history can show it (older rows: 0).
  await run('call_gift_events.gems_earned', `
    ALTER TABLE call_gift_events ADD COLUMN IF NOT EXISTS gems_earned INTEGER NOT NULL DEFAULT 0;
  `);

  // ── Admin-managed post tags ──────────────────────────────────────────────────
  // Top-level tags (parent_id NULL) are the custom tabs on the app's Home feed;
  // sub tags (parent_id set) show as chips under their tab. Posts link to tags
  // through post_tag_links — users can only pick these, not type their own.
  await run('post_tags table', `
    CREATE TABLE IF NOT EXISTS post_tags (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      parent_id   UUID REFERENCES post_tags(id) ON DELETE CASCADE,
      name        VARCHAR(60) NOT NULL,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      is_active   BOOLEAN NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await run('idx_post_tags_parent', `
    CREATE INDEX IF NOT EXISTS idx_post_tags_parent ON post_tags(parent_id, sort_order);
  `);
  await run('post_tag_links table', `
    CREATE TABLE IF NOT EXISTS post_tag_links (
      post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      tag_id  UUID NOT NULL REFERENCES post_tags(id) ON DELETE CASCADE,
      PRIMARY KEY (post_id, tag_id)
    );
  `);
  await run('idx_post_tag_links_tag', `
    CREATE INDEX IF NOT EXISTS idx_post_tag_links_tag ON post_tag_links(tag_id);
  `);

  // ── otp_codes: wrong-code attempt counter (MSG91 OTP) ───────────────────────
  await run('otp_codes.attempts', `
    ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS attempts SMALLINT NOT NULL DEFAULT 0;
  `);

  // ── users.preferred_language: NULL means "not chosen yet" ───────────────────
  // The app shows the language picker once, only while this is NULL. New
  // accounts start NULL; existing accounts keep their saved value (the old
  // 'en' default), so they go straight to Home and are never asked.
  await run('users.preferred_language no default', `
    ALTER TABLE users ALTER COLUMN preferred_language DROP DEFAULT;
  `);

  // ── Agency Portal: documents history, POC accounts, audit log, support ──────
  // POCs are a separate account type, not admins: an admin token opens the
  // whole admin panel, and a POC must only reach their assigned agencies.
  await run('agency portal tables', `
    CREATE TABLE IF NOT EXISTS agency_documents (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      agency_id    UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
      doc_type     VARCHAR(20) NOT NULL,
      file_url     TEXT NOT NULL,
      status       VARCHAR(20) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','verified','rejected')),
      note         TEXT,
      reviewed_at  TIMESTAMPTZ,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (agency_id, file_url)
    );
    CREATE TABLE IF NOT EXISTS agency_pocs (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      full_name     VARCHAR(120) NOT NULL,
      email         VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      is_active     BOOLEAN NOT NULL DEFAULT TRUE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS agency_poc_assignments (
      poc_id      UUID NOT NULL REFERENCES agency_pocs(id) ON DELETE CASCADE,
      agency_id   UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (poc_id, agency_id)
    );
    CREATE TABLE IF NOT EXISTS agency_audit_log (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      agency_id  UUID REFERENCES agencies(id) ON DELETE SET NULL,
      actor_type VARCHAR(20) NOT NULL,
      actor_id   UUID,
      action     VARCHAR(60) NOT NULL,
      details    JSONB,
      ip         VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_agency_audit_agency ON agency_audit_log(agency_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS agency_support_tickets (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      agency_id   UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
      subject     VARCHAR(160) NOT NULL,
      message     TEXT NOT NULL,
      status      VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
      admin_reply TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_agency_tickets_agency ON agency_support_tickets(agency_id, created_at DESC);
  `);

  // ── rooms.room_image_url — catch up rooms whose host added/changed their
  // profile picture after creating the room (the app now keeps these in sync) ──
  await run('rooms image = host picture', `
    UPDATE rooms r SET room_image_url = u.avatar_url
    FROM users u
    WHERE u.id = r.host_user_id AND u.avatar_url IS NOT NULL
      AND r.room_image_url IS DISTINCT FROM u.avatar_url;
  `);

  console.log('\n✅ All migrations complete.');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
