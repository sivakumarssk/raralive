const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const agencyModel = require('../models/agency.model');

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

module.exports = { validateAgentCode, loginAgency, resetPassword };
