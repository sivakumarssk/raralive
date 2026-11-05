const db = require('../config/db');
const walletModel = require('./agency-wallet.model');
const { computeEarnings } = require('../controllers/earnings.controller');
const { monthKey } = require('../utils/earning-slabs');

// Data behind the Agency Portal. Every function takes the agency id from the
// verified session (never from the request), and returns only what an agency
// may see: no OTPs, passwords, phones or emails of users, no other agency's data.
//
// Only audio rooms are tied to an agency (agent code at creation), so an
// agency's profiles are the people hosting its rooms plus its own app account;
// their Video Live and Friend Zone activity counts under the same agency.

const SERVICES = ['chatroom', 'live', 'friendzone'];
const SERVICE_LABEL = { chatroom: 'Audio Chat Room', live: 'Video Live', friendzone: 'Friend Zone' };
const DOC_LABEL = { aadhar: 'Aadhaar', pan: 'PAN', bank: 'Bank proof' };

const IST_MS = 5.5 * 60 * 60 * 1000;
const istDay = date => new Date(new Date(date).getTime() + IST_MS).toISOString().slice(0, 10);
const r2 = n => Math.round(n * 100) / 100;

// Also created in database/migrate-all.js — kept here so the portal works on a
// server where the migration hasn't been re-run yet.
let tablesReady = null;
function ensureTables() {
  if (!tablesReady) {
    tablesReady = db.query(`
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
    `).catch(err => { tablesReady = null; throw err; });
  }
  return tablesReady;
}

// ── Audit ─────────────────────────────────────────────────────────────────────

