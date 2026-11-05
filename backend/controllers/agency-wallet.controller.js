const model = require('../models/agency-wallet.model');
const ioInstance = require('../utils/io-instance');
const { emitToUser } = require('../socket');

/**
 * Push an agency's current coin balance to its app account(s) — the Agency
 * Wallet screen updates live when coins are credited or spent.
 */
async function pushAgencyBalance(agencyId) {
  try {
    const io = ioInstance.get();
    if (!io || !agencyId) return;
    const [balance, userIds] = await Promise.all([model.getBalance(agencyId), model.getAgencyUserIds(agencyId)]);
    userIds.forEach(userId => emitToUser(io, userId, 'agency_wallet_balance', { agencyId, balance }));
  } catch (e) { console.error('pushAgencyBalance error:', e.message); }
}

// ── App (agency user) ─────────────────────────────────────────────────────────

// Resolves the agency the logged-in app user acts for; 403 for normal users.
async function requireAgency(req, res) {
  const agency = await model.getAgencyForUser(req.user.id);
  if (!agency) {
    res.status(403).json({ success: false, message: 'Agency access required.' });
    return null;
  }
  if (agency.status === 'suspended') {
    res.status(403).json({ success: false, message: 'This agency account has been suspended. Contact admin.' });
    return null;
  }
  return agency;
}

function toInt(value) {
  const n = Number(value);
  return Number.isInteger(n) ? n : NaN;
}

/** GET /api/agency-wallet/me */
async function getMyWallet(req, res, next) {
  try {
    const agency = await requireAgency(req, res);
    if (!agency) return;
    const [balance, stats] = await Promise.all([model.getBalance(agency.id), model.getStats(agency.id)]);
    return res.json({
      success: true,
      data: {
        agency: { id: agency.id, agency_name: agency.agency_name, agent_code: agency.agent_code },
        balance,
        stats,
        recharge_slabs: model.RECHARGE_SLABS,
        request_slabs: model.REQUEST_SLABS,
        low_balance_threshold: model.LOW_BALANCE_THRESHOLD,
      },
    });
  } catch (error) { next(error); }
}

/** GET /api/agency-wallet/transactions */
async function getMyTransactions(req, res, next) {
  try {
    const agency = await requireAgency(req, res);
    if (!agency) return;
    const limit = Math.min(Number(req.query.limit) || 200, 500);
    const rows = await model.listTransactions({ agencyId: agency.id, limit });
    return res.json({ success: true, data: rows });
  } catch (error) { next(error); }
}

/** GET /api/agency-wallet/lookup?q=<@username | user id | profile link> */
async function lookupUser(req, res, next) {
  try {
    const agency = await requireAgency(req, res);
    if (!agency) return;
    const user = await model.findUserForRecharge(req.query.q);
    if (!user) return res.status(404).json({ success: false, message: 'No user found for this username / ID.' });
    return res.json({ success: true, data: user });
  } catch (error) { next(error); }
}

