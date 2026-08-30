const db = require('../config/db');

async function getOrCreateWallet(userId) {
  // Upsert wallet row
  const result = await db.query(
    `INSERT INTO wallets (user_id, coins)
     VALUES ($1, 0)
     ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
     RETURNING id, user_id, coins, updated_at`,
    [userId]
  );
  return result.rows[0];
}

async function getWallet(userId) {
  const result = await db.query(
    `SELECT id, user_id, coins, updated_at FROM wallets WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function creditCoins(userId, coins, description, adminId = null, refId = null) {
  // Run inside transaction
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Upsert wallet and add coins atomically
    const walletResult = await client.query(
      `INSERT INTO wallets (user_id, coins)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET coins = wallets.coins + $2, updated_at = NOW()
       RETURNING coins`,
      [userId, coins]
    );
    const balanceAfter = walletResult.rows[0].coins;

    // Record transaction
    await client.query(
      `INSERT INTO wallet_transactions (user_id, type, coins, balance_after, description, ref_id, created_by)
       VALUES ($1, 'credit', $2, $3, $4, $5, $6)`,
      [userId, coins, balanceAfter, description, refId || null, adminId || null]
    );

    await client.query('COMMIT');
    return balanceAfter;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Gems have no ledger table of their own — mirrors the existing room-gift
// crediting in socket/index.js processGift(), which also updates
// wallets.gems directly with no wallet_transactions row (that table's
// schema is coins-only: `coins INTEGER CHECK (coins > 0)`, so a 0/gems-only
// entry isn't representable there).
async function creditGems(userId, gems) {
  const result = await db.query(
    `INSERT INTO wallets (user_id, gems)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET gems = wallets.gems + $2, updated_at = NOW()
     RETURNING gems`,
    [userId, gems]
  );
  return result.rows[0].gems;
}

async function debitCoins(userId, coins, description, refId = null) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const walletResult = await client.query(
      `UPDATE wallets SET coins = coins - $1, updated_at = NOW()
       WHERE user_id = $2 AND coins >= $1
       RETURNING coins`,
      [coins, userId]
    );
    if (!walletResult.rows.length) {
      throw Object.assign(new Error('Insufficient coins'), { code: 'INSUFFICIENT_COINS' });
    }
    const balanceAfter = walletResult.rows[0].coins;

    await client.query(
      `INSERT INTO wallet_transactions (user_id, type, coins, balance_after, description, ref_id)
       VALUES ($1, 'debit', $2, $3, $4, $5)`,
      [userId, coins, balanceAfter, description, refId || null]
    );

    await client.query('COMMIT');
    return balanceAfter;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getTransactions(userId, { limit = 20, offset = 0 } = {}) {
  const result = await db.query(
    `SELECT id, type, coins, balance_after, description, created_at
     FROM wallet_transactions
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  const count = await db.query(
    `SELECT COUNT(*) FROM wallet_transactions WHERE user_id = $1`,
    [userId]
  );
  return { rows: result.rows, total: parseInt(count.rows[0].count, 10) };
}

module.exports = { getOrCreateWallet, getWallet, creditCoins, creditGems, debitCoins, getTransactions };
