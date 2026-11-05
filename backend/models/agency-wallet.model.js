const db = require('../config/db');

// Coin slabs shown in the app's Agency Wallet. Recharge slabs are what an
// agency can send a user (plus any extra coins); request slabs are what it can
// ask RaRa Live Official for. The server only accepts these values.
const RECHARGE_SLABS = [10000, 30000, 50000, 60000, 70000, 80000, 100000, 150000, 200000, 500000];
const REQUEST_SLABS = [10000, 30000, 50000, 60000, 70000, 80000, 100000, 200000, 500000, 1000000];
const LOW_BALANCE_THRESHOLD = 10000;

// Readable, sortable codes: RRL-<KIND>-<IST date>-<6-digit sequence>
const CODE_SQL = (kind) =>
  `'RRL-${kind}-' || to_char(NOW() AT TIME ZONE 'Asia/Kolkata', 'YYYYMMDD') || '-' || lpad(nextval('agency_wallet_code_seq')::text, 6, '0')`;

const TXN_SELECT = `
  SELECT t.id, t.txn_code, t.agency_id, t.type, t.coins, t.slab_coins, t.extra_coins, t.balance_after,
         t.user_id, t.user_handle, t.user_name, t.request_id, t.note, t.created_at,
         a.agency_name
  FROM agency_wallet_transactions t
  JOIN agencies a ON a.id = t.agency_id`;

const REQUEST_SELECT = `
  SELECT r.id, r.request_code, r.agency_id, r.coins, r.status, r.extra_coins, r.admin_note,
         r.processed_at, r.created_at,
         a.agency_name, a.agent_code, a.phone AS agency_phone,
         u.full_name AS requested_by_name, u.username AS requested_by_username
  FROM agency_coin_requests r
  JOIN agencies a ON a.id = r.agency_id
  LEFT JOIN users u ON u.id = r.requested_by`;

// pg returns BIGINT as strings — coin amounts here stay well inside JS's safe range
const NUMERIC_FIELDS = ['coins', 'slab_coins', 'extra_coins', 'balance_after'];
function normalize(row) {
  if (!row) return row;
  for (const f of NUMERIC_FIELDS) if (row[f] !== undefined && row[f] !== null) row[f] = Number(row[f]);
  return row;
}

/** The agency an app user acts for — only role 'agency' users linked to an agency. */
async function getAgencyForUser(userId) {
  const r = await db.query(
    `SELECT a.id, a.agency_name, a.agent_code, a.status
     FROM users u JOIN agencies a ON a.id = u.agency_id
     WHERE u.id = $1 AND u.role = 'agency'`,
    [userId]
  );
  return r.rows[0] || null;
}

async function getBalance(agencyId) {
  const r = await db.query(`SELECT coins FROM agency_wallets WHERE agency_id = $1`, [agencyId]);
  return Number(r.rows[0]?.coins ?? 0);
}

// Received = all official credits; Used Today / Transactions = user recharges
// (today is the IST calendar day).
async function getStats(agencyId) {
  const r = await db.query(
    `SELECT
       COALESCE(SUM(coins) FILTER (WHERE type = 'official_credit'), 0) AS received,
       COALESCE(SUM(coins) FILTER (
         WHERE type = 'user_recharge'
           AND (created_at AT TIME ZONE 'Asia/Kolkata')::date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
       ), 0) AS used_today,
       COUNT(*) FILTER (WHERE type = 'user_recharge') AS transactions
     FROM agency_wallet_transactions WHERE agency_id = $1`,
    [agencyId]
  );
  const row = r.rows[0];
  return { received: Number(row.received), used_today: Number(row.used_today), transactions: Number(row.transactions) };
}

async function listTransactions({ agencyId = null, type = null, limit = 100, offset = 0 } = {}) {
  const conds = []; const vals = [];
  if (agencyId) { vals.push(agencyId); conds.push(`t.agency_id = $${vals.length}`); }
  if (type) { vals.push(type); conds.push(`t.type = $${vals.length}`); }
  vals.push(limit, offset);
  const r = await db.query(
    `${TXN_SELECT}
     ${conds.length ? `WHERE ${conds.join(' AND ')}` : ''}
     ORDER BY t.created_at DESC
     LIMIT $${vals.length - 1} OFFSET $${vals.length}`,
    vals
  );
  return r.rows.map(normalize);
}

