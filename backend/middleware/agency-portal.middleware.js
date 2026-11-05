const jwt = require('jsonwebtoken');
const portal = require('../models/agency-portal.model');

const deny = (res, status, message) => res.status(status).json({ success: false, message });

/**
 * Every Agency Portal request. Accepts an AGENCY or POC token and resolves the
 * one agency the session may act on into req.portal — handlers use that id and
 * nothing from the request, so one agency can never reach another's data.
 *
 * Status is re-read on each request: a token stays valid for hours, and a
 * suspension or removed POC assignment must take effect immediately.
 */
async function authenticatePortal(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return deny(res, 401, 'Missing or invalid authorization header.');

  let payload;
  try {
    payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
  } catch {
    return deny(res, 401, 'Invalid or expired token.');
  }

  try {
    if (payload.type === 'agency') {
      const agency = await portal.getSessionAgency(payload.sub);
      if (!agency) return deny(res, 401, 'Invalid or expired token.');
      if (agency.status === 'suspended') return deny(res, 403, 'This agency account has been suspended. Contact admin.');
      if (agency.is_default_password) return deny(res, 403, 'Change your default password first.');
      req.portal = { role: 'AGENCY', agency, actorType: 'agency', actorId: agency.id };
      return next();
    }

    if (payload.type === 'poc') {
      const poc = await portal.getActivePoc(payload.sub);
      if (!poc) return deny(res, 401, 'Invalid or expired token.');
      req.poc = poc;
      const agencyId = req.headers['x-agency-id'];
      if (!agencyId) return next(); // POC-level routes (their agency list)
      if (!(await portal.pocHasAgency(poc.id, agencyId))) return deny(res, 403, 'This agency is not assigned to you.');
      const agency = await portal.getSessionAgency(agencyId);
      if (!agency) return deny(res, 404, 'Agency not found.');
      req.portal = { role: 'POC', agency, actorType: 'poc', actorId: poc.id };
      return next();
    }

    return deny(res, 403, 'Agency access required.');
  } catch (err) {
    return next(err);
  }
}

/** The route acts on one agency — a POC must have picked one. */
function requireAgencyContext(req, res, next) {
  if (!req.portal) return deny(res, 400, 'Select an agency first.');
  next();
}

/** Financial actions and data: the agency itself only, never a POC. */
function agencyOnly(req, res, next) {
  if (req.portal?.role !== 'AGENCY') return deny(res, 403, 'Only the agency can access this.');
  next();
}

module.exports = { authenticatePortal, requireAgencyContext, agencyOnly };
