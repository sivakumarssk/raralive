-- Rara Live — initial auth / profile schema
-- Run via: npm run db:init

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  username VARCHAR(32) UNIQUE,
  full_name VARCHAR(120),
  gender VARCHAR(20),
  date_of_birth DATE,
  preferred_language VARCHAR(10) DEFAULT 'en',
  avatar_url TEXT,
  is_phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username) WHERE username IS NOT NULL;

-- OTP verification (register / login flows)
CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) NOT NULL,
  code VARCHAR(6) NOT NULL,
  purpose VARCHAR(32) NOT NULL DEFAULT 'register',
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_phone_purpose ON otp_codes (phone, purpose);

-- Admin accounts (separate table, separate auth)
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(120),
  role VARCHAR(32) NOT NULL DEFAULT 'admin',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admins_email ON admins (email);

-- Agencies (talent/creator agencies managed by admin)
CREATE TABLE IF NOT EXISTS agencies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_name     VARCHAR(120) NOT NULL UNIQUE,
  person_name     VARCHAR(120) NOT NULL,
  age             SMALLINT NOT NULL CHECK (age >= 18 AND age <= 120),
  email           VARCHAR(255) NOT NULL UNIQUE,
  phone           VARCHAR(20) NOT NULL UNIQUE,
  address         TEXT NOT NULL,

  -- KYC numbers (stored encrypted in prod; plain for dev)
  aadhar_number   VARCHAR(20) NOT NULL,
  pan_number      VARCHAR(20) NOT NULL,
  bank_account      VARCHAR(30) NOT NULL,
  bank_ifsc         VARCHAR(15),
  bank_holder_name  VARCHAR(100),
  bank_name         VARCHAR(100),

  -- Document file paths (uploaded via multer)
  doc_aadhar_url  TEXT,
  doc_pan_url     TEXT,
  doc_bank_url    TEXT,

  -- Agent credentials (auto-generated on creation)
  agent_code           VARCHAR(12) NOT NULL UNIQUE,
  password_hash        VARCHAR(255) NOT NULL,
  plain_password       VARCHAR(64) NOT NULL,
  is_default_password  BOOLEAN NOT NULL DEFAULT TRUE,

  status          VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
  created_by      UUID REFERENCES admins(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agencies_agent_code ON agencies (agent_code);
CREATE INDEX IF NOT EXISTS idx_agencies_phone ON agencies (phone);
CREATE INDEX IF NOT EXISTS idx_agencies_email ON agencies (email);

-- Chat rooms (created by admin, tied to an agency and a host user)
CREATE TABLE IF NOT EXISTS rooms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code       VARCHAR(20) NOT NULL UNIQUE,
  room_name       TEXT NOT NULL UNIQUE,
  description     TEXT,
  agency_id       UUID REFERENCES agencies(id) ON DELETE RESTRICT,
  host_user_id    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  room_image_url  TEXT,
  visibility      VARCHAR(10) NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  status          VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'banned')),
  city            VARCHAR(120),
  state           VARCHAR(120),
  district        VARCHAR(120),
  created_by      UUID REFERENCES admins(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rooms_agency_id ON rooms (agency_id);
CREATE INDEX IF NOT EXISTS idx_rooms_host_user_id ON rooms (host_user_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms (status);
CREATE INDEX IF NOT EXISTS idx_rooms_room_code ON rooms (room_code);

-- Gifts (managed by admin, shown in GiftBar inside chat rooms)
CREATE TABLE IF NOT EXISTS gifts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(80) NOT NULL,
  image_url   TEXT,
  coins       INTEGER NOT NULL CHECK (coins > 0),
  bg_color    VARCHAR(20) NOT NULL DEFAULT '#FFE4EE',
  sort_order  SMALLINT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gifts_is_active ON gifts (is_active);

-- Gift shop categories (tabs in the gift shop modal)
CREATE TABLE IF NOT EXISTS gift_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(60) NOT NULL UNIQUE,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gift_categories_sort ON gift_categories (sort_order ASC);

-- Add category_id to gifts (nullable so existing gifts are unaffected)
ALTER TABLE gifts ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES gift_categories(id) ON DELETE SET NULL;

-- Coin packages (managed by admin, shown in wallet screen)
CREATE TABLE IF NOT EXISTS coin_packages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coins          INTEGER NOT NULL CHECK (coins > 0),
  price          NUMERIC(10,2) NOT NULL CHECK (price > 0),
  original_price NUMERIC(10,2),
  discount       NUMERIC(5,2) NOT NULL DEFAULT 0,
  highlighted    BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order     SMALLINT NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coin_packages_is_active ON coin_packages (is_active);

-- User wallets (one row per user, coin balance)
CREATE TABLE IF NOT EXISTS wallets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  coins      INTEGER NOT NULL DEFAULT 0 CHECK (coins >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets (user_id);

-- Wallet transaction history
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         VARCHAR(20) NOT NULL CHECK (type IN ('credit', 'debit')),
  coins        INTEGER NOT NULL CHECK (coins > 0),
  balance_after INTEGER NOT NULL,
  description  TEXT NOT NULL,
  ref_id       UUID,
  created_by   UUID REFERENCES admins(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_id ON wallet_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_created_at ON wallet_transactions (created_at DESC);

-- Persisted chat messages per room (last 200 kept, older pruned)
CREATE TABLE IF NOT EXISTS chat_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  type       VARCHAR(20) NOT NULL DEFAULT 'message' CHECK (type IN ('message','join','gift')),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages (room_id, created_at DESC);

-- Gift events: who sent what to whom in which room
CREATE TABLE IF NOT EXISTS room_gift_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id       UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  sender_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gift_id       UUID REFERENCES gifts(id) ON DELETE SET NULL,
  gift_name     TEXT NOT NULL,
  gift_image_url TEXT,
  coins         INTEGER NOT NULL CHECK (coins > 0),
  quantity      INTEGER NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_gift_events_room ON room_gift_events (room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_room_gift_events_sender ON room_gift_events (sender_id);
CREATE INDEX IF NOT EXISTS idx_room_gift_events_recipient ON room_gift_events (recipient_id);

-- Add total coins received and current level to rooms
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS total_coins_received BIGINT NOT NULL DEFAULT 0;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS current_level SMALLINT NOT NULL DEFAULT 0;

-- Gems balance (host earns gems from gifts: 1 coin = 5 gems)
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS gems BIGINT NOT NULL DEFAULT 0;

-- Tasks defined by admin — daily, repeat weekly on selected days
CREATE TABLE IF NOT EXISTS tasks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,
  description      TEXT NOT NULL,
  type             VARCHAR(10) NOT NULL DEFAULT 'daily' CHECK (type IN ('daily')),
  target_coins     INTEGER,
  target_gift_id   UUID REFERENCES gifts(id) ON DELETE SET NULL,
  target_count     INTEGER NOT NULL DEFAULT 1,
  icon_type        VARCHAR(10) NOT NULL DEFAULT 'emoji' CHECK (icon_type IN ('emoji','image')),
  icon_value       TEXT NOT NULL DEFAULT '🎁',
  min_level        SMALLINT NOT NULL DEFAULT 0,
  max_level        SMALLINT NOT NULL DEFAULT 100,
  sort_order       SMALLINT NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  day_of_week      SMALLINT[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}', -- 0=Sun…6=Sat
  reward_bg_url    TEXT,
  reward_frame_url TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks (type, is_active);

-- User posts (created from the Create tab)
CREATE TABLE IF NOT EXISTS posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  caption         TEXT,
  category        VARCHAR(40),
  tags            TEXT[],
  allow_comments  BOOLEAN NOT NULL DEFAULT TRUE,
  likes_count     INTEGER NOT NULL DEFAULT 0,
  comments_count  INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts (user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts (created_at DESC);

-- Post media files (one post can have multiple images/videos)
CREATE TABLE IF NOT EXISTS post_media (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  media_url   TEXT NOT NULL,
  media_type  VARCHAR(10) NOT NULL CHECK (media_type IN ('photo', 'video')),
  sort_order  SMALLINT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_media_post_id ON post_media (post_id);

-- Post likes (one per user per post)
CREATE TABLE IF NOT EXISTS post_likes (
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

-- Post comments
CREATE TABLE IF NOT EXISTS post_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments (post_id, created_at DESC);

-- Task progress per user per period (day or week start)
CREATE TABLE IF NOT EXISTS task_progress (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  room_id     UUID REFERENCES rooms(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,        -- date truncated to day (daily) or week start (weekly)
  progress    INTEGER NOT NULL DEFAULT 0,
  completed   BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  reward_claimed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, task_id, period_start)
);

-- Direct-message conversations (1:1). user_a_id is always the lower UUID of
-- the pair so a conversation between two users is unique regardless of who
-- started it. status tracks the request/accept/reject flow: the conversation
-- starts 'pending' when user_a_id != initiated_by (the other party hasn't
-- accepted yet); 'accepted' once they reply/accept; 'rejected' rows are
-- deleted outright rather than kept around (see chat.model.js).
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

CREATE INDEX IF NOT EXISTS idx_conversations_user_a ON conversations (user_a_id, status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_user_b ON conversations (user_b_id, status, last_message_at DESC);

-- Direct messages within a conversation
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

CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation ON direct_messages (conversation_id, created_at DESC);
