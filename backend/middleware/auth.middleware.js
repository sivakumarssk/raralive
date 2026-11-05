const jwt = require('jsonwebtoken');
const sessions = require('../utils/session-version');

const SESSION_REVOKED = {
  success: false,
  code: 'SESSION_REVOKED',
  message: 'You have been logged out. Please log in again.',
};

/**
 * Verifies an app-user token: signature, expiry, and that the session wasn't
 * revoked by "log out of all devices". Returns the payload, or null.
 * Admin/agency tokens (they carry `type`) keep their old pass-through.
 */
async function verifyUserToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return { payload: null, revoked: false };
  }
  // Single-purpose tokens (password reset) are never a login session.
  if (payload.purpose) return { payload: null, revoked: false };
  if (payload.type) return { payload, revoked: false };
  if (!(await sessions.isTokenCurrent(payload))) return { payload: null, revoked: true };
  return { payload, revoked: false };
}

async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Missing or invalid authorization header.' });
  }

  try {
    const { payload, revoked } = await verifyUserToken(header.slice(7));
    if (revoked) return res.status(401).json(SESSION_REVOKED);
    if (!payload) return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
    req.user = { id: payload.sub, role: payload.role || 'user' };
    next();
  } catch (err) {
    next(err);
  }
}

function authenticateAdmin(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Missing or invalid authorization header.' });
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.type !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required.' });
    }
    req.admin = { id: payload.sub, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
}

function authenticateAgency(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Missing or invalid authorization header.' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.type !== 'agency') {
      return res.status(403).json({ success: false, message: 'Agency access required.' });
    }
    req.agency = { id: payload.sub, agentCode: payload.agentCode };
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
}

async function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return next();
  try {
    const { payload } = await verifyUserToken(header.slice(7));
    if (payload) req.user = { id: payload.sub, role: payload.role || 'user' };
  } catch { /* treat as signed out */ }
  next();
}

module.exports = { authenticate, authenticateAdmin, authenticateAgency, optionalAuth, verifyUserToken };
