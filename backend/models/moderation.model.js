const db = require('../config/db');

// Chat room moderation: report evidence, automatic warnings and 24h bans.
//
//   • A user reported by 5 DIFFERENT people (profile "Report User" or a
//     reported chat message) gets one warning notification.
//   • A chat room reported by 3 DIFFERENT people is banned for 24h, and so is
//     its host's ID — a banned ID can't enter any chat room (checked in the
//     socket join_room, so switching rooms / reconnecting / restarting can't
//     get around it). Bans lift on their own when expires_at passes.
//
// Only distinct reporter IDs count, and only reports made since the target's
// last warning / ban (a new "cycle"), so one person reporting repeatedly can
// never reach a threshold. Every report is kept as evidence and every action is
// logged; admins can dismiss reports and lift a ban (reports page).
//
// Each report runs in one transaction holding an advisory lock on its target,
// so simultaneous reports can't produce two warnings or two bans.

const WARN_UNIQUE_REPORTERS = 5;
const ROOM_BAN_UNIQUE_REPORTERS = 3;
const BAN_HOURS = 24;
// Guards against report spam from one account (all report kinds together)
const MAX_REPORTS_PER_HOUR = 10;

const WARNING_MESSAGE = 'You are misusing the Chat Room and violating our rules. Please do not repeat this behaviour.';
const USER_BANNED_MESSAGE = 'Your ID is banned for 24 hours';
const ROOM_BANNED_MESSAGE = 'This Chat Room is banned for 24 hours.';

class ModerationError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

let tablesReady = null;
function ensureTables() {
  if (!tablesReady) {
    tablesReady = db.query(`
      CREATE TABLE IF NOT EXISTS room_reports (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_id      UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
        reporter_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reason       TEXT NOT NULL,
        note         TEXT,
        status       VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed')),
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_room_reports_room ON room_reports(room_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS user_warnings (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message       TEXT NOT NULL,
        reporter_ids  UUID[] NOT NULL DEFAULT '{}',
        delivered_at  TIMESTAMPTZ,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_user_warnings_user ON user_warnings(user_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS moderation_bans (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        target_type     VARCHAR(10) NOT NULL CHECK (target_type IN ('user','room')),
        target_id       UUID NOT NULL,
        reason          TEXT NOT NULL,
        source_room_id  UUID,
        reporter_ids    UUID[] NOT NULL DEFAULT '{}',
        starts_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at      TIMESTAMPTZ NOT NULL,
        lifted_at       TIMESTAMPTZ,
        lifted_by       UUID,
        lift_note       TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_moderation_bans_target ON moderation_bans(target_type, target_id, expires_at DESC);
      CREATE TABLE IF NOT EXISTS moderation_logs (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        action       VARCHAR(30) NOT NULL,
        target_type  VARCHAR(10),
        target_id    UUID,
        actor_id     UUID,
        details      JSONB NOT NULL DEFAULT '{}',
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_moderation_logs_target ON moderation_logs(target_type, target_id, created_at DESC);
    `).catch(err => { tablesReady = null; throw err; });
  }
  return tablesReady;
}

async function log(client, action, targetType, targetId, actorId, details = {}) {
  await client.query(
    `INSERT INTO moderation_logs (action, target_type, target_id, actor_id, details) VALUES ($1, $2, $3, $4, $5)`,
    [action, targetType, targetId, actorId, JSON.stringify(details)]
  );
}

/** Run fn inside a transaction that holds an advisory lock on `lockKey`. */
async function withTargetLock(lockKey, fn) {
  await ensureTables();
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockKey]);
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function assertNotSpamming(client, reporterId) {
  const r = await client.query(
    `SELECT
       (SELECT COUNT(*) FROM room_reports    WHERE reporter_id = $1 AND created_at > NOW() - INTERVAL '1 hour') +
       (SELECT COUNT(*) FROM user_reports    WHERE reporter_id = $1 AND created_at > NOW() - INTERVAL '1 hour') +
       (SELECT COUNT(*) FROM comment_reports WHERE reporter_id = $1 AND created_at > NOW() - INTERVAL '1 hour') AS n`,
    [reporterId]
  );
  if (Number(r.rows[0].n) >= MAX_REPORTS_PER_HOUR) {
    throw new ModerationError(429, 'You have sent too many reports. Please try again later.');
  }
}