/** POST /api/agency-wallet/recharge  { userId, slabCoins, extraCoins, idempotencyKey } */
async function rechargeUser(req, res, next) {
  try {
    const agency = await requireAgency(req, res);
    if (!agency) return;
    const { userId, idempotencyKey } = req.body;
    const slabCoins = toInt(req.body.slabCoins);
    const extraCoins = toInt(req.body.extraCoins ?? 0);

    if (!userId) return res.status(400).json({ success: false, message: 'Select a verified user first.' });
    if (!model.RECHARGE_SLABS.includes(slabCoins)) {
      return res.status(400).json({ success: false, message: 'Choose a valid coin slab.' });
    }
    if (!Number.isInteger(extraCoins) || extraCoins < 0) {
      return res.status(400).json({ success: false, message: 'Extra coins must be 0 or more.' });
    }

    const user = await model.findUserForRecharge(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const result = await model.rechargeUser({
      agency, user, slabCoins, extraCoins,
      idempotencyKey: typeof idempotencyKey === 'string' ? idempotencyKey.slice(0, 80) : null,
    });
    if (result.insufficient) {
      return res.status(400).json({ success: false, message: 'Insufficient Agency Wallet balance. Please request more Coins.' });
    }
    const balance = await model.getBalance(agency.id);
    if (!result.duplicate) pushAgencyBalance(agency.id);
    return res.status(result.duplicate ? 200 : 201).json({
      success: true,
      data: { transaction: result.transaction, balance, duplicate: !!result.duplicate },
    });
  } catch (error) { next(error); }
}

/** GET /api/agency-wallet/requests */
async function getMyRequests(req, res, next) {
  try {
    const agency = await requireAgency(req, res);
    if (!agency) return;
    const { requests } = await model.listRequests({ agencyId: agency.id, limit: 100 });
    return res.json({ success: true, data: requests });
  } catch (error) { next(error); }
}

/** POST /api/agency-wallet/requests  { coins } */
async function createRequest(req, res, next) {
  try {
    const agency = await requireAgency(req, res);
    if (!agency) return;
    const coins = toInt(req.body.coins);
    if (!model.REQUEST_SLABS.includes(coins)) {
      return res.status(400).json({ success: false, message: 'Choose a valid coin slab.' });
    }
    const request = await model.createRequest({ agencyId: agency.id, userId: req.user.id, coins });
    return res.status(201).json({ success: true, data: request });
  } catch (error) { next(error); }
}

// ── Admin ─────────────────────────────────────────────────────────────────────

/** GET /api/agency-wallet/admin/requests?status=&agencyId= */
async function adminListRequests(req, res, next) {
  try {
    const { status, agencyId } = req.query;
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const result = await model.listRequests({ status: status || null, agencyId: agencyId || null, limit });
    return res.json({ success: true, data: result });
  } catch (error) { next(error); }
}

/** PATCH /api/agency-wallet/admin/requests/:id  { status, extraCoins?, note? } */
async function adminProcessRequest(req, res, next) {
  try {
    const { status, note } = req.body;
    const extraCoins = toInt(req.body.extraCoins ?? 0);
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'status must be approved or rejected.' });
    }
    if (!Number.isInteger(extraCoins) || extraCoins < 0) {
      return res.status(400).json({ success: false, message: 'Extra coins must be 0 or more.' });
    }
    const updated = await model.processRequest({
      requestId: req.params.id, status, extraCoins, note: note?.trim() || null, adminId: req.admin.id,
    });
    if (!updated) return res.status(409).json({ success: false, message: 'This request was already processed.' });
    if (status === 'approved') pushAgencyBalance(updated.agency_id);
    return res.json({ success: true, data: updated });
  } catch (error) { next(error); }
}

/** GET /api/agency-wallet/admin/transactions?type=&agencyId= */
async function adminListTransactions(req, res, next) {
  try {
    const { type, agencyId } = req.query;
    const limit = Math.min(Number(req.query.limit) || 200, 500);
    const rows = await model.listTransactions({ type: type || null, agencyId: agencyId || null, limit });
    return res.json({ success: true, data: rows });
  } catch (error) { next(error); }
}

/** GET /api/agency-wallet/admin/agencies/:id */
async function adminGetAgencyWallet(req, res, next) {
  try {
    const agency = await model.getAgencyById(req.params.id);
    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found.' });
    const [balance, stats] = await Promise.all([model.getBalance(agency.id), model.getStats(agency.id)]);
    return res.json({ success: true, data: { agency, balance, stats } });
  } catch (error) { next(error); }
}

/** POST /api/agency-wallet/admin/agencies/:id/credit  { coins, extraCoins?, note? } */
async function adminCreditAgency(req, res, next) {
  try {
    const agency = await model.getAgencyById(req.params.id);
    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found.' });
    const coins = toInt(req.body.coins);
    const extraCoins = toInt(req.body.extraCoins ?? 0);
    if (!Number.isInteger(coins) || coins <= 0) {
      return res.status(400).json({ success: false, message: 'Coins must be a positive number.' });
    }
    if (!Number.isInteger(extraCoins) || extraCoins < 0) {
      return res.status(400).json({ success: false, message: 'Extra coins must be 0 or more.' });
    }
    const transaction = await model.adminCreditAgency({
      agencyId: agency.id, coins, extraCoins, adminId: req.admin.id, note: req.body.note?.trim() || null,
    });
    pushAgencyBalance(agency.id);
    return res.status(201).json({ success: true, data: transaction });
  } catch (error) { next(error); }
}

module.exports = {
  pushAgencyBalance,
  getMyWallet, getMyTransactions, lookupUser, rechargeUser, getMyRequests, createRequest,
  adminListRequests, adminProcessRequest, adminListTransactions, adminGetAgencyWallet, adminCreditAgency,
};
