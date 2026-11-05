const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const ExcelJS = require('exceljs');
const db = require('../config/db');
const portal = require('../models/agency-portal.model');
const walletModel = require('../models/agency-wallet.model');
const { pushAgencyBalance } = require('./agency-wallet.controller');
const { getAllOnlineCounts, isRoomHostOnline } = require('../socket');

const UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads');
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const fail = (res, status, message) => res.status(status).json({ success: false, message });
const toInt = value => { const n = Number(value); return Number.isInteger(n) ? n : NaN; };

function log(req, action, details) {
  return portal.audit({
    agencyId: req.portal?.agency.id, actorType: req.portal?.actorType, actorId: req.portal?.actorId,
    action, details, ip: req.ip,
  });
}

/** IST date range from the query; defaults to the current month so far. */
function dateRange(query) {
  const today = portal.istDay(new Date());
  const from = DATE_RE.test(query.from ?? '') ? query.from : `${today.slice(0, 7)}-01`;
  const to = DATE_RE.test(query.to ?? '') ? query.to : today;
  return from <= to ? { from, to } : { from: to, to: from };
}

// ── POC login ─────────────────────────────────────────────────────────────────

/** POST /api/agency-portal/poc/login */
async function pocLogin(req, res, next) {
  try {
    await portal.ensureTables();
    const { email, password } = req.body;
    if (!email || !password) return fail(res, 400, 'Email and password are required.');
    const r = await db.query(
      `SELECT id, full_name, password_hash, is_active FROM agency_pocs WHERE LOWER(email) = LOWER($1)`,
      [String(email).trim()]
    );
    const poc = r.rows[0];
    if (!poc || !(await bcrypt.compare(String(password), poc.password_hash))) return fail(res, 401, 'Invalid credentials.');
    if (!poc.is_active) return fail(res, 403, 'This POC account is inactive. Contact admin.');
    const token = jwt.sign({ sub: poc.id, type: 'poc' }, process.env.JWT_SECRET, { expiresIn: '12h' });
    await portal.audit({ actorType: 'poc', actorId: poc.id, action: 'login', ip: req.ip });
    return res.json({ success: true, data: { token, poc: { id: poc.id, name: poc.full_name } } });
  } catch (err) { next(err); }
}

