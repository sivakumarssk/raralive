const walletModel = require('../models/wallet.model');
const packageModel = require('../models/coin-package.model');
const db = require('../config/db');

/** GET /api/wallet/me — current user's balance */
async function getMyWallet(req, res, next) {
  try {
    const wallet = await walletModel.getOrCreateWallet(req.user.id);
    return res.json({ success: true, data: { coins: wallet.coins } });
  } catch (err) { next(err); }
}

/** GET /api/wallet/me/transactions — current user's history */
async function getMyTransactions(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit ?? '20', 10), 100);
    const offset = parseInt(req.query.offset ?? '0', 10);
    const result = await walletModel.getTransactions(req.user.id, { limit, offset });
    return res.json({ success: true, data: result.rows, total: result.total });
  } catch (err) { next(err); }
}

/** POST /api/admin/wallet/recharge — admin credits coins to a user */
async function adminRecharge(req, res, next) {
  try {
    const { user_id, package_id, coins, description } = req.body;
    if (!user_id) {
      return res.status(400).json({ success: false, message: 'user_id is required.' });
    }

    let creditCoins = coins;
    let desc = description;

    // If package_id provided, use package data
    if (package_id) {
      const pkg = await packageModel.getPackageById(package_id);
      if (!pkg) return res.status(404).json({ success: false, message: 'Package not found.' });
      creditCoins = pkg.coins;
      desc = description || `Recharge: ${pkg.coins} coins package (₹${pkg.price})`;
    }

    if (!creditCoins || creditCoins <= 0) {
      return res.status(400).json({ success: false, message: 'coins must be a positive number.' });
    }
    if (!desc) desc = `Admin recharge: ${creditCoins} coins`;

    // Verify user exists
    const userCheck = await db.query('SELECT id, full_name, username FROM users WHERE id = $1', [user_id]);
    if (!userCheck.rows.length) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const balanceAfter = await walletModel.creditCoins(
      user_id,
      creditCoins,
      desc,
      req.admin.id,
      package_id || null
    );

    return res.json({
      success: true,
      data: {
        user_id,
        coins_added: creditCoins,
        balance_after: balanceAfter,
        description: desc,
      },
    });
  } catch (err) { next(err); }
}

/** GET /api/admin/wallet/user/:userId — admin views a user's wallet + recent tx */
async function adminGetUserWallet(req, res, next) {
  try {
    const { userId } = req.params;
    const userResult = await db.query(
      `SELECT id, full_name, username, phone, avatar_url FROM users WHERE id = $1`,
      [userId]
    );
    if (!userResult.rows.length) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    const wallet = await walletModel.getOrCreateWallet(userId);
    const { rows: transactions } = await walletModel.getTransactions(userId, { limit: 10 });
    return res.json({
      success: true,
      data: {
        user: userResult.rows[0],
        coins: wallet.coins,
        recent_transactions: transactions,
      },
    });
  } catch (err) { next(err); }
}

/** GET /api/admin/wallet/user/:userId/transactions — all transactions with optional date & type filter */
async function adminGetUserTransactions(req, res, next) {
  try {
    const { userId } = req.params;
    const { type, from, to, limit = '200', offset = '0' } = req.query;

    const userResult = await db.query(
      `SELECT id, full_name, username, phone FROM users WHERE id = $1`,
      [userId]
    );
    if (!userResult.rows.length) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const conds = ['user_id = $1'];
    const vals = [userId];
    let i = 2;
    if (type === 'credit' || type === 'debit') { conds.push(`type = $${i++}`); vals.push(type); }
    if (from) { conds.push(`created_at >= $${i++}`); vals.push(from); }
    if (to)   { conds.push(`created_at <= $${i++}`); vals.push(to + 'T23:59:59Z'); }

    const limitNum = Math.min(parseInt(limit, 10) || 200, 1000);
    const offsetNum = parseInt(offset, 10) || 0;

    const result = await db.query(
      `SELECT id, type, coins, balance_after, description, created_at
       FROM wallet_transactions
       WHERE ${conds.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${i++} OFFSET $${i++}`,
      [...vals, limitNum, offsetNum]
    );
    const count = await db.query(
      `SELECT COUNT(*), COALESCE(SUM(coins), 0) AS total_coins
       FROM wallet_transactions
       WHERE ${conds.join(' AND ')}`,
      vals
    );

    return res.json({
      success: true,
      data: {
        user: userResult.rows[0],
        transactions: result.rows,
        total: parseInt(count.rows[0].count, 10),
        total_coins: parseInt(count.rows[0].total_coins, 10),
      },
    });
  } catch (err) { next(err); }
}

module.exports = { getMyWallet, getMyTransactions, adminRecharge, adminGetUserWallet, adminGetUserTransactions };