/** Never lets a logging failure break the action being logged. */
async function audit({ agencyId, actorType, actorId, action, details, ip }) {
  try {
    await ensureTables();
    await db.query(
      `INSERT INTO agency_audit_log (agency_id, actor_type, actor_id, action, details, ip)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [agencyId ?? null, actorType, actorId ?? null, action, details ? JSON.stringify(details) : null, ip ?? null]
    );
  } catch (e) { console.error('agency audit error:', e.message); }
}

// ── Session lookups ───────────────────────────────────────────────────────────

async function getSessionAgency(agencyId) {
  await ensureTables();
  const r = await db.query(
    `SELECT id, agency_name, agent_code, status, is_default_password FROM agencies WHERE id = $1`,
    [agencyId]
  );
  return r.rows[0] || null;
}

async function getActivePoc(pocId) {
  await ensureTables();
  const r = await db.query(`SELECT id, full_name FROM agency_pocs WHERE id = $1 AND is_active = TRUE`, [pocId]);
  return r.rows[0] || null;
}

async function pocHasAgency(pocId, agencyId) {
  const r = await db.query(`SELECT 1 FROM agency_poc_assignments WHERE poc_id = $1 AND agency_id = $2`, [pocId, agencyId]);
  return r.rowCount > 0;
}

// ── Members ───────────────────────────────────────────────────────────────────

async function getMembers(agencyId) {
  const r = await db.query(
    `SELECT u.id, u.username, u.full_name, u.avatar_url, u.created_at
     FROM users u
     WHERE u.id IN (
       SELECT host_user_id FROM rooms WHERE agency_id = $1
       UNION SELECT id FROM users WHERE agency_id = $1 AND role = 'agency'
     )
     ORDER BY u.created_at`,
    [agencyId]
  );
  return r.rows;
}

const profileLink = id => `rara-live://user/${id}`;
const handleOf = u => (u.username ? `@${u.username}` : '—');
const nameOf = u => u.full_name || u.username || 'User';

// ── Dashboard ─────────────────────────────────────────────────────────────────

async function getDashboard(agencyId) {
  const [{ rows: [a] }, balance, stats, counts] = await Promise.all([
    db.query(`SELECT agency_name, agent_code, person_name, status, service_access, created_at FROM agencies WHERE id = $1`, [agencyId]),
    walletModel.getBalance(agencyId),
    walletModel.getStats(agencyId),
    db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM rooms r WHERE r.agency_id = $1 AND NOT EXISTS (SELECT 1 FROM live_broadcasts lb WHERE lb.room_id = r.id)) AS rooms,
         (SELECT COUNT(*)::int FROM agency_support_tickets t WHERE t.agency_id = $1 AND t.status = 'open') AS open_tickets`,
      [agencyId]
    ),
  ]);
  return {
    agency: { name: a.agency_name, code: a.agent_code, owner: a.person_name, status: a.status, services: a.service_access, onboarded_at: a.created_at },
    balance,
    low_balance: balance < walletModel.LOW_BALANCE_THRESHOLD,
    low_balance_threshold: walletModel.LOW_BALANCE_THRESHOLD,
    stats: { ...stats, rooms: counts.rows[0].rooms, open_tickets: counts.rows[0].open_tickets, profiles: (await getMembers(agencyId)).length },
    notifications: await getNotifications(agencyId, balance),
  };
}

/** Built from existing records, so it can't drift from what actually happened. */
async function getNotifications(agencyId, balance) {
  const [credits, requests, docs, tickets] = await Promise.all([
    db.query(
      `SELECT txn_code, coins, created_at FROM agency_wallet_transactions
       WHERE agency_id = $1 AND type = 'official_credit' ORDER BY created_at DESC LIMIT 10`, [agencyId]),
    db.query(
      `SELECT request_code, coins, status, processed_at FROM agency_coin_requests
       WHERE agency_id = $1 AND status <> 'pending' ORDER BY processed_at DESC LIMIT 10`, [agencyId]),
    db.query(
      `SELECT doc_type, status, note, reviewed_at FROM agency_documents
       WHERE agency_id = $1 AND reviewed_at IS NOT NULL ORDER BY reviewed_at DESC LIMIT 10`, [agencyId]),
    db.query(
      `SELECT subject, resolved_at FROM agency_support_tickets
       WHERE agency_id = $1 AND status = 'resolved' ORDER BY resolved_at DESC LIMIT 10`, [agencyId]),
  ]);
  const items = [
    ...credits.rows.map(c => ({ kind: 'credit', text: `${Number(c.coins).toLocaleString('en-IN')} coins credited by Official (${c.txn_code})`, at: c.created_at })),
    ...requests.rows.filter(r => r.status === 'rejected').map(r => ({ kind: 'warning', text: `Coin request ${r.request_code} was rejected`, at: r.processed_at })),
    ...docs.rows.map(d => ({ kind: d.status === 'rejected' ? 'warning' : 'info', text: `${DOC_LABEL[d.doc_type] ?? d.doc_type} document ${d.status}${d.note ? `: ${d.note}` : ''}`, at: d.reviewed_at })),
    ...tickets.rows.map(t => ({ kind: 'info', text: `Support replied: ${t.subject}`, at: t.resolved_at })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 12);
  if (balance < walletModel.LOW_BALANCE_THRESHOLD) {
    items.unshift({ kind: 'warning', text: `Low balance: ${balance.toLocaleString('en-IN')} coins left`, at: new Date().toISOString() });
  }
  return items;
}

// ── Onboarding & documents ────────────────────────────────────────────────────

const mask = (value, keep = 4) => {
  const v = String(value ?? '');
  return v.length > keep ? `${'•'.repeat(Math.min(8, v.length - keep))}${v.slice(-keep)}` : v;
};

/** Mirrors the documents uploaded at onboarding into the history table. */
async function syncDocuments(agencyId) {
  await db.query(
    `INSERT INTO agency_documents (agency_id, doc_type, file_url, created_at)
     SELECT a.id, d.doc_type, d.file_url, a.created_at
     FROM agencies a
     CROSS JOIN LATERAL (VALUES ('aadhar', a.doc_aadhar_url), ('pan', a.doc_pan_url), ('bank', a.doc_bank_url)) AS d(doc_type, file_url)
     WHERE a.id = $1 AND d.file_url IS NOT NULL
     ON CONFLICT (agency_id, file_url) DO NOTHING`,
    [agencyId]
  );
}

async function getOnboarding(agencyId) {
  await syncDocuments(agencyId);
  const [{ rows: [a] }, docs, pocs] = await Promise.all([
    db.query(
      `SELECT a.agency_name, a.agent_code, a.person_name, a.email, a.phone, a.address, a.status, a.service_access,
              a.aadhar_number, a.pan_number, a.bank_account, a.bank_ifsc, a.bank_holder_name, a.bank_name,
              a.created_at, ad.full_name AS onboarded_by
       FROM agencies a LEFT JOIN admins ad ON ad.id = a.created_by
       WHERE a.id = $1`,
      [agencyId]
    ),
    db.query(
      `SELECT id, doc_type, status, note, created_at, reviewed_at
       FROM agency_documents WHERE agency_id = $1 ORDER BY created_at DESC`,
      [agencyId]
    ),
    db.query(
      `SELECT p.full_name, x.assigned_at FROM agency_poc_assignments x
       JOIN agency_pocs p ON p.id = x.poc_id WHERE x.agency_id = $1 ORDER BY x.assigned_at`,
      [agencyId]
    ),
  ]);
  const history = [
    { label: 'Agency onboarded', detail: `by ${a.onboarded_by || 'RaRa Live Official'}`, at: a.created_at },
    ...pocs.rows.map(p => ({ label: 'POC assigned', detail: p.full_name, at: p.assigned_at })),
    ...docs.rows.map(d => ({ label: `${DOC_LABEL[d.doc_type] ?? d.doc_type} submitted`, detail: 'Document received', at: d.created_at })),
    ...docs.rows.filter(d => d.reviewed_at).map(d => ({ label: `${DOC_LABEL[d.doc_type] ?? d.doc_type} ${d.status}`, detail: d.note || '', at: d.reviewed_at })),
  ].sort((x, y) => new Date(y.at) - new Date(x.at));

  return {
    profile: {
      agency_name: a.agency_name, agent_code: a.agent_code, owner: a.person_name, email: a.email, phone: a.phone,
      address: a.address, status: a.status, services: a.service_access, onboarded_at: a.created_at,
      onboarded_by: a.onboarded_by || 'RaRa Live Official',
      // Full KYC numbers stay with the Official
      aadhar: mask(a.aadhar_number), pan: mask(a.pan_number), bank_account: mask(a.bank_account),
      bank_ifsc: a.bank_ifsc, bank_holder: a.bank_holder_name, bank_name: a.bank_name,
    },
    documents: docs.rows.map(d => ({ ...d, label: DOC_LABEL[d.doc_type] ?? d.doc_type })),
    pocs: pocs.rows,
    history,
  };
}

async function getDocumentFile(agencyId, documentId) {
  const r = await db.query(`SELECT doc_type, file_url FROM agency_documents WHERE id = $1 AND agency_id = $2`, [documentId, agencyId]);
  return r.rows[0] || null;
}

// ── Service sections ──────────────────────────────────────────────────────────

async function getServiceActivity(agencyId, service, onlineCounts, isHostOnline) {
  const members = await getMembers(agencyId);
  const ids = members.map(m => m.id);
  const profiles = members.map(m => ({ id: m.id, name: nameOf(m), handle: handleOf(m), avatar_url: m.avatar_url, link: profileLink(m.id) }));

  if (service === 'chatroom') {
    const r = await db.query(
      `SELECT r.id, r.room_code, r.room_name, r.room_image_url, r.visibility, r.status, r.current_level,
              r.total_coins_received, r.created_at, r.host_user_id, u.full_name, u.username
       FROM rooms r JOIN users u ON u.id = r.host_user_id
       WHERE r.agency_id = $1 AND NOT EXISTS (SELECT 1 FROM live_broadcasts lb WHERE lb.room_id = r.id)
       ORDER BY r.created_at DESC`,
      [agencyId]
    );
    return {
      profiles,
      items: r.rows.map(x => ({
        id: x.id, title: x.room_name, code: x.room_code, status: x.status, visibility: x.visibility,
        host: nameOf(x), level: x.current_level, coins: Number(x.total_coins_received),
        online: onlineCounts[x.id] ?? 0, host_online: isHostOnline(x.id),
        link: `rara-live://room/${x.id}`, created_at: x.created_at,
      })),
    };
  }

  if (service === 'live') {
    const r = await db.query(
      `SELECT lb.id, lb.status, lb.started_at, lb.ended_at, u.id AS user_id, u.full_name, u.username
       FROM live_broadcasts lb JOIN users u ON u.id = lb.host_user_id
       WHERE lb.host_user_id = ANY($1::uuid[])
       ORDER BY lb.started_at DESC LIMIT 200`,
      [ids]
    );
    return {
      profiles,
      items: r.rows.map(x => ({
        id: x.id, title: `${nameOf(x)} live`, status: x.status, host: nameOf(x), link: profileLink(x.user_id),
        created_at: x.started_at, ended_at: x.ended_at,
        duration_seconds: x.ended_at ? Math.round((new Date(x.ended_at) - new Date(x.started_at)) / 1000) : null,
      })),
    };
  }

  const r = await db.query(
    `SELECT DISTINCT ON (a.user_id) a.id, a.status, a.created_at, u.id AS user_id, u.full_name, u.username,
            (SELECT COUNT(*)::int FROM friend_zone_calls c WHERE c.callee_id = u.id AND c.status = 'ended') AS calls,
            (SELECT MAX(c.created_at) FROM friend_zone_calls c WHERE c.callee_id = u.id) AS last_call
     FROM friend_zone_applications a JOIN users u ON u.id = a.user_id
     WHERE a.user_id = ANY($1::uuid[])
     ORDER BY a.user_id, a.created_at DESC`, // latest application per person
    [ids]
  );
  return {
    profiles,
    items: r.rows.map(x => ({
      id: x.id, title: nameOf(x), status: x.status, host: handleOf(x), link: profileLink(x.user_id),
      calls: x.calls, last_call: x.last_call, created_at: x.created_at,
    })),
  };
}

