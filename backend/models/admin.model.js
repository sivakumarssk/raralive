const db = require('../config/db');

async function findByEmail(email) {
  const result = await db.query(
    `SELECT id, email, password_hash, full_name, role, is_active, created_at
     FROM admins WHERE email = $1`,
    [email]
  );
  return result.rows[0] || null;
}

async function createAdmin({ email, passwordHash, fullName, role = 'admin' }) {
  const result = await db.query(
    `INSERT INTO admins (email, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, full_name, role, is_active, created_at`,
    [email, passwordHash, fullName || null, role]
  );
  return result.rows[0];
}

module.exports = { findByEmail, createAdmin };
