const express = require('express');
const { authenticateAdmin } = require('../middleware/auth.middleware');
const { authenticatePortal, requireAgencyContext, agencyOnly } = require('../middleware/agency-portal.middleware');
const ctrl = require('../controllers/agency-portal.controller');

// Agency Portal. Permissions live here, on the server, not in the web UI:
//   agency  — its own data, plus wallet and recharge
//   poc     — assigned agencies only, no wallet/financial access
//   admin   — system-level control (the /admin routes)
// Agencies have no route to delete or suspend anything, change coin value,
// slabs or commission, touch another wallet, or read OTPs or passwords.

const router = express.Router();

router.post('/poc/login', ctrl.pocLogin);

// ── Admin / Official (a portal token is rejected here) ───────────────────────
router.get('/admin/pocs', authenticateAdmin, ctrl.adminListPocs);
router.post('/admin/pocs', authenticateAdmin, ctrl.adminCreatePoc);
router.patch('/admin/pocs/:id', authenticateAdmin, ctrl.adminUpdatePoc);
router.get('/admin/agencies/:id/documents', authenticateAdmin, ctrl.adminListDocuments);
router.patch('/admin/documents/:id', authenticateAdmin, ctrl.adminReviewDocument);
router.get('/admin/tickets', authenticateAdmin, ctrl.adminListTickets);
router.patch('/admin/tickets/:id', authenticateAdmin, ctrl.adminResolveTicket);
router.get('/admin/audit', authenticateAdmin, ctrl.adminAuditLog);

// ── Agency and POC ────────────────────────────────────────────────────────────
router.use(authenticatePortal);

router.get('/poc/agencies', ctrl.pocAgencies);

router.use(requireAgencyContext);

router.get('/dashboard', ctrl.dashboard);
router.get('/onboarding', ctrl.onboarding);
router.get('/documents/:id/file', ctrl.documentFile);
router.get('/services/:service', ctrl.serviceActivity);
router.get('/services/:service/gifting', ctrl.serviceGifting);
router.get('/reports/:type', ctrl.report);
router.get('/reports/:type/export', ctrl.reportExport);
router.get('/support', ctrl.listSupport);
router.post('/support', ctrl.createSupport);

// ── Financial: the agency itself only ────────────────────────────────────────
router.get('/wallet', agencyOnly, ctrl.wallet);
router.get('/wallet/lookup', agencyOnly, ctrl.lookupUser);
router.post('/wallet/recharge', agencyOnly, ctrl.recharge);
router.get('/wallet/recharges', agencyOnly, ctrl.rechargeHistory);
router.post('/wallet/requests', agencyOnly, ctrl.requestCoins);

module.exports = router;