/**
 * Coins, gems and money for one service in an IST date range, from the same
 * calculation as each host's wallet: a date's Amount is what slabs paid out
 * that day, so it sums to what the wallet actually credited.
 */
async function getGifting(agencyId, service, { from, to, group = 'day' }) {
  const members = await getMembers(agencyId);
  const periods = new Map();
  const byProfile = [];
  const keyOf = group === 'month' ? monthKey : istDay;
  const inRange = date => { const d = istDay(date); return d >= from && d <= to; };
  const bucket = key => {
    if (!periods.has(key)) periods.set(key, { period: key, coins: 0, gems: 0, amount: 0 });
    return periods.get(key);
  };

  for (const m of members) {
    const { events, credits } = await computeEarnings(m.id);
    const row = { id: m.id, name: nameOf(m), handle: handleOf(m), link: profileLink(m.id), coins: 0, gems: 0, amount: 0 };
    for (const e of events) {
      if (e.source !== service || !inRange(e.at)) continue;
      const b = bucket(keyOf(e.at));
      b.coins += e.coins; b.gems += e.gems;
      row.coins += e.coins; row.gems += e.gems;
    }
    for (const c of credits) {
      if (c.source !== service || !inRange(c.achieved_at)) continue;
      bucket(keyOf(c.achieved_at)).amount += c.amount;
      row.amount += c.amount;
    }
    if (row.coins || row.gems || row.amount) byProfile.push({ ...row, amount: r2(row.amount) });
  }

  const rows = [...periods.values()].map(p => ({ ...p, amount: r2(p.amount) })).sort((a, b) => b.period.localeCompare(a.period));
  const totals = rows.reduce(
    (t, p) => ({ coins: t.coins + p.coins, gems: t.gems + p.gems, amount: r2(t.amount + p.amount) }),
    { coins: 0, gems: 0, amount: 0 }
  );
  return { totals, rows, by_profile: byProfile.sort((a, b) => b.coins - a.coins) };
}