// ── Chat room reports → 24h ban (room + host ID) ─────────────────────────────

/**
 * Report a chat room. Returns { duplicate } or { reported, ban } where ban is
 * { roomId, hostUserId, expiresAt } when this report reached the threshold.
 */
async function reportRoom({ reporterId, roomId, reason, note }) {
  return withTargetLock(`mod:room:${roomId}`, async client => {
    const room = (await client.query(`SELECT id, host_user_id FROM rooms WHERE id = $1`, [roomId])).rows[0];
    if (!room) throw new ModerationError(404, 'Chat Room not found.');
    if (room.host_user_id === reporterId) throw new ModerationError(400, "You can't report your own Chat Room.");

    // The current cycle starts at the room's last report-ban
    const lastBan = (await client.query(
      `SELECT MAX(created_at) AS at FROM moderation_bans WHERE target_type = 'room' AND target_id = $1`, [roomId]
    )).rows[0].at;
    const since = lastBan ?? new Date(0);

    const dup = await client.query(
      `SELECT 1 FROM room_reports WHERE room_id = $1 AND reporter_id = $2 AND created_at > $3 AND status <> 'dismissed' LIMIT 1`,
      [roomId, reporterId, since]
    );
    if (dup.rows.length) return { duplicate: true };

    await assertNotSpamming(client, reporterId);
    const ins = await client.query(
      `INSERT INTO room_reports (room_id, reporter_id, reason, note) VALUES ($1, $2, $3, $4) RETURNING id`,
      [roomId, reporterId, reason, note || null]
    );
    await log(client, 'room_report', 'room', roomId, reporterId, { report_id: ins.rows[0].id, reason });

    const reporters = (await client.query(
      `SELECT DISTINCT reporter_id FROM room_reports
       WHERE room_id = $1 AND created_at > $2 AND status <> 'dismissed' AND reporter_id <> $3`,
      [roomId, since, room.host_user_id]
    )).rows.map(r => r.reporter_id);

    if (reporters.length < ROOM_BAN_UNIQUE_REPORTERS) return { reported: true, ban: null };
    // Already banned right now → keep the report as evidence, no second ban
    const active = await client.query(
      `SELECT 1 FROM moderation_bans
       WHERE target_type = 'room' AND target_id = $1 AND lifted_at IS NULL AND expires_at > NOW() LIMIT 1`,
      [roomId]
    );
    if (active.rows.length) return { reported: true, ban: null };

    const expires = (await client.query(`SELECT NOW() + make_interval(hours => $1) AS at`, [BAN_HOURS])).rows[0].at;
    const roomBan = await client.query(
      `INSERT INTO moderation_bans (target_type, target_id, reason, source_room_id, reporter_ids, expires_at)
       VALUES ('room', $1, 'room_reports', $1, $2, $3) RETURNING id`,
      [roomId, reporters, expires]
    );
    const userBan = await client.query(
      `INSERT INTO moderation_bans (target_type, target_id, reason, source_room_id, reporter_ids, expires_at)
       VALUES ('user', $1, 'room_reports', $2, $3, $4) RETURNING id`,
      [room.host_user_id, roomId, reporters, expires]
    );
    await log(client, 'ban', 'room', roomId, null, { ban_id: roomBan.rows[0].id, reporter_ids: reporters, expires_at: expires });
    await log(client, 'ban', 'user', room.host_user_id, null, { ban_id: userBan.rows[0].id, source_room_id: roomId, reporter_ids: reporters, expires_at: expires });
    return { reported: true, ban: { roomId, hostUserId: room.host_user_id, expiresAt: new Date(expires).toISOString() } };
  });
}

// ── User reports (profile + chat messages) → warning ──────────────────────────

/**
 * Report a user — from their profile card (kind 'profile') or one of their
 * chat messages (kind 'message'). Returns { duplicate } or { reported, warning }
 * where warning is { userId, message, createdAt } when the threshold was hit.
 */
