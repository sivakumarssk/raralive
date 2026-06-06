const db = require('../config/db');

async function findByAgencyName(agencyName) {
  const result = await db.query(
    `SELECT id FROM agencies WHERE LOWER(agency_name) = LOWER($1)`,
    [agencyName]
  );
  return result.rows[0] || null;
}

async function findByEmail(email) {
  const result = await db.query(
    `SELECT id FROM agencies WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  return result.rows[0] || null;
}

async function findByPhone(phone) {
  const result = await db.query(
    `SELECT id FROM agencies WHERE phone = $1`,
    [phone]
  );
  return result.rows[0] || null;
}

async function findByAgentCode(agentCode) {
  const result = await db.query(
    `SELECT id, agency_name, agent_code, password_hash, plain_password, is_default_password, status, phone
     FROM agencies WHERE agent_code = $1`,
    [agentCode]
  );
  return result.rows[0] || null;
}

async function resetAgencyPassword(id, passwordHash, plainPassword) {
  await db.query(
    `UPDATE agencies SET
      password_hash = $2, plain_password = $3,
      is_default_password = FALSE, updated_at = NOW()
     WHERE id = $1`,
    [id, passwordHash, plainPassword]
  );
}

async function createAgency({
  agencyName, personName, age, email, phone, address,
  aadharNumber, panNumber, bankAccount, bankIfsc,
  bankHolderName, bankName,
  docAadharUrl, docPanUrl, docBankUrl,
  agentCode, passwordHash, plainPassword, createdBy,
}) {
  const result = await db.query(
    `INSERT INTO agencies (
      agency_name, person_name, age, email, phone, address,
      aadhar_number, pan_number, bank_account, bank_ifsc,
      bank_holder_name, bank_name,
      doc_aadhar_url, doc_pan_url, doc_bank_url,
      agent_code, password_hash, plain_password, created_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
    RETURNING
      id, agency_name, person_name, age, email, phone, address,
      aadhar_number, pan_number, bank_account, bank_ifsc,
      bank_holder_name, bank_name,
      doc_aadhar_url, doc_pan_url, doc_bank_url,
      agent_code, plain_password, status, created_at`,
    [
      agencyName, personName, age, email, phone, address,
      aadharNumber, panNumber, bankAccount, bankIfsc || null,
      bankHolderName || null, bankName || null,
      docAadharUrl || null, docPanUrl || null, docBankUrl || null,
      agentCode, passwordHash, plainPassword, createdBy || null,
    ]
  );
  return result.rows[0];
}

async function listAgencies({ limit = 50, offset = 0, search = '' }) {
  const searchParam = `%${search}%`;
  const result = await db.query(
    `SELECT
      id, agency_name, person_name, age, email, phone,
      agent_code, status, created_at
     FROM agencies
     WHERE ($1 = '' OR agency_name ILIKE $2 OR person_name ILIKE $2 OR agent_code ILIKE $2 OR phone ILIKE $2)
     ORDER BY created_at DESC
     LIMIT $3 OFFSET $4`,
    [search, searchParam, limit, offset]
  );
  const count = await db.query(
    `SELECT COUNT(*) FROM agencies
     WHERE ($1 = '' OR agency_name ILIKE $2 OR person_name ILIKE $2 OR agent_code ILIKE $2 OR phone ILIKE $2)`,
    [search, searchParam]
  );
  return { rows: result.rows, total: parseInt(count.rows[0].count, 10) };
}

async function getAgencyById(id) {
  const result = await db.query(
    `SELECT
      id, agency_name, person_name, age, email, phone, address,
      aadhar_number, pan_number, bank_account, bank_ifsc,
      bank_holder_name, bank_name,
      doc_aadhar_url, doc_pan_url, doc_bank_url,
      agent_code, plain_password, status, created_by, created_at, updated_at
     FROM agencies WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function updateAgencyDetails(id, { personName, age, email, phone, address, bankIfsc }) {
  const result = await db.query(
    `UPDATE agencies SET
      person_name   = COALESCE($2, person_name),
      age           = COALESCE($3, age),
      email         = COALESCE($4, email),
      phone         = COALESCE($5, phone),
      address       = COALESCE($6, address),
      bank_ifsc     = COALESCE($7, bank_ifsc),
      updated_at    = NOW()
     WHERE id = $1
     RETURNING
      id, agency_name, person_name, age, email, phone, address,
      aadhar_number, pan_number, bank_account, bank_ifsc,
      agent_code, plain_password, status, created_at, updated_at`,
    [id, personName || null, age || null, email || null, phone || null, address || null, bankIfsc || null]
  );
  return result.rows[0] || null;
}

async function updateAgencyStatus(id, status) {
  const result = await db.query(
    `UPDATE agencies SET status = $1, updated_at = NOW()
     WHERE id = $2 RETURNING id, agency_name, status`,
    [status, id]
  );
  return result.rows[0] || null;
}

module.exports = {
  findByAgencyName, findByEmail, findByPhone, findByAgentCode,
  createAgency, listAgencies, getAgencyById, updateAgencyDetails, updateAgencyStatus,
  resetAgencyPassword,
};
