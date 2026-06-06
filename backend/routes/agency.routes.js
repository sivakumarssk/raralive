const express = require('express');
const path = require('path');
const multer = require('multer');
const { authenticateAdmin } = require('../middleware/auth.middleware');
const agencyController = require('../controllers/agency.controller');

const router = express.Router();

// Store documents in uploads/agencies/<agency-phone>/<fieldname>-<timestamp>.ext
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.join(__dirname, '..', 'uploads', 'agencies');
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = file.fieldname.replace(/[^a-z0-9]/gi, '_');
    cb(null, `${safe}-${Date.now()}${ext}`);
  },
});

const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter(_req, file, cb) {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WEBP, and PDF files are allowed.'));
    }
  },
});

const docUpload = upload.fields([
  { name: 'docAadhar', maxCount: 1 },
  { name: 'docPan', maxCount: 1 },
  { name: 'docBank', maxCount: 1 },
]);

router.post('/', authenticateAdmin, docUpload, agencyController.createAgency);
router.get('/', authenticateAdmin, agencyController.listAgencies);
router.get('/:id', authenticateAdmin, agencyController.getAgency);
router.patch('/:id', authenticateAdmin, agencyController.updateAgency);
router.patch('/:id/status', authenticateAdmin, agencyController.updateAgencyStatus);
router.post('/:id/reset-password', authenticateAdmin, agencyController.adminResetAgencyPassword);

module.exports = router;