async function reportUser({ reporterId, reportedUserId, roomId, reason, note, kind, messageId, messageText }) {
  if (reportedUserId && reportedUserId === reporterId) throw new ModerationError(400, "You can't report yourself.");

  // A message from an unknown author: keep the evidence, no threshold
  if (!reportedUserId) {
    await ensureTables();
    await db.query(
      `INSERT INTO comment_reports (room_id, message_id, reported_user_id, reporter_id, message_text, reason)
       VALUES ($1, $2, NULL, $3, $4, $5)`,
      [roomId, messageId || null, reporterId, messageText, reason || null]
    );
    return { reported: true, warning: null };
  }

  return withTargetLock(`mod:user:${reportedUserId}`, async client => {
    const lastWarning = (await client.query(
      `SELECT MAX(created_at) AS at FROM user_warnings WHERE user_id = $1`, [reportedUserId]
    )).rows[0].at;
    const since = lastWarning ?? new Date(0);

    const dup = kind === 'message'
      ? await client.query(
          `SELECT 1 FROM comment_reports
           WHERE reporter_id = $1 AND reported_user_id = $2 AND message_id IS NOT DISTINCT FROM $3 AND created_at > $4 LIMIT 1`,
          [reporterId, reportedUserId, messageId || null, since])
      : await client.query(
          `SELECT 1 FROM user_reports
           WHERE reporter_id = $1 AND reported_user_id = $2 AND created_at > $3 AND status <> 'dismissed' LIMIT 1`,
          [reporterId, reportedUserId, since]);
    if (dup.rows.length) return { duplicate: true };

    await assertNotSpamming(client, reporterId);
    if (kind === 'message') {
      await client.query(
        `INSERT INTO comment_reports (room_id, message_id, reported_user_id, reporter_id, message_text, reason)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [roomId, messageId || null, reportedUserId, reporterId, messageText, reason || null]
      );
    } else {
      await client.query(
        `INSERT INTO user_reports (reported_user_id, reporter_id, room_id, reason, note) VALUES ($1, $2, $3, $4, $5)`,
        [reportedUserId, reporterId, roomId || null, reason, note || null]
      );
    }
    await log(client, 'user_report', 'user', reportedUserId, reporterId, { kind, reason, room_id: roomId || null, message_id: messageId || null });

    // Distinct reporters across both report kinds since the last warning
    const reporters = (await client.query(
      `SELECT reporter_id FROM user_reports
         WHERE reported_user_id = $1 AND created_at > $2 AND status <> 'dismissed'
       UNION
       SELECT reporter_id FROM comment_reports
         WHERE reported_user_id = $1 AND created_at > $2 AND status <> 'dismissed'`,
      [reportedUserId, since]
    )).rows.map(r => r.reporter_id).filter(id => id !== reportedUserId);

    if (reporters.length < WARN_UNIQUE_REPORTERS) return { reported: true, warning: null };

    const w = await client.query(
      `INSERT INTO user_warnings (user_id, message, reporter_ids) VALUES ($1, $2, $3) RETURNING id, created_at`,
      [reportedUserId, WARNING_MESSAGE, reporters]
    );
    await client.query(
      `INSERT INTO notifications (user_id, type, title, body, data) VALUES ($1, 'moderation_warning', 'Warning', $2, $3)`,
      [reportedUserId, WARNING_MESSAGE, JSON.stringify({ warning_id: w.rows[0].id })]
    );
    await log(client, 'warning', 'user', reportedUserId, null, { warning_id: w.rows[0].id, reporter_ids: reporters });
    return {
      reported: true,
      warning: { id: w.rows[0].id, userId: reportedUserId, message: WARNING_MESSAGE, createdAt: new Date(w.rows[0].created_at).toISOString() },
    };
  });
}

// ── Enforcement ───────────────────────────────────────────────────────────────

/**
 * Active ban blocking this user from this room: the user's own ID ban first,
 * else the room's ban. { kind: 'user'|'room', message, expiresAt } or null.
 */
async function getEntryBan(userId, roomId) {
  await ensureTables();
  const r = await db.query(
    `SELECT target_type, expires_at FROM moderation_bans
     WHERE lifted_at IS NULL AND expires_at > NOW()
       AND ((target_type = 'user' AND target_id = $1) OR (target_type = 'room' AND target_id = $2))
     ORDER BY (target_type = 'user') DESC, expires_at DESC
     LIMIT 1`,
    [userId, roomId]
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    kind: row.target_type,
    message: row.target_type === 'user' ? USER_BANNED_MESSAGE : ROOM_BANNED_MESSAGE,
    expiresAt: new Date(row.expires_at).toISOString(),
  };
}

/** Warnings not yet shown to the user (they were offline) — marked delivered. */
async function takeUndeliveredWarnings(userId) {
  await ensureTables();
  const r = await db.query(
    `UPDATE user_warnings SET delivered_at = NOW()
     WHERE user_id = $1 AND delivered_at IS NULL
     RETURNING id, message, created_at`,
    [userId]
  );
  return r.rows;
}

async function markWarningDelivered(warningId) {
  await db.query(`UPDATE user_warnings SET delivered_at = NOW() WHERE id = $1 AND delivered_at IS NULL`, [warningId]);
}

// ── Admin review ──────────────────────────────────────────────────────────────

async function listRoomReports({ status = null } = {}) {
  await ensureTables();
  const params = [];
  const where = status ? (params.push(status), `WHERE r.status = $1`) : '';
  const r = await db.query(
    `SELECT r.id, r.reason, r.note, r.status, r.created_at, r.room_id, rm.room_name,
            rep.id AS reporter_id, rep.full_name AS reporter_name, rep.username AS reporter_username, rep.phone AS reporter_phone,
            h.id AS host_id, h.full_name AS host_name, h.username AS host_username, h.phone AS host_phone
     FROM room_reports r
     LEFT JOIN rooms rm  ON rm.id = r.room_id
     LEFT JOIN users rep ON rep.id = r.reporter_id
     LEFT JOIN users h   ON h.id = rm.host_user_id
     ${where}
     ORDER BY r.created_at DESC LIMIT 500`,
    params
  );
  return r.rows;
}

async function listBans({ activeOnly = false } = {}) {
  await ensureTables();
  const r = await db.query(
    `SELECT b.*, (b.lifted_at IS NULL AND b.expires_at > NOW()) AS active,
            u.full_name AS user_name, u.username AS user_username, u.phone AS user_phone,
            rm.room_name AS room_name, src.room_name AS source_room_name
     FROM moderation_bans b
     LEFT JOIN users u  ON b.target_type = 'user' AND u.id = b.target_id
     LEFT JOIN rooms rm ON b.target_type = 'room' AND rm.id = b.target_id
     LEFT JOIN rooms src ON src.id = b.source_room_id
     ${activeOnly ? 'WHERE b.lifted_at IS NULL AND b.expires_at > NOW()' : ''}
     ORDER BY b.created_at DESC LIMIT 500`
  );
  return r.rows;
}

async function listWarnings() {
  await ensureTables();
  const r = await db.query(
    `SELECT w.id, w.user_id, w.message, w.reporter_ids, w.delivered_at, w.created_at,
            u.full_name AS user_name, u.username AS user_username, u.phone AS user_phone
     FROM user_warnings w LEFT JOIN users u ON u.id = w.user_id
     ORDER BY w.created_at DESC LIMIT 500`
  );
  return r.rows;
}

async function listLogs({ targetId = null } = {}) {
  await ensureTables();
  const r = await db.query(
    `SELECT * FROM moderation_logs ${targetId ? 'WHERE target_id = $1' : ''} ORDER BY created_at DESC LIMIT 500`,
    targetId ? [targetId] : []
  );
  return r.rows;
}

/** Admin reverses a ban (e.g. false reports). Returns the lifted ban or null. */
async function liftBan({ banId, adminId, note }) {
  return withTargetLock(`mod:ban:${banId}`, async client => {
    const r = await client.query(
      `UPDATE moderation_bans SET lifted_at = NOW(), lifted_by = $2, lift_note = $3
       WHERE id = $1 AND lifted_at IS NULL RETURNING *`,
      [banId, adminId, note || null]
    );
    const ban = r.rows[0] ?? null;
    if (ban) await log(client, 'ban_lifted', ban.target_type, ban.target_id, adminId, { ban_id: banId, note: note || null });
    return ban;
  });
}

module.exports = {
  WARN_UNIQUE_REPORTERS, ROOM_BAN_UNIQUE_REPORTERS, BAN_HOURS,
  WARNING_MESSAGE, USER_BANNED_MESSAGE, ROOM_BANNED_MESSAGE,
  ModerationError, ensureTables,
  reportRoom, reportUser, getEntryBan, takeUndeliveredWarnings, markWarningDelivered,
  listRoomReports, listBans, listWarnings, listLogs, liftBan,
};
