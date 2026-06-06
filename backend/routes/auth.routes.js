const express = require('express');
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { upload } = require('../middleware/upload.middleware');

const router = express.Router();

// Public
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/verify-otp', authController.verifyOtp);
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-reset-otp', authController.verifyResetOtp);
router.post('/reset-password', authController.resetPassword);

// Protected — profile accepts optional avatar file
router.get('/me', authenticate, authController.getMe);
router.patch('/profile', authenticate, upload.single('avatar'), authController.completeProfile);
router.patch('/language', authenticate, authController.setLanguage);

module.exports = router;