/** Find a user by @username, user id, or a profile link containing either. */
async function findUserForRecharge(query) {
  const q = String(query || '').trim();
  if (!q) return null;
  const uuid = q.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
  if (uuid) {
    const r = await db.query(`SELECT id, username, full_name, avatar_url FROM users WHERE id = $1`, [uuid]);
    return r.rows[0] || null;
  }
  // Last path segment of a link, or the raw text, minus a leading '@'
  const handle = q.split(/[/?#]/).filter(Boolean).pop()?.replace(/^@/, '') ?? '';
  if (!handle) return null;
  const r = await db.query(
    `SELECT id, username, full_name, avatar_url FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
    [handle]
  );
  return r.rows[0] || null;
}

/**
 * Agency → user recharge, all-or-nothing: deducts the agency wallet, credits
 * the user's wallet, and writes both ledgers. A repeated idempotencyKey
 * returns the original transaction instead of charging twice.
 */
async function rechargeUser({ agency, user, slabCoins, extraCoins, idempotencyKey }) {
  const total = slabCoins + extraCoins;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    if (idempotencyKey) {
      const dup = await client.query(
        `SELECT id FROM agency_wallet_transactions WHERE agency_id = $1 AND idempotency_key = $2`,
        [agency.id, idempotencyKey]
      );
      if (dup.rows.length) {
        await client.query('ROLLBACK');
        return { duplicate: true, transaction: await getTransaction(dup.rows[0].id) };
      }
    }

    const debit = await client.query(
      `UPDATE agency_wallets SET coins = coins - $2, updated_at = NOW()
       WHERE agency_id = $1 AND coins >= $2
       RETURNING coins`,
      [agency.id, total]
    );
    if (!debit.rows.length) {
      await client.query('ROLLBACK');
      return { insufficient: true };
    }
    const agencyBalanceAfter = Number(debit.rows[0].coins);

    const txn = await client.query(
      `INSERT INTO agency_wallet_transactions
         (txn_code, agency_id, type, coins, slab_coins, extra_coins, balance_after, user_id, user_handle, user_name, idempotency_key)
       VALUES (${CODE_SQL('USR')}, $1, 'user_recharge', $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, txn_code`,
      [agency.id, total, slabCoins, extraCoins, agencyBalanceAfter, user.id,
        user.username ? `@${user.username}` : null, user.full_name || null, idempotencyKey || null]
    );
    const { id: txnId, txn_code: txnCode } = txn.rows[0];

    const wallet = await client.query(
      `INSERT INTO wallets (user_id, coins) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET coins = wallets.coins + $2, updated_at = NOW()
       RETURNING coins`,
      [user.id, total]
    );
    await client.query(
      `INSERT INTO wallet_transactions (user_id, type, coins, balance_after, description, ref_id)
       VALUES ($1, 'credit', $2, $3, $4, $5)`,
      [user.id, total, wallet.rows[0].coins, `Agency recharge — ${agency.agency_name} (${txnCode})`, txnId]
    );

    await client.query('COMMIT');
    return { transaction: await getTransaction(txnId) };
  } catch (err) {
    await client.query('ROLLBACK');
    // Two identical submits racing — the loser lands on the unique key
    if (err.code === '23505' && idempotencyKey) {
      const dup = await db.query(
        `SELECT id FROM agency_wallet_transactions WHERE agency_id = $1 AND idempotency_key = $2`,
        [agency.id, idempotencyKey]
      );
      if (dup.rows.length) return { duplicate: true, transaction: await getTransaction(dup.rows[0].id) };
    }
    throw err;
  } finally {
    client.release();
  }
}

/** Official → agency credit (admin). Runs inside the caller's client when given. */
async function creditAgency(client, { agencyId, coins, extraCoins = 0, requestId = null, adminId = null, note = null }) {
  const total = coins + extraCoins;
  const wallet = await client.query(
    `INSERT INTO agency_wallets (agency_id, coins) VALUES ($1, $2)
     ON CONFLICT (agency_id) DO UPDATE SET coins = agency_wallets.coins + $2, updated_at = NOW()
     RETURNING coins`,
    [agencyId, total]
  );
  const txn = await client.query(
    `INSERT INTO agency_wallet_transactions
       (txn_code, agency_id, type, coins, slab_coins, extra_coins, balance_after, request_id, admin_id, note)
     VALUES (${CODE_SQL('OFF')}, $1, 'official_credit', $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [agencyId, total, coins, extraCoins, Number(wallet.rows[0].coins), requestId, adminId, note]
  );
  return txn.rows[0].id;
}

async function adminCreditAgency({ agencyId, coins, extraCoins, adminId, note }) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const txnId = await creditAgency(client, { agencyId, coins, extraCoins, adminId, note });
    await client.query('COMMIT');
    return getTransaction(txnId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getTransaction(id) {
  const r = await db.query(`${TXN_SELECT} WHERE t.id = $1`, [id]);
  return normalize(r.rows[0]) || null;
}

async function createRequest({ agencyId, userId, coins }) {
  const r = await db.query(
    `INSERT INTO agency_coin_requests (request_code, agency_id, requested_by, coins)
     VALUES (${CODE_SQL('REQ')}, $1, $2, $3)
     RETURNING id`,
    [agencyId, userId, coins]
  );
  return getRequest(r.rows[0].id);
}

async function getRequest(id) {
  const r = await db.query(`${REQUEST_SELECT} WHERE r.id = $1`, [id]);
  return normalize(r.rows[0]) || null;
}

async function listRequests({ agencyId = null, status = null, limit = 100, offset = 0 } = {}) {
  const conds = []; const vals = [];
  if (agencyId) { vals.push(agencyId); conds.push(`r.agency_id = $${vals.length}`); }
  if (status) { vals.push(status); conds.push(`r.status = $${vals.length}`); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const countR = await db.query(`SELECT COUNT(*)::int AS total FROM agency_coin_requests r ${where}`, vals);
  vals.push(limit, offset);
  const r = await db.query(
    `${REQUEST_SELECT} ${where}
     ORDER BY (r.status = 'pending') DESC, r.created_at DESC
     LIMIT $${vals.length - 1} OFFSET $${vals.length}`,
    vals
  );
  return { requests: r.rows.map(normalize), total: countR.rows[0].total };
}

/**
 * Approve (credits coins + extra to the agency wallet) or reject a pending
 * request. Returns null if the request isn't pending anymore.
 */
async function processRequest({ requestId, status, extraCoins = 0, note = null, adminId }) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const upd = await client.query(
      `UPDATE agency_coin_requests
       SET status = $2, extra_coins = $3, admin_note = $4, processed_by = $5, processed_at = NOW()
       WHERE id = $1 AND status = 'pending'
       RETURNING id, agency_id, coins`,
      [requestId, status, status === 'approved' ? extraCoins : 0, note, adminId]
    );
    if (!upd.rows.length) {
      await client.query('ROLLBACK');
      return null;
    }
    const reqRow = upd.rows[0];
    if (status === 'approved') {
      await creditAgency(client, {
        agencyId: reqRow.agency_id, coins: Number(reqRow.coins), extraCoins,
        requestId, adminId, note,
      });
    }
    await client.query('COMMIT');
    return getRequest(requestId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** App accounts that act for an agency (role 'agency') — who sees its wallet. */
async function getAgencyUserIds(agencyId) {
  const r = await db.query(`SELECT id FROM users WHERE agency_id = $1 AND role = 'agency'`, [agencyId]);
  return r.rows.map(row => row.id);
}

async function getAgencyById(agencyId) {
  const r = await db.query(`SELECT id, agency_name, agent_code, phone, status FROM agencies WHERE id = $1`, [agencyId]);
  return r.rows[0] || null;
}

module.exports = {
  getAgencyUserIds,
  RECHARGE_SLABS, REQUEST_SLABS, LOW_BALANCE_THRESHOLD,
  getAgencyForUser, getAgencyById, getBalance, getStats, listTransactions, getTransaction,
  findUserForRecharge, rechargeUser, adminCreditAgency,
  createRequest, getRequest, listRequests, processRequest,
};
