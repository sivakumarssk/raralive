const bcrypt = require('bcryptjs');
const db = require('../config/db');
const jwt = require('jsonwebtoken');
const agencyModel = require('../models/agency.model');
const userModel = require('../models/user.model');

function signAgencyToken(agencyId, agentCode) {
  return jwt.sign(
    { sub: agencyId, agentCode, type: 'agency' },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );
}

/** GET /api/agency/validate/:code — public, check if agent code exists */
async function validateAgentCode(req, res, next) {
  try {
    const { code } = req.params;
    const agency = await agencyModel.findByAgentCode(code.toUpperCase());
    if (!agency) {
      return res.status(404).json({ success: false, message: 'Agency not found.' });
    }
    if (agency.status === 'suspended') {
      return res.status(403).json({ success: false, message: 'This agency account has been suspended.' });
    }
    return res.json({
      success: true,
      data: {
        agentCode: agency.agent_code,
        agencyName: agency.agency_name,
      },
    });
  } catch (error) {
    next(error);
  }
}

/** POST /api/agency/login — agency login with phone + password */
async function loginAgency(req, res, next) {
  try {
    const { agentCode, phone, password } = req.body;

    if (!agentCode || !phone || !password) {
      return res.status(400).json({ success: false, message: 'Agent code, phone and password are required.' });
    }

    const agency = await agencyModel.findByAgentCode(agentCode.toUpperCase());
    if (!agency) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    if (agency.status === 'suspended') {
      return res.status(403).json({ success: false, message: 'This agency account has been suspended. Contact admin.' });
    }

    if (agency.phone !== phone.trim()) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const valid = await bcrypt.compare(password, agency.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const token = signAgencyToken(agency.id, agency.agent_code);

    return res.json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        isDefaultPassword: agency.is_default_password,
        agency: {
          id: agency.id,
          agencyName: agency.agency_name,
          agentCode: agency.agent_code,
          phone: agency.phone,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/** POST /api/agency/reset-password — set new password (requires agency JWT) */
async function resetPassword(req, res, next) {
  try {
    const { newPassword, confirmPassword } = req.body;

    if (!newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'New password and confirmation are required.' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    // Check it's not the same as current plain_password
    const agency = await agencyModel.findByAgentCode(req.agency.agentCode);
    if (!agency) {
      return res.status(404).json({ success: false, message: 'Agency not found.' });
    }
    if (newPassword === agency.plain_password) {
      return res.status(400).json({ success: false, message: 'New password must be different from your current password.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await agencyModel.resetAgencyPassword(req.agency.id, passwordHash, newPassword);

    // Keep the app-login password in sync — same credentials must work for
    // both the agency panel and the regular app login (see linkAgencyUser()).
    await userModel.linkAgencyUser({
      agencyId: agency.id,
      phone: agency.phone,
      passwordHash,
      fullName: null,
    });

    // Return new token (still same session, now not default password)
    const token = signAgencyToken(req.agency.id, req.agency.agentCode);

    return res.json({
      success: true,
      message: 'Password updated successfully.',
      data: { token, isDefaultPassword: false },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/agency/public/:id: agency profile for the app (logged-in users).
 * Only profile-safe fields: never KYC numbers, documents, bank or password data.
 * app_user_id is the agency's own app account (users.role = 'agency'), used by
 * the app's "Message" button; null if the agency has never logged into the app.
 * avatar_url / cover_url come from that account's profile (null = not set, the
 * app then falls back to its default logo + banner colors).
 */
async function getPublicAgencyProfile(req, res, next) {
  try {
    const { id } = req.params;
    const r = await db.query(
      `SELECT a.id, a.agency_name, a.agent_code, a.email, a.phone, a.person_name,
              a.status, a.service_access, a.created_at,
              au.id AS app_user_id, au.avatar_url, au.cover_url
       FROM agencies a
       LEFT JOIN LATERAL (
         SELECT u.id, u.avatar_url, u.cover_url FROM users u
         WHERE u.agency_id = a.id AND u.role = 'agency'
         ORDER BY u.created_at LIMIT 1
       ) au ON TRUE
       WHERE a.id = $1`,
      [id]
    );
    if (!r.rows.length) {
      return res.status(404).json({ success: false, message: 'Agency not found.' });
    }
    return res.json({ success: true, data: r.rows[0] });
  } catch (error) {
    next(error);
  }
}

module.exports = { validateAgentCode, loginAgency, resetPassword, getPublicAgencyProfile };