/** GET /api/agency-portal/poc/agencies */
async function pocAgencies(req, res, next) {
  try {
    if (!req.poc) return fail(res, 403, 'POC access required.');
    const r = await db.query(
      `SELECT a.id, a.agency_name, a.agent_code, a.status
       FROM agency_poc_assignments x JOIN agencies a ON a.id = x.agency_id
       WHERE x.poc_id = $1 ORDER BY a.agency_name`,
      [req.poc.id]
    );
    return res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

// ── Sections ──────────────────────────────────────────────────────────────────

/** GET /api/agency-portal/dashboard — wallet figures are the agency's alone */
async function dashboard(req, res, next) {
  try {
    const data = await portal.getDashboard(req.portal.agency.id);
    if (req.portal.role !== 'AGENCY') {
      delete data.balance; delete data.low_balance; delete data.low_balance_threshold;
      data.notifications = data.notifications.filter(n => n.kind !== 'credit' && !n.text.startsWith('Low balance') && !n.text.startsWith('Coin request'));
      data.stats = { rooms: data.stats.rooms, profiles: data.stats.profiles, open_tickets: data.stats.open_tickets };
    }
    return res.json({ success: true, data: { ...data, role: req.portal.role } });
  } catch (err) { next(err); }
}

/** GET /api/agency-portal/onboarding */
async function onboarding(req, res, next) {
  try {
    return res.json({ success: true, data: await portal.getOnboarding(req.portal.agency.id) });
  } catch (err) { next(err); }
}

/** GET /api/agency-portal/documents/:id/file — own documents only */
async function documentFile(req, res, next) {
  try {
    const doc = await portal.getDocumentFile(req.portal.agency.id, req.params.id);
    if (!doc) return fail(res, 404, 'Document not found.');
    const file = path.resolve(UPLOADS_DIR, '..', doc.file_url);
    if (!file.startsWith(UPLOADS_DIR + path.sep) || !fs.existsSync(file)) return fail(res, 404, 'Document file not found.');
    await log(req, 'document_viewed', { document: req.params.id, type: doc.doc_type });
    return res.sendFile(file);
  } catch (err) { next(err); }
}

/** GET /api/agency-portal/services/:service */
async function serviceActivity(req, res, next) {
  try {
    const { service } = req.params;
    if (!portal.SERVICES.includes(service)) return fail(res, 404, 'Unknown section.');
    const data = await portal.getServiceActivity(req.portal.agency.id, service, getAllOnlineCounts(), isRoomHostOnline);
    return res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** GET /api/agency-portal/services/:service/gifting?from=&to=&group=day|month */
async function serviceGifting(req, res, next) {
  try {
    const { service } = req.params;
    if (!portal.SERVICES.includes(service)) return fail(res, 404, 'Unknown section.');
    const data = await portal.getGifting(req.portal.agency.id, service, {
      ...dateRange(req.query), group: req.query.group === 'month' ? 'month' : 'day',
    });
    return res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ── Wallet (agency only — enforced in the routes) ─────────────────────────────

/** GET /api/agency-portal/wallet */
async function wallet(req, res, next) {
  try {
    const id = req.portal.agency.id;
    const [balance, stats, ledger, { requests }] = await Promise.all([
      walletModel.getBalance(id), walletModel.getStats(id), portal.listLedger(id),
      walletModel.listRequests({ agencyId: id, limit: 50 }),
    ]);
    return res.json({
      success: true,
      data: {
        balance, stats, ledger,
        low_balance: balance < walletModel.LOW_BALANCE_THRESHOLD,
        low_balance_threshold: walletModel.LOW_BALANCE_THRESHOLD,
        recharge_slabs: walletModel.RECHARGE_SLABS,
        request_slabs: walletModel.REQUEST_SLABS,
        requests: requests.map(r => ({
          request_code: r.request_code, coins: r.coins, extra_coins: r.extra_coins, status: r.status,
          admin_note: r.admin_note, created_at: r.created_at, processed_at: r.processed_at,
        })),
      },
    });
  } catch (err) { next(err); }
}

/** GET /api/agency-portal/wallet/lookup?q= — the minimum needed to verify a recipient */
async function lookupUser(req, res, next) {
  try {
    const user = await walletModel.findUserForRecharge(req.query.q);
    if (!user) return fail(res, 404, 'No user found for this profile link, UID or handle.');
    await log(req, 'user_lookup', { uid: user.id });
    return res.json({
      success: true,
      data: { uid: user.id, handle: user.username ? `@${user.username}` : null, name: user.full_name, avatar_url: user.avatar_url },
    });
  } catch (err) { next(err); }
}

/** POST /api/agency-portal/wallet/recharge { uid, slabCoins, extraCoins, idempotencyKey } */
async function recharge(req, res, next) {
  try {
    const { uid, idempotencyKey } = req.body;
    const slabCoins = toInt(req.body.slabCoins);
    const extraCoins = toInt(req.body.extraCoins ?? 0);
    if (!uid) return fail(res, 400, 'Verify the user first.');
    if (!walletModel.RECHARGE_SLABS.includes(slabCoins)) return fail(res, 400, 'Choose a valid coin slab.');
    if (!Number.isInteger(extraCoins) || extraCoins < 0) return fail(res, 400, 'Extra coins must be 0 or more.');
    // Must be supplied by the portal: it's what stops a double charge
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 8) return fail(res, 400, 'Missing transaction key.');

    const user = await walletModel.findUserForRecharge(uid);
    if (!user) return fail(res, 404, 'User not found.');

    const { agency } = req.portal;
    const result = await walletModel.rechargeUser({
      agency: { id: agency.id, agency_name: agency.agency_name },
      user, slabCoins, extraCoins, idempotencyKey: idempotencyKey.slice(0, 80),
    });
    if (result.insufficient) return fail(res, 400, 'Insufficient Agency Wallet balance. Please request more coins.');

    const balance = await walletModel.getBalance(agency.id);
    if (!result.duplicate) {
      pushAgencyBalance(agency.id);
      await log(req, 'user_recharge', { transaction_id: result.transaction.txn_code, uid: user.id, coins: slabCoins + extraCoins });
    }
    return res.status(result.duplicate ? 200 : 201).json({
      success: true,
      data: {
        transaction_id: result.transaction.txn_code,
        coins: result.transaction.coins,
        created_at: result.transaction.created_at,
        balance,
        low_balance: balance < walletModel.LOW_BALANCE_THRESHOLD,
        duplicate: !!result.duplicate,
      },
    });
  } catch (err) { next(err); }
}

/** GET /api/agency-portal/wallet/recharges?from=&to= */
async function rechargeHistory(req, res, next) {
  try {
    return res.json({ success: true, data: await portal.listRecharges(req.portal.agency.id, dateRange(req.query)) });
  } catch (err) { next(err); }
}

/** POST /api/agency-portal/wallet/requests { coins } — asks the Official; adds nothing itself */
async function requestCoins(req, res, next) {
  try {
    const coins = toInt(req.body.coins);
    if (!walletModel.REQUEST_SLABS.includes(coins)) return fail(res, 400, 'Choose a valid coin slab.');
    const r = await walletModel.createRequest({ agencyId: req.portal.agency.id, userId: null, coins });
    await log(req, 'coin_request', { request_code: r.request_code, coins });
    return res.status(201).json({ success: true, data: { request_code: r.request_code, coins: r.coins, status: r.status, created_at: r.created_at } });
  } catch (err) { next(err); }
}

// ── Reports ───────────────────────────────────────────────────────────────────

const MONEY = '₹#,##0.00';
const COUNT = '#,##0';

const GIFT_COLUMNS = [
  { key: 'coins', header: 'Coins', format: COUNT },
  { key: 'gems', header: 'Gems', format: COUNT },
  { key: 'amount', header: 'Amount (₹)', format: MONEY },
];
const RECHARGE_COLUMNS = [
  { key: 'transaction_id', header: 'Transaction ID' }, { key: 'user_name', header: 'User Name' },
  { key: 'handle', header: 'Handle' }, { key: 'uid', header: 'UID' }, { key: 'profile_link', header: 'Profile Link' },
  { key: 'coins', header: 'Coins', format: COUNT }, { key: 'date', header: 'Date' }, { key: 'time', header: 'Time' },
  { key: 'status', header: 'Status' },
];

const istStamp = iso => {
  const [date, time] = new Date(new Date(iso).getTime() + 5.5 * 3600 * 1000).toISOString().split('T');
  return { date, time: time.slice(0, 8) };
};

async function buildReport(agencyId, type, { from, to, group }) {
  if (type === 'recharge') {
    const rows = (await portal.listRecharges(agencyId, { from, to })).map(r => ({ ...r, ...istStamp(r.created_at) }));
    return {
      title: 'Coin Recharge Report', from, to,
      totals: { transactions: rows.length, coins: rows.reduce((sum, r) => sum + r.coins, 0) },
      sheets: [{ name: 'Recharges', columns: RECHARGE_COLUMNS, rows }],
    };
  }
  const g = await portal.getGifting(agencyId, type, { from, to, group });
  return {
    title: `${portal.SERVICE_LABEL[type]} Report`, from, to, totals: g.totals,
    sheets: [
      { name: group === 'month' ? 'Month-wise' : 'Date-wise', columns: [{ key: 'period', header: group === 'month' ? 'Month' : 'Date' }, ...GIFT_COLUMNS], rows: g.rows },
      {
        name: 'By profile',
        columns: [{ key: 'name', header: 'Profile' }, { key: 'handle', header: 'Handle' }, { key: 'id', header: 'UID' }, { key: 'link', header: 'Profile Link' }, ...GIFT_COLUMNS],
        rows: g.by_profile,
      },
    ],
  };
}

const REPORT_TYPES = [...portal.SERVICES, 'recharge'];
/** Recharge data is financial, so it's agency-only — same rule as the wallet. */
function reportAllowed(req, res) {
  if (!REPORT_TYPES.includes(req.params.type)) { fail(res, 404, 'Unknown report.'); return false; }
  if (req.params.type === 'recharge' && req.portal.role !== 'AGENCY') { fail(res, 403, 'Only the agency can access this.'); return false; }
  return true;
}
const reportOptions = query => ({ ...dateRange(query), group: query.group === 'month' ? 'month' : 'day' });

/** GET /api/agency-portal/reports/:type?from=&to=&group= */
async function report(req, res, next) {
  try {
    if (!reportAllowed(req, res)) return;
    return res.json({ success: true, data: await buildReport(req.portal.agency.id, req.params.type, reportOptions(req.query)) });
  } catch (err) { next(err); }
}

/** GET /api/agency-portal/reports/:type/export?from=&to=&group= — .xlsx */
async function reportExport(req, res, next) {
  try {
    if (!reportAllowed(req, res)) return;
    const { agency } = req.portal;
    const data = await buildReport(agency.id, req.params.type, reportOptions(req.query));

    const book = new ExcelJS.Workbook();
    book.creator = 'RaRa Live Agency Portal';
    for (const sheet of data.sheets) {
      const ws = book.addWorksheet(sheet.name);
      ws.columns = sheet.columns.map(c => ({
        header: c.header, key: c.key, width: Math.max(14, c.header.length + 4),
        style: c.format ? { numFmt: c.format } : {},
      }));
      ws.getRow(1).font = { bold: true };
      ws.addRows(sheet.rows);
      ws.views = [{ state: 'frozen', ySplit: 1 }];
    }
    const meta = book.addWorksheet('About');
    meta.addRows([
      ['Report', data.title], ['Agency', `${agency.agency_name} (${agency.agent_code})`],
      ['From', data.from], ['To', data.to], ['Generated (UTC)', new Date().toISOString()],
    ]);
    meta.getColumn(1).width = 18; meta.getColumn(2).width = 40;

    await log(req, 'report_exported', { type: req.params.type, from: data.from, to: data.to });
    const filename = `${agency.agent_code}-${req.params.type}-${data.from}-to-${data.to}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await book.xlsx.write(res);
    return res.end();
  } catch (err) { next(err); }
}

// ── Support ───────────────────────────────────────────────────────────────────

/** GET /api/agency-portal/support */
async function listSupport(req, res, next) {
  try {
    return res.json({ success: true, data: await portal.listTickets(req.portal.agency.id) });
  } catch (err) { next(err); }
}

/** POST /api/agency-portal/support { subject, message } */
async function createSupport(req, res, next) {
  try {
    const subject = String(req.body.subject ?? '').trim().slice(0, 160);
    const message = String(req.body.message ?? '').trim();
    if (!subject || !message) return fail(res, 400, 'Subject and message are required.');
    const ticket = await portal.createTicket(req.portal.agency.id, subject, message.slice(0, 2000));
    await log(req, 'support_ticket', { ticket: ticket.id });
    return res.status(201).json({ success: true, data: ticket });
  } catch (err) { next(err); }
}

// ── Admin / Official ──────────────────────────────────────────────────────────

const adminLog = (req, agencyId, action, details) => portal.audit({ agencyId, actorType: 'admin', actorId: req.admin.id, action, details, ip: req.ip });

/** GET /api/agency-portal/admin/pocs */
async function adminListPocs(req, res, next) {
  try {
    await portal.ensureTables();
    const r = await db.query(
      `SELECT p.id, p.full_name, p.email, p.is_active, p.created_at,
              COALESCE(json_agg(json_build_object('id', a.id, 'agency_name', a.agency_name, 'agent_code', a.agent_code)
                       ORDER BY a.agency_name) FILTER (WHERE a.id IS NOT NULL), '[]') AS agencies
       FROM agency_pocs p
       LEFT JOIN agency_poc_assignments x ON x.poc_id = p.id
       LEFT JOIN agencies a ON a.id = x.agency_id
       GROUP BY p.id ORDER BY p.created_at DESC`
    );
    return res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

/** POST /api/agency-portal/admin/pocs { fullName, email, password } */
async function adminCreatePoc(req, res, next) {
  try {
    await portal.ensureTables();
    const fullName = String(req.body.fullName ?? '').trim();
    const email = String(req.body.email ?? '').trim().toLowerCase();
    const password = String(req.body.password ?? '');
    if (!fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(res, 400, 'Enter a name and a valid email.');
    if (password.length < 8) return fail(res, 400, 'Password must be at least 8 characters.');
    const dup = await db.query(`SELECT 1 FROM agency_pocs WHERE LOWER(email) = $1`, [email]);
    if (dup.rowCount) return fail(res, 409, 'A POC with this email already exists.');
    const hash = await bcrypt.hash(password, 12);
    const r = await db.query(
      `INSERT INTO agency_pocs (full_name, email, password_hash) VALUES ($1, $2, $3)
       RETURNING id, full_name, email, is_active, created_at`,
      [fullName, email, hash]
    );
    await adminLog(req, null, 'poc_created', { poc: r.rows[0].id });
    return res.status(201).json({ success: true, data: { ...r.rows[0], agencies: [] } });
  } catch (err) { next(err); }
}

/** PATCH /api/agency-portal/admin/pocs/:id { isActive?, agencyIds? } */
async function adminUpdatePoc(req, res, next) {
  const client = await db.pool.connect();
  try {
    await portal.ensureTables();
    const { id } = req.params;
    const { isActive, agencyIds } = req.body;
    await client.query('BEGIN');
    if (typeof isActive === 'boolean') {
      await client.query(`UPDATE agency_pocs SET is_active = $2 WHERE id = $1`, [id, isActive]);
    }
    if (Array.isArray(agencyIds)) {
      await client.query(`DELETE FROM agency_poc_assignments WHERE poc_id = $1 AND NOT (agency_id = ANY($2::uuid[]))`, [id, agencyIds]);
      await client.query(
        `INSERT INTO agency_poc_assignments (poc_id, agency_id)
         SELECT $1, unnest($2::uuid[]) ON CONFLICT DO NOTHING`,
        [id, agencyIds]
      );
    }
    await client.query('COMMIT');
    await adminLog(req, null, 'poc_updated', { poc: id, isActive, agencyIds });
    return res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

/** GET /api/agency-portal/admin/agencies/:id/documents */
async function adminListDocuments(req, res, next) {
  try {
    await portal.ensureTables();
    await portal.syncDocuments(req.params.id);
    const r = await db.query(
      `SELECT id, doc_type, file_url, status, note, created_at, reviewed_at FROM agency_documents
       WHERE agency_id = $1 ORDER BY created_at DESC`,
      [req.params.id]
    );
    return res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

/** PATCH /api/agency-portal/admin/documents/:id { status, note? } */
async function adminReviewDocument(req, res, next) {
  try {
    const { status, note } = req.body;
    if (!['verified', 'rejected'].includes(status)) return fail(res, 400, 'status must be verified or rejected.');
    const r = await db.query(
      `UPDATE agency_documents SET status = $2, note = $3, reviewed_at = NOW() WHERE id = $1 RETURNING id, agency_id, doc_type`,
      [req.params.id, status, note?.trim() || null]
    );
    if (!r.rowCount) return fail(res, 404, 'Document not found.');
    await adminLog(req, r.rows[0].agency_id, 'document_reviewed', { document: r.rows[0].id, status });
    return res.json({ success: true });
  } catch (err) { next(err); }
}

/** GET /api/agency-portal/admin/tickets */
async function adminListTickets(req, res, next) {
  try {
    await portal.ensureTables();
    const r = await db.query(
      `SELECT t.id, t.subject, t.message, t.status, t.admin_reply, t.created_at, t.resolved_at, a.agency_name, a.agent_code
       FROM agency_support_tickets t JOIN agencies a ON a.id = t.agency_id
       ORDER BY (t.status = 'open') DESC, t.created_at DESC LIMIT 200`
    );
    return res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

/** PATCH /api/agency-portal/admin/tickets/:id { reply } */
async function adminResolveTicket(req, res, next) {
  try {
    const reply = String(req.body.reply ?? '').trim();
    if (!reply) return fail(res, 400, 'Reply is required.');
    const r = await db.query(
      `UPDATE agency_support_tickets SET status = 'resolved', admin_reply = $2, resolved_at = NOW()
       WHERE id = $1 RETURNING agency_id`,
      [req.params.id, reply]
    );
    if (!r.rowCount) return fail(res, 404, 'Ticket not found.');
    await adminLog(req, r.rows[0].agency_id, 'ticket_resolved', { ticket: req.params.id });
    return res.json({ success: true });
  } catch (err) { next(err); }
}

/** GET /api/agency-portal/admin/audit?agencyId= */
async function adminAuditLog(req, res, next) {
  try {
    await portal.ensureTables();
    const { agencyId } = req.query;
    const r = await db.query(
      `SELECT l.id, l.actor_type, l.action, l.details, l.ip, l.created_at, a.agency_name, a.agent_code,
              COALESCE(p.full_name, ad.full_name) AS actor_name
       FROM agency_audit_log l
       LEFT JOIN agencies a ON a.id = l.agency_id
       LEFT JOIN agency_pocs p ON l.actor_type = 'poc' AND p.id = l.actor_id
       LEFT JOIN admins ad ON l.actor_type = 'admin' AND ad.id = l.actor_id
       WHERE ($1::uuid IS NULL OR l.agency_id = $1)
       ORDER BY l.created_at DESC LIMIT 300`,
      [agencyId || null]
    );
    return res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

module.exports = {
  pocLogin, pocAgencies, dashboard, onboarding, documentFile, serviceActivity, serviceGifting,
  wallet, lookupUser, recharge, rechargeHistory, requestCoins, report, reportExport, listSupport, createSupport,
  adminListPocs, adminCreatePoc, adminUpdatePoc, adminListDocuments, adminReviewDocument,
  adminListTickets, adminResolveTicket, adminAuditLog,
};