// ── Wallet ────────────────────────────────────────────────────────────────────

const recharges = (rows) => rows.map(t => ({
  transaction_id: t.txn_code,
  user_name: t.user_name || '—',
  handle: t.user_handle || '—',
  uid: t.user_id,
  profile_link: t.user_id ? profileLink(t.user_id) : null,
  coins: Number(t.coins),
  slab_coins: Number(t.slab_coins),
  extra_coins: Number(t.extra_coins),
  created_at: t.created_at,
  status: 'Success',
}));

/** Agency-to-user recharges in an IST date range, newest first. */
async function listRecharges(agencyId, { from, to }) {
  const r = await db.query(
    `SELECT txn_code, user_id, user_name, user_handle, coins, slab_coins, extra_coins, created_at
     FROM agency_wallet_transactions
     WHERE agency_id = $1 AND type = 'user_recharge'
       AND (created_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN $2::date AND $3::date
     ORDER BY created_at DESC`,
    [agencyId, from, to]
  );
  return recharges(r.rows);
}

async function listLedger(agencyId, limit = 300) {
  const r = await db.query(
    `SELECT txn_code, type, coins, slab_coins, extra_coins, balance_after, user_handle, user_name, note, created_at
     FROM agency_wallet_transactions WHERE agency_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [agencyId, limit]
  );
  return r.rows.map(t => ({
    transaction_id: t.txn_code,
    type: t.type,
    direction: t.type === 'official_credit' ? 'in' : 'out',
    coins: Number(t.coins),
    balance_after: Number(t.balance_after),
    party: t.type === 'official_credit' ? 'RaRa Live Official' : (t.user_handle || t.user_name || 'User'),
    note: t.note,
    created_at: t.created_at,
  }));
}

// ── Support ───────────────────────────────────────────────────────────────────

async function listTickets(agencyId) {
  const r = await db.query(
    `SELECT id, subject, message, status, admin_reply, created_at, resolved_at
     FROM agency_support_tickets WHERE agency_id = $1 ORDER BY created_at DESC`,
    [agencyId]
  );
  return r.rows;
}

async function createTicket(agencyId, subject, message) {
  const r = await db.query(
    `INSERT INTO agency_support_tickets (agency_id, subject, message) VALUES ($1, $2, $3)
     RETURNING id, subject, message, status, admin_reply, created_at, resolved_at`,
    [agencyId, subject, message]
  );
  return r.rows[0];
}

module.exports = {
  SERVICES, SERVICE_LABEL, ensureTables, audit,
  getSessionAgency, getActivePoc, pocHasAgency,
  getDashboard, getOnboarding, syncDocuments, getDocumentFile,
  getServiceActivity, getGifting, listRecharges, listLedger,
  listTickets, createTicket, istDay,
};
